const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Tạo thư mục database nếu chưa tồn tại
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'room_booking.db');

console.log('🔄 Khởi tạo database...');
console.log('📍 Đường dẫn:', dbPath);

// Kết nối database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Lỗi kết nối database:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Đã kết nối SQLite database');
    }
});

// Khởi tạo bảng
db.serialize(() => {
    console.log('🔧 Tạo bảng bookings...');
    
    // Tạo bảng bookings
    db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            day TEXT NOT NULL,
            hour INTEGER NOT NULL,
            notes TEXT DEFAULT '',
            week_start DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Lỗi tạo bảng bookings:', err.message);
        } else {
            console.log('✅ Đã tạo bảng bookings');
        }
    });
    
    // Tạo index unique cho slot
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_slot 
        ON bookings(day, hour, week_start)
    `, (err) => {
        if (err) {
            console.error('❌ Lỗi tạo index:', err.message);
        } else {
            console.log('✅ Đã tạo unique index');
        }
    });
    
    // Tạo index cho tìm kiếm theo tuần
    db.run(`
        CREATE INDEX IF NOT EXISTS idx_week_start 
        ON bookings(week_start)
    `, (err) => {
        if (err) {
            console.error('❌ Lỗi tạo index week_start:', err.message);
        } else {
            console.log('✅ Đã tạo index week_start');
        }
    });
    
    // Tạo trigger để tự động cập nhật updated_at
    db.run(`
        CREATE TRIGGER IF NOT EXISTS update_timestamp 
        AFTER UPDATE ON bookings
        BEGIN
            UPDATE bookings 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE id = NEW.id;
        END
    `, (err) => {
        if (err) {
            console.error('❌ Lỗi tạo trigger:', err.message);
        } else {
            console.log('✅ Đã tạo trigger update_timestamp');
        }
    });
    
    // Thêm dữ liệu mẫu (tùy chọn)
    const addSampleData = process.argv.includes('--sample');
    if (addSampleData) {
        console.log('📊 Thêm dữ liệu mẫu...');
        
        const getCurrentWeekStart = () => {
            const now = new Date();
            const day = now.getDay();
            const monday = new Date(now);
            monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
            monday.setHours(0, 0, 0, 0);
            return monday.toISOString().split('T')[0];
        };
        
        const weekStart = getCurrentWeekStart();
        const sampleBookings = [
            {
                name: 'Nguyễn Văn A',
                phone: '0123456789',
                day: 'Thứ 2',
                hour: 8,
                notes: 'Học nhóm Toán cao cấp',
                week_start: weekStart
            },
            {
                name: 'Trần Thị B',
                phone: '0987654321',
                day: 'Thứ 3',
                hour: 14,
                notes: 'Thảo luận đồ án',
                week_start: weekStart
            },
            {
                name: 'Lê Văn C',
                phone: '0369258147',
                day: 'Thứ 5',
                hour: 16,
                notes: 'Ôn thi cuối kỳ',
                week_start: weekStart
            }
        ];
        
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO bookings 
            (name, phone, day, hour, notes, week_start) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        sampleBookings.forEach(booking => {
            stmt.run([
                booking.name,
                booking.phone,
                booking.day,
                booking.hour,
                booking.notes,
                booking.week_start
            ]);
        });
        
        stmt.finalize((err) => {
            if (err) {
                console.error('❌ Lỗi thêm dữ liệu mẫu:', err.message);
            } else {
                console.log('✅ Đã thêm dữ liệu mẫu');
            }
        });
    }
    
    // Hiển thị thông tin database
    db.get("SELECT COUNT(*) as count FROM bookings", (err, row) => {
        if (err) {
            console.error('❌ Lỗi đếm records:', err.message);
        } else {
            console.log(`📊 Tổng số booking hiện tại: ${row.count}`);
        }
    });
    
    // Hiển thị schema
    db.all("PRAGMA table_info(bookings)", (err, rows) => {
        if (err) {
            console.error('❌ Lỗi lấy schema:', err.message);
        } else {
            console.log('📋 Schema bảng bookings:');
            rows.forEach(col => {
                console.log(`   - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
            });
        }
        
        // Đóng database
        db.close((err) => {
            if (err) {
                console.error('❌ Lỗi đóng database:', err.message);
            } else {
                console.log('✅ Đã đóng database');
                console.log('🎉 Khởi tạo database hoàn tất!');
                console.log('');
                console.log('📚 Hướng dẫn sử dụng:');
                console.log('   npm start          - Chạy server');
                console.log('   npm run dev        - Chạy server với nodemon');
                console.log('   npm run init-db    - Khởi tạo lại database');
                console.log('   npm run init-db -- --sample  - Thêm dữ liệu mẫu');
                console.log('');
            }
        });
    });
});