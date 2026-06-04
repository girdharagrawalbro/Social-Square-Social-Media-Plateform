const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    mobile: {
        type: String,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    ip: {
        type: String
    },
    device: {
        type: String
    },
    location: {
        city: { type: String, default: 'Unknown' },
        region: { type: String, default: 'Unknown' },
        country: { type: String, default: 'Unknown' }
    },
    status: {
        type: String,
        enum: ['unseen', 'seen', 'replied'],
        default: 'unseen'
    },
    replies: [
        {
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            message: {
                type: String,
                required: true
            },
            sentAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound indexes for pagination and filtering
ContactSchema.index({ status: 1, createdAt: -1 });
ContactSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Contact', ContactSchema);
