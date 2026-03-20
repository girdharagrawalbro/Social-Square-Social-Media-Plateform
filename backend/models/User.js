const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
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

  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);