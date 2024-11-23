const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const VerificationCode = require('../models/VerificationCode');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Middleware to prevent access to login and register routes if the user is already logged in
const redirectIfAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');  // Redirect nếu đã đăng nhập
    }
    next();  // Tiếp tục nếu chưa đăng nhập
};

// Route đăng nhập, áp dụng middleware để kiểm tra nếu đã đăng nhập
router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('login');  // Hiển thị trang login
});

// Route đăng ký, áp dụng middleware để kiểm tra nếu đã đăng nhập
router.get('/register', redirectIfAuthenticated, (req, res) => {
    res.render('register');  // Hiển thị trang đăng ký nếu chưa đăng nhập
});

// Route đăng ký người dùng
router.post('/register', async (req, res) => {
    const {
        username,
        password,
        phone,
        email,
        country = 'Vietnam',
        city = '',
    } = req.body;

    try {
        // Kiểm tra xem username hoặc email đã tồn tại chưa
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username hoặc Email đã tồn tại' });
        }

        // Định dạng số điện thoại nếu cần
        const fullPhone = `0${phone}`;

        // Xác định role: mặc định là 'user', nếu email đặc biệt thì là 'admin'
        const role = ['hoaphamduc2399@gmail.com', 'neverinlove99@gmail.com'].includes(email) ? 'admin' : 'user';

        // Tạo người dùng mới
        const user = new User({
            username,
            password,
            role,
            phone: fullPhone,
            email,
            country,
            city,
            permissions: { // Đặt tất cả quyền mặc định là false
                manageInventory: false,
                sellProducts: false,
                updateStoreInfo: false,
            },
        });

        // Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Lưu người dùng vào cơ sở dữ liệu
        await user.save();

        // Tạo token JWT
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            message: 'Đăng ký thành công',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Route xử lý đăng nhập bằng username
router.post('/login', redirectIfAuthenticated, async (req, res) => {
    const { username, password } = req.body;

    try {
        // Tìm người dùng theo tên đăng nhập
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Tên đăng nhập không tồn tại' });
        }

        // Kiểm tra mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu không đúng' });
        }

        // Lưu thông tin người dùng vào session
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            phone: user.phone,
            country: user.country,
            city: user.city,
            permissions: user.permissions, // Thêm thông tin quyền vào session
        };

        // Lưu session và chuyển hướng tới dashboard
        req.session.save(() => {
            res.redirect('/dashboard');
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Route xử lý đăng xuất
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Đăng xuất thất bại' });
        }
        res.redirect('/');
    });
});

// Route lấy thông tin người dùng từ session
router.get('/user-info', (req, res) => {
    if (req.session.user) {
        return res.status(200).json({
            message: 'Lấy thông tin người dùng thành công',
            user: req.session.user
        });
    } else {
        return res.status(401).json({
            message: 'Người dùng chưa đăng nhập'
        });
    }
});

// Set up multer for file uploads (e.g., QR code image)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Specify the uploads directory
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.post('/update-info', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Người dùng chưa đăng nhập' });
    }

    const userId = req.session.user.id;
    const { phone, city, country } = req.body;

    try {
        const user = await User.findById(userId);

        const updatedData = {
            phone: phone || user.phone,
            city: city || user.city,
            country: country || user.country,
        };

        const updatedUser = await User.findByIdAndUpdate(userId, updatedData, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        // Cập nhật session
        req.session.user = {
            id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
            phone: updatedUser.phone,
            country: updatedUser.country,
            city: updatedUser.city,
        };

        res.status(200).json({ message: 'Cập nhật thông tin thành công', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/update-info', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if no user is in session
    }

    try {
        const user = await User.findById(req.session.user.id);

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Render the view and pass the user object to the EJS template
        res.render('updateInfo', { user });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).send('Error loading user info');
    }
});

// Route to display user information for updating
router.get('/update-info', async (req, res) => {
    // Check if the user is logged in (session has user data)
    if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if no user is in session
    }

    try {
        // Fetch the user data from the database using the user ID stored in the session
        const user = await User.findById(req.session.user.id);

        // If user not found, handle the case
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Render the view and pass the user object to the EJS template
        res.render('updateInfo', { user });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).send('Error loading user info');
    }
});

router.post('/change-password', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Người dùng chưa đăng nhập' });
    }
    const userId = req.session.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;
    try {
        // Find the user in the database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tồn tại' });
        }
        // Check if the current password matches
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
        }
        // Check if new passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Mật khẩu mới không khớp' });
        }
        // Hash the new password and save it
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        return res.status(200).json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({ message: 'Lỗi server' });
    }
});

// Route to render the change password form
router.get('/change-password', (req, res) => {
    if (!req.session.user) {
        // If the user is not logged in, redirect to the login page
        return res.redirect('/login');
    }
    // If the user is logged in, render the change password form
    res.render('changePassword', { title: 'Đổi mật khẩu' });
});

