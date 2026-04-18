//import Stripe from 'stripe'
import Stripe, { type Stripe as StripeType } from 'stripe'
import User from '../models/User'
import { creditsService } from './credits'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2026-03-25.dahlia',
  })

  export { stripeClient as stripe }

//export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export const stripeService = {

  // Get or create Stripe customer
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')

    // Already has a customer ID
    if (user.stripeCustomerId) return user.stripeCustomerId

    // Create new Stripe customer
    const customer = await stripeClient.customers.create({
      email,
      metadata: { userId },
    })

    // Save to user
    await User.findByIdAndUpdate(userId, {
      stripeCustomerId: customer.id,
    })

    return customer.id
  },

  // Create checkout session for credit top up
  async createTopUpSession(
    userId: string,
    email: string,
    credits: number
  ): Promise<string> {
    // Validate credit amount
    if (credits < 50 || credits > 5000) {
      throw new Error('Credits must be between 50 and 5000')
    }

    // Calculate price in cents ($1 = 100 credits)
    const amountCents = Math.round((credits / 100) * 100)

    const customerId = await stripeService.getOrCreateCustomer(userId, email)

    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'CraftMaster Credits',
              description: `${credits} credits — never expire`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        credits: credits.toString(),
        type: 'topup',
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard/credits?success=1&credits=${credits}`,
      cancel_url:  `${process.env.FRONTEND_URL}/dashboard/credits?canceled=1`,
    })

    if (!session.url) throw new Error('Failed to create checkout session')
    return session.url
  },

  // Handle webhook events
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    // Verify webhook signature
    let event: ReturnType<typeof stripeClient.webhooks.constructEvent>
    
    try {
      event = stripeClient.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET as string
      )
    } catch {
      throw new Error('Invalid webhook signature')
    }

    // Handle checkout completed
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as {
          metadata?: {
            userId?: string
            credits?: string
            type?: string
          }
          payment_intent?: string | null
        }
      
        const { userId, credits, type } = session.metadata ?? {}
      
        if (type === 'topup' && userId && credits) {
          const creditAmount = parseInt(credits)
          const paymentId = session.payment_intent as string
      
          await creditsService.add(
            userId,
            creditAmount,
            'TOPUP',
            `Top up: ${creditAmount} credits`,
            paymentId
          )
      
          console.log(`Credits added: ${creditAmount} for user ${userId}`)
        }
      }
  },
}