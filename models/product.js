const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    sold: { type: Number, default: 0 },
    imageUrl: { type: String, required: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    createdAt: { type: Date, default: Date.now },
    category: String,
    discountPercentage: { type: Number, default: 0 }, // Phần trăm giảm giá
    discountStartDate: { type: Date }, // Ngày bắt đầu khuyến mãi
    discountEndDate: { type: Date }   // Ngày kết thúc khuyến mãi
});

module.exports = mongoose.model('Product', productSchema);
