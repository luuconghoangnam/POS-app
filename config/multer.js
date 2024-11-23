const multer = require('multer');
const path = require('path');

// Cấu hình multer để lưu trữ file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Đặt thư mục lưu trữ ảnh (ví dụ: /uploads)
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Đặt tên file theo thời gian để tránh trùng lặp
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Bộ lọc chỉ cho phép các file ảnh
const fileFilter = (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Chỉ chấp nhận file ảnh!');
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // Giới hạn kích thước file là 5MB
    fileFilter: fileFilter
});

module.exports = upload;
