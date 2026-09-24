import { Router, Response }          from 'express'
import Anthropic                       from '@anthropic-ai/sdk'
import { authenticate, AuthRequest }  from '../middleware/auth'
import VideoProject                    from '../models/VideoProject'
import Job                             from '../models/Job'
import User                            from '../models/User'
import CreditTransaction               from '../models/CreditTransaction'
import { replicateService }            from '../services/replicate'

const router = Router()
router.use(authenticate)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CREDITS_SCRIPT = 10
const CREDITS_SCENES = 5
const CREDITS_IMAGE  = parseInt(process.env.CREDITS_IMAGE || '4')
const CREDITS_VIDEO  = 50   // Seedance 2.0

const CHANNEL_TYPES = [
  'Kids Animation','Educational','Documentary','Explainer',
  'Top 10','True Crime','Finance','Travel','Cooking',
  'Motivational','Tech',
]

const DURATION_GUIDE: Record<string, string> = {
  short:  '2-3 minutes (approx. 3-5 scenes)',
  medium: '4-6 minutes (approx. 6-9 scenes)',
  long:   '7-10 minutes (approx. 10-15 scenes)',
}

// ── Helper: deduct credits ────────────────────────────────
async function deductCredits(
  userId:      any,
  amount:      number,
  description: string
): Promise<void> {
  await User.findByIdAndUpdate(userId, { $inc: { creditsBalance: -amount } })
  await CreditTransaction.create({ userId, amount: -amount, type: 'USAGE', description })
}

// ── Helper: check credits ─────────────────────────────────
async function checkCredits(userId: any, required: number): Promise<{ ok: boolean; balance: number }> {
  const user = await User.findById(userId).select('creditsBalance')
  return { ok: (user?.creditsBalance ?? 0) >= required, balance: user?.creditsBalance ?? 0 }
}

