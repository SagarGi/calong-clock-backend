const express = require("express");
const { pool } = require("../config/database");
const { authenticateAdmin } = require("../middleware/auth");

const router = express.Router();

// Helper function to calculate hours and minutes
const calculateTime = (clockIn, clockOut, breakMinutes = 0) => {
  const diff = new Date(clockOut) - new Date(clockIn);
  const totalMinutesBeforeBreak = Math.floor(diff / (1000 * 60));
  const totalMinutes = Math.max(0, totalMinutesBeforeBreak - breakMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    hours,
    minutes,
    totalMinutes,
    hoursDecimal: (totalMinutes / 60).toFixed(2),
  };
};

// Helper function to get week number
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};

// Clock In (Employee)
router.post("/clock-in", async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "PIN is required.",
      });
    }

    // Verify employee
    const [employees] = await pool.execute(
      "SELECT id, name FROM employees WHERE pin = ? AND is_active = TRUE",
      [pin]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN or inactive employee.",
      });
    }

    const employee = employees[0];

    // Check if already clocked in
    const [activeEntry] = await pool.execute(
      "SELECT id FROM time_entries WHERE employee_id = ? AND clock_out IS NULL",
      [employee.id]
    );

    if (activeEntry.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Already clocked in. Please clock out first.",
      });
    }

    const now = new Date();
    const entryDate = now.toISOString().split("T")[0];
    const entryWeek = getWeekNumber(now);
    const entryMonth = now.getMonth() + 1;
    const entryYear = now.getFullYear();

    const [result] = await pool.execute(
      `INSERT INTO time_entries (employee_id, clock_in, entry_date, entry_week, entry_month, entry_year) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee.id, now, entryDate, entryWeek, entryMonth, entryYear]
    );

    res.status(201).json({
      success: true,
      message: `${employee.name} clocked in successfully.`,
      data: {
        entry_id: result.insertId,
        employee_name: employee.name,
        clock_in: now,
      },
    });
  } catch (error) {
    console.error("Clock in error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during clock in.",
    });
  }
});

// Clock Out (Employee)
router.post("/clock-out", async (req, res) => {
  try {
    const { pin, notes } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "PIN is required.",
      });
    }

    // Verify employee
    const [employees] = await pool.execute(
      "SELECT id, name FROM employees WHERE pin = ? AND is_active = TRUE",
      [pin]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN or inactive employee.",
      });
    }

    const employee = employees[0];

    // Find active time entry
    const [activeEntry] = await pool.execute(
      "SELECT id, clock_in FROM time_entries WHERE employee_id = ? AND clock_out IS NULL",
      [employee.id]
    );

    if (activeEntry.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active clock in found. Please clock in first.",
      });
    }

    const entry = activeEntry[0];
    const now = new Date();
    const { hours, minutes, totalMinutes, hoursDecimal } = calculateTime(
      entry.clock_in,
      now
    );

    await pool.execute(
      `UPDATE time_entries SET 
        clock_out = ?, 
        hours_worked = ?, 
        minutes_worked = ?,
        total_minutes = ?,
        notes = ?
       WHERE id = ?`,
      [now, hoursDecimal, minutes, totalMinutes, notes || null, entry.id]
    );

    res.json({
      success: true,
      message: `${employee.name} clocked out successfully.`,
      data: {
        entry_id: entry.id,
        employee_name: employee.name,
        clock_in: entry.clock_in,
        clock_out: now,
        hours_worked: hours,
        minutes_worked: minutes,
        total_time: `${hours}h ${minutes}m`,
      },
    });
  } catch (error) {
    console.error("Clock out error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during clock out.",
    });
  }
});

// Get employee's current status (Employee)
router.post("/status", async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "PIN is required.",
      });
    }

    // Verify employee
    const [employees] = await pool.execute(
      "SELECT id, name FROM employees WHERE pin = ? AND is_active = TRUE",
      [pin]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN or inactive employee.",
      });
    }

    const employee = employees[0];

    // Check for active entry
    const [activeEntry] = await pool.execute(
      "SELECT id, clock_in FROM time_entries WHERE employee_id = ? AND clock_out IS NULL",
      [employee.id]
    );

    res.json({
      success: true,
      data: {
        employee_name: employee.name,
        is_clocked_in: activeEntry.length > 0,
        current_entry: activeEntry.length > 0 ? activeEntry[0] : null,
      },
    });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error checking status.",
    });
  }
});

// Get employee time entries (Employee view by PIN)
router.post("/my-entries", async (req, res) => {
  try {
    const { pin, start_date, end_date, period } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "PIN is required.",
      });
    }

    // Verify employee
    const [employees] = await pool.execute(
      "SELECT id, name FROM employees WHERE pin = ? AND is_active = TRUE",
      [pin]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN or inactive employee.",
      });
    }

    const employee = employees[0];
    let query = `
      SELECT id, clock_in, clock_out, hours_worked, minutes_worked, total_minutes, 
             notes, entry_date, entry_week, entry_month, entry_year 
      FROM time_entries 
      WHERE employee_id = ?
    `;
    const params = [employee.id];

    // Apply date filters
    if (start_date && end_date) {
      query += " AND entry_date BETWEEN ? AND ?";
      params.push(start_date, end_date);
    } else if (period === "week") {
      query += " AND entry_week = ? AND entry_year = ?";
      params.push(getWeekNumber(new Date()), new Date().getFullYear());
    } else if (period === "month") {
      query += " AND entry_month = ? AND entry_year = ?";
      params.push(new Date().getMonth() + 1, new Date().getFullYear());
    }

    query += " ORDER BY clock_in DESC";

    const [entries] = await pool.execute(query, params);

    // Calculate totals
    const totalMinutes = entries.reduce(
      (sum, e) => sum + (e.total_minutes || 0),
      0
    );
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    res.json({
      success: true,
      data: {
        employee_name: employee.name,
        entries,
        summary: {
          total_entries: entries.length,
          total_hours: totalHours,
          total_minutes: remainingMinutes,
          total_time: `${totalHours}h ${remainingMinutes}m`,
        },
      },
    });
  } catch (error) {
    console.error("Get entries error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching entries.",
    });
  }
});

// Get all time entries (Admin only)
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const { employee_id, start_date, end_date, week, month, year } = req.query;

    let query = `
      SELECT te.*, e.name as employee_name, e.pin as employee_pin, e.employee_type
      FROM time_entries te
      JOIN employees e ON te.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (employee_id) {
      query += " AND te.employee_id = ?";
      params.push(employee_id);
    }
    if (start_date && end_date) {
      query += " AND te.entry_date BETWEEN ? AND ?";
      params.push(start_date, end_date);
    }
    if (week && year) {
      query += " AND te.entry_week = ? AND te.entry_year = ?";
      params.push(week, year);
    }
    if (month && year) {
      query += " AND te.entry_month = ? AND te.entry_year = ?";
      params.push(month, year);
    }

    query += " ORDER BY te.clock_in DESC";

    const [entries] = await pool.execute(query, params);

    res.json({
      success: true,
      data: entries,
    });
  } catch (error) {
    console.error("Get all entries error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching entries.",
    });
  }
});

