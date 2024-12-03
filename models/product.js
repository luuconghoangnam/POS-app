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
    category: { type: String },
    discountPercentage: { type: Number, default: 0 },
    discountStartDate: { type: Date },
    discountEndDate: { type: Date },
    
    // Mã sản phẩm
    productCode: { type: String, required: true, unique: true },

    // Đơn vị sản phẩm
    unit: { 
        type: String, 
        enum: ['cái', 'hộp', 'kg', 'lít', 'mét', 'túi', 'gói'],
        required: true 
    }
});

module.exports = mongoose.model('Product', productSchema);
