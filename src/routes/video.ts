import { Router, Response } from 'express'
import { authenticate, requireCredits, AuthRequest } from '../middleware/auth'
import { creditsService } from '../services/credits'
import { replicateService } from '../services/replicate'
import Job from '../models/Job'
import User from '../models/User'

const router = Router()

const CREDITS_VIDEO = parseInt(process.env.CREDITS_VIDEO || '40')

// ── POST /video/generate ─────────────────────────────────
router.post(
  '/generate',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { prompt, duration = 5 } = req.body

      // Validate prompt
      if (!prompt || prompt.trim().length < 3) {
        res.status(400).json({ error: 'Prompt must be at least 3 characters' })
        return
      }

      // Validate duration
      if (![5, 10].includes(duration)) {
        res.status(400).json({ error: 'Duration must be 5 or 10 seconds' })
        return
      }

      // 10 seconds costs double
      const creditsRequired = duration === 10 ? CREDITS_VIDEO * 2 : CREDITS_VIDEO

      // TEMPORARY DEBUG LOG
    console.log('=== VIDEO DEBUG ===')
    console.log('User ID:', req.user!._id)
    console.log('User balance from token:', req.user!.creditsBalance)
    console.log('Duration:', duration)
    console.log('CREDITS_VIDEO env:', process.env.CREDITS_VIDEO)
    console.log('CREDITS_VIDEO parsed:', CREDITS_VIDEO)
    console.log('Credits required:', creditsRequired)
    console.log('===================')

    // Re-fetch fresh balance directly from DB
    const freshUser = await User.findById(req.user!._id).select('creditsBalance')
    const freshBalance = freshUser?.creditsBalance ?? 0

    console.log('Fresh balance from DB:', freshBalance)
    console.log('Credits required:', creditsRequired)

      // Check credits manually since cost varies
      if (freshBalance < creditsRequired) {
        res.status(402).json({
          error:    'Insufficient credits',
          required: creditsRequired,
          balance:  freshBalance,
        })
        return
      }

      // Create job in DB
      const job = await Job.create({
        userId:      req.user!._id,
        type:        'VIDEO',
        status:      'PENDING',
        prompt:      prompt.trim(),
        parameters:  { duration },
        creditsUsed: creditsRequired,
      })

      // Deduct credits
      await creditsService.deduct(
        req.user!._id.toString(),
        creditsRequired,
        `Video generation (${duration}s): "${prompt.trim().slice(0, 50)}"`,
        job._id
      )

      // Start Replicate job
      const replicateId = await replicateService.createVideoJob(
        prompt.trim(),
        duration
      )

      // Update job with Replicate ID
      await Job.findByIdAndUpdate(job._id, {
        replicateId,
        status: 'PROCESSING',
      })

      res.status(202).json({
        message:      'Video generation started',
        jobId:        job._id,
        replicateId,
        creditsUsed:  creditsRequired,
        duration:     `${duration} seconds`,
        pollUrl:      `/jobs/${job._id}`,
        note:         'Videos take 2-5 minutes to generate',
      })
    } catch (err: any) {
      console.error('Video generation error:', err.message)
      res.status(500).json({ error: err.message || 'Video generation failed' })
    }
  }
)

// ── GET /video/info ──────────────────────────────────────
router.get('/info', (_req, res) => {
  res.json({
    durations: [
      { seconds: 5,  credits: CREDITS_VIDEO,     label: '5 seconds' },
      { seconds: 10, credits: CREDITS_VIDEO * 2, label: '10 seconds' },
    ],
    tips: [
      'Describe camera movement (slow pan, aerial shot, zoom in)',
      'Mention lighting (golden hour, neon lights, soft daylight)',
      'Include subject motion (walking, flowing water, dancing)',
      'Add mood or atmosphere (cinematic, dreamy, dramatic)',
    ],
    note: 'Videos take 2-5 minutes to generate',
  })
})

export default router