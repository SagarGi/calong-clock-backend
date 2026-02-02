-- Calong-Tick Database Setup Script
-- Run this script to create the database and tables

-- Create database
CREATE DATABASE IF NOT EXISTS calong_tick;
USE calong_tick;

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create employees table
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
);

-- Create time_entries table
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
    );

-- Create indexes for better query performance
CREATE INDEX idx_employees_pin ON employees(pin);
CREATE INDEX idx_employees_active ON employees(is_active);
CREATE INDEX idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX idx_time_entries_date ON time_entries(entry_date);
CREATE INDEX idx_time_entries_week ON time_entries(entry_week, entry_year);
CREATE INDEX idx_time_entries_month ON time_entries(entry_month, entry_year);

-- Sample data (optional - uncomment to use)
-- INSERT INTO admins (username, email, password) VALUES 
-- ('admin', 'admin@calong.com', '$2a$10$your_hashed_password_here');
