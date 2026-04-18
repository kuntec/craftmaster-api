import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { creditsService } from '../services/credits'
import { builderService } from '../services/builder'
import Project from '../models/Project'

const router = Router()
router.use(authenticate)

const CREDITS = {
  plan:    parseInt(process.env.CREDITS_BUILDER_PLAN     || '5'),
  BASIC:   parseInt(process.env.CREDITS_BUILDER_STEP_BASIC    || '8'),
  MEDIUM:  parseInt(process.env.CREDITS_BUILDER_STEP_MEDIUM   || '15'),
  ADVANCED:parseInt(process.env.CREDITS_BUILDER_STEP_ADVANCED || '20'),
}

// ── POST /projects/plan ──────────────────────────────────
// Generate 3 plan options — costs CREDITS.plan credits
router.post('/plan', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { description } = req.body

    if (!description || description.trim().length < 10) {
      res.status(400).json({ error: 'Please describe your project in at least 10 characters' })
      return
    }

    // Check credits
    if (req.user!.creditsBalance < CREDITS.plan) {
      res.status(402).json({
        error:    'Insufficient credits',
        required: CREDITS.plan,
        balance:  req.user!.creditsBalance,
      })
      return
    }

    // Generate plans
    const plans = await builderService.generatePlans(description.trim())

    // Deduct planning credits
    await creditsService.deduct(
      req.user!._id.toString(),
      CREDITS.plan,
      `Project planning: "${description.trim().slice(0, 50)}"`,
    )

    res.json({
      plans,
      creditsUsed: CREDITS.plan,
    })
  } catch (err: any) {
    console.error('Plan generation error:', err.message)
    res.status(500).json({ error: err.message || 'Failed to generate plans' })
  }
})

// ── POST /projects/start ─────────────────────────────────
// User picks a plan and starts the project — no extra credits
router.post('/start', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, description, plan, features, steps, totalCredits } = req.body
  
      if (!title || !description || !plan || !features || !steps) {
        res.status(400).json({ error: 'Missing required fields' })
        return
      }
  
      // Include plannedSteps directly in create
      const project = await Project.create({
        userId:       req.user!._id,
        title:        title.trim(),
        description:  description.trim(),
        plan,
        status:       'IN_PROGRESS',
        totalSteps:   steps.length,
        currentStep:  0,
        totalCredits,
        usedCredits:  CREDITS.plan,
        features,
        plannedSteps: steps,  // ← add directly here
        steps:        [],
      })
  
      res.status(201).json({ project })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

// ── POST /projects/:id/next-step ─────────────────────────
// Generate the next step
router.post('/:id/next-step', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findOne({
      _id:    req.params.id,
      userId: req.user!._id,
    })

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    if (project.status === 'COMPLETED') {
      res.status(400).json({ error: 'Project is already completed' })
      return
    }

    // Get the next step info from request
    const { stepTitle, stepDescription } = req.body

    if (!stepTitle || !stepDescription) {
      res.status(400).json({ error: 'stepTitle and stepDescription are required' })
      return
    }

    const stepCreditCost = CREDITS[project.plan as keyof typeof CREDITS] as number
    const nextStepNumber = project.currentStep + 1

    // Check credits
    if (req.user!.creditsBalance < stepCreditCost) {
      res.status(402).json({
        error:    'Insufficient credits',
        required: stepCreditCost,
        balance:  req.user!.creditsBalance,
      })
      return
    }

    // Get completed step titles for context
    const completedStepTitles = project.steps.map((s) => s.title)

    // Generate the step
    const generated = await builderService.generateStep(
      project.title,
      project.description,
      project.plan,
      nextStepNumber,
      stepTitle,
      stepDescription,
      completedStepTitles
    )

    // Deduct credits
    await creditsService.deduct(
      req.user!._id.toString(),
      stepCreditCost,
      `Build step ${nextStepNumber}: "${stepTitle}"`,
    )

    // Save step to project
    const newStep = {
      stepNumber:       nextStepNumber,
      title:            generated.title,
      explanation:      generated.explanation,
      files:            generated.files,
      testInstructions: generated.testInstructions,
      creditsUsed:      stepCreditCost,
      completedAt:      new Date(),
    }

    const isCompleted = nextStepNumber >= project.totalSteps

    await Project.findByIdAndUpdate(project._id, {
      $push: { steps: newStep },
      $set:  {
        currentStep: nextStepNumber,
        usedCredits: project.usedCredits + stepCreditCost,
        status:      isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      },
    })

    res.json({
      step:        newStep,
      creditsUsed: stepCreditCost,
      isCompleted,
      progress:    {
        current: nextStepNumber,
        total:   project.totalSteps,
      },
    })
  } catch (err: any) {
    console.error('Step generation error:', err.message)
    res.status(500).json({ error: err.message || 'Failed to generate step' })
  }
})

// ── GET /projects ─────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await Project.find({ userId: req.user!._id })
      .sort({ createdAt: -1 })
      .select('-steps')
      .lean()

    res.json({ projects })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /projects/:id ─────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findOne({
      _id:    req.params.id,
      userId: req.user!._id,
    })

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    res.json({ project })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /projects/:id/pause ─────────────────────────────
router.patch('/:id/pause', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      { $set: { status: 'PAUSED' } },
      { new: true }
    )

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    res.json({ project })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /projects/:id/resume ────────────────────────────
router.patch('/:id/resume', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      { $set: { status: 'IN_PROGRESS' } },
      { new: true }
    )

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    res.json({ project })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router