// ─────────────────────────────────────────────────────────
// 1. GET /video-studio/projects
// ─────────────────────────────────────────────────────────
router.get('/projects', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await VideoProject.find({ userId: req.user!._id })
      .sort({ createdAt: -1 })
      .select('-script -scenes')   // keep list lightweight
    res.json({ projects })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────
// 2. POST /video-studio/projects
// ─────────────────────────────────────────────────────────
router.post('/projects', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, channelType, style, targetAudience, duration, idea } = req.body

    if (!name?.trim())        { res.status(400).json({ error: 'Project name is required' }); return }
    if (!channelType?.trim()) { res.status(400).json({ error: 'Channel type is required' }); return }
    if (!idea?.trim())        { res.status(400).json({ error: 'Idea is required' }); return }

    const project = await VideoProject.create({
      userId: req.user!._id,
      name:   name.trim(),
      channelType,
      style:          style?.trim() || '',
      targetAudience: targetAudience?.trim() || '',
      duration:       duration || 'medium',
      idea:           idea.trim(),
      status:         'setup',
    })

    res.status(201).json({ project })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────
// 3. GET /video-studio/projects/:id
// ─────────────────────────────────────────────────────────
router.get('/projects/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await VideoProject.findOne({ _id: req.params.id, userId: req.user!._id })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }
    res.json({ project })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────
// 4. DELETE /video-studio/projects/:id
// ─────────────────────────────────────────────────────────
router.delete('/projects/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await VideoProject.findOneAndDelete({ _id: req.params.id, userId: req.user!._id })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }
    res.json({ message: 'Project deleted' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────
// 5. POST /video-studio/projects/:id/script  — Generate
// ─────────────────────────────────────────────────────────
router.post('/projects/:id/script', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await VideoProject.findOne({ _id: req.params.id, userId: req.user!._id })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }

    const { ok, balance } = await checkCredits(req.user!._id, CREDITS_SCRIPT)
    if (!ok) {
      res.status(402).json({ error: 'Insufficient credits', required: CREDITS_SCRIPT, balance })
      return
    }

    const durationGuide = DURATION_GUIDE[project.duration] || DURATION_GUIDE.medium

    const prompt = `You are a professional YouTube scriptwriter. Write a complete, engaging script for a ${project.channelType} YouTube video.

Project Details:
- Title: ${project.name}
- Channel Type: ${project.channelType}
- Visual Style: ${project.style || 'Modern, clean, professional'}
- Target Audience: ${project.targetAudience || 'General audience'}
- Duration: ${durationGuide}
- Topic/Idea: ${project.idea}

Write the full script with these requirements:
1. Use clear scene markers: [SCENE 1: Scene Title]
2. Include narration text for each scene
3. Add visual descriptions in (parentheses) after narration lines
4. Estimate duration for each scene, e.g. [~30 seconds]
5. Match the tone and style to the channel type
6. Include an engaging hook in Scene 1
7. End with a call-to-action in the final scene

Write the complete script now:`

    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    })

    const scriptText = (message.content[0] as any).text as string

    await deductCredits(req.user!._id, CREDITS_SCRIPT, `Video Studio: Script for "${project.name}"`)

    await VideoProject.findByIdAndUpdate(project._id, {
      script:      scriptText,
      status:      'script',
      $inc:        { creditsUsed: CREDITS_SCRIPT },
    })

    res.json({ script: scriptText, creditsUsed: CREDITS_SCRIPT })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────
// 6. PUT /video-studio/projects/:id/script  — Save edits
// ─────────────────────────────────────────────────────────
router.put('/projects/:id/script', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { script } = req.body
    const project = await VideoProject.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      { script },
      { new: true }
    )
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }
    res.json({ message: 'Script saved', project })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────
// 7. POST /video-studio/projects/:id/scenes  — Generate breakdown
// ─────────────────────────────────────────────────────────
router.post('/projects/:id/scenes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await VideoProject.findOne({ _id: req.params.id, userId: req.user!._id })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }
    if (!project.script) { res.status(400).json({ error: 'Generate a script first' }); return }

    const { ok, balance } = await checkCredits(req.user!._id, CREDITS_SCENES)
    if (!ok) {
      res.status(402).json({ error: 'Insufficient credits', required: CREDITS_SCENES, balance })
      return
    }

    const prompt = `You are a professional video director and AI art director. Break down this YouTube script into scenes and generate AI image and video prompts for each.

Script:
${project.script}

Project Details:
- Channel Type: ${project.channelType}
- Visual Style: ${project.style || 'Modern, cinematic'}

Return ONLY a valid JSON array (no markdown, no explanation, just the array).
Each scene object must have exactly these fields:
{
  "sceneNumber": 1,
  "title": "Scene title",
  "description": "What happens visually in this scene",
  "mood": "The emotional tone (e.g. exciting, calm, mysterious)",
  "narration": "The exact narration text spoken in this scene",
  "estimatedSeconds": 30,
  "imagePrompt": "Detailed prompt for FLUX image generation. Include: subject, art style matching ${project.style || 'the channel type'}, lighting, composition, colors, mood. NO text or watermarks.",
  "videoPrompt": "Detailed prompt for Seedance video generation. Include: what moves in the scene, camera movement (pan, zoom, dolly), atmosphere, motion details."
}

Generate scenes matching the ${project.duration} duration target. Return the JSON array now:`

    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages:   [{ role: 'user', content: prompt }],
    })

    let responseText = (message.content[0] as any).text as string

    // Strip markdown code fences if present
    responseText = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

    let scenesData: any[]
    try {
      scenesData = JSON.parse(responseText)
    } catch {
      // Try to extract JSON array from response
      const match = responseText.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('Failed to parse scene breakdown from AI response')
      scenesData = JSON.parse(match[0])
    }

    const scenes = scenesData.map((s: any, i: number) => ({
      sceneNumber:      s.sceneNumber ?? i + 1,
      title:            s.title ?? `Scene ${i + 1}`,
      description:      s.description ?? '',
      mood:             s.mood ?? '',
      narration:        s.narration ?? '',
      estimatedSeconds: s.estimatedSeconds ?? 30,
      imagePrompt:      s.imagePrompt ?? '',
      videoPrompt:      s.videoPrompt ?? '',
      imageJobId:       null,
      videoJobId:       null,
      imageUrl:         null,
      videoUrl:         null,
      imageStatus:      'pending',
      videoStatus:      'pending',
    }))

    await deductCredits(req.user!._id, CREDITS_SCENES, `Video Studio: Scene breakdown for "${project.name}"`)

    const updated = await VideoProject.findByIdAndUpdate(
      project._id,
      {
        scenes,
        status: 'scenes',
        $inc:   { creditsUsed: CREDITS_SCENES },
      },
      { new: true }
    )

    res.json({ scenes: updated!.scenes, creditsUsed: CREDITS_SCENES })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────
// 8. PUT /video-studio/projects/:id/scenes/:sceneId
// ─────────────────────────────────────────────────────────
router.put('/projects/:id/scenes/:sceneId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await VideoProject.findOne({ _id: req.params.id, userId: req.user!._id })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }

    const scene = project.scenes.id(req.params.sceneId)
    if (!scene) { res.status(404).json({ error: 'Scene not found' }); return }

    const allowed = ['title','description','mood','narration','estimatedSeconds','imagePrompt','videoPrompt']
    allowed.forEach(field => {
      if (req.body[field] !== undefined) (scene as any)[field] = req.body[field]
    })

    await project.save()
    res.json({ scene })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────
// 9. POST /video-studio/projects/:id/scenes/:sceneId/image
// ─────────────────────────────────────────────────────────
router.post('/projects/:id/scenes/:sceneId/image', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await VideoProject.findOne({ _id: req.params.id, userId: req.user!._id })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }

    const scene = project.scenes.id(req.params.sceneId)
    if (!scene) { res.status(404).json({ error: 'Scene not found' }); return }

    const { ok, balance } = await checkCredits(req.user!._id, CREDITS_IMAGE)
    if (!ok) {
      res.status(402).json({ error: 'Insufficient credits', required: CREDITS_IMAGE, balance })
      return
    }

    const prompt = scene.imagePrompt || scene.description

    // Create job
    const job = await Job.create({
      userId:      req.user!._id,
      type:        'IMAGE',
      status:      'PROCESSING',
      prompt,
      parameters:  { width: 1280, height: 720, source: 'video-studio', projectId: project._id, sceneId: scene._id },
      creditsUsed: CREDITS_IMAGE,
    })

    await deductCredits(req.user!._id, CREDITS_IMAGE, `Video Studio: Image for scene ${scene.sceneNumber} of "${project.name}"`)

    // Start Replicate
    const replicateId = await replicateService.createImageJob(prompt, 1280, 720)
    await Job.findByIdAndUpdate(job._id, { replicateId })

    // Update scene
    scene.imageJobId  = job._id as any
    scene.imageStatus = 'generating'
    await project.save()

    await VideoProject.findByIdAndUpdate(project._id, { $inc: { creditsUsed: CREDITS_IMAGE } })

    res.status(202).json({ jobId: job._id, replicateId })
  } catch (err: any) {
    const detail = err.response?.data
    console.error('[video-studio/image]', detail || err.message)
    // Pass through Replicate billing errors as 402
    if (detail?.status === 402 || detail?.title?.toLowerCase().includes('insufficient credit')) {
      res.status(402).json({ error: 'Insufficient Replicate credits. Top up at replicate.com/account/billing' })
      return
    }
    res.status(500).json({ error: err.message, detail })
  }
})

