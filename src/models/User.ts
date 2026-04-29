import mongoose, { Document, Schema } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId
  email: string
  name: string
  avatarUrl?: string
  googleId?: string
  passwordHash?: string
  creditsBalance: number
  referralCode: string
  referredBy?: string
  plan: 'FREE' | 'STARTER' | 'PRO'
  role: 'USER' | 'SUPERADMIN'
  stripeCustomerId?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  comparePassword(password: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>(
  {
    email:            { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:             { type: String, required: true, trim: true },
    avatarUrl:        { type: String },
    googleId:         { type: String, unique: true, sparse: true },
    passwordHash:     { type: String },
    creditsBalance:   { type: Number, default: 30, min: 0 },
    referralCode:     { type: String, unique: true, required: true },
    referredBy:       { type: String },
    plan:             { type: String, enum: ['FREE', 'STARTER', 'PRO'], default: 'FREE' },
    role: {
      type:    String,
      enum:    ['USER', 'SUPERADMIN'],
      default: 'USER',
    },
    stripeCustomerId: { type: String, unique: true, sparse: true },
    isActive:         { type: Boolean, default: true },
  },
  { timestamps: true }
)

// Compare password method
UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  if (!this.passwordHash) return false
  return bcrypt.compare(password, this.passwordHash)
}

// Indexes
// UserSchema.index({ email: 1 })
// UserSchema.index({ referralCode: 1 })

export default mongoose.model<IUser>('User', UserSchema)