import mongoose from 'mongoose'
import User from '../models/User'
import CreditTransaction, { TransactionType } from '../models/CreditTransaction'
import { AppError } from '../middleware/errorHandler'

export const creditsService = {

  // Get current balance
  async getBalance(userId: string): Promise<number> {
    const user = await User.findById(userId).select('creditsBalance')
    if (!user) throw new AppError('User not found', 404)
    return user.creditsBalance
  },

  // Deduct credits (atomic)
  async deduct(
    userId: string,
    amount: number,
    description: string,
    jobId?: mongoose.Types.ObjectId
  ): Promise<number> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const user = await User.findById(userId).session(session)
      if (!user) throw new AppError('User not found', 404)
      if (user.creditsBalance < amount) {
        throw new AppError('Insufficient credits', 402, 'INSUFFICIENT_CREDITS')
      }

      user.creditsBalance -= amount
      await user.save({ session })

      await CreditTransaction.create(
        [{
          userId,
          amount: -amount,
          type: 'USAGE' as TransactionType,
          description,
          jobId,
        }],
        { session }
      )

      await session.commitTransaction()
      return user.creditsBalance
    } catch (err) {
      await session.abortTransaction()
      throw err
    } finally {
      session.endSession()
    }
  },

  // Add credits (top up or referral)
  async add(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    stripePaymentId?: string
  ): Promise<number> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const user = await User.findById(userId).session(session)
      if (!user) throw new AppError('User not found', 404)

      user.creditsBalance += amount
      await user.save({ session })

      await CreditTransaction.create(
        [{
          userId,
          amount,
          type,
          description,
          stripePaymentId,
        }],
        { session }
      )

      await session.commitTransaction()
      return user.creditsBalance
    } catch (err) {
      await session.abortTransaction()
      throw err
    } finally {
      session.endSession()
    }
  },

  // Get transaction history
  async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit

    const [transactions, total] = await Promise.all([
      CreditTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CreditTransaction.countDocuments({ userId }),
    ])

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  },
}