const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const { authenticateAdmin } = require("../middleware/auth");

const router = express.Router();

// Check if admin exists (Public)
router.get("/exists", async (req, res) => {
  try {
    const [admins] = await pool.execute("SELECT id FROM admins LIMIT 1");
    res.json({
      success: true,
      exists: admins.length > 0,
    });
  } catch (error) {
    console.error("Check admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

// Admin Sign Up
router.post("/signup", async (req, res) => {
  try {
    // Check if an admin already exists
    const [existingAdmins] = await pool.execute(
      "SELECT id FROM admins LIMIT 1"
    );

    if (existingAdmins.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Admin already exists. Only one admin is allowed.",
      });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required.",
      });
    }

    // Check if admin already exists
    const [existing] = await pool.execute(
      "SELECT id FROM admins WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Admin with this username or email already exists.",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin
    const [result] = await pool.execute(
      "INSERT INTO admins (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    // Generate token
    const token = jwt.sign(
      { id: result.insertId, username, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: "Admin registered successfully.",
      data: {
        id: result.insertId,
        username,
        email,
        token,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration.",
    });
  }
});

// Admin Sign In
router.post("/signin", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    // Find admin
    const [admins] = await pool.execute(
      "SELECT * FROM admins WHERE username = ? OR email = ?",
      [username, username]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const admin = admins[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: admin.id, username: admin.username, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: "Login successful.",
      data: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        token,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login.",
    });
  }
});

// Get admin profile
router.get("/profile", authenticateAdmin, async (req, res) => {
  try {
    const [admins] = await pool.execute(
      "SELECT id, username, email, created_at FROM admins WHERE id = ?",
      [req.admin.id]
    );

    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found.",
      });
    }

    res.json({
      success: true,
      data: admins[0],
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

module.exports = router;
