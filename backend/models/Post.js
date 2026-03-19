const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    user: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      fullname: { type: String, required: true },
      profile_picture: { type: String },
    },
    image_url: { type: String, default: null },
    image_urls: [{ type: String }],
    caption: { type: String, maxLength: 500 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [],
    category: { type: String, required: true },
    location: {
      name: { type: String, default: null },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    music: {
      title: { type: String, default: null },
      artist: { type: String, default: null },
    },
    score: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PostSchema.index({ score: -1, createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);