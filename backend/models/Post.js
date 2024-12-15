const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    user: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      fullname: { type: String, required: true },
      profile_picture: { type: String },
    },
    image_url: {
      type: String,
      validate: {
        validator: function (value) {
          return /^(https?:\/\/|data:image\/)/.test(value);
        },
        message: (props) => `${props.value} is not a valid image URL or base64 string!`,
      },
    },
    caption: {
      type: String,
      maxLength: 500,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [
      
    ],
    category: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Post', PostSchema);
