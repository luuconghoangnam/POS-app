const https = require('https');
const fs = require('fs');
const express = require('express');
const dotenv = require('dotenv');
const session = require('express-session');
const path = require('path');
const connectDB = require('./config/db');
const layoutMiddleware = require('./middlewares/layout');
const MongoStore = require('connect-mongo');

// Cấu hình dotenv để lấy các biến môi trường
dotenv.config();

// Kết nối MongoDB
connectDB();

// Khởi tạo ứng dụng Express
const app = express();

// Redirect HTTP to HTTPS middleware
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
        // Redirect to HTTPS
        return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
});

// Layout middleware
app.use(layoutMiddleware);

// Middleware để parse dữ liệu từ form (body-parser)
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Dùng để xử lý JSON

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Cấu hình session
app.use(session({
    secret: 'meobeosieudeptrai@2024',  // Khóa bí mật
    resave: false,  // Không lưu lại session nếu không có sự thay đổi
    saveUninitialized: false,  // Không lưu session mới chưa được khởi tạo
    cookie: {
        maxAge: 1000 * 60 * 60,  // Thời gian sống của cookie (1 giờ)
        httpOnly: true,  // Chỉ truy cập được qua HTTP
    },
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,  // URL kết nối MongoDB
        collectionName: 'sessions',  // Tên collection để lưu session
        ttl: 60 * 60  // Thời gian sống của session trong MongoDB (1 giờ)
    })
}));

// Import route
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboard');
const supplierRoutes = require('./routes/supplierRoutes');
const shopRoutes = require('./routes/shopRoutes');
const staffRoutes = require('./routes/staffRoutes');

// Cấu hình view engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cấu hình thư mục tĩnh cho CSS, JS, hình ảnh
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Định nghĩa route
app.use('/', userRoutes);
app.use('/', dashboardRoutes);
app.use('/', shopRoutes);
app.use('/', staffRoutes);
app.use('/api/suppliers', supplierRoutes);

// Trang chủ
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('index', { title: 'Trang chủ' });
});

// Đọc chứng chỉ và khóa riêng tư
const sslServerOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'privkey.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'fullchain.pem'))
};

// Khởi động server HTTPS
const httpsServer = https.createServer(sslServerOptions, app);

const PORT = process.env.PORT || 3000;
httpsServer.listen(PORT, () => {
    console.log(`👻 HTTPS server running on https://localhost:${PORT}`);
});
