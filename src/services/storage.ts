import axios from 'axios'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

let r2Client: S3Client | null = null

const getR2 = (): S3Client => {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('CLOUDFLARE_ACCOUNT_ID not set')
  if (!process.env.R2_ACCESS_KEY_ID)      throw new Error('R2_ACCESS_KEY_ID not set')
  if (!process.env.R2_SECRET_ACCESS_KEY)  throw new Error('R2_SECRET_ACCESS_KEY not set')
  if (!process.env.R2_BUCKET_NAME)        throw new Error('R2_BUCKET_NAME not set')

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
  console.log(`R2: downloading from ${fileUrl}`)

  const response = await axios.get(fileUrl, {
    responseType: 'arraybuffer',
    timeout:      60000,
    headers:      { 'User-Agent': 'Studio42/1.0' },
  })

  const buffer = Buffer.from(response.data)
  console.log(`R2: downloaded ${buffer.length} bytes`)

  await getR2().send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME!,
    Key:         key,
    Body:        buffer,
    ContentType: mimeType,
  }))

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`
  console.log(`R2: uploaded → ${publicUrl}`)
  return publicUrl
}

// ── Upload buffer directly ────────────────────────────────
export async function uploadBuffer(
  buffer:   Buffer,
  key:      string,
  mimeType: string
): Promise<string> {
  console.log(`R2: uploading buffer ${buffer.length} bytes as ${key}`)

  await getR2().send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME!,
    Key:         key,
    Body:        buffer,
    ContentType: mimeType,
  }))

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`
  console.log(`R2: buffer uploaded → ${publicUrl}`)
  return publicUrl
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