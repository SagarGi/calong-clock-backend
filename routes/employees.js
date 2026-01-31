const express = require('express');
const { pool } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// Generate unique 6-digit PIN
const generatePin = async () => {
  let pin;
  let exists = true;
  
  while (exists) {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
    const [result] = await pool.execute(
      'SELECT id FROM employees WHERE pin = ?',
      [pin]
    );
    exists = result.length > 0;
  }
  
  return pin;
};

// Create employee (Admin only)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, employee_type, role, hourly_rate, phone, email } = req.body;

    if (!name || !employee_type) {
      return res.status(400).json({
        success: false,
        message: 'Name and employee type are required.'
      });
    }

    const pin = await generatePin();

    const [result] = await pool.execute(
      `INSERT INTO employees (name, pin, employee_type, role, hourly_rate, phone, email, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, pin, employee_type, role || 'waiter', hourly_rate || 0, phone || null, email || null, req.admin.id]
    );

    res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      data: {
        id: result.insertId,
        name,
        pin,
        employee_type,
        role: role || 'waiter',
        hourly_rate: hourly_rate || 0,
        phone,
        email
      }
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating employee.'
    });
  }
});

// Get all employees (Admin only)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const [employees] = await pool.execute(
      `SELECT id, name, pin, employee_type, role, hourly_rate, phone, email, is_active, created_at, updated_at 
       FROM employees ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching employees.'
    });
  }
});

// Get single employee (Admin only)
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const [employees] = await pool.execute(
      `SELECT id, name, pin, employee_type, role, hourly_rate, phone, email, is_active, created_at, updated_at 
       FROM employees WHERE id = ?`,
      [req.params.id]
    );

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.'
      });
    }

    res.json({
      success: true,
      data: employees[0]
    });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching employee.'
    });
  }
});

// Update employee (Admin only)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name, employee_type, role, hourly_rate, phone, email, is_active, pin } = req.body;

    // Check if employee exists
    const [existing] = await pool.execute(
      'SELECT id FROM employees WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.'
      });
    }

    // If PIN is being changed, check for uniqueness
    if (pin) {
      const [pinCheck] = await pool.execute(
        'SELECT id FROM employees WHERE pin = ? AND id != ?',
        [pin, req.params.id]
      );
      if (pinCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'PIN already in use by another employee.'
        });
      }
    }

    await pool.execute(
      `UPDATE employees SET 
        name = COALESCE(?, name),
        employee_type = COALESCE(?, employee_type),
        role = COALESCE(?, role),
        hourly_rate = COALESCE(?, hourly_rate),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        is_active = COALESCE(?, is_active),
        pin = COALESCE(?, pin)
       WHERE id = ?`,
      [name, employee_type, role, hourly_rate, phone, email, is_active, pin, req.params.id]
    );

    const [updated] = await pool.execute(
      'SELECT id, name, pin, employee_type, role, hourly_rate, phone, email, is_active FROM employees WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Employee updated successfully.',
      data: updated[0]
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating employee.'
    });
  }
});

// Delete employee (Admin only)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM employees WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.'
      });
    }

    res.json({
      success: true,
      message: 'Employee deleted successfully.'
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting employee.'
    });
  }
});

// Verify employee PIN (Public - for employee dashboard)
router.post('/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'PIN is required.'
      });
    }

    const [employees] = await pool.execute(
      `SELECT id, name, pin, employee_type, role, hourly_rate, phone, email, is_active 
       FROM employees WHERE pin = ? AND is_active = TRUE`,
      [pin]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN or inactive employee.'
      });
    }

    res.json({
      success: true,
      data: employees[0]
    });
  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying PIN.'
    });
  }
});

module.exports = router;