// Update time entry (Admin only)
router.put("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { clock_in, clock_out, notes } = req.body;

    const [existing] = await pool.execute(
      "SELECT id FROM time_entries WHERE id = ?",
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Time entry not found.",
      });
    }

    let hoursDecimal = null;
    let minutes = null;
    let totalMinutes = null;

    if (clock_in && clock_out) {
      const calc = calculateTime(clock_in, clock_out);
      hoursDecimal = calc.hoursDecimal;
      minutes = calc.minutes;
      totalMinutes = calc.totalMinutes;
    }

    const clockInDate = clock_in ? new Date(clock_in) : null;
    const entryDate = clockInDate
      ? clockInDate.toISOString().split("T")[0]
      : null;
    const entryWeek = clockInDate ? getWeekNumber(clockInDate) : null;
    const entryMonth = clockInDate ? clockInDate.getMonth() + 1 : null;
    const entryYear = clockInDate ? clockInDate.getFullYear() : null;

    await pool.execute(
      `UPDATE time_entries SET 
        clock_in = COALESCE(?, clock_in),
        clock_out = COALESCE(?, clock_out),
        hours_worked = COALESCE(?, hours_worked),
        minutes_worked = COALESCE(?, minutes_worked),
        total_minutes = COALESCE(?, total_minutes),
        notes = COALESCE(?, notes),
        entry_date = COALESCE(?, entry_date),
        entry_week = COALESCE(?, entry_week),
        entry_month = COALESCE(?, entry_month),
        entry_year = COALESCE(?, entry_year)
       WHERE id = ?`,
      [
        clock_in,
        clock_out,
        hoursDecimal,
        minutes,
        totalMinutes,
        notes,
        entryDate,
        entryWeek,
        entryMonth,
        entryYear,
        req.params.id,
      ]
    );

    const [updated] = await pool.execute(
      "SELECT * FROM time_entries WHERE id = ?",
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Time entry updated successfully.",
      data: updated[0],
    });
  } catch (error) {
    console.error("Update entry error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating entry.",
    });
  }
});

