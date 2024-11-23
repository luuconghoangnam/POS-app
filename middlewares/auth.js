// Middleware kiểm tra xem người dùng đã đăng nhập hay chưa
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();  // Nếu đã đăng nhập, tiếp tục xử lý request
    } else {
        // Nếu chưa đăng nhập, trả về lỗi hoặc chuyển hướng tới trang đăng nhập
        return res.status(401).json({ message: 'Người dùng chưa đăng nhập' });
    }
};

module.exports = { isAuthenticated };
