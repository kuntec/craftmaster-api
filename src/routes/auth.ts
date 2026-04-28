import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import User from '../models/User'
import CreditTransaction from '../models/CreditTransaction'
import { generateToken } from '../config/jwt'
import { authenticate, AuthRequest } from '../middleware/auth'
import { OAuth2Client } from 'google-auth-library'

const router = Router()

// ── POST /auth/register ──────────────────────────────────
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, referralCode } = req.body

    // Validate
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email and password are required' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }

    // Check existing user
    const existing = await User.findOne({ email })
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const user = await User.create({
      name,
      email,
      passwordHash,
      referralCode: nanoid(8).toUpperCase(),
      creditsBalance: 30,
    })

    // Handle referral
    if (referralCode) {
      const referrer = await User.findOne({ referralCode })
      if (referrer) {
        // Give new user 20 bonus credits
        await User.findByIdAndUpdate(user._id, {
          $inc: { creditsBalance: 20 },
          referredBy: referralCode,
        })
        await CreditTransaction.create({
          userId: user._id,
          amount: 20,
          type: 'REFERRAL_RECEIVE',
          description: 'Referral bonus for signing up',
        })

        // Give referrer 20 credits
        await User.findByIdAndUpdate(referrer._id, {
          $inc: { creditsBalance: 20 },
        })
        await CreditTransaction.create({
          userId: referrer._id,
          amount: 20,
          type: 'REFERRAL_GIVE',
          description: 'Referral reward',
        })
      }
    }

    // Log free credits transaction
    await CreditTransaction.create({
      userId: user._id,
      amount: 30,
      type: 'FREE_CREDITS',
      description: 'Welcome credits',
    })

    const token = generateToken(user._id.toString())

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        creditsBalance: user.creditsBalance,
        referralCode: user.referralCode,
        plan: user.plan,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// ── POST /auth/login ─────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    // Find user with passwordHash
    const user = await User.findOne({ email }).select('+passwordHash')
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    if (!user.isActive) {
      res.status(401).json({ error: 'Account is inactive' })
      return
    }

    // Check password
    const valid = await user.comparePassword(password)
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const token = generateToken(user._id.toString())

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        creditsBalance: user.creditsBalance,
        referralCode: user.referralCode,
        plan: user.plan,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ── POST /auth/google ─────────────────────────────────────
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, referralCode } = req.body

    if (!idToken) {
      res.status(400).json({ error: 'Google ID token is required' })
      return
    }

    // Verify token with Google
    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload?.email) {
      res.status(400).json({ error: 'Invalid Google token' })
      return
    }

    const { email, name, picture: avatarUrl, sub: googleId } = payload

    // Find existing user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] })

    if (!user) {
      // New user — create account
      user = await User.create({
        email,
        name:           name || email.split('@')[0],
        avatarUrl,
        googleId,
        referralCode:   nanoid(8).toUpperCase(),
        creditsBalance: 30,
        plan:           'FREE',
      })

      // Log free credits
      await CreditTransaction.create({
        userId:      user._id,
        amount:      30,
        type:        'FREE_CREDITS',
        description: 'Welcome credits',
      })

      // Apply referral if provided
      if (referralCode) {
        const referrer = await User.findOne({ referralCode })
        if (referrer) {
          await User.findByIdAndUpdate(user._id, {
            $inc:       { creditsBalance: 20 },
            referredBy: referralCode,
          })
          await CreditTransaction.create({
            userId:      user._id,
            amount:      20,
            type:        'REFERRAL_RECEIVE',
            description: 'Referral bonus for signing up',
          })
          await User.findByIdAndUpdate(referrer._id, {
            $inc: { creditsBalance: 20 },
          })
          await CreditTransaction.create({
            userId:      referrer._id,
            amount:      20,
            type:        'REFERRAL_GIVE',
            description: 'Referral reward',
          })
        }
      }
    } else if (!user.googleId) {
      // Existing email user — link Google account
      await User.findByIdAndUpdate(user._id, { googleId, avatarUrl })
    }

    if (!user.isActive) {
      res.status(401).json({ error: 'Account is inactive' })
      return
    }

    // Refetch to get updated credits
    const updatedUser = await User.findById(user._id)

    const token = generateToken(user._id.toString())

    res.json({
      token,
      user: {
        id:             updatedUser!._id,
        name:           updatedUser!.name,
        email:          updatedUser!.email,
        creditsBalance: updatedUser!.creditsBalance,
        referralCode:   updatedUser!.referralCode,
        plan:           updatedUser!.plan,
      },
    })
  } catch (err: any) {
    console.error('Google auth error:', err.message)
    res.status(500).json({ error: 'Google authentication failed' })
  }
})



// ── GET /auth/me ─────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    user: {
      id: req.user!._id,
      name: req.user!.name,
      email: req.user!.email,
      creditsBalance: req.user!.creditsBalance,
      referralCode: req.user!.referralCode,
      plan: req.user!.plan,
      createdAt: req.user!.createdAt,
    },
  })
})

// ── PATCH /auth/profile ──────────────────────────────────
router.patch('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body

    if (!name || name.trim().length < 1) {
      res.status(400).json({ error: 'Name is required' })
      return
    }

    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { name: name.trim() },
      { new: true }
    ).select('-passwordHash')

    res.json({
      message: 'Profile updated',
      user: {
        id:             user!._id,
        name:           user!.name,
        email:          user!.email,
        creditsBalance: user!.creditsBalance,
        referralCode:   user!.referralCode,
        plan:           user!.plan,
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /auth/password ─────────────────────────────────
router.patch('/password', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new password are required' })
      return
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' })
      return
    }

    const user = await User.findById(req.user!._id).select('+passwordHash')
    if (!user || !user.passwordHash) {
      res.status(400).json({ error: 'Cannot change password for OAuth accounts' })
      return
    }

    const valid = await user.comparePassword(currentPassword)
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' })
      return
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12)
    await user.save()

    res.json({ message: 'Password updated successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /auth/account ─────────────────────────────────
router.delete('/account', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.user!._id, { isActive: false })
    res.json({ message: 'Account deactivated successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router