// Delete time entry (Admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const [result] = await pool.execute(
      "DELETE FROM time_entries WHERE id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Time entry not found.",
      });
    }

    res.json({
      success: true,
      message: "Time entry deleted successfully.",
    });
  } catch (error) {
    console.error("Delete entry error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting entry.",
    });
  }
});

// Get summary report (Admin only)
router.get("/reports/summary", authenticateAdmin, async (req, res) => {
  try {
    const { employee_id, period, week, month, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || new Date().getMonth() + 1;
    const currentWeek = week || getWeekNumber(new Date());

    let query = `
      SELECT 
        e.id as employee_id,
        e.name as employee_name,
        e.employee_type,
        e.hourly_rate,
        COUNT(te.id) as total_entries,
        SUM(te.total_minutes) as total_minutes,
        MIN(te.entry_date) as first_entry,
        MAX(te.entry_date) as last_entry
      FROM employees e
      LEFT JOIN time_entries te ON e.id = te.employee_id
      WHERE e.is_active = TRUE
    `;
    const params = [];

    if (employee_id) {
      query += " AND e.id = ?";
      params.push(employee_id);
    }

    if (period === "week") {
      query += " AND te.entry_week = ? AND te.entry_year = ?";
      params.push(currentWeek, currentYear);
    } else if (period === "month") {
      query += " AND te.entry_month = ? AND te.entry_year = ?";
      params.push(currentMonth, currentYear);
    } else if (period === "year") {
      query += " AND te.entry_year = ?";
      params.push(currentYear);
    }

    query += " GROUP BY e.id ORDER BY e.name";

    const [summary] = await pool.execute(query, params);

    // Calculate formatted hours and estimated pay
    const formattedSummary = summary.map((row) => {
      const totalMins = row.total_minutes || 0;
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const estimatedPay = (totalMins / 60) * (row.hourly_rate || 0);

      return {
        ...row,
        total_hours: hours,
        remaining_minutes: mins,
        total_time: `${hours}h ${mins}m`,
        estimated_pay: estimatedPay.toFixed(2),
      };
    });

    res.json({
      success: true,
      data: formattedSummary,
    });
  } catch (error) {
    console.error("Summary report error:", error);
    res.status(500).json({
      success: false,
      message: "Server error generating report.",
    });
  }
});

// Create manual time entry (Admin only)
router.post("/manual", authenticateAdmin, async (req, res) => {
  try {
    const { employee_id, clock_in, clock_out, break_minutes, notes } = req.body;

    if (!employee_id || !clock_in || !clock_out) {
      return res.status(400).json({
        success: false,
        message: "Employee ID, clock in, and clock out times are required.",
      });
    }

    // Verify employee exists
    const [employees] = await pool.execute(
      "SELECT id, name FROM employees WHERE id = ?",
      [employee_id]
    );

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const clockInDate = new Date(clock_in);
    const clockOutDate = new Date(clock_out);
    const breakMins = parseInt(break_minutes) || 0;
    const { hours, minutes, totalMinutes, hoursDecimal } = calculateTime(
      clockInDate,
      clockOutDate,
      breakMins
    );

    const entryDate = clockInDate.toISOString().split("T")[0];
    const entryWeek = getWeekNumber(clockInDate);
    const entryMonth = clockInDate.getMonth() + 1;
    const entryYear = clockInDate.getFullYear();

    const [result] = await pool.execute(
      `INSERT INTO time_entries 
        (employee_id, clock_in, clock_out, break_minutes, hours_worked, minutes_worked, total_minutes, notes, entry_date, entry_week, entry_month, entry_year) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee_id,
        clockInDate,
        clockOutDate,
        breakMins,
        hoursDecimal,
        minutes,
        totalMinutes,
        notes || null,
        entryDate,
        entryWeek,
        entryMonth,
        entryYear,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Time entry created successfully.",
      data: {
        id: result.insertId,
        employee_name: employees[0].name,
        clock_in: clockInDate,
        clock_out: clockOutDate,
        break_minutes: breakMins,
        total_time: `${hours}h ${minutes}m`,
      },
    });
  } catch (error) {
    console.error("Manual entry error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating entry.",
    });
  }
});

// Employee self-service: Create time entry
router.post("/employee-entry", async (req, res) => {
  try {
    const { pin, clock_in, clock_out, break_minutes, notes } = req.body;

    if (!pin || !clock_in || !clock_out) {
      return res.status(400).json({
        success: false,
        message: "PIN, clock in, and clock out times are required.",
      });
    }

    // Verify employee
    const [employees] = await pool.execute(
      "SELECT id, name FROM employees WHERE pin = ? AND is_active = TRUE",
      [pin]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN or inactive employee.",
      });
    }

    const employee = employees[0];
    const clockInDate = new Date(clock_in);
    const clockOutDate = new Date(clock_out);
    const breakMins = parseInt(break_minutes) || 0;
    const { hours, minutes, totalMinutes, hoursDecimal } = calculateTime(
      clockInDate,
      clockOutDate,
      breakMins
    );

    const entryDate = clockInDate.toISOString().split("T")[0];
    const entryWeek = getWeekNumber(clockInDate);
    const entryMonth = clockInDate.getMonth() + 1;
    const entryYear = clockInDate.getFullYear();

    const [result] = await pool.execute(
      `INSERT INTO time_entries 
        (employee_id, clock_in, clock_out, break_minutes, hours_worked, minutes_worked, total_minutes, notes, entry_date, entry_week, entry_month, entry_year) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee.id,
        clockInDate,
        clockOutDate,
        breakMins,
        hoursDecimal,
        minutes,
        totalMinutes,
        notes || null,
        entryDate,
        entryWeek,
        entryMonth,
        entryYear,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Time entry created successfully.",
      data: {
        id: result.insertId,
        employee_name: employee.name,
        clock_in: clockInDate,
        clock_out: clockOutDate,
        break_minutes: breakMins,
        total_time: `${hours}h ${minutes}m`,
      },
    });
  } catch (error) {
    console.error("Employee entry error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating entry.",
    });
  }
});

