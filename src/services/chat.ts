import Anthropic        from '@anthropic-ai/sdk'
import OpenAI           from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ChatModel }    from '../config/chatModels'
import { Response }     from 'express'

// ── Lazy clients ──────────────────────────────────────────
let openaiClient:   OpenAI           | null = null
let anthropicClient: Anthropic       | null = null
let googleClient:   GoogleGenerativeAI | null = null

const getOpenAI = () => {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openaiClient
}

const getAnthropic = () => {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return anthropicClient
}

const getGoogle = () => {
  if (!googleClient) googleClient = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_KEY!)
  return googleClient
}

// ── Message type ──────────────────────────────────────────
export interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

// ── Stream handler ────────────────────────────────────────
export async function streamChat(
  model:    ChatModel,
  messages: ChatMessage[],
  res:      Response
): Promise<string> {

  // Set SSE headers
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  let fullText = ''

  const send = (chunk: string) => {
    fullText += chunk
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
  }

  const done = () => {
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }

  try {
    if (model.provider === 'openai') {
      const stream = await getOpenAI().chat.completions.create({
        model:    model.modelId,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream:   true,
        max_tokens: 2048,
      })

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) send(text)
      }

    } else if (model.provider === 'anthropic') {
      const userMessages = messages.filter(m => (m.role as string) !== 'system')

      const stream = getAnthropic().messages.stream({
        model:      model.modelId,
        max_tokens: 2048,
        messages:   userMessages.map(m => ({
          role:    m.role as 'user' | 'assistant',
          content: m.content,
        })),
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          send(event.delta.text)
        }
      }

    } else if (model.provider === 'google') {
      const googleModel = getGoogle().getGenerativeModel({
        model: model.modelId,
      })

      // Convert to Google format
      const history = messages.slice(0, -1).map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

      const lastMessage = messages[messages.length - 1].content

      const chat   = googleModel.startChat({ history })
      const result = await chat.sendMessageStream(lastMessage)

      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) send(text)
      }
    }

    done()
    return fullText

  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
    throw err
  }
}