const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }, // Liên kết với Store
    date: { type: String, required: true },  // YYYY-MM-DD
    totalRevenue: { type: Number, default: 0 }
});

module.exports = mongoose.model('Revenue', revenueSchema);
