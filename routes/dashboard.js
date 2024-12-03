const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const upload = require('../config/multer');
const fs = require('fs');
const path = require('path');
const Category = require('../models/Category');
const Revenue = require('../models/Revenue');
const History = require('../models/history');
const Store = require('../models/Store');
const ExportHistory = require('../models/ExportHistory');
const multer = require('multer');
const xlsx = require('xlsx');

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    return res.redirect('/login');
};

// Route for the dashboard, only accessible by logged-in users
router.get('/dashboard', isAuthenticated, (req, res) => {
    res.renderWithLayout('dashboard', {
        title: 'Chào mừng',
        user: req.session.user
    })
});

router.get('/sales', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;

        // Kiểm tra quyền truy cập
        if (!user || (!user.permissions.sellProducts && user.role !== 'admin')) {
            return res.status(403).render('accessDenied', { message: 'Bạn không có quyền truy cập vào trang này.' });
        }

        const selectedCategory = req.query.category || 'Tất cả';
        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        const categories = await Category.find({ store: store._id });

        let products;
        if (selectedCategory === 'Tất cả') {
            products = await Product.find({ store: store._id });
        } else {
            products = await Product.find({ store: store._id, category: selectedCategory });
        }

        const currentDate = new Date();
        products = products.map(product => {
            if (product.discountPercentage > 0 &&
                currentDate >= product.discountStartDate &&
                currentDate <= product.discountEndDate) {
                product.salePrice = product.price * (1 - product.discountPercentage / 100);
            }
            return product;
        });

        res.renderWithLayout('sales', {
            title: 'Bán hàng',
            products, categories, selectedCategory, store
        })
    } catch (error) {
        console.error('Lỗi khi lấy sản phẩm:', error);
        res.status(500).send('Lỗi khi lấy sản phẩm');
    }
});

// Route để chỉnh sửa chương trình khuyến mãi của sản phẩm
router.post('/products/:id/promotion', isAuthenticated, async (req, res) => {
    const { discountPercentage, discountStartDate, discountEndDate } = req.body;

    try {
        // Kiểm tra quyền của người dùng
        const user = req.session.user;
        if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
            return res.status(403).render('accessDenied', { message: 'Bạn không có quyền truy cập vào chức năng này.' });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }

        product.discountPercentage = discountPercentage;
        product.discountStartDate = new Date(discountStartDate);
        product.discountEndDate = new Date(discountEndDate);

        await product.save();
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi cập nhật khuyến mãi');
    }
});

// Route to handle sales checkout
router.post('/sales/checkout', isAuthenticated, async (req, res) => {
    const { cart } = req.body;

    // Kiểm tra quyền của người dùng
    const user = req.session.user;
    if (!user || (!user.permissions.sellProducts && user.role !== 'admin')) {
        return res.status(403).render('accessDenied', { message: 'Bạn không có quyền truy cập vào chức năng này.' });
    }

    if (!Array.isArray(cart)) {
        return res.status(400).send('Giỏ hàng không hợp lệ');
    }

    try {
        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        let total = 0;
        const productsPurchased = [];

        for (let item of cart) {
            const product = await Product.findById(item.id);

            if (!product) {
                return res.status(400).send(`Sản phẩm với ID ${item.id} không tồn tại`);
            }

            const finalPrice = item.discount > 0
                ? item.price * (1 - item.discount / 100)
                : item.price;

            total += finalPrice * item.quantity;

            productsPurchased.push({
                productId: product._id,
                quantity: item.quantity,
                price: item.price,
                discountPercentage: item.discount,
                totalProductPrice: finalPrice * item.quantity,
            });

            if (product.stock >= item.quantity) {
                await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity, sold: item.quantity } });
            } else {
                return res.status(400).send(`Không đủ hàng trong kho cho sản phẩm ${product.name}`);
            }
        }

        const history = new History({
            products: productsPurchased,
            totalPrice: total,
            status: 'Done',
            store: store._id, // Liên kết với Store
        });

        await history.save();

        // Cập nhật tổng doanh thu
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];

        await Revenue.updateOne(
            { store: store._id, date: formattedDate },
            { $inc: { totalRevenue: total } },
            { upsert: true } // Tạo mới nếu chưa có
        );

        res.status(200).send('Thanh toán thành công');
    } catch (error) {
        console.error('Lỗi khi thanh toán:', error);
        res.status(500).send('Lỗi khi thanh toán');
    }
});

