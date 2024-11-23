# Mini Supermarket Web Application

## 🚀 Giới thiệu
Ứng dụng web **Siêu Thị Mini** được thiết kế để quản lý và vận hành một siêu thị quy mô nhỏ, với các tính năng tiện lợi cho việc bán hàng, quản lý kho, theo dõi lịch sử giao dịch, báo cáo doanh thu, và quản lý người dùng. 

### Các tính năng chính:
1. **Quản lý bán hàng**:
   - Giao diện thân thiện hỗ trợ thêm sản phẩm vào giỏ hàng.
   - Thanh toán với các phương thức linh hoạt (tiền mặt, chuyển khoản).

2. **Quản lý kho hàng**:
   - Thêm, sửa, xóa sản phẩm và danh mục.
   - Theo dõi số lượng sản phẩm tồn kho.

3. **Báo cáo & thống kê**:
   - Xem báo cáo doanh thu ngày, tháng, năm.
   - Theo dõi sản phẩm bán chạy và hàng tồn kho.

4. **Lịch sử giao dịch**:
   - Xem chi tiết các giao dịch đã thực hiện.
   - Tìm kiếm lịch sử giao dịch theo ngày.

5. **Quản lý người dùng**:
   - Phân quyền người dùng: admin, quản lý kho, nhân viên bán hàng.
   - Cấp quyền truy cập linh hoạt cho từng vai trò.

6. **Cập nhật thông tin cửa hàng**:
   - Thay đổi thông tin siêu thị như địa chỉ, tài khoản ngân hàng, mã QR.

7. **Đổi mật khẩu & Quên mật khẩu**:
   - Tính năng đổi mật khẩu an toàn.
   - Hỗ trợ quên mật khẩu thông qua email khôi phục.

---

## 🛠️ Công nghệ sử dụng
- **Frontend**: HTML5, CSS3, Bootstrap 5, SweetAlert2, jQuery.
- **Backend**: Node.js, Express.js.
- **Cơ sở dữ liệu**: MongoDB.
- **Authentication**: JWT (JSON Web Token), session-based login.
- **File Upload**: Multer (xử lý file QR code, ảnh sản phẩm).
- **Email**: Nodemailer (gửi email xác thực, quên mật khẩu).

---

## 📦 Cài đặt & khởi chạy
### 1. Clone dự án
```bash
git clone https://github.com/hoaphamduc/mini-supermarket.git
cd mini-supermarket
```

### 2. Cài đặt các package cần thiết

```bash
npm install
```

### 3. Cấu hình môi trường

Tạo file `.env` trong thư mục gốc và thêm các thông tin:

```sh
PORT=3000
MONGO_URI=mongodb://localhost:27017/ProductsManager
JWT_SECRET=your_jwt_secret_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_password_or_app_password
```

### 4. Chạy ứng dụng

```bash
npm run start
```

Ứng dụng sẽ chạy tại http://localhost:3000.

## 📂 Cấu trúc dự án

``` sh
mini-supermarket/
│
├── models/         # Định nghĩa các schema của MongoDB
├── routes/         # Các route xử lý logic
├── public/         # Tài nguyên tĩnh như CSS, JS, hình ảnh
├── views/          # Các file EJS template
├── config/         # File cấu hình
├── middlewares/    # Các middlewares
├── ssl/            # Chứa các chứng chỉ SSL nếu bạn có
├── uploads/        # Các tài nguyên được tải lên server
├── views/          # Chứa các file giao diện
├── .env            # File cấu hình môi trường
└── server.js       # Điểm khởi đầu của ứng dụng
```

## 🔐 Quyền truy cập

### Vai trò trong ứng dụng:

#### 1. Admin:
- Quản lý toàn bộ hệ thống.
- Cấp quyền và chỉnh sửa thông tin người dùng.
#### 2. Quản lý kho:
- Quản lý sản phẩm, báo cáo doanh thu, lịch sử giao dịch.
#### 3. Nhân viên bán hàng:
- Sử dụng tính năng bán hàng.

## 🌟 Giao diện

### Dashboard

Hiển thị các tính năng chính dưới dạng menu.

### Quản lý bán hàng

- Giao diện đơn giản để thêm sản phẩm vào giỏ hàng.
- Hiển thị thông tin sản phẩm, giá và tồn kho.

### Báo cáo doanh thu

- Biểu đồ và danh sách sản phẩm bán chạy.

## 🧑‍💻 Đóng góp

1. Fork repo.

2. Tạo nhánh feature mới:

``` bash
git checkout -b feature/your-feature-name
```

3. Commit và push:

``` bash
git commit -m "Add your feature"
git push origin feature/your-feature-name
```

4. Tạo Pull Request.

## 📧 Liên hệ

Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ:

- Email: hoaphamduc2399@gmail.com
- GitHub: [Github](https://github.com/hoaphamduc/mini-supermarket)

## Cảm ơn bạn đã sử dụng ứng dụng! 🎉