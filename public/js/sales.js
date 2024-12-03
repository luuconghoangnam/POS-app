// Lọc sản phẩm theo tên
$('#search-input').on('keyup', function () {
    var searchText = $(this).val().toLowerCase();
    $('.product-item').each(function () {
        var productName = $(this).find('.card-title').text().toLowerCase();
        if (productName.indexOf(searchText) !== -1) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
});

/// Giỏ hàng
let cart = [];

// Sự kiện thêm sản phẩm vào giỏ
$(document).on('click', '.add-to-cart', function () {
    const productId = $(this).data('id');
    const productCard = $(this).closest('.card');
    const productName = productCard.find('.card-title').text();
    const productPrice = parseInt(productCard.find('.card-text').first().text().replace('đ', ''));
    const discountLabel = productCard.find('.discount-label').first();
    const productDiscount = discountLabel.length > 0 ? parseInt(discountLabel.text().replace('-', '').replace('%', '')) : 0;
    let productStock = parseInt(productCard.find('.card-text').last().text().replace('Số lượng còn: ', ''));

    // Tìm sản phẩm trong giỏ hàng
    const foundProduct = cart.find(item => item.id === productId);

    if (productStock === 0) {
        alert('Sản phẩm này đã hết hàng');
        return;
    }

    if (foundProduct) {
        // Nếu sản phẩm đã có trong giỏ và còn hàng thì tăng số lượng
        if (foundProduct.quantity < foundProduct.stock) {
            foundProduct.quantity++;
            productStock--;  // Giảm số lượng trong kho
        } else {
            alert('Số lượng trong giỏ đã đạt giới hạn trong kho!');
        }
    } else {
        // Nếu sản phẩm chưa có trong giỏ hàng thì thêm vào giỏ
        cart.push({ id: productId, name: productName, price: productPrice, discount: productDiscount, quantity: 1, stock: productStock });
        productStock--;  // Giảm số lượng trong kho
    }

    // Cập nhật hiển thị số lượng còn lại
    productCard.find('.card-text').last().text(`Số lượng còn: ${productStock}`);

    // Vô hiệu hóa nút nếu hết hàng
    if (productStock === 0) {
        $(this).prop('disabled', true).text('Hết hàng');
    }

    renderCart();
    checkStockLimits();
});

// Hàm hiển thị giỏ hàng
function renderCart() {
    let subtotal = 0;
    $('#cart-items').empty();
    cart.forEach(item => {
        $('#cart-items').append(`
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <button class="btn btn-danger btn-sm remove-item" data-id="${item.id}">Xóa</button>
                ${item.name} 
                <button class="btn btn-sm btn-outline-secondary decrease-quantity" data-id="${item.id}">-</button>
                <span class="badge bg-primary rounded-pill">${item.quantity} x ${item.price * (1 - item.discount / 100)}đ</span>
                <button class="btn btn-sm btn-outline-secondary increase-quantity" data-id="${item.id}">+</button>
            </li>
        `);
        subtotal += item.price * (1 - item.discount / 100) * item.quantity;
    });

    $('#subtotal').text(subtotal + 'đ');
    const tax = subtotal * 0.0;  // Thuế 0%
    $('#tax').text(tax + 'đ');
    const total = subtotal + tax;
    $('#total').text(total + 'đ');
}

// Kiểm tra giới hạn kho và disable các nút "Tăng số lượng" hoặc "Thêm vào giỏ"
function checkStockLimits() {
    $('.product-item').each(function () {
        const productId = $(this).find('.add-to-cart').data('id');
        const productCard = $(this).closest('.card');
        let productStock = parseInt(productCard.find('.card-text').last().text().replace('Số lượng còn: ', ''));
        const foundProduct = cart.find(item => item.id === productId);

        if (foundProduct && foundProduct.quantity >= foundProduct.stock) {
            $(this).find('.add-to-cart').prop('disabled', true).text('Hết hàng');
        } else {
            $(this).find('.add-to-cart').prop('disabled', false).text('Thêm vào giỏ');
        }
    });
}

// Sự kiện tăng số lượng sản phẩm trong giỏ
$(document).on('click', '.increase-quantity', function () {
    const productId = $(this).data('id');
    const foundProduct = cart.find(item => item.id === productId);

    if (foundProduct.quantity < foundProduct.stock) {
        foundProduct.quantity++;
        const productCard = $(`button[data-id='${productId}']`).closest('.card');
        let currentStock = parseInt(productCard.find('.card-text').last().text().replace('Số lượng còn: ', ''));
        currentStock--;  // Giảm số lượng hàng còn lại
        productCard.find('.card-text').last().text(`Số lượng còn: ${currentStock}`);
    } else {
        alert('Số lượng trong giỏ đã đạt giới hạn trong kho!');
    }

    renderCart();
    checkStockLimits();
});

// Sự kiện giảm số lượng sản phẩm trong giỏ
$(document).on('click', '.decrease-quantity', function () {
    const productId = $(this).data('id');
    const foundProduct = cart.find(item => item.id === productId);
    const productCard = $(`button[data-id='${productId}']`).closest('.card');
    let currentStock = parseInt(productCard.find('.card-text').last().text().replace('Số lượng còn: ', ''));

    // Nếu số lượng trong giỏ hàng > 1, giảm số lượng
    if (foundProduct.quantity > 1) {
        foundProduct.quantity--;
        currentStock++;  // Tăng số lượng hàng còn lại
    } else {
        // Nếu số lượng = 1 và người dùng nhấn giảm, xóa sản phẩm khỏi giỏ
        cart = cart.filter(item => item.id !== productId);
        currentStock += foundProduct.quantity;
    }

    // Cập nhật hiển thị số lượng còn lại
    productCard.find('.card-text').last().text(`Số lượng còn: ${currentStock}`);

    // Nếu số lượng hàng sau khi tăng > 0, bật lại nút "Thêm vào giỏ"
    if (currentStock > 0) {
        productCard.find('.add-to-cart').prop('disabled', false).text('Thêm vào giỏ');
    }

    renderCart();
    checkStockLimits();
});

// Sự kiện xóa sản phẩm khỏi giỏ
$(document).on('click', '.remove-item', function () {
    const productId = $(this).data('id');
    const foundProduct = cart.find(item => item.id === productId);

    // Trả lại số lượng hàng vào kho khi xóa khỏi giỏ
    const productCard = $(`button[data-id='${productId}']`).closest('.card');
    let currentStock = parseInt(productCard.find('.card-text').last().text().replace('Số lượng còn: ', ''));
    currentStock += foundProduct.quantity;
    productCard.find('.card-text').last().text(`Số lượng còn: ${currentStock}`);

    // Xóa sản phẩm khỏi giỏ hàng
    cart = cart.filter(item => item.id !== productId);

    // Cập nhật lại nút "Thêm vào giỏ" nếu hàng có sẵn
    if (currentStock > 0) {
        productCard.find('.add-to-cart').prop('disabled', false).text('Thêm vào giỏ');
    }

    renderCart();
    checkStockLimits();
});

// Sự kiện khi nhấn "Thanh toán"
$('#checkout-btn').on('click', function () {
    // Kiểm tra nếu giỏ hàng rỗng, hiển thị cảnh báo
    if (cart.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Giỏ hàng trống!',
            text: 'Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán.',
        });
        return;
    }

    // Hiển thị modal thanh toán
    $('#checkoutModal').modal('show');
});

