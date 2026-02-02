const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "calong_tick",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Initialize database tables
const initDatabase = async () => {
  try {
    const connection = await pool.getConnection();

    // Create admins table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create employees table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        pin VARCHAR(6) UNIQUE NOT NULL,
        employee_type ENUM('part_time', 'full_time') NOT NULL,
        role ENUM('head_chef', 'sous_chef', 'junior_chef', 'kitchen_helper', 'dishwasher', 'restaurant_manager', 'floor_manager', 'head_waiter', 'waiter', 'bartender', 'host', 'busser', 'cashier') DEFAULT 'waiter',
        hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
        phone VARCHAR(20),
        email VARCHAR(100),
        created_by INT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
      )
    `);

    // Create time_entries table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        clock_in DATETIME NOT NULL,
        clock_out DATETIME,
        break_minutes INT DEFAULT 0,
        hours_worked DECIMAL(5, 2),
        minutes_worked INT,
        total_minutes INT,
        notes TEXT,
        entry_date DATE NOT NULL,
        entry_week INT,
        entry_month INT,
        entry_year INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    connection.release();
    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
};

module.exports = { pool, initDatabase };
