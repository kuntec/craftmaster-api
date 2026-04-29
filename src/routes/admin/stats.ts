import { Router, Response } from 'express'
import { AdminRequest, adminAuthenticate } from '../../middleware/adminAuth'
import User              from '../../models/User'
import Job               from '../../models/Job'
import CreditTransaction from '../../models/CreditTransaction'

const router = Router()
router.use(adminAuthenticate)

// ── GET /admin/stats/overview ─────────────────────────────
router.get('/overview', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const now       = new Date()
    const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const last30    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      todaySignups,
      monthSignups,
      totalJobs,
      todayJobs,
      imageJobs,
      videoJobs,
      websiteJobs,
      projectJobs,
      totalRevenue,
      monthRevenue,
      todayRevenue,
      payingUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: thisMonth } }),
      Job.countDocuments({ status: 'COMPLETED' }),
      Job.countDocuments({ status: 'COMPLETED', createdAt: { $gte: today } }),
      Job.countDocuments({ type: 'IMAGE',   status: 'COMPLETED' }),
      Job.countDocuments({ type: 'VIDEO',   status: 'COMPLETED' }),
      Job.countDocuments({ type: 'WEBSITE', status: 'COMPLETED' }),
      Job.countDocuments({ type: 'PROJECT', status: 'COMPLETED' }),
      CreditTransaction.aggregate([
        { $match: { type: 'TOPUP' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CreditTransaction.aggregate([
        { $match: { type: 'TOPUP', createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CreditTransaction.aggregate([
        { $match: { type: 'TOPUP', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CreditTransaction.distinct('userId', { type: 'TOPUP' }),
    ])

    // Convert credits to dollars (20 credits = $1)
    const totalRevenueCredits = totalRevenue[0]?.total ?? 0
    const monthRevenueCredits = monthRevenue[0]?.total ?? 0
    const todayRevenueCredits = todayRevenue[0]?.total ?? 0

    res.json({
      users: {
        total:       totalUsers,
        today:       todaySignups,
        thisMonth:   monthSignups,
        paying:      payingUsers.length,
        payingPct:   totalUsers > 0 ? Math.round((payingUsers.length / totalUsers) * 100) : 0,
      },
      revenue: {
        totalCredits:  totalRevenueCredits,
        totalUsd:      +(totalRevenueCredits / 20).toFixed(2),
        monthCredits:  monthRevenueCredits,
        monthUsd:      +(monthRevenueCredits / 20).toFixed(2),
        todayCredits:  todayRevenueCredits,
        todayUsd:      +(todayRevenueCredits / 20).toFixed(2),
      },
      generations: {
        total:   totalJobs,
        today:   todayJobs,
        images:  imageJobs,
        videos:  videoJobs,
        websites: websiteJobs,
        projects: projectJobs,
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/stats/signups-chart ────────────────────────
router.get('/signups-chart', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const data = await User.aggregate([
      { $match: { createdAt: { $gte: last30 } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    res.json({ data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/stats/revenue-chart ────────────────────────
router.get('/revenue-chart', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const data = await CreditTransaction.aggregate([
      { $match: { type: 'TOPUP', createdAt: { $gte: last30 } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          credits: { $sum: '$amount' },
          usd:     { $sum: { $divide: ['$amount', 20] } },
        },
      },
      { $sort: { _id: 1 } },
    ])

    res.json({ data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router