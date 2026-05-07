import { Router, Response }           from 'express'
import { authenticate, AuthRequest }  from '../middleware/auth'
import Job                            from '../models/Job'
import { processImageJob, processVideoJob } from '../services/fileProcessor'

const router = Router()
router.use(authenticate)

// ── GET /jobs ─────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page   = parseInt(req.query.page  as string) || 1
    const limit  = parseInt(req.query.limit as string) || 20
    const type   = req.query.type   as string | undefined
    const status = req.query.status as string | undefined

    const query: any = { userId: req.user!._id }
    if (type)   query.type   = type.toUpperCase()
    if (status) query.status = status.toUpperCase()

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
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

    // If still processing — poll Replicate for latest status
    if (
      job.replicateId &&
      (job.status === 'PENDING' || job.status === 'PROCESSING')
    ) {
      try {
        const replicateRes = await fetch(
          `https://api.replicate.com/v1/predictions/${job.replicateId}`,
          {
            headers: {
              Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            },
          }
        )

        const replicateJob = await replicateRes.json() as any

        if (replicateJob.status === 'succeeded') {
          const output    = replicateJob.output
          const outputUrl = Array.isArray(output) ? output[0] : output

          await Job.findByIdAndUpdate(job._id, {
            status:    'COMPLETED',
            outputUrl: outputUrl,
          })

          job.status    = 'COMPLETED'
          job.outputUrl = outputUrl

          // Save to R2 in background — don't block response
          if (job.type === 'IMAGE' && outputUrl && job.storageProvider !== 'r2') {
            processImageJob(
              job._id.toString(),
              job.userId.toString(),
              outputUrl
            ).catch(console.error)
          } else if (job.type === 'VIDEO' && outputUrl && job.storageProvider !== 'r2') {
            processVideoJob(
              job._id.toString(),
              job.userId.toString(),
              outputUrl
            ).catch(console.error)
          }

        } else if (
          replicateJob.status === 'failed' ||
          replicateJob.status === 'canceled'
        ) {
          await Job.findByIdAndUpdate(job._id, {
            status:       'FAILED',
            errorMessage: replicateJob.error || 'Generation failed',
          })

          job.status       = 'FAILED'
          job.errorMessage = replicateJob.error || 'Generation failed'

        } else if (replicateJob.status === 'processing') {
          await Job.findByIdAndUpdate(job._id, { status: 'PROCESSING' })
          job.status = 'PROCESSING'
        }
      } catch (pollErr: any) {
        console.error('Replicate poll error:', pollErr.message)
      }
    }

    res.json({ job })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router