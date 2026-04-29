import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import connectDB from './config/database'
import authRoutes from './routes/auth'
import creditsRoutes from './routes/credits'
import stripeRoutes from './routes/stripe'
import imageRoutes from './routes/image'
import videoRoutes from './routes/video'
import websiteRoutes from './routes/website'
import jobsRoutes from './routes/jobs'
import { errorHandler, notFound } from './middleware/errorHandler'
import projectRoutes from './routes/projects'
import freeRoutes from './routes/free'
// Admin routes 
import adminAuthRoutes        from './routes/admin/auth'
import adminStatsRoutes       from './routes/admin/stats'
import adminUsersRoutes       from './routes/admin/users'
import adminPaymentsRoutes    from './routes/admin/payments'
import adminGenerationsRoutes from './routes/admin/generations'

const app = express()
const PORT = process.env.PORT || 3001

connectDB()

app.use(helmet())
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(morgan('dev'))

// Stripe webhook needs raw body BEFORE json middleware
app.use('/stripe/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})
app.use('/auth',    authRoutes)
app.use('/credits', creditsRoutes)
app.use('/stripe',  stripeRoutes)
app.use('/image',   imageRoutes)
app.use('/video',   videoRoutes)
app.use('/website', websiteRoutes)
app.use('/jobs',    jobsRoutes)
app.use('/projects', projectRoutes)
app.use('/free', freeRoutes)

// admin routes
app.use('/admin/auth',        adminAuthRoutes)
app.use('/admin/stats',       adminStatsRoutes)
app.use('/admin/users',       adminUsersRoutes)
app.use('/admin/payments',    adminPaymentsRoutes)
app.use('/admin/generations', adminGenerationsRoutes)

app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`CraftMaster API running on port ${PORT} [${process.env.NODE_ENV}]`)
})

export default app