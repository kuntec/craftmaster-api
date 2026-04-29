import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../../models/User'

const router = Router()

// ── POST /admin/auth/login ────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' })
      return
    }

    // Check against env vars for superadmin
    const adminEmail    = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      res.status(500).json({ error: 'Admin credentials not configured' })
      return
    }

    if (email !== adminEmail || password !== adminPassword) {
      res.status(401).json({ error: 'Invalid admin credentials' })
      return
    }

    // Generate admin JWT
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET!
    const token  = jwt.sign(
      { id: 'superadmin', email, role: 'SUPERADMIN' },
      secret,
      { expiresIn: '24h' }
    )

    res.json({
      token,
      admin: { email, role: 'SUPERADMIN' },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/auth/verify ────────────────────────────────
router.get('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token required' })
      return
    }

    const token  = authHeader.split(' ')[1]
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET!
    const decoded = jwt.verify(token, secret) as { role: string }

    if (decoded.role !== 'SUPERADMIN') {
      res.status(403).json({ error: 'Not superadmin' })
      return
    }

    res.json({ valid: true })
  } catch {
    res.status(401).json({ valid: false })
  }
})

export default router