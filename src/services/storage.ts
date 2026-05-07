// import {
//     S3Client,
//     PutObjectCommand,
//     DeleteObjectCommand,
//   } from '@aws-sdk/client-s3'
  
//   // ── Lazy R2 client ────────────────────────────────────────
//   let r2Client: S3Client | null = null
  
//   const getR2 = (): S3Client => {
//     if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
//       throw new Error('R2 not configured — missing env vars')
//     }
//     if (!r2Client) {
//       r2Client = new S3Client({
//         region:   'auto',
//         endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
//         credentials: {
//           accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
//           secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
//         },
//       })
//     }
//     return r2Client
//   }
  
//   // ── Upload file from URL ──────────────────────────────────
//   export async function uploadFromUrl(
//     fileUrl:  string,
//     key:      string,
//     mimeType: string
//   ): Promise<string> {
//     // Download the file
//     const response = await fetch(fileUrl)
//     if (!response.ok) {
//       throw new Error(`Failed to fetch file: ${response.statusText}`)
//     }
  
//     const buffer      = await response.arrayBuffer()
//     const fileBuffer  = Buffer.from(buffer)
  
//     // Upload to R2
//     await getR2().send(new PutObjectCommand({
//       Bucket:      process.env.R2_BUCKET_NAME!,
//       Key:         key,
//       Body:        fileBuffer,
//       ContentType: mimeType,
//     }))
  
//     // Return permanent public URL
//     return `${process.env.R2_PUBLIC_URL}/${key}`
//   }
  
//   // ── Upload buffer directly ────────────────────────────────
//   export async function uploadBuffer(
//     buffer:   Buffer,
//     key:      string,
//     mimeType: string
//   ): Promise<string> {
//     await getR2().send(new PutObjectCommand({
//       Bucket:      process.env.R2_BUCKET_NAME!,
//       Key:         key,
//       Body:        buffer,
//       ContentType: mimeType,
//     }))
  
//     return `${process.env.R2_PUBLIC_URL}/${key}`
//   }
  
//   // ── Delete file ───────────────────────────────────────────
//   export async function deleteFile(key: string): Promise<void> {
//     await getR2().send(new DeleteObjectCommand({
//       Bucket: process.env.R2_BUCKET_NAME!,
//       Key:    key,
//     }))
//   }
  
//   // ── Generate storage key ──────────────────────────────────
//   export function generateKey(
//     userId: string,
//     type:   'image' | 'video' | 'website',
//     ext:    string
//   ): string {
//     const timestamp = Date.now()
//     const random    = Math.random().toString(36).slice(2, 8)
//     return `${type}s/${userId}/${timestamp}-${random}.${ext}`
//   }

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

let r2Client: S3Client | null = null

const getR2 = (): S3Client => {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID not set')
  }
  if (!process.env.R2_ACCESS_KEY_ID) {
    throw new Error('R2_ACCESS_KEY_ID not set')
  }
  if (!process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_SECRET_ACCESS_KEY not set')
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region:   'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return r2Client
}

// ── Upload from URL ───────────────────────────────────────
export async function uploadFromUrl(
  fileUrl:  string,
  key:      string,
  mimeType: string
): Promise<string> {
  console.log(`R2 storage: fetching file from ${fileUrl}`)

  const response = await fetch(fileUrl, {
    headers: {
      'User-Agent': 'Studio42/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer      = Buffer.from(arrayBuffer)

  console.log(`R2 storage: fetched ${buffer.length} bytes, uploading as ${mimeType}`)

  const client = getR2()

  await client.send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME!,
    Key:         key,
    Body:        buffer,
    ContentType: mimeType,
  }))

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`
  console.log(`R2 storage: upload complete → ${publicUrl}`)
  return publicUrl
}
// ── Upload buffer ─────────────────────────────────────────
export async function uploadBuffer(
  buffer:   Buffer,
  key:      string,
  mimeType: string
): Promise<string> {
  await getR2().send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME!,
    Key:         key,
    Body:        buffer,
    ContentType: mimeType,
  }))

  return `${process.env.R2_PUBLIC_URL}/${key}`
}

// ── Delete file ───────────────────────────────────────────
export async function deleteFile(key: string): Promise<void> {
  await getR2().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key:    key,
  }))
}

// ── Generate storage key ──────────────────────────────────
export function generateKey(
  userId: string,
  type:   'image' | 'video' | 'website',
  ext:    string
): string {
  const timestamp = Date.now()
  const random    = Math.random().toString(36).slice(2, 8)
  return `${type}s/${userId}/${timestamp}-${random}.${ext}`
}