// Sự kiện chọn phương thức thanh toán
$('input[name="paymentMethod"]').on('change', function () {
    const selectedMethod = $('input[name="paymentMethod"]:checked').val();
    if (selectedMethod === 'bank') {
        $('#bankTransferDetails').show();
        $('#cashPaymentDetails').hide();
    } else if (selectedMethod === 'cash') {
        $('#bankTransferDetails').hide();
        $('#cashPaymentDetails').show();
    }
});

// Confirm cash payment action
$('#confirmCashPayment').on('click', function () {
    Swal.fire({
        title: 'Thanh toán thành công!',
        text: 'Bạn đã xác nhận thanh toán bằng tiền mặt. Bạn có muốn in hóa đơn không?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Có, in hóa đơn',
        cancelButtonText: 'Không',
    }).then((result) => {
        if (result.isConfirmed) {
            printBill('cash');  // Gọi hàm in hóa đơn và truyền phương thức thanh toán là "cash"
        }
        processCheckout();  // Xử lý thanh toán
    });
});

// Confirm bank transfer action
$('#confirmBankTransfer').on('click', function () {
    Swal.fire({
        title: 'Thanh toán thành công!',
        text: 'Bạn đã xác nhận thanh toán chuyển khoản. Bạn có muốn in hóa đơn không?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Có, in hóa đơn',
        cancelButtonText: 'Không',
    }).then((result) => {
        if (result.isConfirmed) {
            printBill('bank');  // Gọi hàm in hóa đơn và truyền phương thức thanh toán là "bank"
        }
        processCheckout();  // Xử lý thanh toán
    });
});

