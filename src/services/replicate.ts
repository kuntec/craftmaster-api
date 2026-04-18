import axios from 'axios'

const replicateClient = axios.create({
  baseURL: 'https://api.replicate.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
})

export const replicateService = {

  // Create image generation job
  async createImageJob(prompt: string, width: number, height: number): Promise<string> {
    const response = await replicateClient.post(
      '/models/black-forest-labs/flux-1.1-pro/predictions',
      {
        input: {
          prompt,
          width,
          height,
          num_outputs: 1,
          output_format: 'webp',
          output_quality: 90,
        },
      }
    )
    return response.data.id
  },

  // Create video generation job
  async createVideoJob(prompt: string, duration: number): Promise<string> {
    const response = await replicateClient.post(
      '/models/wavespeedai/wan-2.1-t2v-480p/predictions',
      {
        input: {
          prompt,
          num_frames: duration === 10 ? 81 : 49,
          sample_shift: 8,
          sample_guide_scale: 5,
          fast_mode: 'Balanced',
        },
      }
    )
    return response.data.id
  },

  // Poll job status
  async pollJob(replicateId: string): Promise<{
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
    output?: string | string[]
    error?: string
  }> {
    const response = await replicateClient.get(`/predictions/${replicateId}`)
    return response.data
  },
}