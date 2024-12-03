document.addEventListener('DOMContentLoaded', () => {
    // Lưu trạng thái tab
    const tabs = document.querySelectorAll('.nav-link');
    const savedTab = localStorage.getItem('activeTab');

    if (savedTab) {
        const activeTab = document.querySelector(`#${savedTab}`);
        const activeContent = document.querySelector(activeTab.dataset.bsTarget);
        tabs.forEach(tab => tab.classList.remove('active'));
        activeTab.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('show', 'active'));
        activeContent.classList.add('show', 'active');
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            localStorage.setItem('activeTab', tab.id);
        });
    });

    // Xuất kho logic
    $('#exportButton').on('click', function () {
        const selectedProducts = [];
        $('#exportForm input[name="selectedProducts"]:checked').each(function () {
            const id = $(this).val();
            const quantity = $(`#exportForm input[name="quantity_${id}"]`).val();
            if (quantity > 0) {
                selectedProducts.push({ id, quantity });
            }
        });

        if (selectedProducts.length === 0) {
            alert('Vui lòng chọn sản phẩm và nhập số lượng xuất.');
            return;
        }

        // Gửi yêu cầu xuất kho
        $.post('/products/export', { products: selectedProducts }, function (data) {
            if (!data || !data.receiptId) {
                alert('Không thể xuất kho, vui lòng thử lại!');
                return;
            }

            // Hiển thị hóa đơn xuất kho
            $('#exportReceipt').html(`
                <h4>Hóa đơn xuất kho</h4>
                <p>Mã hóa đơn: ${data.receiptId}</p>
                <p>Ngày: ${new Date(data.date).toLocaleString()}</p>
                <p>Tổng số lượng xuất: ${data.totalQuantity}</p>
                <button id="printInvoiceButton" class="btn btn-primary mt-2">In hóa đơn</button>
            `);

            // Tạo sự kiện in hóa đơn ngay sau khi xuất
            $('#printInvoiceButton').on('click', function () {
                // Lấy thông tin hóa đơn để in
                $.get(`/export-history/${data.receiptId}`, function (invoiceData) {
                    if (!invoiceData || !invoiceData.products) {
                        alert('Không thể tải thông tin hóa đơn!');
                        return;
                    }

                    const printWindow = window.open('', '', 'width=800,height=600');
                    printWindow.document.write(`
                        <html>
                        <head>
                            <title>Hóa đơn xuất kho</title>
                            <style>
                                body {
                                    font-family: Arial, sans-serif;
                                    margin: 0;
                                    padding: 20px;
                                    color: #333;
                                }
                                .invoice-container {
                                    max-width: 800px;
                                    margin: auto;
                                    padding: 20px;
                                    border: 1px solid #ddd;
                                    border-radius: 10px;
                                    background-color: #f9f9f9;
                                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                                }
                                h1 {
                                    text-align: center;
                                    color: #4CAF50;
                                    margin-bottom: 20px;
                                }
                                .store-info, .invoice-info {
                                    margin-bottom: 20px;
                                }
                                .store-info p, .invoice-info p {
                                    margin: 5px 0;
                                    line-height: 1.6;
                                }
                                table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin-top: 20px;
                                }
                                th, td {
                                    border: 1px solid #ddd;
                                    padding: 10px;
                                    text-align: center;
                                }
                                th {
                                    background-color: #f2f2f2;
                                }
                                .total {
                                    text-align: right;
                                    font-weight: bold;
                                    padding-top: 20px;
                                }
                                .footer {
                                    text-align: center;
                                    margin-top: 30px;
                                    font-size: 14px;
                                    color: #888;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="invoice-container">
                                <h1>HÓA ĐƠN XUẤT KHO</h1>
                                ${invoiceData.store ? `
                                    <div class="store-info">
                                        <p><strong>Cửa hàng:</strong> ${invoiceData.store.storeName}</p>
                                        <p><strong>Địa chỉ:</strong> ${invoiceData.store.storeAddress || 'Chưa có thông tin'}</p>
                                        <p><strong>Ngân hàng:</strong> ${invoiceData.store.bankName || 'Chưa có thông tin'}</p>
                                        <p><strong>Số tài khoản:</strong> ${invoiceData.store.bankAccountNumber || 'Chưa có thông tin'}</p>
                                    </div>
                                ` : '<p><em>Không tìm thấy thông tin cửa hàng</em></p>'}
                    
                                <div class="invoice-info">
                                    <p><strong>Mã hóa đơn:</strong> ${invoiceData._id}</p>
                                    <p><strong>Ngày:</strong> ${new Date(invoiceData.date).toLocaleDateString('vi-VN')} ${new Date(invoiceData.date).toLocaleTimeString('vi-VN')}</p>
                                    <p><strong>Tổng số lượng xuất:</strong> ${invoiceData.totalQuantity}</p>
                                </div>
                    
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Mã sản phẩm</th>
                                            <th>Tên sản phẩm</th>
                                            <th>Số lượng</th>
                                            <th>Đơn giá</th>
                                            <th>Đơn vị</th>
                                            <th>Tổng cộng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${invoiceData.products.map(product => `
                                            <tr>
                                                <td>${product.productCode || 'Chưa có mã'}</td>
                                                <td>${product.productName}</td>
                                                <td>${product.quantity}</td>
                                                <td>${product.price.toLocaleString()} VND</td>
                                                <td>${product.unit || 'Chưa có đơn vị'}</td>
                                                <td>${(product.quantity * product.price).toLocaleString()} VND</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                    
                                <p class="total"><strong>Tổng cộng:</strong> ${invoiceData.products.reduce((sum, product) => sum + (product.quantity * product.price), 0).toLocaleString()} VND</p>
                    
                                <div class="footer">
                                    <p>Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của chúng tôi!</p>
                                    <p>Ngày xuất hóa đơn: ${new Date().toLocaleDateString('vi-VN')}</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                }).fail(() => alert('Không thể tải hóa đơn!'));
            });
        }).fail(function () {
            alert('Xuất kho thất bại!');
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Gắn sự kiện cho các nút "In hóa đơn"
    document.querySelectorAll('.print-btn').forEach(button => {
        button.addEventListener('click', function () {
            const receiptId = this.dataset.id; // Lấy ID hóa đơn từ thuộc tính data-id
            if (!receiptId) {
                alert('Không tìm thấy ID hóa đơn!');
                return;
            }

            // Gửi yêu cầu để lấy thông tin hóa đơn
            $.get(`/export-history/${receiptId}`, function (invoiceData) {
                if (!invoiceData || !invoiceData.products) {
                    alert('Không thể tải dữ liệu hóa đơn!');
                    return;
                }

                // Tạo cửa sổ mới và viết nội dung hóa đơn vào đó
                const printWindow = window.open('', '', 'width=800,height=600');
                printWindow.document.write(`
                    <html>
                    <head>
                        <title>Hóa đơn xuất kho</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                margin: 0;
                                padding: 20px;
                                color: #333;
                            }
                            .invoice-container {
                                max-width: 800px;
                                margin: auto;
                                padding: 20px;
                                border: 1px solid #ddd;
                                border-radius: 10px;
                                background-color: #f9f9f9;
                                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                            }
                            h1 {
                                text-align: center;
                                color: #4CAF50;
                                margin-bottom: 20px;
                            }
                            .store-info, .invoice-info {
                                margin-bottom: 20px;
                            }
                            .store-info p, .invoice-info p {
                                margin: 5px 0;
                                line-height: 1.6;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-top: 20px;
                            }
                            th, td {
                                border: 1px solid #ddd;
                                padding: 10px;
                                text-align: center;
                            }
                            th {
                                background-color: #f2f2f2;
                            }
                            .total {
                                text-align: right;
                                font-weight: bold;
                                padding-top: 20px;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 30px;
                                font-size: 14px;
                                color: #888;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="invoice-container">
                            <h1>HÓA ĐƠN XUẤT KHO</h1>
                            ${invoiceData.store ? `
                                <div class="store-info">
                                    <p><strong>Cửa hàng:</strong> ${invoiceData.store.storeName}</p>
                                    <p><strong>Địa chỉ:</strong> ${invoiceData.store.storeAddress || 'Chưa có thông tin'}</p>
                                    <p><strong>Ngân hàng:</strong> ${invoiceData.store.bankName || 'Chưa có thông tin'}</p>
                                    <p><strong>Số tài khoản:</strong> ${invoiceData.store.bankAccountNumber || 'Chưa có thông tin'}</p>
                                </div>
                            ` : '<p><em>Không tìm thấy thông tin cửa hàng</em></p>'}
                
                            <div class="invoice-info">
                                <p><strong>Mã hóa đơn:</strong> ${invoiceData._id}</p>
                                <p><strong>Ngày:</strong> ${new Date(invoiceData.date).toLocaleDateString('vi-VN')} ${new Date(invoiceData.date).toLocaleTimeString('vi-VN')}</p>
                                <p><strong>Tổng số lượng xuất:</strong> ${invoiceData.totalQuantity}</p>
                            </div>
                
                            <table>
                                <thead>
                                    <tr>
                                        <th>Mã sản phẩm</th>
                                        <th>Tên sản phẩm</th>
                                        <th>Số lượng</th>
                                        <th>Đơn giá</th>
                                        <th>Đơn vị</th>
                                        <th>Tổng cộng</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invoiceData.products.map(product => `
                                        <tr>
                                            <td>${product.productCode || 'Chưa có mã'}</td>
                                            <td>${product.productName}</td>
                                            <td>${product.quantity}</td>
                                            <td>${product.price.toLocaleString()} VND</td>
                                            <td>${product.unit || 'Chưa có đơn vị'}</td>
                                            <td>${(product.quantity * product.price).toLocaleString()} VND</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                
                            <p class="total"><strong>Tổng cộng:</strong> ${invoiceData.products.reduce((sum, product) => sum + (product.quantity * product.price), 0).toLocaleString()} VND</p>
                
                            <div class="footer">
                                <p>Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của chúng tôi!</p>
                                <p>Ngày xuất hóa đơn: ${new Date().toLocaleDateString('vi-VN')}</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
            }).fail(() => alert('Không thể tải thông tin hóa đơn!'));
        });
    });
});

document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', function () {
        const form = this.closest('form');
        Swal.fire({
            title: 'Bạn có chắc chắn muốn xóa sản phẩm này?',
            text: 'Hành động này không thể hoàn tác!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy',
        }).then(result => {
            if (result.isConfirmed) {
                form.submit();
            }
        });
    });
});