// Gửi mã xác thực email và lưu vào MongoDB
router.post('/send-verification-email', async (req, res) => {
    const { email } = req.body;
    try {
        // Kiểm tra xem email đã tồn tại trong hệ thống chưa
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email đã tồn tại, vui lòng chọn email khác.' });
        }
        // Tạo mã xác thực ngẫu nhiên (6 ký tự)
        const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        const expiresAt = new Date(Date.now() + 5 * 60000); // Thời gian hết hạn là 5 phút
        // Lưu mã xác thực vào MongoDB (nếu tồn tại email đã có mã trước đó thì xóa)
        await VerificationCode.deleteOne({ email });
        const codeEntry = new VerificationCode({
            email,
            code: verificationCode,
            expiresAt
        });
        await codeEntry.save();
        // Cấu hình Nodemailer
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER, // Tài khoản email của bạn
                pass: process.env.EMAIL_PASSWORD // Mật khẩu email hoặc App Password
            }
        });
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Mã xác thực tài khoản',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
                    <h1 style="text-align: center; color: #4CAF50; margin-bottom: 20px;">Mã xác thực tài khoản</h1>
                    <p style="font-size: 16px; color: #333;">
                        Chào bạn,</p>
                    <p style="font-size: 16px; color: #333;">
                        Cảm ơn bạn đã đăng ký tài khoản. Dưới đây là mã xác thực của bạn:
                    </p>
                    <div style="text-align: center; margin: 20px 0;">
                        <span style="font-size: 24px; font-weight: bold; color: #4CAF50; border: 2px dashed #4CAF50; padding: 10px 20px; border-radius: 5px;">${verificationCode}</span>
                    </div>
                    <p style="font-size: 16px; color: #333;">
                        Lưu ý: Mã xác thực này chỉ có hiệu lực trong vòng <strong>5 phút</strong>.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="font-size: 14px; color: #999; text-align: center;">
                        Nếu bạn không yêu cầu xác thực tài khoản, vui lòng bỏ qua email này.
                    </p>
                    <p style="font-size: 14px; color: #999; text-align: center;">
                        Trân trọng,<br>
                        <strong>Đội ngũ Hỗ trợ</strong>
                    </p>
                </div>
            `
        };
        // Gửi email
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Mã xác thực đã được gửi đến email của bạn.' });
    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});
// Xác nhận mã xác thực
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;
    // Kiểm tra xem dữ liệu email và code có được cung cấp không
    if (!email || !code) {
        return res.status(400).json({ message: 'Thiếu email hoặc mã xác thực.' });
    }
    try {
        // Tìm mã xác thực theo email và mã
        const codeEntry = await VerificationCode.findOne({ email, code });
        if (!codeEntry) {
            return res.status(400).json({ message: 'Mã xác thực không đúng.' });
        }
        // Kiểm tra thời gian hết hạn
        if (codeEntry.expiresAt < new Date()) {
            return res.status(400).json({ message: 'Mã xác thực đã hết hạn.' });
        }
        // Mã hợp lệ, thực hiện các bước tiếp theo (ví dụ: đăng ký tài khoản)
        res.status(200).json({ message: 'Xác thực thành công.' });
        // Xóa mã xác thực sau khi xác nhận thành công
        await VerificationCode.deleteOne({ _id: codeEntry._id });
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});
// API kiểm tra xem email và username đã tồn tại chưa
router.post('/check-user', async (req, res) => {
    const { username, email } = req.body;
    if (!username || !email) {
        return res.status(400).json({ message: 'Thiếu tên đăng nhập hoặc email' });
    }
    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(200).json({ exists: true });
        } else {
            return res.status(200).json({ exists: false });
        }
    } catch (error) {
        console.error('Error checking user:', error);
        return res.status(500).json({ message: 'Lỗi server' });
    }
});

// Hiển thị form quên mật khẩu
router.get('/forgot-password', redirectIfAuthenticated, (req, res) => {
    res.render('forgotPassword', { title: 'Quên mật khẩu' });
});

// Xử lý yêu cầu quên mật khẩu
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // Tìm người dùng có email này
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Email không tồn tại trong hệ thống.' });
        }

        // Tạo token ngẫu nhiên để đặt lại mật khẩu
        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetTokenExpires = Date.now() + 3600000; // Token hết hạn sau 1 giờ

        // Lưu token vào cơ sở dữ liệu
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpires;
        await user.save();

        // Gửi email chứa đường dẫn đặt lại mật khẩu
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Đặt lại mật khẩu',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
                    <h2 style="text-align: center; color: #4CAF50; margin-bottom: 20px;">Đặt lại mật khẩu</h2>
                    <p style="font-size: 16px; color: #333;">Xin chào <strong>${user.username}</strong>,</p>
                    <p style="font-size: 16px; color: #333;">
                        Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấn vào nút bên dưới để đặt lại mật khẩu:
                    </p>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${resetUrl}" style="
                            display: inline-block;
                            padding: 10px 20px;
                            font-size: 16px;
                            color: #fff;
                            background-color: #4CAF50;
                            text-decoration: none;
                            border-radius: 5px;
                        ">Đặt lại mật khẩu</a>
                    </div>
                    <p style="font-size: 16px; color: #333;">
                        Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Mật khẩu của bạn sẽ không bị thay đổi nếu bạn không thực hiện thao tác nào.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="font-size: 14px; color: #999; text-align: center;">
                        Trân trọng,<br>
                        <strong>Đội ngũ hỗ trợ</strong>
                    </p>
                </div>
            `,
        };        

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Email đặt lại mật khẩu đã được gửi.' });
    } catch (error) {
        console.error('Error handling forgot password:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/reset-password/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Tìm người dùng có token hợp lệ
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }, // Token phải còn hiệu lực
        });

        if (!user) {
            return res.status(400).send('Token không hợp lệ hoặc đã hết hạn.');
        }

        // Hiển thị form đổi mật khẩu
        res.render('resetPassword', { title: 'Đặt lại mật khẩu', token });
    } catch (error) {
        console.error('Error fetching reset token:', error);
        res.status(500).send('Lỗi server');
    }
});

router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Mật khẩu không khớp.' });
    }

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({ message: 'Mật khẩu đã được cập nhật thành công.' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;