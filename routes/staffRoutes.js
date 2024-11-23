const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Middleware kiểm tra vai trò admin
function isAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).render('accessDenied', { message: 'Chỉ Admin mới được phép truy cập.' });
    }
    next();
}

// Hiển thị danh sách người dùng
router.get('/admin/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.session.user.id } }); // Loại bỏ chính admin
        res.render('users', { users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Lỗi server');
    }
});

// Cập nhật quyền của người dùng
router.post('/admin/users/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { permissions, role } = req.body; // Nhận thêm trường role

    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tồn tại' });
        }

        // Cập nhật quyền nếu có
        if (permissions) {
            user.permissions = {
                manageInventory: permissions.hasOwnProperty('manageInventory')
                    ? permissions.manageInventory
                    : user.permissions.manageInventory,
                sellProducts: permissions.hasOwnProperty('sellProducts')
                    ? permissions.sellProducts
                    : user.permissions.sellProducts,
                updateStoreInfo: permissions.hasOwnProperty('updateStoreInfo')
                    ? permissions.updateStoreInfo
                    : user.permissions.updateStoreInfo,
            };
        }

        // Cập nhật vai trò nếu có
        if (role && ['admin', 'user'].includes(role)) {
            user.role = role;
        }

        await user.save();
        res.status(200).json({ message: 'Cập nhật thông tin thành công', user });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;