// ─────────────────────────────────────────────────────────
// 10. POST /video-studio/projects/:id/scenes/:sceneId/video
// ─────────────────────────────────────────────────────────
router.post('/projects/:id/scenes/:sceneId/video', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await VideoProject.findOne({ _id: req.params.id, userId: req.user!._id })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }

    const scene = project.scenes.id(req.params.sceneId)
    if (!scene) { res.status(404).json({ error: 'Scene not found' }); return }

    const { ok, balance } = await checkCredits(req.user!._id, CREDITS_VIDEO)
    if (!ok) {
      res.status(402).json({ error: 'Insufficient credits', required: CREDITS_VIDEO, balance })
      return
    }

    const {
      duration    = 5,
      resolution  = '720p',
      enableAudio = true,
    } = req.body

    const prompt = scene.videoPrompt || scene.description

    // Create job
    const job = await Job.create({
      userId:      req.user!._id,
      type:        'VIDEO',
      status:      'PROCESSING',
      prompt,
      parameters:  { duration, resolution, enableAudio, source: 'video-studio', projectId: project._id, sceneId: scene._id },
      creditsUsed: CREDITS_VIDEO,
    })

    await deductCredits(req.user!._id, CREDITS_VIDEO, `Video Studio: Video for scene ${scene.sceneNumber} of "${project.name}"`)

    // Use generated scene image as the first frame if available
    const startImage = scene.imageUrl || undefined

    // Start Seedance job
    const replicateId = await replicateService.createSeedanceJob(
      prompt,
      duration,
      resolution as '480p' | '720p',
      '16:9',
      enableAudio,
      startImage
    )
    await Job.findByIdAndUpdate(job._id, { replicateId })

    // Update scene
    scene.videoJobId  = job._id as any
    scene.videoStatus = 'generating'
    await project.save()

    await VideoProject.findByIdAndUpdate(project._id, { $inc: { creditsUsed: CREDITS_VIDEO } })

    res.status(202).json({ jobId: job._id, replicateId })
  } catch (err: any) {
    const detail = err.response?.data
    console.error('[video-studio/video]', detail || err.message)
    if (detail?.status === 402 || detail?.title?.toLowerCase().includes('insufficient credit')) {
      res.status(402).json({ error: 'Insufficient Replicate credits. Top up at replicate.com/account/billing' })
      return
    }
    res.status(500).json({ error: err.message, detail })
  }
})

// ─────────────────────────────────────────────────────────
// 11. POST /video-studio/projects/:id/scenes/:sceneId/complete
// ─────────────────────────────────────────────────────────
router.post('/projects/:id/scenes/:sceneId/complete', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, url } = req.body  // type: 'image' | 'video'

    const project = await VideoProject.findOne({ _id: req.params.id, userId: req.user!._id })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }

    const scene = project.scenes.id(req.params.sceneId)
    if (!scene) { res.status(404).json({ error: 'Scene not found' }); return }

    if (type === 'image') {
      scene.imageUrl    = url
      scene.imageStatus = 'completed'
    } else if (type === 'video') {
      scene.videoUrl    = url
      scene.videoStatus = 'completed'
    }

    // Check if all scenes are fully complete
    const allComplete = project.scenes.every(
      s => s.imageStatus === 'completed' && s.videoStatus === 'completed'
    )
    if (allComplete) project.status = 'complete'
    else if (project.status === 'scenes') project.status = 'assets'

    await project.save()
    res.json({ scene, projectStatus: project.status })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
