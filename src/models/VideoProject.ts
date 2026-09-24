import mongoose, { Document, Schema } from 'mongoose'

// ── Scene sub-document ────────────────────────────────────
export interface IScene {
  _id:             mongoose.Types.ObjectId
  sceneNumber:     number
  title:           string
  description:     string
  mood:            string
  narration:       string
  estimatedSeconds:number
  imagePrompt:     string
  videoPrompt:     string
  imageJobId:      mongoose.Types.ObjectId | null
  videoJobId:      mongoose.Types.ObjectId | null
  imageUrl:        string | null
  videoUrl:        string | null
  imageStatus:     'pending' | 'generating' | 'completed' | 'failed'
  videoStatus:     'pending' | 'generating' | 'completed' | 'failed'
}

// ── VideoProject document ─────────────────────────────────
export interface IVideoProject extends Document {
  userId:         mongoose.Types.ObjectId
  name:           string
  channelType:    string
  style:          string
  targetAudience: string
  duration:       'short' | 'medium' | 'long'
  idea:           string
  script:         string
  scenes:         IScene[]
  status:         'setup' | 'script' | 'scenes' | 'assets' | 'complete'
  creditsUsed:    number
  createdAt:      Date
  updatedAt:      Date
}

const SceneSchema = new Schema<IScene>(
  {
    sceneNumber:      { type: Number,  required: true },
    title:            { type: String,  default: '' },
    description:      { type: String,  default: '' },
    mood:             { type: String,  default: '' },
    narration:        { type: String,  default: '' },
    estimatedSeconds: { type: Number,  default: 30 },
    imagePrompt:      { type: String,  default: '' },
    videoPrompt:      { type: String,  default: '' },
    imageJobId:       { type: Schema.Types.ObjectId, ref: 'Job', default: null },
    videoJobId:       { type: Schema.Types.ObjectId, ref: 'Job', default: null },
    imageUrl:         { type: String,  default: null },
    videoUrl:         { type: String,  default: null },
    imageStatus:      { type: String,  enum: ['pending','generating','completed','failed'], default: 'pending' },
    videoStatus:      { type: String,  enum: ['pending','generating','completed','failed'], default: 'pending' },
  },
  { _id: true }
)

const VideoProjectSchema = new Schema<IVideoProject>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    name:           { type: String, required: true },
    channelType:    { type: String, required: true },
    style:          { type: String, default: '' },
    targetAudience: { type: String, default: '' },
    duration: {
      type:    String,
      enum:    ['short', 'medium', 'long'],
      default: 'medium',
    },
    idea:        { type: String, default: '' },
    script:      { type: String, default: '' },
    scenes:      { type: [SceneSchema], default: [] },
    status: {
      type:    String,
      enum:    ['setup', 'script', 'scenes', 'assets', 'complete'],
      default: 'setup',
    },
    creditsUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
)

VideoProjectSchema.index({ userId: 1, createdAt: -1 })

export default mongoose.model<IVideoProject>('VideoProject', VideoProjectSchema)
