import { Router, Response }          from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import Job                           from '../models/Job'
import User                          from '../models/User'
import CreditTransaction             from '../models/CreditTransaction'
import { replicateService }          from '../services/replicate'
import { VIDEO_MODELS, getVideoModel, DEFAULT_VIDEO_MODEL } from '../config/videoModels'

const router = Router()
router.use(authenticate)

// ── GET /video/models ─────────────────────────────────────
router.get('/models', (_req: AuthRequest, res: Response): void => {
  res.json({ models: VIDEO_MODELS })
})

// ── GET /video/info ───────────────────────────────────────
router.get('/info', (_req: AuthRequest, res: Response): void => {
  res.json({
    models:      VIDEO_MODELS,
    defaultModel: DEFAULT_VIDEO_MODEL.id,
  })
})

// ── POST /video/generate ──────────────────────────────────
router.post('/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      prompt,
      duration    = 5,
      modelId     = DEFAULT_VIDEO_MODEL.id,
      resolution  = '480p',
      aspectRatio = '16:9',
      enableAudio = true,
      startImage,
      endImage,
      referenceImages,
    } = req.body

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Prompt is required' })
      return
    }

    // Get model config
    const model = getVideoModel(modelId)
    if (!model) {
      res.status(400).json({ error: 'Invalid model' })
      return
    }

    // Validate duration
    const validDuration = Math.min(Math.max(parseInt(duration), 3), 15)

    // Check credits
    const freshUser = await User.findById(req.user!._id).select('creditsBalance')
    if (!freshUser || freshUser.creditsBalance < model.credits) {
      res.status(402).json({
        error:    'Insufficient credits',
        required: model.credits,
        balance:  freshUser?.creditsBalance ?? 0,
      })
      return
    }

    // Create job
    const job = await Job.create({
      userId:      req.user!._id,
      type:        'VIDEO',
      status:      'PROCESSING',
      prompt:      prompt.trim(),
      parameters:  { duration: validDuration, modelId, resolution, aspectRatio },
      creditsUsed: model.credits,
    })

    // Deduct credits
    await User.findByIdAndUpdate(req.user!._id, {
      $inc: { creditsBalance: -model.credits },
    })

    await CreditTransaction.create({
      userId:      req.user!._id,
      amount:      -model.credits,
      type:        'USAGE',
      description: `Video generation (${model.name}): "${prompt.trim().slice(0, 50)}"`,
    })

    // Start generation based on model
    let replicateId: string

    if (model.id === 'wan-2.1') {
      replicateId = await replicateService.createWanVideoJob(
        prompt.trim(),
        validDuration
      )
    } else if (model.id === 'seedance-2.0') {
      replicateId = await replicateService.createSeedanceJob(
        prompt.trim(),
        validDuration,
        resolution as '480p' | '720p',
        aspectRatio,
        enableAudio,
        startImage
      )
    } else if (model.id === 'kling-v3') {
      replicateId = await replicateService.createKlingV3Job(
        prompt.trim(),
        validDuration,
        resolution === '1080p' ? 'pro' : 'standard',
        aspectRatio,
        enableAudio,
        startImage,
        endImage
      )
    } else if (model.id === 'kling-v3-omni') {
      replicateId = await replicateService.createKlingV3OmniJob(
        prompt.trim(),
        validDuration,
        resolution === '1080p' ? 'pro' : 'standard',
        aspectRatio,
        enableAudio,
        startImage,
        endImage,
        referenceImages
      )
    } else {
      // fallback to Wan 2.1
      replicateId = await replicateService.createWanVideoJob(
        prompt.trim(),
        validDuration
      )
    }

    // Update job with replicateId
    await Job.findByIdAndUpdate(job._id, { replicateId })

    res.status(202).json({
      job: { ...job.toObject(), replicateId },
      replicateId,
      model: model.name,
      message: 'Video generation started. Poll /jobs/:id for status.',
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router