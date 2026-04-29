import { Router, Response } from 'express'
import { AdminRequest, adminAuthenticate } from '../../middleware/adminAuth'
import Job from '../../models/Job'

const router = Router()
router.use(adminAuthenticate)

// ── GET /admin/generations ────────────────────────────────
router.get('/', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const page   = parseInt(req.query.page as string)  || 1
    const limit  = parseInt(req.query.limit as string) || 20
    const type   = req.query.type   as string || ''
    const status = req.query.status as string || ''

    const query: any = {}
    if (type)   query.type   = type.toUpperCase()
    if (status) query.status = status.toUpperCase()

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email')
        .lean(),
      Job.countDocuments(query),
    ])

    res.json({
      jobs,
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