function printBill(paymentMethod) {
    $.ajax({
        url: '/store-info',
        method: 'GET',
        success: function (response) {
            const { storeName, storeAddress } = response;

            // Nội dung hóa đơn
            const billContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd;">
                    <h1 style="text-align: center; color: #4CAF50;">HÓA ĐƠN THANH TOÁN</h1>
                    <hr>
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h3>Cửa hàng: ${storeName || 'Tên cửa hàng chưa được thiết lập'}</h3>
                        <p>Địa chỉ: ${storeAddress || 'Địa chỉ chưa được thiết lập'}</p>
                    </div>
                    <hr>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tên sản phẩm</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Số lượng</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Giá</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Tổng</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cart.map(item => `
                                <tr>
                                    <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${(item.price * (1 - item.discount / 100)).toLocaleString()}đ</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${(item.price * (1 - item.discount / 100) * item.quantity).toLocaleString()}đ</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <hr>
                    <div style="text-align: right; margin-bottom: 20px;">
                        <p style="font-size: 18px;"><strong>Tổng cộng: ${$('#total').text()}</strong></p>
                    </div>
                    <div style="text-align: center; margin-bottom: 20px;">
                        <p><strong>Phương thức thanh toán:</strong> ${paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</p>
                    </div>
                    <div style="text-align: center;">
                        <p>Cảm ơn bạn đã mua sắm tại ${storeName || 'Cửa hàng'}!</p>
                        <p>Ngày xuất hóa đơn: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            `;

            // Hiển thị hóa đơn trong cửa sổ in
            const printWindow = window.open('', '', 'height=800,width=1200');
            printWindow.document.write('<html><head><title>In hóa đơn</title><style>');
            printWindow.document.write(`
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                h1 { color: #4CAF50; }
                hr { border: 1px solid #ddd; }
            `);
            printWindow.document.write('</style></head><body>');
            printWindow.document.write(billContent);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        },
        error: function (xhr) {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: xhr.responseJSON ? xhr.responseJSON.message : 'Lỗi không xác định xảy ra',
            });
        }
    });
}

// Hàm xử lý thanh toán
function processCheckout() {
    $.ajax({
        url: '/sales/checkout',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ cart }),
        success: function (response) {
            window.location.reload();
        },
        error: function (xhr, status, error) {
            console.error('Lỗi khi thanh toán:', error);
            alert('Lỗi khi thanh toán');
        }
    });
}

$('.add-to-cart').click(function () {
    $('#cart-items').append('<li class="list-group-item">Sản phẩm mới</li>').hide().slideDown();
});

document.addEventListener('keydown', function (event) {
    if (event.key === 'F2') {
        event.preventDefault();
       document.getElementById('checkout-btn').click();
    }
});