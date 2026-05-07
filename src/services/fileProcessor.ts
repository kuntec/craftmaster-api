// import Job from '../models/Job'

// // R2 temporarily disabled — returns original URL as-is
// export async function processImageJob(
//   jobId:     string,
//   userId:    string,
//   outputUrl: string
// ): Promise<string> {
//   console.log('R2 disabled — skipping image upload for job:', jobId)
//   return outputUrl
// }

// export async function processVideoJob(
//   jobId:     string,
//   userId:    string,
//   outputUrl: string
// ): Promise<string> {
//   console.log('R2 disabled — skipping video upload for job:', jobId)
//   return outputUrl
// }

// export async function processWebsiteJob(
//   jobId:     string,
//   userId:    string,
//   html:      string
// ): Promise<string> {
//   console.log('R2 disabled — skipping website upload for job:', jobId)
//   return ''
// }

import Job               from '../models/Job'
import { uploadFromUrl, uploadBuffer, generateKey } from './storage'

// ── Process completed image job ───────────────────────────
export async function processImageJob(
  jobId:     string,
  userId:    string,
  outputUrl: string
): Promise<string> {
  try {
    console.log(`R2: uploading image for job ${jobId}`)

    const key          = generateKey(userId, 'image', 'jpg')
    const permanentUrl = await uploadFromUrl(outputUrl, key, 'image/jpeg')

    await Job.findByIdAndUpdate(jobId, {
      outputUrl:       permanentUrl,
      storageKey:      key,
      storageProvider: 'r2',
    })

    console.log(`R2: image saved → ${permanentUrl}`)
    return permanentUrl
  } catch (err: any) {
    console.error(`R2: image upload failed → ${err.message}`)
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
    console.log(`R2: uploading video for job ${jobId}`)

    const key          = generateKey(userId, 'video', 'mp4')
    const permanentUrl = await uploadFromUrl(outputUrl, key, 'video/mp4')

    await Job.findByIdAndUpdate(jobId, {
      outputUrl:       permanentUrl,
      storageKey:      key,
      storageProvider: 'r2',
    })

    console.log(`R2: video saved → ${permanentUrl}`)
    return permanentUrl
  } catch (err: any) {
    console.error(`R2: video upload failed → ${err.message}`)
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
    console.log(`R2: uploading website for job ${jobId}`)

    const key          = generateKey(userId, 'website', 'html')
    const buffer       = Buffer.from(html, 'utf-8')
    const permanentUrl = await uploadBuffer(buffer, key, 'text/html')

    await Job.findByIdAndUpdate(jobId, {
      outputUrl:       permanentUrl,
      storageKey:      key,
      storageProvider: 'r2',
    })

    console.log(`R2: website saved → ${permanentUrl}`)
    return permanentUrl
  } catch (err: any) {
    console.error(`R2: website upload failed → ${err.message}`)
    return ''
  }
}