import Job from '../models/Job'

// R2 temporarily disabled — returns original URL as-is
export async function processImageJob(
  jobId:     string,
  userId:    string,
  outputUrl: string
): Promise<string> {
  console.log('R2 disabled — skipping image upload for job:', jobId)
  return outputUrl
}

export async function processVideoJob(
  jobId:     string,
  userId:    string,
  outputUrl: string
): Promise<string> {
  console.log('R2 disabled — skipping video upload for job:', jobId)
  return outputUrl
}

export async function processWebsiteJob(
  jobId:     string,
  userId:    string,
  html:      string
): Promise<string> {
  console.log('R2 disabled — skipping website upload for job:', jobId)
  return ''
}