// Employee self-service: Update time entry
router.put("/employee-entry/:id", async (req, res) => {
  try {
    const { pin, clock_in, clock_out, break_minutes, notes } = req.body;
    const entryId = req.params.id;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "PIN is required.",
      });
    }

    // Verify employee
    const [employees] = await pool.execute(
      "SELECT id FROM employees WHERE pin = ? AND is_active = TRUE",
      [pin]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN or inactive employee.",
      });
    }

    // Verify entry belongs to this employee
    const [entries] = await pool.execute(
      "SELECT id FROM time_entries WHERE id = ? AND employee_id = ?",
      [entryId, employees[0].id]
    );

    if (entries.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Time entry not found or access denied.",
      });
    }

    let hoursDecimal = null;
    let minutes = null;
    let totalMinutes = null;
    const breakMins = parseInt(break_minutes) || 0;

    if (clock_in && clock_out) {
      const calc = calculateTime(clock_in, clock_out, breakMins);
      hoursDecimal = calc.hoursDecimal;
      minutes = calc.minutes;
      totalMinutes = calc.totalMinutes;
    }

    const clockInDate = clock_in ? new Date(clock_in) : null;
    const entryDate = clockInDate
      ? clockInDate.toISOString().split("T")[0]
      : null;
    const entryWeek = clockInDate ? getWeekNumber(clockInDate) : null;
    const entryMonth = clockInDate ? clockInDate.getMonth() + 1 : null;
    const entryYear = clockInDate ? clockInDate.getFullYear() : null;

    await pool.execute(
      `UPDATE time_entries SET 
        clock_in = COALESCE(?, clock_in),
        clock_out = COALESCE(?, clock_out),
        break_minutes = COALESCE(?, break_minutes),
        hours_worked = COALESCE(?, hours_worked),
        minutes_worked = COALESCE(?, minutes_worked),
        total_minutes = COALESCE(?, total_minutes),
        notes = COALESCE(?, notes),
        entry_date = COALESCE(?, entry_date),
        entry_week = COALESCE(?, entry_week),
        entry_month = COALESCE(?, entry_month),
        entry_year = COALESCE(?, entry_year)
       WHERE id = ?`,
      [
        clock_in,
        clock_out,
        breakMins,
        hoursDecimal,
        minutes,
        totalMinutes,
        notes,
        entryDate,
        entryWeek,
        entryMonth,
        entryYear,
        entryId,
      ]
    );

    res.json({
      success: true,
      message: "Time entry updated successfully.",
    });
  } catch (error) {
    console.error("Employee update entry error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating entry.",
    });
  }
});

// Employee self-service: Delete time entry
router.delete("/employee-entry/:id", async (req, res) => {
  try {
    const { pin } = req.body;
    const entryId = req.params.id;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "PIN is required.",
      });
    }

    // Verify employee
    const [employees] = await pool.execute(
      "SELECT id FROM employees WHERE pin = ? AND is_active = TRUE",
      [pin]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN or inactive employee.",
      });
    }

    // Delete entry only if it belongs to this employee
    const [result] = await pool.execute(
      "DELETE FROM time_entries WHERE id = ? AND employee_id = ?",
      [entryId, employees[0].id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Time entry not found or access denied.",
      });
    }

    res.json({
      success: true,
      message: "Time entry deleted successfully.",
    });
  } catch (error) {
    console.error("Employee delete entry error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting entry.",
    });
  }
});

module.exports = router;
