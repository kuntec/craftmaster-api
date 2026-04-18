import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { creditsService } from '../services/credits'

const router = Router()

// All routes require auth
router.use(authenticate)

// ── GET /credits/balance ─────────────────────────────────
router.get('/balance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const balance = await creditsService.getBalance(req.user!._id.toString())
    res.json({ balance })
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
})

// ── GET /credits/history ─────────────────────────────────
router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page  = parseInt(req.query.page as string)  || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await creditsService.getHistory(
      req.user!._id.toString(),
      page,
      limit
    )
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /credits/packages ────────────────────────────────
router.get('/packages', (_req: AuthRequest, res: Response): void => {
  res.json({
    packages: [
      { credits: 100,  price: 5,  label: 'Starter Pack',  description: '~25 images' },
      { credits: 250,  price: 10, label: 'Creator Pack',  description: '~62 images', badge: 'Popular' },
      { credits: 600,  price: 20, label: 'Pro Pack',      description: '~150 images', badge: 'Best value' },
      { credits: 1500, price: 40, label: 'Studio Pack',   description: '~375 images' },
    ],
    costs: {
      image:   4,
      video:   40,
      website: 20,
    },
  })
})

export default router