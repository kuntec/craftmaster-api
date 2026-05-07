import Job                                   from '../models/Job'
import { uploadFromUrl, uploadBuffer, generateKey } from './storage'

// ── Process image ─────────────────────────────────────────
export async function processImageJob(
  jobId:     string,
  userId:    string,
  outputUrl: string
): Promise<string> {
  try {
    console.log(`R2: processing image job ${jobId}`)

    const ext      = outputUrl.includes('.webp') ? 'webp'
                   : outputUrl.includes('.png')  ? 'png'
                   : 'jpg'
    const mimeType = ext === 'webp' ? 'image/webp'
                   : ext === 'png'  ? 'image/png'
                   : 'image/jpeg'

    const key          = generateKey(userId, 'image', ext)
    const permanentUrl = await uploadFromUrl(outputUrl, key, mimeType)

    await Job.findByIdAndUpdate(jobId, {
      outputUrl:       permanentUrl,
      storageKey:      key,
      storageProvider: 'r2',
    })

    console.log(`R2: image job ${jobId} saved → ${permanentUrl}`)
    return permanentUrl
  } catch (err: any) {
    console.error(`R2: image job ${jobId} failed → ${err.message}`)
    return outputUrl
  }
}

// ── Process video ─────────────────────────────────────────
export async function processVideoJob(
  jobId:     string,
  userId:    string,
  outputUrl: string
): Promise<string> {
  try {
    console.log(`R2: processing video job ${jobId}`)

    const key          = generateKey(userId, 'video', 'mp4')
    const permanentUrl = await uploadFromUrl(outputUrl, key, 'video/mp4')

    await Job.findByIdAndUpdate(jobId, {
      outputUrl:       permanentUrl,
      storageKey:      key,
      storageProvider: 'r2',
    })

    console.log(`R2: video job ${jobId} saved → ${permanentUrl}`)
    return permanentUrl
  } catch (err: any) {
    console.error(`R2: video job ${jobId} failed → ${err.message}`)
    return outputUrl
  }
}

// ── Process website ───────────────────────────────────────
export async function processWebsiteJob(
  jobId:     string,
  userId:    string,
  html:      string
): Promise<string> {
  try {
    console.log(`R2: processing website job ${jobId}`)

    const key          = generateKey(userId, 'website', 'html')
    const buffer       = Buffer.from(html, 'utf-8')
    const permanentUrl = await uploadBuffer(buffer, key, 'text/html')

    await Job.findByIdAndUpdate(jobId, {
      outputUrl:       permanentUrl,
      storageKey:      key,
      storageProvider: 'r2',
    })

    console.log(`R2: website job ${jobId} saved → ${permanentUrl}`)
    return permanentUrl
  } catch (err: any) {
    console.error(`R2: website job ${jobId} failed → ${err.message}`)
    return ''
  }
}