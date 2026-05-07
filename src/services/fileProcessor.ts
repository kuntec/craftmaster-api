import { uploadFromUrl, generateKey } from './storage'
import Job from '../models/Job'

// ── Process completed image job ───────────────────────────
export async function processImageJob(
  jobId:     string,
  userId:    string,
  outputUrl: string
): Promise<string> {
  try {
    const key         = generateKey(userId, 'image', 'jpg')
    const permanentUrl = await uploadFromUrl(outputUrl, key, 'image/jpeg')

    // Update job with permanent URL
    await Job.findByIdAndUpdate(jobId, {
      outputUrl:      permanentUrl,
      storageKey:     key,
      storageProvider: 'r2',
    })

    console.log(`Image saved to R2: ${key}`)
    return permanentUrl
  } catch (err: any) {
    console.error('Failed to save image to R2:', err.message)
    // Return original URL as fallback
    return outputUrl
  }
}

// ── Process completed video job ───────────────────────────
export async function processVideoJob(
  jobId:     string,
  userId:    string,
  outputUrl: string
): Promise<string> {
  try {
    const key          = generateKey(userId, 'video', 'mp4')
    const permanentUrl = await uploadFromUrl(outputUrl, key, 'video/mp4')

    await Job.findByIdAndUpdate(jobId, {
      outputUrl:       permanentUrl,
      storageKey:      key,
      storageProvider: 'r2',
    })

    console.log(`Video saved to R2: ${key}`)
    return permanentUrl
  } catch (err: any) {
    console.error('Failed to save video to R2:', err.message)
    return outputUrl
  }
}

// ── Process website HTML ──────────────────────────────────
export async function processWebsiteJob(
  jobId:     string,
  userId:    string,
  html:      string
): Promise<string> {
  try {
    const key          = generateKey(userId, 'website', 'html')
    const buffer       = Buffer.from(html, 'utf-8')

    const { uploadBuffer } = await import('./storage')
    const permanentUrl = await uploadBuffer(buffer, key, 'text/html')

    await Job.findByIdAndUpdate(jobId, {
      outputUrl:       permanentUrl,
      storageKey:      key,
      storageProvider: 'r2',
    })

    console.log(`Website saved to R2: ${key}`)
    return permanentUrl
  } catch (err: any) {
    console.error('Failed to save website to R2:', err.message)
    return ''
  }
}