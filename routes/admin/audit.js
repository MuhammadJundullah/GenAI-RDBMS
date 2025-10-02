const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../routes/user/auth");
const authorizeAdmin = require("../../middleware/authorizeAdmin");
const AuditLog = require("../../models/AuditLog");

// Apply authentication and admin authorization to all admin audit routes
router.use(authenticateToken);
router.use(authorizeAdmin);

// Get all audit logs
router.get("/logs", async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const logs = await AuditLog.getAllLogs(parseInt(limit), parseInt(offset));
    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get audit logs for a specific user
router.get("/logs/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const logs = await AuditLog.getLogsByUserId(parseInt(userId), parseInt(limit), parseInt(offset));
    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs by user ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
