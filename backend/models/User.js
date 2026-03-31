const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  profile_picture: {
    type: String,
    default: "https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain",
  },
  bio: { type: String, default: null },
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  googleId: { type: String, default: null },
  githubId: { type: String, default: null },
  authProvider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorOtp: { type: String, default: null },
  twoFactorOtpExpires: { type: Date, default: null },

  // Admin
  isAdmin: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: null },
  bannedAt: { type: Date, default: null },

  // User Preferences
  preferredMood: { 
    type: String, 
    default: null, 
    trim: true,
    set: v => (v === "" ? null : v),
    enum: ['happy', 'excited', 'funny', 'romantic', 'inspirational', 'calm', 'nostalgic', 'sad', null] 
  },
  isPrivate: { type: Boolean, default: false },
  followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Verification
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null },
  emailVerificationTokenSentAt: { type: Date, default: null },

  // Analytics
  profileViews: { type: Number, default: 0 },

  // User Preferences
  notificationSettings: {
    emailDigest: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: true },
  },

  created_at: { type: Date, default: Date.now },
});


module.exports = mongoose.model('User', UserSchema);