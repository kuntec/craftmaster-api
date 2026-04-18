import { Router,Request, Response } from 'express'
import { authenticate, requireCredits, AuthRequest } from '../middleware/auth'
import { creditsService } from '../services/credits'
import { claudeService } from '../services/claude'
import Job from '../models/Job'

const router = Router()

const CREDITS_WEBSITE = parseInt(process.env.CREDITS_WEBSITE || '20')

const VALID_STYLES = ['modern', 'minimal', 'bold', 'corporate', 'creative', 'dark']

// ── POST /website/generate ───────────────────────────────
router.post(
  '/generate',
  authenticate,
  requireCredits(CREDITS_WEBSITE),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { prompt, style = 'modern' } = req.body

      // Validate prompt
      if (!prompt || prompt.trim().length < 10) {
        res.status(400).json({ error: 'Prompt must be at least 10 characters' })
        return
      }

      // Validate style
      if (!VALID_STYLES.includes(style)) {
        res.status(400).json({
          error: 'Invalid style',
          validStyles: VALID_STYLES,
        })
        return
      }

      // Create job in DB
      const job = await Job.create({
        userId:      req.user!._id,
        type:        'WEBSITE',
        status:      'PENDING',
        prompt:      prompt.trim(),
        parameters:  { style },
        creditsUsed: CREDITS_WEBSITE,
      })

      // Deduct credits
      await creditsService.deduct(
        req.user!._id.toString(),
        CREDITS_WEBSITE,
        `Website generation: "${prompt.trim().slice(0, 50)}"`,
        job._id
      )

      // Update status to processing
      await Job.findByIdAndUpdate(job._id, { status: 'PROCESSING' })

      // Generate website — synchronous
      const html = await claudeService.generateWebsite(prompt.trim(), style)

      // Update job as completed
      await Job.findByIdAndUpdate(job._id, {
        status:      'COMPLETED',
        outputData:  { html },
        completedAt: new Date(),
      })

      res.json({
        message:     'Website generated successfully',
        jobId:       job._id,
        creditsUsed: CREDITS_WEBSITE,
        html,
      })
    } catch (err: any) {
      console.error('Website generation error:', err.message)

      // Mark job as failed if it was created
      res.status(500).json({ error: err.message || 'Website generation failed' })
    }
  }
)

// ── GET /website/styles ──────────────────────────────────
router.get('/styles', (_req, res) => {
  res.json({
    styles: [
      { id: 'modern',    label: 'Modern',    description: 'Clean and contemporary' },
      { id: 'minimal',   label: 'Minimal',   description: 'Ultra clean, typography focused' },
      { id: 'bold',      label: 'Bold',      description: 'Strong colors, impactful' },
      { id: 'corporate', label: 'Corporate', description: 'Professional and trustworthy' },
      { id: 'creative',  label: 'Creative',  description: 'Artistic and unique' },
      { id: 'dark',      label: 'Dark Mode', description: 'Dark background, premium feel' },
    ],
    credits: CREDITS_WEBSITE,
  })
})

// ── GET /website/preview/:jobId ──────────────────────────
router.get(
    '/preview/:jobId',
    authenticate,
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const job = await Job.findOne({
          _id:    req.params.jobId,
          userId: req.user!._id,
          type:   'WEBSITE',
        })
  
        if (!job) {
          res.status(404).json({ error: 'Job not found' })
          return
        }
  
        if (job.status !== 'COMPLETED' || !job.outputData) {
          res.status(400).json({ error: 'Website not ready yet' })
          return
        }
  
        const { html } = job.outputData as { html: string }
  
        // Send raw HTML — browser renders it directly
        res.setHeader('Content-Type', 'text/html')
        res.send(html)
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    }
  )

  // ── GET /website/preview/public/:jobId (no auth) ─────────
router.get(
  '/preview/public/:jobId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const job = await Job.findById(req.params.jobId)

      if (!job || job.status !== 'COMPLETED' || !job.outputData) {
        res.status(404).send('<h1>Website not found</h1>')
        return
      }

      const { html } = job.outputData as { html: string }
      res.setHeader('Content-Type', 'text/html')
      res.send(html)
    } catch (err: any) {
      res.status(500).send('<h1>Error loading website</h1>')
    }
  }
)

export default router