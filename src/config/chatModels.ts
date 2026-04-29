export interface ChatModel {
    id:          string
    name:        string
    provider:    'openai' | 'anthropic' | 'google'
    modelId:     string
    credits:     number
    description: string
    badge:       string
    color:       string
    fast:        boolean
  }
  
  export const CHAT_MODELS: ChatModel[] = [
    {
      id:          'gpt-4o',
      name:        'GPT-4o',
      provider:    'openai',
      modelId:     'gpt-4o',
      credits:     5,
      description: 'Most capable OpenAI model. Great for complex tasks.',
      badge:       'Powerful',
      color:       '#10A37F',
      fast:        false,
    },
    {
      id:          'gpt-4o-mini',
      name:        'GPT-4o mini',
      provider:    'openai',
      modelId:     'gpt-4o-mini',
      credits:     1,
      description: 'Fast and affordable. Great for everyday tasks.',
      badge:       'Fast',
      color:       '#10A37F',
      fast:        true,
    },
    {
      id:          'claude-sonnet',
      name:        'Claude Sonnet 4',
      provider:    'anthropic',
      modelId:     'claude-sonnet-4-20250514',
      credits:     5,
      description: 'Anthropic\'s most intelligent model. Excellent reasoning.',
      badge:       'Smart',
      color:       '#D97706',
      fast:        false,
    },
    {
      id:          'claude-haiku',
      name:        'Claude Haiku',
      provider:    'anthropic',
      modelId:     'claude-haiku-4-5-20251001',
      credits:     1,
      description: 'Fastest Claude model. Great for quick responses.',
      badge:       'Fast',
      color:       '#D97706',
      fast:        true,
    },
    {
      id:          'gemini-pro',
      name:        'Gemini 1.5 Pro',
      provider:    'google',
      modelId:     'gemini-1.5-pro',
      credits:     3,
      description: 'Google\'s most capable model. Great for analysis.',
      badge:       'Capable',
      color:       '#4F8EF7',
      fast:        false,
    },
    {
      id:          'gemini-flash',
      name:        'Gemini Flash',
      provider:    'google',
      modelId:     'gemini-1.5-flash',
      credits:     1,
      description: 'Google\'s fastest model. Ideal for simple tasks.',
      badge:       'Fast',
      color:       '#4F8EF7',
      fast:        true,
    },
  ]
  
  export const getModel = (id: string) =>
    CHAT_MODELS.find(m => m.id === id)