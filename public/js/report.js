// Lấy dữ liệu doanh thu theo ngày qua API
fetch('/api/daily-revenue')
    .then(response => response.json())
    .then(data => {
        const dailyLabels = data.map(rev => rev.date);
        const dailyData = data.map(rev => rev.totalRevenue);

        const dailyRevenueChart = new Chart(document.getElementById('dailyRevenueChart'), {
            type: 'line',
            data: {
                labels: dailyLabels,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: dailyData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2
                }]
            }
        });
    })
    .catch(error => console.error('Lỗi khi lấy dữ liệu doanh thu theo ngày:', error));

// Lấy dữ liệu doanh thu theo tháng qua API
fetch('/api/monthly-revenue')
    .then(response => response.json())
    .then(data => {
        const monthlyLabels = data.map(rev => rev._id);
        const monthlyData = data.map(rev => rev.total);

        const monthlyRevenueChart = new Chart(document.getElementById('monthlyRevenueChart'), {
            type: 'bar',
            data: {
                labels: monthlyLabels,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: monthlyData,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            }
        });
    })
    .catch(error => console.error('Lỗi khi lấy dữ liệu doanh thu theo tháng:', error));

fetch('/api/yearly-revenue')
    .then(response => response.json())
    .then(data => {
        const yearlyLabels = data.map(rev => rev._id); // Sử dụng năm làm label
        const yearlyData = data.map(rev => rev.total); // Tổng doanh thu theo năm

        const yearlyRevenueChart = new Chart(document.getElementById('yearlyRevenueChart'), {
            type: 'bar',  // Sử dụng biểu đồ cột
            data: {
                labels: yearlyLabels,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: yearlyData,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            }
        });
    })
    .catch(error => console.error('Lỗi khi lấy dữ liệu doanh thu theo năm:', error));