// Route to get sales report
router.get('/sales/report', isAuthenticated, async (req, res) => {
    try {
        // Kiểm tra quyền của người dùng
        const user = req.session.user;
        if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
            return res.status(403).render('accessDenied', {
                message: 'Bạn không có quyền truy cập vào chức năng này.'
            });
        }

        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        const bestSellingProducts = await Product.find({ store: store._id, sold: { $gt: 0 } })
            .sort({ sold: -1 })
            .limit(10);
        const lowStockProducts = await Product.find({ store: store._id, stock: { $lt: 10 } });
        const dailyRevenue = await Revenue.find({ store: store._id })
            .sort({ date: -1 })
            .limit(30);

        const monthlyRevenue = await Revenue.aggregate([
            { $match: { store: store._id } },
            { $group: { _id: { $substr: ['$date', 0, 7] }, total: { $sum: '$totalRevenue' } } },
            { $sort: { _id: -1 } }
        ]);

        const yearlyRevenue = await Revenue.aggregate([
            { $match: { store: store._id } },
            { $group: { _id: { $substr: ['$date', 0, 4] }, total: { $sum: '$totalRevenue' } } },
            { $sort: { _id: -1 } }
        ]);

        res.renderWithLayout('report', {
            title: 'Báo cáo - Thống kê',
            bestSellingProducts,
            lowStockProducts,
            dailyRevenue,
            monthlyRevenue,
            yearlyRevenue
        })
    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi khi lấy thống kê');
    }
});

// Route hiển thị lịch sử mua hàng
router.get('/sales/history', isAuthenticated, async (req, res) => {
    try {
        // Kiểm tra quyền của người dùng
        const user = req.session.user;
        if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
            return res.status(403).render('accessDenied', {
                message: 'Bạn không có quyền truy cập vào lịch sử bán hàng.'
            });
        }

        const orders = await History.find()
            .populate('products.productId')
            .sort({ createdAt: -1 });

        res.renderWithLayout('history', {
            title: 'Lịch sử bán hàng',
            orders
        })
    } catch (error) {
        console.error('Lỗi khi lấy lịch sử mua hàng:', error);
        res.status(500).send('Lỗi khi lấy lịch sử mua hàng');
    }
});

// Route tìm kiếm lịch sử mua hàng theo ngày
router.get('/history/search', isAuthenticated, async (req, res) => {
    try {
        // Kiểm tra quyền của người dùng
        const user = req.session.user;
        if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
            return res.status(403).render('accessDenied', {
                message: 'Bạn không có quyền truy cập vào tìm kiếm lịch sử.'
            });
        }

        const { date } = req.query;

        if (!date) {
            return res.status(400).send("Vui lòng chọn ngày để tìm kiếm.");
        }

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        // Sử dụng populate để lấy chi tiết sản phẩm
        const orders = await History.find({
            createdAt: { $gte: startDate, $lte: endDate }
        }).populate('products.productId').sort({ createdAt: -1 });

        res.renderWithLayout('history', {
            title: 'Lịch sử bán hàng',
            orders, date
        })
    } catch (error) {
        console.error('Lỗi khi tìm kiếm lịch sử:', error);
        res.status(500).send('Lỗi khi tìm kiếm lịch sử');
    }
});

router.get('/api/daily-revenue', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;
        if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
            return res.status(403).send('Bạn không có quyền truy cập.');
        }

        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        const dailyRevenue = await Revenue.find({ store: store._id }).sort({ date: 1 }).limit(30);
        res.json(dailyRevenue);
    } catch (error) {
        res.status(500).send('Lỗi khi lấy doanh thu theo ngày');
    }
});

router.get('/api/monthly-revenue', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;
        if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
            return res.status(403).send('Bạn không có quyền truy cập.');
        }

        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        const monthlyRevenue = await Revenue.aggregate([
            { $match: { store: store._id } },
            { $group: { _id: { $substr: ['$date', 0, 7] }, total: { $sum: '$totalRevenue' } } },
            { $sort: { _id: 1 } }
        ]);
        res.json(monthlyRevenue);
    } catch (error) {
        res.status(500).send('Lỗi khi lấy doanh thu theo tháng');
    }
});

