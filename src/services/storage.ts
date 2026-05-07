import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
  } from '@aws-sdk/client-s3'
  
  // ── Lazy R2 client ────────────────────────────────────────
  let r2Client: S3Client | null = null
  
  const getR2 = (): S3Client => {
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
  
  // ── Upload file from URL ──────────────────────────────────
  export async function uploadFromUrl(
    fileUrl:  string,
    key:      string,
    mimeType: string
  ): Promise<string> {
    // Download the file
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }
  
    const buffer      = await response.arrayBuffer()
    const fileBuffer  = Buffer.from(buffer)
  
    // Upload to R2
    await getR2().send(new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET_NAME!,
      Key:         key,
      Body:        fileBuffer,
      ContentType: mimeType,
    }))
  
    // Return permanent public URL
    return `${process.env.R2_PUBLIC_URL}/${key}`
  }
  
  // ── Upload buffer directly ────────────────────────────────
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