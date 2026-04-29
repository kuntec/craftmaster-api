import { Router, Response }    from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { CHAT_MODELS, getModel }     from '../config/chatModels'
import { streamChat }                from '../services/chat'
import Conversation                  from '../models/Conversation'
import User                          from '../models/User'
import CreditTransaction             from '../models/CreditTransaction'

const router = Router()
router.use(authenticate)

// ── GET /chat/models ──────────────────────────────────────
router.get('/models', async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ models: CHAT_MODELS })
})

// ── GET /chat/conversations ───────────────────────────────
router.get('/conversations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversations = await Conversation.find({ userId: req.user!._id })
      .select('title modelId totalCredits createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean()

    res.json({ conversations })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /chat/conversations ──────────────────────────────
router.post('/conversations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { model = 'gpt-4o-mini' } = req.body

    if (!getModel(model)) {
      res.status(400).json({ error: 'Invalid model' })
      return
    }

    const conversation = await Conversation.create({
      userId: req.user!._id,
      title:  'New conversation',
      modelId: model,              
      messages: [],
    })

    res.status(201).json({ conversation })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /chat/conversations/:id ───────────────────────────
router.get('/conversations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversation = await Conversation.findOne({
      _id:    req.params.id,
      userId: req.user!._id,
    })

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }

    res.json({ conversation })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /chat/conversations/:id ─────────────────────────
router.patch('/conversations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, model } = req.body

    const update: any = {}
    if (title) update.title = title
    if (model && getModel(model)) update.model = model

    await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      update
    )

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /chat/conversations/:id ────────────────────────
router.delete('/conversations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Conversation.findOneAndDelete({
      _id:    req.params.id,
      userId: req.user!._id,
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /chat/conversations/:id/message ──────────────────
router.post('/conversations/:id/message', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content, model: modelId } = req.body

    if (!content?.trim()) {
      res.status(400).json({ error: 'Message content required' })
      return
    }

    // Get model config
    const model = getModel(modelId)
    if (!model) {
      res.status(400).json({ error: 'Invalid model' })
      return
    }

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

    // Get conversation
    const conversation = await Conversation.findOne({
      _id:    req.params.id,
      userId: req.user!._id,
    })

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }

    // Add user message
    conversation.messages.push({
      role:      'user',
      content:   content.trim(),
      createdAt: new Date(),
    })

    // Build messages history for AI
    const messages = conversation.messages.map(m => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Stream the response
    let assistantText = ''
    try {
      assistantText = await streamChat(model, messages, res)
    } catch (err: any) {
      return
    }

    // Save assistant message
    conversation.messages.push({
      role:      'assistant',
      content:   assistantText,
      model:     model.id,
      credits:   model.credits,
      createdAt: new Date(),
    })

    // Update model if changed
    conversation.modelId        = model.id
    conversation.totalCredits += model.credits

    // Auto-generate title from first message
    if (conversation.messages.length === 2) {
      conversation.title = content.trim().slice(0, 60) +
        (content.trim().length > 60 ? '…' : '')
    }

    await conversation.save()

    // Deduct credits
    await User.findByIdAndUpdate(req.user!._id, {
      $inc: { creditsBalance: -model.credits },
    })

    await CreditTransaction.create({
      userId:      req.user!._id,
      amount:      -model.credits,
      type:        'USAGE',
      description: `Chat with ${model.name}`,
    })

  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message })
    }
  }
})

export default router