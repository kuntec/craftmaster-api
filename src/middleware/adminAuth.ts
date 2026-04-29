import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User'

export interface AdminRequest extends Request {
  admin?: {
    id:    string
    email: string
    role:  string
  }
}

export const adminAuthenticate = async (
  req:  AdminRequest,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Admin token required' })
      return
    }

    const token = authHeader.split(' ')[1]
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET!

    const decoded = jwt.verify(token, secret) as {
      id:    string
      email: string
      role:  string
    }

    if (decoded.role !== 'SUPERADMIN') {
      res.status(403).json({ error: 'Superadmin access required' })
      return
    }

    req.admin = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired admin token' })
  }
}