// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// Global Variables
const HOURS = Array.from({length: 16}, (_, i) => i + 7); // 7h-22h
const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

let bookings = {};
let selectedSlot = null;
let currentWeekStart = null;

// Utility Functions
const showLoading = () => {
    document.getElementById('loading-overlay').classList.add('show');
};

const hideLoading = () => {
    document.getElementById('loading-overlay').classList.remove('show');
};

const showNotification = (message, type = 'info') => {
    // Simple notification using alert for now
    // Can be enhanced with a custom notification system
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        alert('ℹ️ ' + message);
    }
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

// API Functions
const apiCall = async (endpoint, options = {}) => {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Lỗi server');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Load bookings from server
const loadBookings = async () => {
    try {
        showLoading();
        const data = await apiCall('/bookings');
        
        bookings = data.bookings;
        currentWeekStart = data.weekStart;
        
        updateWeekInfo();
        createScheduleTable();
        loadStats();
        
    } catch (error) {
        showNotification('Lỗi tải dữ liệu: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
};

// Load statistics
const loadStats = async () => {
    try {
        const data = await apiCall('/stats');
        updateStatsDisplay(data.stats);
    } catch (error) {
        console.error('Lỗi tải thống kê:', error);
    }
};

// Create booking
const createBooking = async (bookingData) => {
    try {
        showLoading();
        const data = await apiCall('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
        
        return data.booking;
    } catch (error) {
        throw error;
    } finally {
        hideLoading();
    }
};

// Delete booking
const deleteBooking = async (bookingId) => {
    try {
        showLoading();
        await apiCall(`/bookings/${bookingId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        throw error;
    } finally {
        hideLoading();
    }
};

// Reset week
const resetWeekAPI = async () => {
    try {
        showLoading();
        const data = await apiCall('/reset-week', {
            method: 'POST'
        });
        return data;
    } catch (error) {
        throw error;
    } finally {
        hideLoading();
    }
};

// UI Functions
const updateWeekInfo = () => {
    if (!currentWeekStart) return;
    
    const startDate = new Date(currentWeekStart);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    document.getElementById('current-week').textContent = 
        `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

const updateStatsDisplay = (stats) => {
    document.getElementById('total-slots').textContent = stats.totalSlots;
    document.getElementById('booked-slots').textContent = stats.bookedSlots;
    document.getElementById('available-slots').textContent = stats.availableSlots;
};

const createScheduleTable = () => {
    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = '';
    
    HOURS.forEach(hour => {
        const row = document.createElement('tr');
        
        // Time cell
        const timeCell = document.createElement('td');
        timeCell.className = 'time-cell';
        timeCell.textContent = `${hour}:00`;
        row.appendChild(timeCell);
        
        // Day cells
        DAYS.forEach(day => {
            const dayCell = document.createElement('td');
            dayCell.className = 'day-cell';
            dayCell.dataset.day = day;
            dayCell.dataset.hour = hour;
            
            const booking = bookings[day] && bookings[day][hour];
            
            if (booking) {
                dayCell.classList.add('booked');
                dayCell.innerHTML = `
                    <div class="booking-info">
                        <strong>${booking.name}</strong><br>
                        <small>${booking.phone}</small>
                    </div>
                `;
                dayCell.onclick = () => showBookingDetails(booking);
            } else {
                dayCell.classList.add('available');
                dayCell.textContent = 'Trống';
                dayCell.onclick = () => selectSlot(day, hour, dayCell);
            }
            
            row.appendChild(dayCell);
        });
        
        tbody.appendChild(row);
    });
};

const selectSlot = (day, hour, cell) => {
    // Clear previous selection
    document.querySelectorAll('.day-cell').forEach(c => {
        c.classList.remove('selected-slot');
    });
    
    // Mark new selection
    cell.classList.add('selected-slot');
    
    // Save selection
    selectedSlot = { day, hour };
    
    // Update form
    document.getElementById('selected-day').value = day;
    document.getElementById('selected-time').value = `${hour}:00`;
    
    // Scroll to form
    document.getElementById('booking-form').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
    });
};

const showBookingDetails = (booking) => {
    const details = `
Thông tin đặt lịch:
• Tên: ${booking.name}
• Số ĐT: ${booking.phone}
• Ghi chú: ${booking.notes || 'Không có'}
• Thời gian đặt: ${new Date(booking.created_at).toLocaleString('vi-VN')}

Bạn có muốn xóa booking này không?
    `;
    
    if (confirm(details)) {
        handleDeleteBooking(booking.id);
    }
};

const handleDeleteBooking = async (bookingId) => {
    try {
        await deleteBooking(bookingId);
        showNotification('Đã xóa booking thành công!', 'success');
        await loadBookings(); // Reload data
    } catch (error) {
        showNotification('Lỗi xóa booking: ' + error.message, 'error');
    }
};

const resetForm = () => {
    document.getElementById('booking-form').reset();
    document.getElementById('selected-day').value = '';
    document.getElementById('selected-time').value = '';
    selectedSlot = null;
    
    // Clear selection
    document.querySelectorAll('.day-cell').forEach(c => {
        c.classList.remove('selected-slot');
    });
};

const resetWeek = async () => {
    const confirmMessage = `
🔄 RESET TUẦN MỚI

Bạn có chắc chắn muốn xóa TẤT CẢ dữ liệu đặt lịch của tuần hiện tại?

⚠️ Hành động này KHÔNG THỂ hoàn tác!

Nhấn OK để xác nhận, Cancel để hủy.
    `;
    
    if (confirm(confirmMessage)) {
        try {
            const result = await resetWeekAPI();
            showNotification(`Reset thành công! ${result.message}`, 'success');
            await loadBookings(); // Reload data
            resetForm();
        } catch (error) {
            showNotification('Lỗi reset: ' + error.message, 'error');
        }
    }
};

// Form handling
const handleFormSubmit = async (event) => {
    event.preventDefault();
    
    if (!selectedSlot) {
        showNotification('Vui lòng chọn thời gian từ lịch!', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.textContent;
    
    try {
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Đang đăng ký...';
        
        const formData = new FormData(event.target);
        const bookingData = {
            name: document.getElementById('student-name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            day: selectedSlot.day,
            hour: selectedSlot.hour,
            notes: document.getElementById('notes').value.trim()
        };
        
        // Validation
        if (!bookingData.name || !bookingData.phone) {
            showNotification('Vui lòng điền đầy đủ thông tin bắt buộc!', 'error');
            return;
        }
        
        // Phone validation
        const phoneRegex = /^[0-9+\-\s()]+$/;
        if (!phoneRegex.test(bookingData.phone)) {
            showNotification('Số điện thoại không hợp lệ!', 'error');
            return;
        }
        
        // Create booking
        const newBooking = await createBooking(bookingData);
        
        // Update UI immediately
        const selectedCell = document.querySelector(
            `[data-day="${selectedSlot.day}"][data-hour="${selectedSlot.hour}"]`
        );
        
        if (selectedCell) {
            selectedCell.classList.remove('available', 'selected-slot');
            selectedCell.classList.add('booked');
            selectedCell.innerHTML = `
                <div class="booking-info">
                    <strong>${bookingData.name}</strong><br>
                    <small>${bookingData.phone}</small>
                </div>
            `;
            selectedCell.onclick = () => showBookingDetails({
                ...newBooking,
                created_at: new Date().toISOString()
            });
        }
        
        // Update bookings data
        if (!bookings[selectedSlot.day]) {
            bookings[selectedSlot.day] = {};
        }
        bookings[selectedSlot.day][selectedSlot.hour] = {
            id: newBooking.id,
            name: bookingData.name,
            phone: bookingData.phone,
            notes: bookingData.notes
        };
        
        // Reset form
        resetForm();
        
        // Reload stats
        await loadStats();
        
        // Success message
        showNotification(
            `Đăng ký thành công!\n\nThời gian: ${selectedSlot.day} ${selectedSlot.hour}:00\nNgười đăng ký: ${bookingData.name}`,
            'success'
        );
        
    } catch (error) {
        showNotification('Lỗi đăng ký: ' + error.message, 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
};

// Initialize app
const initializeApp = async () => {
    try {
        // Setup form handler
        document.getElementById('booking-form').addEventListener('submit', handleFormSubmit);
        
        // Load initial data
        await loadBookings();
        
        // Auto refresh every 30 seconds to sync with other users
        setInterval(async () => {
            try {
                await loadBookings();
            } catch (error) {
                console.warn('Auto refresh failed:', error);
            }
        }, 30000);
        
        console.log('✅ App initialized successfully');
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showNotification('Lỗi khởi tạo ứng dụng: ' + error.message, 'error');
    }
};

// Auto-refresh when tab becomes visible again
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        loadBookings();
    }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showNotification('Đã xảy ra lỗi không mong muốn. Vui lòng thử lại!', 'error');
});

// Handle network errors
window.addEventListener('online', () => {
    showNotification('Đã kết nối lại internet!', 'success');
    loadBookings();
});

window.addEventListener('offline', () => {
    showNotification('Mất kết nối internet!', 'error');
});