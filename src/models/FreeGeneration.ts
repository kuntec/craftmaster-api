import mongoose, { Document, Schema } from 'mongoose'

export type FreeGenType = 'IMAGE' | 'WEBSITE' | 'BUILDER_PLAN'

export interface IFreeGeneration extends Document {
  ip:        string
  type:      FreeGenType
  createdAt: Date
}

const FreeGenerationSchema = new Schema<IFreeGeneration>(
  {
    ip:   { type: String, required: true, index: true },
    type: { type: String, enum: ['IMAGE', 'WEBSITE', 'BUILDER_PLAN'], required: true },
  },
  { timestamps: true }
)

// Auto delete after 24 hours — rate limit resets daily
FreeGenerationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 }
)

FreeGenerationSchema.index({ ip: 1, type: 1 })

export default mongoose.model<IFreeGeneration>('FreeGeneration', FreeGenerationSchema)