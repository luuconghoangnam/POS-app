const mongoose = require('mongoose');
const Product = require('./models/product');

// Hàm xóa dấu tiếng Việt
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

// Hàm tạo mã sản phẩm
function generateProductCode(name) {
    return `${removeVietnameseTones(name.slice(0, 3)).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;
}

async function updateProducts() {
    try {
        // Kết nối MongoDB
        await mongoose.connect('mongodb://localhost:27017/ProductsManager');
        console.log('Kết nối MongoDB thành công');

        // Lấy danh sách sản phẩm chưa có mã sản phẩm hoặc đơn vị
        const products = await Product.find({
            $or: [
                { productCode: { $exists: false } }, // Trường không tồn tại
                { productCode: '' },                // Trường rỗng
                { unit: { $exists: false } },       // Trường không tồn tại
                { unit: '' }                        // Trường rỗng
            ],
        });

        console.log(`Tìm thấy ${products.length} sản phẩm cần cập nhật`);

        for (const product of products) {
            const updates = {};

            // Kiểm tra và tạo mã sản phẩm nếu cần
            if (!product.productCode || product.productCode.trim() === '') {
                updates.productCode = generateProductCode(product.name);
            }

            // Kiểm tra và đặt đơn vị mặc định nếu cần
            if (!product.unit || product.unit.trim() === '') {
                updates.unit = 'cái'; // Đơn vị mặc định
            }

            // Cập nhật sản phẩm
            if (Object.keys(updates).length > 0) {
                await Product.updateOne({ _id: product._id }, { $set: updates });
                console.log(`Cập nhật sản phẩm ID: ${product._id}, Mã: ${updates.productCode || product.productCode}, Đơn vị: ${updates.unit || product.unit}`);
            }
        }

        console.log('Cập nhật thành công tất cả sản phẩm');
        await mongoose.disconnect();
    } catch (error) {
        console.error('Lỗi khi cập nhật sản phẩm:', error);
        await mongoose.disconnect();
    }
}

updateProducts();