router.get('/api/yearly-revenue', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;
        if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
            return res.status(403).send('Bạn không có quyền truy cập.');
        }

        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        const yearlyRevenue = await Revenue.aggregate([
            { $match: { store: store._id } },
            { $group: { _id: { $substr: ['$date', 0, 4] }, total: { $sum: '$totalRevenue' } } },
            { $sort: { _id: 1 } }
        ]);
        res.json(yearlyRevenue);
    } catch (error) {
        res.status(500).send('Lỗi khi lấy doanh thu theo năm');
    }
});

// Route for managing products
router.get('/products', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;
        if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
            return res.status(403).render('accessDenied', {
                message: 'Bạn không có quyền truy cập vào trang quản lý kho.'
            });
        }

        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        const categories = await Category.find({ store: store._id });
        const products = await Product.find({ store: store._id });
        const exportHistories = await ExportHistory.find({}).sort({ date: -1 }); // Lấy lịch sử hóa đơn xuất kho, sắp xếp theo ngày giảm dần

        res.renderWithLayout('products', {
            title: 'Quản lý kho',
            store,
            products,
            categories,
            exportHistories,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi server');
    }
});

// Route to add new product
router.post('/products/new', isAuthenticated, upload.single('image'), async (req, res) => {
    const user = req.session.user;
    if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
        return res.status(403).json({ status: 'error', message: 'Bạn không có quyền thực hiện hành động này.' });
    }

    const { name, description, price, stock, category, discountPercentage, unit } = req.body;
    let imageUrl = '/images/default.svg';

    if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
        const store = await Store.findOne();

        if (!store) {
            return res.status(500).json({ status: 'error', message: 'Store chưa được cấu hình.' });
        }

        // Hàm để bỏ dấu tiếng Việt
        function removeVietnameseTones(str) {
            const accentMap = {
                'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a', 'ă': 'a', 'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
                'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a', 'đ': 'd', 'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e',
                'ẹ': 'e', 'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e', 'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i',
                'ị': 'i', 'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o', 'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o',
                'ộ': 'o', 'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o', 'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u',
                'ụ': 'u', 'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u', 'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y',
                'ỵ': 'y', 'Ạ': 'A', 'Á': 'A', 'À': 'A', 'Ả': 'A', 'Ã': 'A', 'Ă': 'A', 'Ắ': 'A', 'Ằ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',
                'Ặ': 'A', 'Â': 'A', 'Ấ': 'A', 'Ầ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A', 'Đ': 'D', 'É': 'E', 'È': 'E', 'Ẻ': 'E',
                'Ẽ': 'E', 'Ẹ': 'E', 'Ê': 'E', 'Ế': 'E', 'Ề': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E', 'Í': 'I', 'Ì': 'I', 'Ỉ': 'I',
                'Ĩ': 'I', 'Ị': 'I', 'Ó': 'O', 'Ò': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O', 'Ô': 'O', 'Ố': 'O', 'Ồ': 'O', 'Ổ': 'O',
                'Ỗ': 'O', 'Ộ': 'O', 'Ơ': 'O', 'Ớ': 'O', 'Ờ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O', 'Ú': 'U', 'Ù': 'U', 'Ủ': 'U',
                'Ũ': 'U', 'Ụ': 'U', 'Ư': 'U', 'Ứ': 'U', 'Ừ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U', 'Ý': 'Y', 'Ỳ': 'Y', 'Ỷ': 'Y',
                'Ỹ': 'Y', 'Ỵ': 'Y'
            };
            return str.split('').map(char => accentMap[char] || char).join('');
        }

        // Tạo mã sản phẩm tự động
        const productCode = `${removeVietnameseTones(name.slice(0, 3)).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;

        const newProduct = new Product({
            name,
            description,
            price,
            stock,
            imageUrl,
            category,
            store: store._id,
            discountPercentage: discountPercentage || 0,
            productCode,
            unit, 
        });

        await newProduct.save();
        res.status(200).json({
            status: 'success',
            message: 'Sản phẩm đã được thêm thành công.',
            product: newProduct
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Lỗi khi thêm sản phẩm' });
    }
});

// Route to delete product
router.post('/products/:id/delete', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
        return res.status(403).send('Bạn không có quyền thực hiện hành động này.');
    }

    const { id } = req.params;

    try {
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }

        // Kiểm tra xem ảnh có phải là ảnh mặc định không
        const imagePath = path.join(__dirname, '..', product.imageUrl);
        
        // Nếu ảnh không phải là ảnh mặc định, thực hiện xóa
        if (product.imageUrl !== '/images/default.svg') {
            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error('Lỗi khi xóa file:', err);
                    return res.status(500).send('Lỗi khi xóa ảnh');
                }

                console.log('Xóa ảnh thành công');
            });
        } else {
            console.log('Ảnh mặc định, không cần xóa.');
        }

        // Xóa sản phẩm khỏi cơ sở dữ liệu
        await Product.deleteOne({ _id: id });

        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi xóa sản phẩm');
    }
});

// Route to display product edit form
router.get('/products/:id/edit', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
        return res.status(403).render('accessDenied', {
            message: 'Bạn không có quyền chỉnh sửa sản phẩm.',
        });
    }

    try {
        const product = await Product.findById(req.params.id);
        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        const categories = await Category.find({ store: store._id });

        if (!product) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }

        res.renderWithLayout('editProduct', {
            title: 'Sửa sản phẩm', product, categories
        })
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi lấy sản phẩm');
    }
});

// Route to update product details
router.post('/products/:id/edit', isAuthenticated, upload.single('image'), async (req, res) => {
    const user = req.session.user;
    if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
        return res.status(403).send('Bạn không có quyền thực hiện hành động này.');
    }

    // Lấy dữ liệu từ form
    const { name, description, price, stock, category, unit, discountPercentage } = req.body;

    // Tạo object cập nhật sản phẩm
    let updatedProduct = { 
        name, 
        description, 
        price, 
        stock, 
        category, 
        unit,  // Cập nhật đơn vị sản phẩm
        discountPercentage 
    };

    // Kiểm tra nếu có hình ảnh mới, cập nhật đường dẫn hình ảnh
    if (req.file) {
        updatedProduct.imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
        // Tìm và cập nhật sản phẩm
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }

        // Cập nhật sản phẩm
        await Product.findByIdAndUpdate(req.params.id, updatedProduct);

        // Chuyển hướng về danh sách sản phẩm
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi cập nhật sản phẩm');
    }
});

// Route to add new category
router.post('/categories/new', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
        return res.status(403).send('Bạn không có quyền thực hiện hành động này.');
    }

    const { category } = req.body;

    if (!category) {
        return res.status(400).send('Tên danh mục không hợp lệ');
    }

    if (category.trim().toLowerCase() === 'tất cả') {
        return res.status(400).send('Không thể tạo danh mục với tên "Tất cả"');
    }

    try {
        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        const existingCategory = await Category.findOne({ name: category, store: store._id });
        if (existingCategory) {
            return res.status(400).send('Danh mục đã tồn tại');
        }

        const newCategory = new Category({
            name: category,
            store: store._id,
        });

        await newCategory.save();
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi thêm danh mục');
    }
});

// Route để chỉnh sửa danh mục
router.get('/categories/:id/edit', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
        return res.status(403).send('Bạn không có quyền thực hiện hành động này.');
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
        return res.status(404).send('Danh mục không tồn tại');
    }

    res.renderWithLayout('editCategory', {
        title: 'Sửa danh mục sản phẩm',
        category
    })
});

// Route để cập nhật danh mục
router.post('/categories/:id/edit', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
        return res.status(403).send('Bạn không có quyền thực hiện hành động này.');
    }

    const { category } = req.body;
    if (!category) {
        return res.status(400).send('Tên danh mục không hợp lệ');
    }

    if (category.trim().toLowerCase() === 'tất cả') {
        return res.status(400).send('Không thể thay đổi tên danh mục thành "Tất cả"');
    }

    try {
        const existingCategory = await Category.findOne({ name: category });
        if (existingCategory) {
            return res.status(400).send('Danh mục đã tồn tại');
        }

        const updatedCategory = await Category.findByIdAndUpdate(req.params.id, { name: category }, { new: true });
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi cập nhật danh mục');
    }
});

// Route để xóa danh mục
router.post('/categories/:id/delete', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    if (!user || (!user.permissions.manageInventory && user.role !== 'admin')) {
        return res.status(403).send('Bạn không có quyền thực hiện hành động này.');
    }

    try {
        await Category.findByIdAndDelete(req.params.id);
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi xóa danh mục');
    }
});

router.post('/products/export', async (req, res) => {
    try {
        const { products } = req.body;

        if (!products || !Array.isArray(products)) {
            return res.status(400).json({ message: 'Dữ liệu không hợp lệ. Vui lòng gửi danh sách sản phẩm.' });
        }

        let totalQuantity = 0;
        const exportDetails = [];

        for (const item of products) {
            const { id, quantity } = item;

            if (!id || !quantity || quantity <= 0) {
                return res.status(400).json({ message: `Dữ liệu sản phẩm không hợp lệ. Sản phẩm ID: ${id}` });
            }

            // Tìm sản phẩm và cập nhật số lượng trong kho
            const updatedProduct = await Product.findOneAndUpdate(
                { _id: id, stock: { $gte: quantity } }, // Điều kiện: không xuất vượt quá số lượng hiện có
                { $inc: { stock: -quantity } },         // Trừ số lượng trong kho
                { new: true }                           // Trả về sản phẩm sau khi cập nhật
            );

            if (!updatedProduct) {
                return res.status(400).json({
                    message: `Không đủ số lượng sản phẩm hoặc sản phẩm không tồn tại. ID: ${id}`
                });
            }

            // Lưu chi tiết sản phẩm vào mảng exportDetails
            exportDetails.push({
                productId: updatedProduct._id,
                productName: updatedProduct.name,
                productCode: updatedProduct.productCode || 'Chưa có mã sản phẩm',
                unit: updatedProduct.unit || 'Chưa có đơn vị',
                quantity,
                price: updatedProduct.price,
                total: updatedProduct.price * quantity
            });

            totalQuantity += parseInt(quantity, 10);
        }

        // Lưu lịch sử xuất kho
        const exportHistory = new ExportHistory({
            products: exportDetails,
            totalQuantity,
            date: new Date()
        });

        await exportHistory.save();

        // Trả về phản hồi bao gồm mảng sản phẩm đã xuất
        res.status(200).json({
            message: 'Xuất kho thành công!',
            receiptId: exportHistory._id,
            date: exportHistory.date,
            totalQuantity,
            exportedProducts: exportDetails.map(product => ({
                ...product,
                productCode: product.productCode,
                unit: product.unit
            }))
        });
    } catch (error) {
        console.error('Lỗi khi xuất kho:', error.message);
        res.status(500).json({ message: 'Đã xảy ra lỗi trong quá trình xuất kho.' });
    }
});

router.get('/export-history/:id', async (req, res) => {
    try {
        const exportHistory = await ExportHistory.findById(req.params.id).lean();
        const store = await Store.findOne();

        if (!exportHistory) {
            console.log('Hóa đơn không tồn tại');
            return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
        }

        const responseData = {
            ...exportHistory,
            store: store ? {
                storeName: store.storeName,
                storeAddress: store.storeAddress,
                bankName: store.bankName,
                bankAccountNumber: store.bankAccountNumber,
                qrCodeImageUrl: store.qrCodeImageUrl,
            } : null,
        };

        console.log('Dữ liệu hóa đơn trả về:', responseData); // Kiểm tra dữ liệu trong console
        res.json(responseData);
    } catch (err) {
        console.error('Lỗi khi lấy hóa đơn:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Cấu hình multer để upload file excel
const uploadExcel = multer({
    dest: path.join(__dirname, '../uploads'),
});

function removeVietnameseTones(str) {
    const accentMap = {
        'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a', 'ă': 'a', 'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a', 'đ': 'd', 'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e',
        'ẹ': 'e', 'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e', 'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i',
        'ị': 'i', 'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o', 'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o',
        'ộ': 'o', 'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o', 'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u',
        'ụ': 'u', 'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u', 'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y',
        'ỵ': 'y', 'Ạ': 'A', 'Á': 'A', 'À': 'A', 'Ả': 'A', 'Ã': 'A', 'Ă': 'A', 'Ắ': 'A', 'Ằ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',
        'Ặ': 'A', 'Â': 'A', 'Ấ': 'A', 'Ầ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A', 'Đ': 'D', 'É': 'E', 'È': 'E', 'Ẻ': 'E',
        'Ẽ': 'E', 'Ẹ': 'E', 'Ê': 'E', 'Ế': 'E', 'Ề': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E', 'Í': 'I', 'Ì': 'I', 'Ỉ': 'I',
        'Ĩ': 'I', 'Ị': 'I', 'Ó': 'O', 'Ò': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O', 'Ô': 'O', 'Ố': 'O', 'Ồ': 'O', 'Ổ': 'O',
        'Ỗ': 'O', 'Ộ': 'O', 'Ơ': 'O', 'Ớ': 'O', 'Ờ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O', 'Ú': 'U', 'Ù': 'U', 'Ủ': 'U',
        'Ũ': 'U', 'Ụ': 'U', 'Ư': 'U', 'Ứ': 'U', 'Ừ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U', 'Ý': 'Y', 'Ỳ': 'Y', 'Ỷ': 'Y',
        'Ỹ': 'Y', 'Ỵ': 'Y'
    };
    return str.split('').map(char => accentMap[char] || char).join('');
}

// Tạo mã sản phẩm tự động (ví dụ: mã sản phẩm = tên sản phẩm + số ngẫu nhiên)
function generateProductCode(name) {
    return `${removeVietnameseTones(name.slice(0, 3)).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;
}

// Route nhập sản phẩm bằng file Excel
router.post('/products/import-excel', uploadExcel.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'Vui lòng tải lên file Excel.' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const products = xlsx.utils.sheet_to_json(sheet);

        const store = await Store.findOne();
        if (!store) {
            return res.status(500).json({ status: 'error', message: 'Store chưa được cấu hình. Vui lòng cấu hình trước.' });
        }

        let importedCount = 0;
        let errorCount = 0;
        let errorDetails = [];

        for (const product of products) {
            let { productCode, name, description, price, stock, category, unit, discountPercentage } = product;
            const missingFields = [];

            if (!name) missingFields.push('Tên sản phẩm');
            if (!price) missingFields.push('Giá');
            if (!stock) missingFields.push('Số lượng');
            if (!unit) missingFields.push('Đơn vị');
            if (isNaN(price)) missingFields.push('Giá (phải là số)');
            if (isNaN(stock)) missingFields.push('Số lượng (phải là số)');

            if (missingFields.length > 0) {
                errorDetails.push({ product, missingFields });
                errorCount++;
                continue;
            }

            if (!productCode) {
                productCode = generateProductCode(name);
            }

            const validUnits = ['cái', 'hộp', 'kg', 'lít', 'mét', 'túi', 'gói'];
            const finalUnit = validUnits.includes(unit.trim()) ? unit.trim() : 'cái';

            const finalCategory = category?.trim() || 'Chưa phân loại';
            let categoryData = await Category.findOne({ name: finalCategory });
            if (!categoryData) {
                categoryData = new Category({ name: finalCategory, store: store._id });
                await categoryData.save();
            }

            let existingProduct = await Product.findOne({ productCode });
            if (existingProduct) {
                existingProduct.stock += parseInt(stock);
                await existingProduct.save();
                importedCount++;
            } else {
                const newProduct = new Product({
                    productCode,
                    name,
                    description: description || '',
                    price: parseFloat(price),
                    stock: parseInt(stock),
                    category: categoryData.name,
                    unit: finalUnit,
                    discountPercentage: discountPercentage ? parseFloat(discountPercentage) : 0,
                    imageUrl: '/images/default.svg',
                    store: store._id,
                });

                await newProduct.save();
                importedCount++;
            }
        }

        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Lỗi khi xóa file:', err);
        });

        if (importedCount > 0 || errorCount > 0) {
            res.status(200).json({
                status: 'success',
                message: `${importedCount} sản phẩm đã được nhập thành công.`,
                errorCount,
                errorDetails: errorDetails.length > 0 ? errorDetails : [] // Đảm bảo luôn trả về errorDetails
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: 'Không có sản phẩm nào được nhập.',
                errorCount,
                errorDetails: errorDetails.length > 0 ? errorDetails : [] // Đảm bảo luôn trả về errorDetails
            });
        }
    } catch (error) {
        console.error('Lỗi khi nhập sản phẩm từ Excel:', error.message);
        res.status(500).json({ status: 'error', message: 'Lỗi khi nhập sản phẩm từ Excel.' });
    }
});

module.exports = router;