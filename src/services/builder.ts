import Anthropic from '@anthropic-ai/sdk'

const getClient = (): Anthropic => {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey: key })
}

// ── Types ─────────────────────────────────────────────────
export interface PlanFeature {
  id:          string
  title:       string
  description: string
}

export interface PlanStep {
  stepNumber:  number
  title:       string
  description: string
}

export interface ProjectPlanOption {
  plan:             'BASIC' | 'MEDIUM' | 'ADVANCED'
  title:            string
  description:      string
  features:         PlanFeature[]
  steps:            PlanStep[]
  totalSteps:       number
  estimatedCredits: number
}

export interface GeneratedStep {
  stepNumber:       number
  title:            string
  explanation:      string
  files: {
    filename: string
    language: string
    code:     string
  }[]
  testInstructions: string
}

// ── Plan generation ───────────────────────────────────────
export const builderService = {

  async generatePlans(description: string): Promise<ProjectPlanOption[]> {
    const client = getClient()

    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: `You are a senior software architect specializing in MongoDB + Node.js + Next.js stack.
A user wants to build a software project. Generate 3 plan options: BASIC, MEDIUM, ADVANCED.

Return ONLY valid JSON — no markdown, no explanation, no code fences.

JSON structure:
{
  "plans": [
    {
      "plan": "BASIC",
      "title": "short title",
      "description": "what this plan includes in 1-2 sentences",
      "features": [
        { "id": "f1", "title": "Feature name", "description": "what it does" }
      ],
      "steps": [
        { "stepNumber": 1, "title": "Step title", "description": "what we build" }
      ],
      "totalSteps": 8,
      "estimatedCredits": 120
    }
  ]
}

Rules:
- BASIC: 6-8 steps, core features only, estimatedCredits 80-150
- MEDIUM: 12-14 steps, standard features, estimatedCredits 180-280
- ADVANCED: 18-20 steps, full features, estimatedCredits 300-450
- Stack is always MongoDB + Node.js/Express + Next.js
- Steps must be in logical build order (models first, then routes, then frontend)
- Each step builds on the previous one`,
      messages: [
        {
          role:    'user',
          content: `Generate 3 plans for: ${description}`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response')

    let text = content.text.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(text)
    return parsed.plans as ProjectPlanOption[]
  },

  // ── Step generation ──────────────────────────────────────
  async generateStep(
    projectTitle:    string,
    projectDescription: string,
    plan:            string,
    stepNumber:      number,
    stepTitle:       string,
    stepDescription: string,
    completedSteps:  string[]
  ): Promise<GeneratedStep> {
    const client = getClient()

    const completedContext = completedSteps.length > 0
      ? `\nCompleted steps so far:\n${completedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : '\nThis is the first step.'

    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: `You are a senior developer building a ${plan} version of a project.
Stack: MongoDB + Node.js/Express/TypeScript + Next.js/React/TypeScript.
You explain each step clearly like a mentor teaching a junior developer.

Return ONLY valid JSON — no markdown, no explanation, no code fences.

JSON structure:
{
  "stepNumber": 1,
  "title": "step title",
  "explanation": "2-3 paragraphs explaining WHY this step exists, what we are building, and how it fits into the overall system",
  "files": [
    {
      "filename": "src/models/User.ts",
      "language": "typescript",
      "code": "complete file code here"
    }
  ],
  "testInstructions": "how to verify this step works (postman request, browser check etc)"
}

Rules:
- explanation must be genuinely helpful — not generic
- code must be complete and production ready
- filename must be the exact path relative to project root
- include ALL files needed for this step
- code must work with the previous steps
- always use TypeScript
- always use proper error handling
- keep each file under 150 lines — split into multiple files if needed
- do not over-engineer — only what is needed for this specific step
- generate maximum 4 files per step`,
      messages: [
        {
          role: 'user',
          content: `Project: ${projectTitle}
Description: ${projectDescription}
Plan: ${plan}
${completedContext}

Now generate Step ${stepNumber}: ${stepTitle}
What this step should do: ${stepDescription}`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response')

    let text = content.text.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(text)
    return parsed as GeneratedStep
  },
}