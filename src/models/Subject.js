// ============================================
// models/Subject.js
// ============================================
const mongoose = require('mongoose');
const { Schema } = mongoose;

const subjectSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    department: {
        type: String,
        trim: true
    },
    semester: {
        type: Number,
        min: 1
    },
    credits: {
        type: Number,
        min: 1,
        max: 10,
        default: 3
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Ensure both name & code are unique
subjectSchema.index({ name: 1 }, { unique: true });
subjectSchema.index({ code: 1 }, { unique: true });

// Optional: useful for filtering
subjectSchema.index({ department: 1, semester: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
