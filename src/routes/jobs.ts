import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { replicateService } from '../services/replicate'
import Job from '../models/Job'

const router = Router()

router.use(authenticate)

// ── GET /jobs ─────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page   = parseInt(req.query.page  as string) || 1
    const limit  = parseInt(req.query.limit as string) || 20
    const type   = req.query.type   as string | undefined
    const status = req.query.status as string | undefined
    const skip   = (page - 1) * limit

    const filter: any = { userId: req.user!._id }
    if (type)   filter.type   = type
    if (status) filter.status = status

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(filter),
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

// ── GET /jobs/:id ─────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await Job.findOne({
      _id:    req.params.id,
      userId: req.user!._id,
    })

    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    // If still processing — sync with Replicate
    if (
      job.replicateId &&
      (job.status === 'PENDING' || job.status === 'PROCESSING')
    ) {
      const result = await replicateService.pollJob(job.replicateId)

      if (result.status === 'succeeded') {
        const outputUrl = Array.isArray(result.output)
          ? result.output[0]
          : result.output

        await Job.findByIdAndUpdate(job._id, {
          status:      'COMPLETED',
          outputUrl,
          completedAt: new Date(),
        })

        job.status    = 'COMPLETED'
        job.outputUrl = outputUrl
      } else if (
        result.status === 'failed' ||
        result.status === 'canceled'
      ) {
        await Job.findByIdAndUpdate(job._id, {
          status:       'FAILED',
          errorMessage: result.error || 'Generation failed',
          completedAt:  new Date(),
        })

        job.status       = 'FAILED'
        job.errorMessage = result.error || 'Generation failed'
      } else {
        job.status = 'PROCESSING'
      }
    }

    res.json({ job })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router