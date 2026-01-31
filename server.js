const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { initDatabase } = require("./config/database");
const adminRoutes = require("./routes/admin");
const employeeRoutes = require("./routes/employees");
const timeEntryRoutes = require("./routes/timeEntries");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/time-entries", timeEntryRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Calong-Tick API is running",
    timestamp: new Date().toISOString(),
  });
});

// Serve static files from Vue build
app.use(express.static(path.join(__dirname, "public")));

// Handle Vue Router - send all non-API routes to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start server
const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Calong-Tick API ServerServer running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
