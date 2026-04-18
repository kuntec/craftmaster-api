import { Router, Request, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { stripeService } from '../services/stripe'

const router = Router()

// ── POST /stripe/topup ───────────────────────────────────
// Creates a Stripe checkout session
router.post('/topup', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { credits } = req.body

    if (!credits || typeof credits !== 'number') {
      res.status(400).json({ error: 'Credits amount is required' })
      return
    }

    const checkoutUrl = await stripeService.createTopUpSession(
      req.user!._id.toString(),
      req.user!.email,
      credits
    )

    res.json({ checkoutUrl })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// ── POST /stripe/webhook ─────────────────────────────────
// IMPORTANT: Must use raw body — registered in index.ts before json middleware
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string

  if (!signature) {
    res.status(400).json({ error: 'Missing stripe-signature header' })
    return
  }

  try {
    await stripeService.handleWebhook(req.body as Buffer, signature)
    res.json({ received: true })
  } catch (err: any) {
    console.error('Webhook error:', err.message)
    res.status(400).json({ error: err.message })
  }
})

export default router