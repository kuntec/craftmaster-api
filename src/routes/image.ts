import { Router, Response } from 'express'
import { authenticate, requireCredits, AuthRequest } from '../middleware/auth'
import { creditsService } from '../services/credits'
import { replicateService } from '../services/replicate'
import Job from '../models/Job'

const router = Router()

const CREDITS_IMAGE = parseInt(process.env.CREDITS_IMAGE || '4')

const VALID_SIZES = [
  { width: 1024, height: 1024 },
  { width: 768,  height: 1152 },
  { width: 1152, height: 768  },
  { width: 1280, height: 720  },
]

// ── POST /image/generate ─────────────────────────────────
router.post(
  '/generate',
  authenticate,
  requireCredits(CREDITS_IMAGE),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { prompt, width = 1024, height = 1024 } = req.body

      // Validate prompt
      if (!prompt || prompt.trim().length < 3) {
        res.status(400).json({ error: 'Prompt must be at least 3 characters' })
        return
      }

      // Validate size
      const validSize = VALID_SIZES.find(
        (s) => s.width === width && s.height === height
      )
      if (!validSize) {
        res.status(400).json({
          error: 'Invalid size',
          validSizes: VALID_SIZES,
        })
        return
      }

      // Create job in DB
      const job = await Job.create({
        userId:      req.user!._id,
        type:        'IMAGE',
        status:      'PENDING',
        prompt:      prompt.trim(),
        parameters:  { width, height },
        creditsUsed: CREDITS_IMAGE,
      })

      // Deduct credits
      await creditsService.deduct(
        req.user!._id.toString(),
        CREDITS_IMAGE,
        `Image generation: "${prompt.trim().slice(0, 50)}"`,
        job._id
      )

      // Start Replicate job
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
        message: 'Image generation started',
        jobId: job._id,
        replicateId,
        creditsUsed: CREDITS_IMAGE,
        pollUrl: `/jobs/${job._id}`,
      })
    } catch (err: any) {
      console.error('Image generation error:', err.message)
      res.status(500).json({ error: err.message || 'Image generation failed' })
    }
  }
)

// ── GET /image/sizes ─────────────────────────────────────
router.get('/sizes', (_req, res) => {
  res.json({
    sizes: [
      { label: 'Square (1:1)',      width: 1024, height: 1024 },
      { label: 'Portrait (2:3)',    width: 768,  height: 1152 },
      { label: 'Landscape (3:2)',   width: 1152, height: 768  },
      { label: 'Widescreen (16:9)', width: 1280, height: 720  },
    ],
    credits: CREDITS_IMAGE,
  })
})

export default router