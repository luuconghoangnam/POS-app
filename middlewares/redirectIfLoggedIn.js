const redirectIfLoggedIn = (req, res, next) => {
    if (req.session && req.session.user) {
        // Nếu người dùng đã đăng nhập, chuyển hướng đến /dashboard
        return res.redirect('/dashboard');
    }
    next();  // Nếu chưa đăng nhập, tiếp tục truy cập route
};

module.exports = redirectIfLoggedIn;
