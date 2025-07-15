const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'database/room_booking.db'), (err) => {
    if (err) {
        console.error('Lỗi kết nối database:', err.message);
    } else {
        console.log('✅ Đã kết nối SQLite database');
    }
});

// Khởi tạo database
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            day TEXT NOT NULL,
            hour INTEGER NOT NULL,
            notes TEXT,
            week_start DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_slot 
        ON bookings(day, hour, week_start)
    `);
});

// Helper functions
const getCurrentWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
};

// API Routes

// Lấy tất cả booking của tuần hiện tại
app.get('/api/bookings', (req, res) => {
    const weekStart = getCurrentWeekStart();
    
    db.all(
        'SELECT * FROM bookings WHERE week_start = ? ORDER BY day, hour',
        [weekStart],
        (err, rows) => {
            if (err) {
                console.error('Lỗi query:', err);
                res.status(500).json({ error: 'Lỗi server' });
                return;
            }
            
            // Chuyển đổi thành format frontend mong muốn
            const bookings = {};
            const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
            const hours = Array.from({length: 16}, (_, i) => i + 7);
            
            // Khởi tạo structure
            days.forEach(day => {
                bookings[day] = {};
                hours.forEach(hour => {
                    bookings[day][hour] = null;
                });
            });
            
            // Điền dữ liệu từ database
            rows.forEach(row => {
                bookings[row.day][row.hour] = {
                    id: row.id,
                    name: row.name,
                    phone: row.phone,
                    notes: row.notes,
                    created_at: row.created_at
                };
            });
            
            res.json({
                success: true,
                weekStart: weekStart,
                bookings: bookings
            });
        }
    );
});

// Tạo booking mới
app.post('/api/bookings', (req, res) => {
    const { name, phone, day, hour, notes } = req.body;
    const weekStart = getCurrentWeekStart();
    
    // Validation
    if (!name || !phone || !day || !hour) {
        return res.status(400).json({
            success: false,
            error: 'Thiếu thông tin bắt buộc'
        });
    }
    
    // Kiểm tra slot có trống không
    db.get(
        'SELECT id FROM bookings WHERE day = ? AND hour = ? AND week_start = ?',
        [day, hour, weekStart],
        (err, row) => {
            if (err) {
                console.error('Lỗi check slot:', err);
                return res.status(500).json({ error: 'Lỗi server' });
            }
            
            if (row) {
                return res.status(400).json({
                    success: false,
                    error: 'Thời gian này đã được đặt!'
                });
            }
            
            // Tạo booking mới
            db.run(
                'INSERT INTO bookings (name, phone, day, hour, notes, week_start) VALUES (?, ?, ?, ?, ?, ?)',
                [name, phone, day, hour, notes || '', weekStart],
                function(err) {
                    if (err) {
                        console.error('Lỗi insert:', err);
                        return res.status(500).json({ error: 'Lỗi server' });
                    }
                    
                    res.json({
                        success: true,
                        booking: {
                            id: this.lastID,
                            name,
                            phone,
                            day,
                            hour,
                            notes,
                            weekStart
                        }
                    });
                }
            );
        }
    );
});

// Xóa booking
app.delete('/api/bookings/:id', (req, res) => {
    const bookingId = req.params.id;
    
    db.run(
        'DELETE FROM bookings WHERE id = ?',
        [bookingId],
        function(err) {
            if (err) {
                console.error('Lỗi delete:', err);
                return res.status(500).json({ error: 'Lỗi server' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy booking'
                });
            }
            
            res.json({
                success: true,
                message: 'Đã xóa booking thành công'
            });
        }
    );
});

// Reset tuần mới
app.post('/api/reset-week', (req, res) => {
    const weekStart = getCurrentWeekStart();
    
    db.run(
        'DELETE FROM bookings WHERE week_start = ?',
        [weekStart],
        function(err) {
            if (err) {
                console.error('Lỗi reset:', err);
                return res.status(500).json({ error: 'Lỗi server' });
            }
            
            res.json({
                success: true,
                message: `Đã xóa ${this.changes} booking(s)`,
                weekStart: weekStart
            });
        }
    );
});

// Thống kê
app.get('/api/stats', (req, res) => {
    const weekStart = getCurrentWeekStart();
    
    db.get(
        'SELECT COUNT(*) as total FROM bookings WHERE week_start = ?',
        [weekStart],
        (err, row) => {
            if (err) {
                console.error('Lỗi stats:', err);
                return res.status(500).json({ error: 'Lỗi server' });
            }
            
            const totalSlots = 7 * 16; // 7 ngày x 16 giờ
            const bookedSlots = row.total;
            const availableSlots = totalSlots - bookedSlots;
            
            res.json({
                success: true,
                stats: {
                    totalSlots,
                    bookedSlots,
                    availableSlots,
                    weekStart
                }
            });
        }
    );
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Lỗi server:', err);
    res.status(500).json({ error: 'Lỗi server nội bộ' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Không tìm thấy endpoint' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Đang đóng server...');
    db.close((err) => {
        if (err) {
            console.error('Lỗi đóng database:', err.message);
        } else {
            console.log('✅ Đã đóng database');
        }
        process.exit(0);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📊 Database: ${path.join(__dirname, 'database/room_booking.db')}`);
});