const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
    storeName: { type: String, required: true },
    storeAddress: { type: String },
    qrCodeImageUrl: { type: String },
    bankAccountNumber: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^\d+$/.test(v);
            },
            message: props => `${props.value} is not a valid bank account number!`
        }
    },
    bankName: { type: String }
}, {
    timestamps: true
});

module.exports = mongoose.model('Store', storeSchema);
