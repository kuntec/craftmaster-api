import mongoose, { Document, Schema } from 'mongoose'

export type JobType   = 'IMAGE' | 'VIDEO' | 'WEBSITE'
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface IJob extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  type: JobType
  status: JobStatus
  prompt: string
  parameters: Record<string, any>
  creditsUsed: number
  replicateId?: string
  outputUrl?: string
  outputData?: Record<string, any>
  errorMessage?: string
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const JobSchema = new Schema<IJob>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:         { type: String, enum: ['IMAGE', 'VIDEO', 'WEBSITE'], required: true },
    status:       { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    prompt:       { type: String, required: true },
    parameters:   { type: Schema.Types.Mixed, default: {} },
    creditsUsed:  { type: Number, required: true },
    replicateId:  { type: String },
    outputUrl:    { type: String },
    outputData:   { type: Schema.Types.Mixed },
    errorMessage: { type: String },
    completedAt:  { type: Date },
  },
  { timestamps: true }
)

JobSchema.index({ userId: 1, createdAt: -1 })
JobSchema.index({ replicateId: 1 })
JobSchema.index({ status: 1 })

export default mongoose.model<IJob>('Job', JobSchema)