import mongoose, { Document, Schema } from 'mongoose'

export interface IMessage {
  role:      'user' | 'assistant'
  content:   string
  model?:    string
  credits?:  number
  createdAt: Date
}

export interface IConversation extends Document {
  userId:       mongoose.Types.ObjectId
  title:        string
  modelId:        string
  messages:     IMessage[]
  totalCredits: number
  createdAt:    Date
  updatedAt:    Date
}

const MessageSchema = new Schema<IMessage>({
  role:      { type: String, enum: ['user', 'assistant'], required: true },
  content:   { type: String, required: true },
  model:     { type: String },
  credits:   { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
})

const ConversationSchema = new Schema<IConversation>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title:        { type: String, default: 'New conversation' },
    modelId:        { type: String, required: true },
    messages:     [MessageSchema],
    totalCredits: { type: Number, default: 0 },
  },
  { timestamps: true }
)

ConversationSchema.index({ userId: 1, createdAt: -1 })

export default mongoose.model<IConversation>('Conversation', ConversationSchema)