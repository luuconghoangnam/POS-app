const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Kết nối MongoDB
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`🐌 MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`🙄 Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;