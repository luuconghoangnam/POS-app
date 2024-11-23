const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const Store = require('../models/Store');

// Middleware kiểm tra vai trò admin
function canUpdateStore(req, res, next) {
    const user = req.session.user;
    if (!user || (!user.permissions.updateStoreInfo && user.role !== 'admin')) {
        return res.status(403).render('accessDenied', { message: 'Bạn không có quyền truy cập.' });
    }
    next();
}

const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    return res.redirect('/login');
};

// Cấu hình multer để lưu trữ file QR
const upload = multer({
    dest: path.join(__dirname, '../uploads'),
    fileFilter: (req, file, cb) => {
        // Cập nhật danh sách các loại file ảnh được chấp nhận
        const allowedMimeTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
            'image/webp', 'image/bmp', 'image/svg+xml', 'image/tiff'
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true); // Chấp nhận file
        } else {
            cb(new Error('File không hợp lệ. Chỉ chấp nhận các định dạng ảnh: jpeg, jpg, png, gif, webp, bmp, svg, tiff.'));
        }
    },
});

// View quản lý cửa hàng
router.get('/shop', isAuthenticated, canUpdateStore, async (req, res) => {
    try {
        const shop = await Store.findOne();
        res.render('shop', { shop });
    } catch (error) {
        console.error('Error fetching shop:', error);
        res.status(500).send('Lỗi server');
    }
});

// Tạo hoặc chỉnh sửa thông tin cửa hàng
router.post('/shop', isAuthenticated, canUpdateStore, upload.single('qrCodeImage'), async (req, res) => {
    const { storeName, storeAddress, bankAccountNumber, bankName } = req.body;

    try {
        let shop = await Store.findOne();

        // Nếu có file ảnh, xử lý file QR
        let qrCodeImageUrl = shop ? shop.qrCodeImageUrl : null;
        if (req.file) {
            // Xóa file QR cũ nếu có
            if (shop && shop.qrCodeImageUrl) {
                const oldQrPath = path.join(__dirname, '../', shop.qrCodeImageUrl);
                if (fs.existsSync(oldQrPath)) {
                    fs.unlinkSync(oldQrPath);
                }
            }
            // Lưu file mới
            qrCodeImageUrl = `/uploads/${req.file.filename}`;
        }

        if (shop) {
            // Cập nhật thông tin cửa hàng
            shop.storeName = storeName || shop.storeName;
            shop.storeAddress = storeAddress || shop.storeAddress;
            shop.bankAccountNumber = bankAccountNumber || shop.bankAccountNumber;
            shop.bankName = bankName || shop.bankName;
            shop.qrCodeImageUrl = qrCodeImageUrl || shop.qrCodeImageUrl;

            await shop.save();
            res.status(200).json({ message: 'Cập nhật thông tin cửa hàng thành công', shop });
        } else {
            // Tạo cửa hàng mới
            shop = new Store({
                storeName,
                storeAddress,
                bankAccountNumber,
                bankName,
                qrCodeImageUrl,
            });

            await shop.save();
            res.status(201).json({ message: 'Tạo cửa hàng thành công', shop });
        }
    } catch (error) {
        console.error('Error processing shop:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;
