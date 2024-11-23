import mongoose from 'mongoose';


const PostSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
    }
    ,
    image_url: {
        type: String,
        required: true,
    },
    caption: {
        type: String,
        default: null,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }]
});

module.exports = mongoose.model('Post', PostSchema);