document.getElementById('addProductForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const formData = new FormData(this);

    fetch('/products/new', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Sản phẩm đã được thêm thành công!',
                text: data.message,
                footer: `Mã sản phẩm: ${data.product.productCode}`
            }).then(() => {
                window.location.reload();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Có lỗi xảy ra!',
                text: data.message
            });
        }
    })
    .catch(error => {
        Swal.fire({
            icon: 'error',
            title: 'Có lỗi xảy ra!',
            text: 'Không thể kết nối đến server.'
        });
    });
});

document.getElementById('importForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const formData = new FormData(this);

    fetch('/products/import-excel', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Nhập hàng bằng Excel thành công!',
                text: data.message,
                footer: `<span>Có ${data.errorCount} lỗi trong quá trình nhập.</span>` + 
                        (data.errorDetails && data.errorDetails.length > 0 ? 
                            `<br><br><b>Chi tiết lỗi:</b><ul style="text-align: left;">` +
                            data.errorDetails.map(error => 
                                `<li>Sản phẩm: ${error.product.name} - Lỗi: ${error.missingFields.join(', ')}</li>`
                            ).join('') + 
                            `</ul>` : '')
            }).then(() => {
                window.location.reload();
            });
        } else {
            let errorMessage = `Có ${data.errorCount} lỗi trong quá trình nhập.`;
            if (data.errorDetails && data.errorDetails.length > 0) {
                errorMessage += '<br><br><b>Chi tiết lỗi:</b><ul>';
                data.errorDetails.forEach(error => {
                    errorMessage += `<li>Sản phẩm: ${error.product.name} - Lỗi: ${error.missingFields.join(', ')}</li>`;
                });
                errorMessage += '</ul>';
            }

            Swal.fire({
                icon: 'error',
                title: 'Có lỗi xảy ra!',
                html: errorMessage,
            });
        }
    })
    .catch(error => {
        Swal.fire({
            icon: 'error',
            title: 'Có lỗi xảy ra!',
            text: 'Không thể kết nối đến server.',
        });
    });
});
