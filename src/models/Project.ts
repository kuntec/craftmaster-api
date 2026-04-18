import mongoose, { Document, Schema } from 'mongoose'

export type ProjectPlan   = 'BASIC' | 'MEDIUM' | 'ADVANCED'
export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED'
export type ProjectStack  = 'MONGO_NODE_NEXT'

export interface IProjectFeature {
  id:          string
  title:       string
  description: string
}

export interface IPlannedStep {
  stepNumber:  number
  title:       string
  description: string
}

export interface IProjectStep {
  stepNumber:       number
  title:            string
  explanation:      string
  files: {
    filename: string
    language: string
    code:     string
  }[]
  testInstructions: string
  creditsUsed:      number
  completedAt?:     Date
}

export interface IProject extends Document {
  _id:          mongoose.Types.ObjectId
  userId:       mongoose.Types.ObjectId
  title:        string
  description:  string
  plan:         ProjectPlan
  stack:        ProjectStack
  status:       ProjectStatus
  totalSteps:   number
  currentStep:  number
  totalCredits: number
  usedCredits:  number
  features:     IProjectFeature[]
  plannedSteps: IPlannedStep[]
  steps:        IProjectStep[]
  createdAt:    Date
  updatedAt:    Date
}

// ── Sub schemas ───────────────────────────────────────────

const ProjectFeatureSchema = new Schema<IProjectFeature>(
  {
    id:          { type: String, required: true },
    title:       { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
)

const PlannedStepSchema = new Schema<IPlannedStep>(
  {
    stepNumber:  { type: Number, required: true },
    title:       { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
)

const ProjectStepSchema = new Schema<IProjectStep>(
  {
    stepNumber:   { type: Number, required: true },
    title:        { type: String, required: true },
    explanation:  { type: String, required: true },
    files: [
      {
        filename: { type: String, required: true },
        language: { type: String, required: true },
        code:     { type: String, required: true },
      },
    ],
    testInstructions: { type: String, default: '' },
    creditsUsed:      { type: Number, required: true },
    completedAt:      { type: Date },
  },
  { _id: false }
)

// ── Main schema ───────────────────────────────────────────

const ProjectSchema = new Schema<IProject>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    description: {
      type:     String,
      required: true,
      trim:     true,
    },
    plan: {
      type:     String,
      enum:     ['BASIC', 'MEDIUM', 'ADVANCED'],
      required: true,
    },
    stack: {
      type:    String,
      enum:    ['MONGO_NODE_NEXT'],
      default: 'MONGO_NODE_NEXT',
    },
    status: {
      type:    String,
      enum:    ['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED'],
      default: 'PLANNING',
    },
    totalSteps:   { type: Number, default: 0 },
    currentStep:  { type: Number, default: 0 },
    totalCredits: { type: Number, default: 0 },
    usedCredits:  { type: Number, default: 0 },
    features:     [ProjectFeatureSchema],
    plannedSteps: [PlannedStepSchema],
    steps:        [ProjectStepSchema],
  },
  { timestamps: true }
)

// ── Indexes ───────────────────────────────────────────────

ProjectSchema.index({ userId: 1, createdAt: -1 })
ProjectSchema.index({ status: 1 })

export default mongoose.model<IProject>('Project', ProjectSchema)