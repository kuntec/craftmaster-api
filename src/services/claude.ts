import Anthropic from '@anthropic-ai/sdk'

const getClient = (): Anthropic => {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in .env')
  return new Anthropic({ apiKey: key })
}

const SYSTEM_PROMPT = `You are an expert web developer. Generate a complete, single-file HTML website based on the user's description.

Rules:
- Output ONLY valid HTML — no markdown, no explanation, no code fences
- Include all CSS in a <style> tag inside <head>
- Include all JavaScript in a <script> tag before </body>
- Use modern, clean design with good typography
- Make it fully mobile responsive
- Use a professional color palette appropriate to the topic
- Include realistic placeholder content
- Add smooth hover effects and transitions
- Design must look polished and production-ready
- Do NOT use any external CSS frameworks or JS libraries
- Do NOT include any comments in the output

Output only the complete HTML document starting with <!DOCTYPE html>`

export const claudeService = {

  // Generate a full website
  async generateWebsite(prompt: string, style: string = 'modern'): Promise<string> {
    const client = getClient()

    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system:     SYSTEM_PROMPT,
      messages: [
        {
          role:    'user',
          content: `Create a ${style} style website for: ${prompt}`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response from Claude')
    }

    // Strip any accidental code fences
    let html = content.text.trim()
    if (html.startsWith('```')) {
      html = html.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
    }

    if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
      throw new Error('Claude returned invalid HTML')
    }

    return html
  },
}