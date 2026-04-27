import { Router, Request, Response } from 'express'
import FreeGeneration      from '../models/FreeGeneration'
import { replicateService } from '../services/replicate'
import { claudeService }    from '../services/claude'
import { builderService }   from '../services/builder'

const router = Router()

// ── Rate limit helper ─────────────────────────────────────
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    return (typeof forwarded === 'string'
      ? forwarded
      : forwarded[0]
    ).split(',')[0].trim()
  }
  return req.socket.remoteAddress || 'unknown'
}

const checkLimit = async (
  ip:    string,
  type:  'IMAGE' | 'WEBSITE' | 'BUILDER_PLAN',
  limit: number
): Promise<{ allowed: boolean; used: number; max: number }> => {
  const used = await FreeGeneration.countDocuments({ ip, type })
  return { allowed: used < limit, used, max: limit }
}

// ── POST /free/image/generate ─────────────────────────────
router.post('/image/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = getClientIp(req)

    // 3 free images per day per IP
    const limit = await checkLimit(ip, 'IMAGE', 3)
    if (!limit.allowed) {
      res.status(429).json({
        error:   'Daily free limit reached',
        message: 'Sign up for 30 free credits to generate more',
        used:    limit.used,
        max:     limit.max,
      })
      return
    }

    const { prompt } = req.body
    if (!prompt || prompt.trim().length < 3) {
      res.status(400).json({ error: 'Prompt must be at least 3 characters' })
      return
    }

    // Track usage
    await FreeGeneration.create({ ip, type: 'IMAGE' })

    // Generate with smaller size for free tier
    const replicateId = await replicateService.createImageJob(
      prompt.trim(),
      512,
      512
    )

    res.json({
      replicateId,
      remaining: limit.max - limit.used - 1,
      message:   'Sign up for 30 credits to download full resolution',
    })
  } catch (err: any) {
    console.error('Free image error:', err.message)
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
})

// ── POST /free/website/generate ───────────────────────────
router.post('/website/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = getClientIp(req)

    // 1 free website per day per IP
    const limit = await checkLimit(ip, 'WEBSITE', 1)
    if (!limit.allowed) {
      res.status(429).json({
        error:   'Daily free limit reached',
        message: 'Sign up for 30 free credits to generate more websites',
        used:    limit.used,
        max:     limit.max,
      })
      return
    }

    const { prompt, style = 'modern' } = req.body
    if (!prompt || prompt.trim().length < 10) {
      res.status(400).json({ error: 'Prompt must be at least 10 characters' })
      return
    }

    // Track usage
    await FreeGeneration.create({ ip, type: 'WEBSITE' })

    // Generate website
    const html = await claudeService.generateWebsite(prompt.trim(), style)

    // Add watermark to HTML
    const watermarkedHtml = html.replace(
      '</body>',
      `<div style="position:fixed;bottom:12px;right:12px;background:rgba(0,0,0,0.7);color:white;padding:6px 12px;border-radius:20px;font-family:sans-serif;font-size:12px;z-index:99999;pointer-events:none;">
        Made with <strong>Studio42.ai</strong>
      </div></body>`
    )

    res.json({
      html:      watermarkedHtml,
      remaining: limit.max - limit.used - 1,
      message:   'Sign up to download this website without watermark',
    })
  } catch (err: any) {
    console.error('Free website error:', err.message)
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
})

// ── POST /free/builder/plan ───────────────────────────────
// Completely free — no login, no limit
// This is the hook to get users to sign up
router.post('/builder/plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { description } = req.body

    if (!description || description.trim().length < 10) {
      res.status(400).json({ error: 'Please describe your project in at least 10 characters' })
      return
    }

    // Generate plans — free, no rate limit
    const plans = await builderService.generatePlans(description.trim())

    res.json({
      plans,
      message: 'Sign up free to start building — get 30 credits on signup',
    })
  } catch (err: any) {
    console.error('Free builder plan error:', err.message)
    res.status(500).json({ error: 'Failed to generate plans. Please try again.' })
  }
})

// ── GET /free/limits ──────────────────────────────────────
// Check remaining free generations for this IP
router.get('/limits', async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = getClientIp(req)

    const [imageUsed, websiteUsed] = await Promise.all([
      FreeGeneration.countDocuments({ ip, type: 'IMAGE'   }),
      FreeGeneration.countDocuments({ ip, type: 'WEBSITE' }),
    ])

    res.json({
      image:   { used: imageUsed,   max: 3, remaining: Math.max(0, 3 - imageUsed)   },
      website: { used: websiteUsed, max: 1, remaining: Math.max(0, 1 - websiteUsed) },
      builder: { unlimited: true, message: 'Plans always free'                       },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /free/jobs/poll/:replicateId ──────────────────────
router.get('/jobs/poll/:replicateId', async (req: Request, res: Response): Promise<void> => {
    try {
        const { replicateId } = req.params as { replicateId: string }
        const result = await replicateService.pollJob(replicateId)
      res.json({
        status: result.status,
        output: result.output,
        error:  result.error,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

export default router