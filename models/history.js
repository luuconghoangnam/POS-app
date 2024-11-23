const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    products: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true },
            discountPercentage: { type: Number, default: true },
            totalProductPrice: { type: Number, required: true },
        }
    ],
    totalPrice: { type: Number, required: true },
    status: { type: String, default: 'Pending' },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('History', historySchema);
