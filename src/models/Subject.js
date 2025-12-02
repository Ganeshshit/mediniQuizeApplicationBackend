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

subjectSchema.index({ code: 1 });
subjectSchema.index({ semester: 1, department: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
