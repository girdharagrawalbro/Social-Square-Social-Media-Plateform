const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    image_url: {
      type: String,
      // required: true,
      default: "https://example.com/default-image.jpg", // Use a URL to a placeholder image
      validate: {
        validator: function (value) {
          return /^(https?:\/\/|data:image\/)/.test(value); // Check for URL or base64
        },
        message: (props) => `${props.value} is not a valid image URL or base64 string!`,
      },
    },
    caption: {
      type: String,
      maxLength: 500, // Example: Limit the caption length
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: { type: String, required: true },
        created_at: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

module.exports = mongoose.model('Post', PostSchema);
