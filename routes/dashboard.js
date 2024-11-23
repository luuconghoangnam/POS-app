const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const upload = require('../config/multer');
const fs = require('fs');
const path = require('path');
const Category = require('../models/Category');
const Revenue = require('../models/Revenue');
const Customer = require('../models/customer');
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
    res.render('dashboard', { user: req.session.user });
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

        res.render('sales', { products, categories, selectedCategory, store });
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

        res.render('report', {
            bestSellingProducts,
            lowStockProducts,
            dailyRevenue,
            monthlyRevenue,
            yearlyRevenue
        });
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

        res.render('history', { orders });
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

        res.render('history', { orders, date });
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

        res.render('products', {
            title: 'Quản lý kho',
            products,
            categories,
            exportHistories, // Truyền danh sách lịch sử xuất kho vào view
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
        return res.status(403).send('Bạn không có quyền thực hiện hành động này.');
    }

    const { name, description, price, stock, category, discountPercentage } = req.body;
    let imageUrl = '/images/default.svg';

    if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
        const store = await Store.findOne();

        if (!store) {
            return res.status(500).send('Store chưa được cấu hình.');
        }

        const newProduct = new Product({
            name,
            description,
            price,
            stock,
            imageUrl,
            category,
            store: store._id,
            discountPercentage: discountPercentage || 0,
        });

        await newProduct.save();
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi thêm sản phẩm');
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

        const imagePath = path.join(__dirname, '..', product.imageUrl);

        await Product.deleteOne({ _id: id });

        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error('Lỗi khi xóa file:', err);
                return res.status(500).send('Lỗi khi xóa ảnh');
            }

            res.redirect('/products');
        });
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

        res.render('editProduct', { title: 'Sửa sản phẩm', product, categories });
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

    const { name, description, price, stock, category, discountPercentage } = req.body;
    let updatedProduct = { name, description, price, stock, category, discountPercentage };

    if (req.file) {
        updatedProduct.imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
        await Product.findByIdAndUpdate(req.params.id, updatedProduct);
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
            exportedProducts: exportDetails // Mảng sản phẩm đã xuất
        });
    } catch (error) {
        console.error('Lỗi khi xuất kho:', error.message);
        res.status(500).json({ message: 'Đã xảy ra lỗi trong quá trình xuất kho.' });
    }
});

// Route để lấy chi tiết hóa đơn xuất kho
router.get('/export-history/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Tìm hóa đơn xuất kho theo ID
        const exportHistory = await ExportHistory.findById(id);

        if (!exportHistory) {
            return res.status(404).json({ message: 'Không tìm thấy hóa đơn xuất kho.' });
        }

        // Trả về dữ liệu hóa đơn
        res.status(200).json(exportHistory);
    } catch (error) {
        console.error('Lỗi khi lấy hóa đơn xuất kho:', error.message);
        res.status(500).json({ message: 'Đã xảy ra lỗi trong quá trình xử lý.' });
    }
});

// Cấu hình multer để upload file excel
const uploadExcel = multer({
    dest: path.join(__dirname, '../uploads'),
});

// Route nhập sản phẩm bằng file Excel
router.post('/products/import-excel', uploadExcel.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('Vui lòng tải lên file Excel.');
        }

        // Đọc file Excel
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const products = xlsx.utils.sheet_to_json(sheet);

        // Lấy thông tin store mặc định (giả định store đã được cấu hình)
        const store = await Store.findOne();
        if (!store) {
            return res.status(500).send('Store chưa được cấu hình. Vui lòng cấu hình trước.');
        }

        // Kiểm tra và tạo danh mục "Tất cả" nếu chưa có
        let defaultCategory = await Category.findOne({ name: 'Tất cả' });
        if (!defaultCategory) {
            defaultCategory = new Category({ name: 'Tất cả', store: store._id });
            await defaultCategory.save();
        }

        for (const product of products) {
            const { name, description, price, stock, category, discountPercentage } = product;

            // Kiểm tra dữ liệu cơ bản
            if (!name || !price || !stock) {
                console.log(`Bỏ qua sản phẩm không đầy đủ thông tin: ${JSON.stringify(product)}`);
                continue;
            }

            // Nếu không có danh mục, gán mặc định là "Tất cả"
            const finalCategory = category?.trim() || 'Tất cả';

            // Kiểm tra danh mục có tồn tại hay không
            let categoryData = await Category.findOne({ name: finalCategory });
            if (!categoryData) {
                console.log(`Danh mục không tồn tại, tạo mới danh mục: ${finalCategory}`);
                categoryData = new Category({ name: finalCategory, store: store._id });
                await categoryData.save();
            }

            // Tạo sản phẩm mới
            const newProduct = new Product({
                name,
                description: description || '',
                price: parseFloat(price),
                stock: parseInt(stock),
                category: categoryData.name,
                discountPercentage: discountPercentage ? parseFloat(discountPercentage) : 0,
                imageUrl: '/images/default.svg', // Hình ảnh mặc định
                store: store._id, // Liên kết sản phẩm với cửa hàng
            });

            await newProduct.save();
        }

        // Xóa file Excel sau khi xử lý
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Lỗi khi xóa file:', err);
        });

        res.redirect('/products');
    } catch (error) {
        console.error('Lỗi khi nhập sản phẩm từ Excel:', error.message);
        res.status(500).send('Lỗi khi nhập sản phẩm từ Excel.');
    }
});

module.exports = router;
