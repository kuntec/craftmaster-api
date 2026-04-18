import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../config/jwt'
import User, { IUser } from '../models/User'

export interface AuthRequest extends Request {
  user?: IUser
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyToken(token)

    const user = await User.findById(decoded.userId).select('-passwordHash')
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid or inactive account' })
      return
    }

    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export const requireCredits = (amount: number) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    if (req.user.creditsBalance < amount) {
      res.status(402).json({
        error: 'Insufficient credits',
        required: amount,
        balance: req.user.creditsBalance,
      })
      return
    }
    next()
  }
}