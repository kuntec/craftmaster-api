import { Router, Response }          from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import Job                           from '../models/Job'
import User                          from '../models/User'
import CreditTransaction             from '../models/CreditTransaction'
import { replicateService }          from '../services/replicate'
import { processImageJob }           from '../services/fileProcessor'

const router = Router()
router.use(authenticate)

const CREDITS_IMAGE = parseInt(process.env.CREDITS_IMAGE || '4')

// ── POST /image/generate ──────────────────────────────────
router.post('/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { prompt, width = 1024, height = 1024 } = req.body

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Prompt is required' })
      return
    }

    // Check credits
    const freshUser = await User.findById(req.user!._id).select('creditsBalance')
    if (!freshUser || freshUser.creditsBalance < CREDITS_IMAGE) {
      res.status(402).json({
        error:    'Insufficient credits',
        required: CREDITS_IMAGE,
        balance:  freshUser?.creditsBalance ?? 0,
      })
      return
    }

    // Create job
    const job = await Job.create({
      userId:      req.user!._id,
      type:        'IMAGE',
      status:      'PROCESSING',
      prompt:      prompt.trim(),
      parameters:  { width, height },
      creditsUsed: CREDITS_IMAGE,
    })

    // Deduct credits
    await User.findByIdAndUpdate(req.user!._id, {
      $inc: { creditsBalance: -CREDITS_IMAGE },
    })

    await CreditTransaction.create({
      userId:      req.user!._id,
      amount:      -CREDITS_IMAGE,
      type:        'USAGE',
      description: `Image generation: "${prompt.trim().slice(0, 50)}"`,
    })

    // Start Replicate job using existing service
    const replicateId = await replicateService.createImageJob(
      prompt.trim(),
      width,
      height
    )

    // Update job with Replicate ID
    await Job.findByIdAndUpdate(job._id, {
      replicateId,
      status: 'PROCESSING',
    })

    res.status(202).json({
      job: {
        ...job.toObject(),
        replicateId,
      },
      replicateId,
      message: 'Image generation started. Poll /jobs/:id for status.',
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /image/sizes ──────────────────────────────────────
router.get('/sizes', (_req: AuthRequest, res: Response): void => {
  res.json({
    sizes: [
      { label: 'Square (1:1)',      width: 1024, height: 1024 },
      { label: 'Portrait (2:3)',    width: 768,  height: 1152 },
      { label: 'Landscape (3:2)',   width: 1152, height: 768  },
      { label: 'Widescreen (16:9)', width: 1280, height: 720  },
    ],
    cost: CREDITS_IMAGE,
  })
})

export default router