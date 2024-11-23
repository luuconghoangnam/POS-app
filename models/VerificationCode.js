const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
    email: { type: String, required: true }, // Email nhận mã
    code: { type: String, required: true },  // Mã xác thực
    expiresAt: { type: Date, required: true } // Thời gian hết hạn
});

// Tự động xóa mã xác thực sau khi hết hạn (TTL - Time To Live)
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);
