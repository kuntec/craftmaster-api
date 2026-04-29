import { Router, Response } from 'express'
import { AdminRequest, adminAuthenticate } from '../../middleware/adminAuth'
import User              from '../../models/User'
import Job               from '../../models/Job'
import CreditTransaction from '../../models/CreditTransaction'
import mongoose from 'mongoose'

const router = Router()
router.use(adminAuthenticate)

// ── GET /admin/users ──────────────────────────────────────
router.get('/', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const page     = parseInt(req.query.page as string)   || 1
    const limit    = parseInt(req.query.limit as string)  || 20
    const search   = req.query.search as string           || ''
    const sortBy   = req.query.sortBy as string           || 'createdAt'
    const sortDir  = req.query.sortDir === 'asc' ? 1 : -1

    const query: any = {}
    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort({ [sortBy]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ])

    // Get total spend per user
    const userIds = users.map(u => u._id)
    const spends  = await CreditTransaction.aggregate([
      { $match: { userId: { $in: userIds }, type: 'TOPUP' } },
      { $group: { _id: '$userId', totalCredits: { $sum: '$amount' } } },
    ])

    const spendMap: Record<string, number> = {}
    spends.forEach(s => { spendMap[s._id.toString()] = s.totalCredits })

    const enriched = users.map(u => ({
      ...u,
      totalSpendCredits: spendMap[u._id.toString()] || 0,
      totalSpendUsd:     +((spendMap[u._id.toString()] || 0) / 20).toFixed(2),
    }))

    res.json({
      users: enriched,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/users/:id ──────────────────────────────────
router.get('/:id', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash').lean()
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const [jobs, transactions] = await Promise.all([
      Job.find({ userId: req.params.id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      CreditTransaction.find({ userId: req.params.id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ])

    const totalSpend = await CreditTransaction.aggregate([
      { $match: { userId: user._id, type: 'TOPUP' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])

    res.json({
      user: {
        ...user,
        totalSpendCredits: totalSpend[0]?.total || 0,
        totalSpendUsd:     +((totalSpend[0]?.total || 0) / 20).toFixed(2),
      },
      recentJobs:         jobs,
      recentTransactions: transactions,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /admin/users/:id/credits ────────────────────────
router.patch('/:id/credits', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { amount, reason } = req.body

    if (!amount || !reason) {
      res.status(400).json({ error: 'Amount and reason required' })
      return
    }

    const user = await User.findById(req.params.id)
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    await User.findByIdAndUpdate(req.params.id, {
      $inc: { creditsBalance: amount },
    })

    await CreditTransaction.create({
      userId:      req.params.id as any,
      amount,
      type:        amount > 0 ? 'FREE_CREDITS' : 'USAGE',
      description: `Admin adjustment: ${reason}`,
    })

    const updated = await User.findById(req.params.id).select('creditsBalance')
    res.json({ success: true, newBalance: updated!.creditsBalance })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /admin/users/:id/ban ────────────────────────────
router.patch('/:id/ban', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    await User.findByIdAndUpdate(req.params.id, {
      isActive: !user.isActive,
    })

    res.json({ success: true, isActive: !user.isActive })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /admin/users/:id ───────────────────────────────
router.delete('/:id', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndDelete(req.params.id)
    await Job.deleteMany({ userId: req.params.id })
    await CreditTransaction.deleteMany({ userId: req.params.id })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router