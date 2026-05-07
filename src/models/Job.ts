import mongoose, { Document, Schema } from 'mongoose'

export interface IJob extends Document {
  userId:          mongoose.Types.ObjectId
  type:            'IMAGE' | 'VIDEO' | 'WEBSITE' | 'PROJECT'
  status:          'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  prompt:          string
  parameters:      Record<string, any>
  creditsUsed:     number
  replicateId:     string | null
  outputUrl:       string | null
  outputData:      Record<string, any> | null
  errorMessage:    string | null
  storageKey:      string | null
  storageProvider: 'r2' | 'replicate'
  createdAt:       Date
  updatedAt:       Date
}

const JobSchema = new Schema<IJob>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    type: {
      type:     String,
      enum:     ['IMAGE', 'VIDEO', 'WEBSITE', 'PROJECT'],
      required: true,
    },
    status: {
      type:    String,
      enum:    ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    prompt: {
      type:    String,
      default: '',
    },
    parameters: {
      type:    Schema.Types.Mixed,
      default: {},
    },
    creditsUsed: {
      type:    Number,
      default: 0,
    },
    replicateId: {
      type:    String,
      default: null,
    },
    outputUrl: {
      type:    String,
      default: null,
    },
    outputData: {
      type:    Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type:    String,
      default: null,
    },
    storageKey: {
      type:    String,
      default: null,
    },
    storageProvider: {
      type:    String,
      enum:    ['r2', 'replicate'],
      default: 'replicate',
    },
  },
  { timestamps: true }
)

JobSchema.index({ userId: 1, createdAt: -1 })
JobSchema.index({ status: 1 })
JobSchema.index({ replicateId: 1 })

export default mongoose.model<IJob>('Job', JobSchema)