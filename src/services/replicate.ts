import axios from 'axios'

const replicateClient = axios.create({
  baseURL: 'https://api.replicate.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
})

export const replicateService = {

  // ── Image generation (FLUX 1.1 Pro) ────────────────────
  async createImageJob(
    prompt: string,
    width:  number,
    height: number
  ): Promise<string> {
    const response = await replicateClient.post(
      '/models/black-forest-labs/flux-1.1-pro/predictions',
      {
        input: {
          prompt,
          width,
          height,
          num_outputs:    1,
          output_format:  'webp',
          output_quality: 90,
        },
      }
    )
    return response.data.id
  },

  // ── Wan 2.1 video ───────────────────────────────────────
  async createWanVideoJob(
    prompt:   string,
    duration: number
  ): Promise<string> {
    const response = await replicateClient.post(
      '/models/wavespeedai/wan-2.1-t2v-480p/predictions',
      {
        input: {
          prompt,
          num_frames:         duration === 10 ? 81 : 49,
          sample_shift:       8,
          sample_guide_scale: 5,
          fast_mode:          'Balanced',
        },
      }
    )
    return response.data.id
  },

  // ── Seedance 2.0 video ──────────────────────────────────
  async createSeedanceJob(
    prompt:       string,
    duration:     number,
    resolution:   '480p' | '720p' = '480p',
    aspectRatio:  string = '16:9',
    enableAudio:  boolean = true,
    startImage?:  string
  ): Promise<string> {
    const input: any = {
      prompt,
      duration,
      resolution,
      aspect_ratio:  aspectRatio,
      enable_audio:  enableAudio,
    }
    if (startImage) input.image = startImage

    const response = await replicateClient.post(
      '/models/bytedance/seedance-2.0/predictions',
      { input }
    )
    return response.data.id
  },

  // ── Kling v3 Video ──────────────────────────────────────
  async createKlingV3Job(
    prompt:       string,
    duration:     number,
    mode:         'standard' | 'pro' = 'standard',
    aspectRatio:  string = '16:9',
    generateAudio: boolean = true,
    startImage?:  string,
    endImage?:    string
  ): Promise<string> {
    const input: any = {
      prompt,
      duration,
      mode,
      aspect_ratio:    aspectRatio,
      generate_audio:  generateAudio,
    }
    if (startImage) input.start_image = startImage
    if (endImage)   input.end_image   = endImage

    const response = await replicateClient.post(
      '/models/kwaivgi/kling-v3-video/predictions',
      { input }
    )
    return response.data.id
  },

  // ── Kling v3 Omni ───────────────────────────────────────
  async createKlingV3OmniJob(
    prompt:           string,
    duration:         number,
    mode:             'standard' | 'pro' = 'standard',
    aspectRatio:      string = '16:9',
    generateAudio:    boolean = true,
    startImage?:      string,
    endImage?:        string,
    referenceImages?: string[]
  ): Promise<string> {
    const input: any = {
      prompt,
      duration,
      mode,
      aspect_ratio:    aspectRatio,
      generate_audio:  generateAudio,
    }
    if (startImage)                      input.start_image      = startImage
    if (endImage)                        input.end_image        = endImage
    if (referenceImages?.length)         input.reference_images = referenceImages

    const response = await replicateClient.post(
      '/models/kwaivgi/kling-v3-omni-video/predictions',
      { input }
    )
    return response.data.id
  },

  // ── Poll job status ─────────────────────────────────────
  async pollJob(replicateId: string): Promise<{
    status:  'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
    output?: string | string[]
    error?:  string
  }> {
    const response = await replicateClient.get(
      `/predictions/${replicateId}`
    )
    return response.data
  },
}