import { Router, Response }               from 'express'
import { adminAuthenticate, AdminRequest } from '../../middleware/adminAuth'
import { uploadBuffer }                   from '../../services/storage'

const router = Router()
router.use(adminAuthenticate)

// ── GET /admin/storage/test ───────────────────────────────
router.get('/test', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    console.log('R2 test: ACCOUNT_ID =', process.env.CLOUDFLARE_ACCOUNT_ID?.slice(0, 8) + '...')
    console.log('R2 test: BUCKET     =', process.env.R2_BUCKET_NAME)
    console.log('R2 test: PUBLIC_URL =', process.env.R2_PUBLIC_URL)
    console.log('R2 test: KEY_ID     =', process.env.R2_ACCESS_KEY_ID?.slice(0, 8) + '...')

    const buffer = Buffer.from(`Studio42 R2 test - ${new Date().toISOString()}`)
    const url    = await uploadBuffer(buffer, `test/test-${Date.now()}.txt`, 'text/plain')

    res.json({ success: true, url, message: 'R2 is working!' })
  } catch (err: any) {
    console.error('R2 test failed:', err.message)
    res.status(500).json({
      success: false,
      error:   err.message,
    })
  }
})

export default router