// import { Router, Response }          from 'express'
// import { authenticate, AuthRequest } from '../middleware/auth'
// import Job                           from '../models/Job'
// import { replicateService }          from '../services/replicate'

// const router = Router()
// router.use(authenticate)

// // ── GET /jobs ─────────────────────────────────────────────
// router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const page   = parseInt(req.query.page  as string) || 1
//     const limit  = parseInt(req.query.limit as string) || 20
//     const type   = req.query.type   as string | undefined
//     const status = req.query.status as string | undefined

//     const query: any = { userId: req.user!._id }
//     if (type)   query.type   = type.toUpperCase()
//     if (status) query.status = status.toUpperCase()

//     const [jobs, total] = await Promise.all([
//       Job.find(query)
//         .sort({ createdAt: -1 })
//         .skip((page - 1) * limit)
//         .limit(limit)
//         .lean(),
//       Job.countDocuments(query),
//     ])

//     res.json({
//       jobs,
//       pagination: {
//         page,
//         limit,
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     })
//   } catch (err: any) {
//     res.status(500).json({ error: err.message })
//   }
// })

// // ── GET /jobs/:id ─────────────────────────────────────────
// router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const job = await Job.findOne({
//       _id:    req.params.id,
//       userId: req.user!._id,
//     })

//     if (!job) {
//       res.status(404).json({ error: 'Job not found' })
//       return
//     }

//     // Poll Replicate if still processing
//     if (
//       job.replicateId &&
//       (job.status === 'PENDING' || job.status === 'PROCESSING')
//     ) {
//       try {
//         const replicateJob = await replicateService.pollJob(job.replicateId)

//         if (replicateJob.status === 'succeeded') {
//           const output    = replicateJob.output
//           const outputUrl = Array.isArray(output) ? output[0] : output as string

//           await Job.findByIdAndUpdate(job._id, {
//             status:    'COMPLETED',
//             outputUrl: outputUrl,
//           })

//           job.status    = 'COMPLETED'
//           job.outputUrl = outputUrl

//         } else if (
//           replicateJob.status === 'failed' ||
//           replicateJob.status === 'canceled'
//         ) {
//           await Job.findByIdAndUpdate(job._id, {
//             status:       'FAILED',
//             errorMessage: replicateJob.error || 'Generation failed',
//           })

//           job.status       = 'FAILED'
//           job.errorMessage = replicateJob.error || 'Generation failed'

//         } else if (replicateJob.status === 'processing') {
//           await Job.findByIdAndUpdate(job._id, { status: 'PROCESSING' })
//           job.status = 'PROCESSING'
//         }

//       } catch (pollErr: any) {
//         console.error('Replicate poll error:', pollErr.message)
//       }
//     }

//     res.json({ job })
//   } catch (err: any) {
//     res.status(500).json({ error: err.message })
//   }
// })

// export default router

import { Router, Response }                from 'express'
import { authenticate, AuthRequest }       from '../middleware/auth'
import Job                                 from '../models/Job'
import { replicateService }               from '../services/replicate'
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

    // Poll Replicate if still processing
    if (
      job.replicateId &&
      (job.status === 'PENDING' || job.status === 'PROCESSING')
    ) {
      try {
        const replicateJob = await replicateService.pollJob(job.replicateId)

        if (replicateJob.status === 'succeeded') {
          const output    = replicateJob.output
          const outputUrl = Array.isArray(output) ? output[0] : output as string

          // Save COMPLETED status immediately
          await Job.findByIdAndUpdate(job._id, {
            status:    'COMPLETED',
            outputUrl: outputUrl,
          })

          job.status    = 'COMPLETED'
          job.outputUrl = outputUrl

          // R2 upload in background — uses setImmediate so it
          // never blocks or affects the response
          if (job.type === 'IMAGE' && outputUrl && job.storageProvider !== 'r2') {
            setImmediate(() => {
              processImageJob(
                job._id.toString(),
                job.userId.toString(),
                outputUrl
              ).catch(err => console.error('R2 image failed:', err.message))
            })
          } else if (job.type === 'VIDEO' && outputUrl && job.storageProvider !== 'r2') {
            setImmediate(() => {
              processVideoJob(
                job._id.toString(),
                job.userId.toString(),
                outputUrl
              ).catch(err => console.error('R2 video failed:', err.message))
            })
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