const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const purchaseHistorySchema = new Schema({
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number,  // Giá tại thời điểm mua
    date: { type: Date, default: Date.now }
});

const customerSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    purchaseHistory: [purchaseHistorySchema],
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true }
});

module.exports = mongoose.model('Customer', customerSchema);