const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    subject: { 
        type: String, 
        required: true 
    },
    university: { 
        type: String, 
        required: true 
    },
    capacity: { 
        type: Number, 
        required: true 
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    members: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('Group', GroupSchema);
