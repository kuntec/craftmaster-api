import mongoose, { Document, Schema } from 'mongoose'

export type TransactionType =
  | 'TOPUP'
  | 'USAGE'
  | 'REFERRAL_GIVE'
  | 'REFERRAL_RECEIVE'
  | 'FREE_CREDITS'

export interface ICreditTransaction extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  amount: number
  type: TransactionType
  description: string
  stripePaymentId?: string
  jobId?: mongoose.Types.ObjectId
  createdAt: Date
}

const CreditTransactionSchema = new Schema<ICreditTransaction>(
  {
    userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount:          { type: Number, required: true },
    type:            { type: String, enum: ['TOPUP', 'USAGE', 'REFERRAL_GIVE', 'REFERRAL_RECEIVE', 'FREE_CREDITS'], required: true },
    description:     { type: String, required: true },
    stripePaymentId: { type: String },
    jobId:           { type: Schema.Types.ObjectId, ref: 'Job' },
  },
  { timestamps: true }
)

// Indexes
CreditTransactionSchema.index({ userId: 1, createdAt: -1 })

export default mongoose.model<ICreditTransaction>('CreditTransaction', CreditTransactionSchema)