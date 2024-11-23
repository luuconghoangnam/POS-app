const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    phone: { type: String },
    email: { type: String, required: true, unique: true },
    country: { type: String },
    city: { type: String },
    permissions: {
        manageInventory: { type: Boolean, default: false },
        sellProducts: { type: Boolean, default: false },
        updateStoreInfo: { type: Boolean, default: false }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
