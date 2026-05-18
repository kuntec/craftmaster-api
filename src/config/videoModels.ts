export interface VideoModel {
    id:          string
    name:        string
    description: string
    replicateId: string
    credits:     number
    badge:       string
    badgeColor:  string
    duration:    string
    resolution:  string
    audio:       boolean
    features:    string[]
    modes:       ('text' | 'image')[]
    default?:    boolean
  }
  
  export const VIDEO_MODELS: VideoModel[] = [
    {
      id:          'wan-2.1',
      name:        'Wan 2.1',
      description: 'Fast and reliable text-to-video. Great for quick generations.',
      replicateId: 'wavespeedai/wan-2.1-t2v-480p',
      credits:     35,
      badge:       'Budget',
      badgeColor:  '#10B981',
      duration:    '5s or 10s',
      resolution:  '480p',
      audio:       false,
      features:    ['Fast generation', 'Reliable output', 'Low cost'],
      modes:       ['text'],
    },
    {
      id:          'seedance-2.0',
      name:        'Seedance 2.0',
      description: 'ByteDance\'s latest model. Native audio, better motion and physics.',
      replicateId: 'bytedance/seedance-2.0',
      credits:     50,
      badge:       'Best value',
      badgeColor:  '#4F8EF7',
      duration:    '4-15s',
      resolution:  '480p / 720p',
      audio:       true,
      features:    ['Native audio', 'Better motion', 'Lip sync', 'Image-to-video'],
      modes:       ['text', 'image'],
      default:     true,
    },
    {
      id:          'kling-v3',
      name:        'Kling v3',
      description: 'Cinematic quality up to 15 seconds. Multi-shot control and native audio.',
      replicateId: 'kwaivgi/kling-v3-video',
      credits:     60,
      badge:       'Premium',
      badgeColor:  '#7B2FBE',
      duration:    '3-15s',
      resolution:  '720p / 1080p',
      audio:       true,
      features:    ['Up to 1080p', 'Multi-shot', 'Native audio', 'Lip sync'],
      modes:       ['text', 'image'],
    },
    {
      id:          'kling-v3-omni',
      name:        'Kling v3 Omni',
      description: 'Most powerful model. Reference images, video editing, character consistency.',
      replicateId: 'kwaivgi/kling-v3-omni-video',
      credits:     80,
      badge:       'Pro',
      badgeColor:  '#F59E0B',
      duration:    '3-15s',
      resolution:  '720p / 1080p',
      audio:       true,
      features:    ['Reference images', 'Video editing', 'Character consistency', '1080p'],
      modes:       ['text', 'image'],
    },
  ]
  
  export const getVideoModel = (id: string) =>
    VIDEO_MODELS.find(m => m.id === id) ?? VIDEO_MODELS.find(m => m.default)!
  
  export const DEFAULT_VIDEO_MODEL = VIDEO_MODELS.find(m => m.default)!