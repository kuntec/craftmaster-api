import { Router, Response } from 'express'
import { AdminRequest, adminAuthenticate } from '../../middleware/adminAuth'
import CreditTransaction from '../../models/CreditTransaction'
import User              from '../../models/User'

const router = Router()
router.use(adminAuthenticate)

// ── GET /admin/payments ───────────────────────────────────
router.get('/', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const page  = parseInt(req.query.page as string)  || 1
    const limit = parseInt(req.query.limit as string) || 20

    const [transactions, total] = await Promise.all([
      CreditTransaction.find({ type: 'TOPUP' })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email')
        .lean(),
      CreditTransaction.countDocuments({ type: 'TOPUP' }),
    ])

    const enriched = transactions.map(t => ({
      ...t,
      usd: +(t.amount / 20).toFixed(2),
    }))

    res.json({
      transactions: enriched,
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

export default router