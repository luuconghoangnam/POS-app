const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone_number: { type: String, required: true },
    email: { type: String, required: true },
    products_supplied: { type: String, required: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('Supplier', supplierSchema);