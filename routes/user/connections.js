const express = require("express");
const router = express.Router();
const dbManager = require("../../utils/databaseManager"); // Keep dbManager for testConnection
const { body, validationResult } = require("express-validator");
const Connection = require("../../models/Connection"); // Import the Connection model

// Import authenticateToken middleware
const { authenticateToken } = require("./auth");

// Get all connections for user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const connections = await Connection.getUserConnections(userId);
    res.json(connections);
  } catch (error) {
    console.error("Get connections error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new connection
router.post(
  "/",
  authenticateToken,
  [
    body("name").notEmpty().trim(),
    body("type").isIn(["postgres", "mysql", "sqlite"]),
    body("host").if(body("type").not().equals("sqlite")).notEmpty(),
    body("port").if(body("type").not().equals("sqlite")).optional().isInt(),
    body("database").if(body("type").not().equals("sqlite")).notEmpty(),
    body("username").if(body("type").not().equals("sqlite")).notEmpty(),
    body("password").if(body("type").not().equals("sqlite")).optional(),
    body("filePath").if(body("type").equals("sqlite")).notEmpty(),
    // SSL/TLS configuration
    body("sslEnabled").optional().isBoolean(),
    body("sslMode").optional().isIn(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]),
    body("sslRejectUnauthorized").optional().isBoolean(),
    body("sslCaCert").optional().isString(),
    body("sslClientCert").optional().isString(),
    body("sslClientKey").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const connectionData = { ...req.body, userId: req.user.id };

      // Test connection first using dbManager
      const testResult = await dbManager.testConnection(connectionData);
      if (!testResult.success) {
        return res.status(400).json({
          error: "Connection test failed",
          details: testResult.error,
        });
      }

      // Save connection to database using Connection model
      const savedConnection = await Connection.saveConnection(connectionData);
      res.status(201).json(savedConnection);
    } catch (error) {
      console.error("Create connection error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Update connection
router.put(
  "/:id",
  authenticateToken,
  [
    body("name").optional().notEmpty().trim(),
    body("host").optional().notEmpty(),
    body("port").optional().isInt(),
    body("database").optional().notEmpty(),
    body("username").optional().notEmpty(),
    body("password").optional(),
    body("sslEnabled").optional().isBoolean(),
    body("sslMode").optional().isIn(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]),
    body("sslRejectUnauthorized").optional().isBoolean(),
    body("sslCaCert").optional().isString(),
    body("sslClientCert").optional().isString(),
    body("sslClientKey").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      // Verify ownership
      const existing = await Connection.getConnectionById(id, userId);
      if (!existing) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Test new connection if credentials changed
      if (updates.host || updates.port || updates.database || updates.username || updates.password || updates.sslEnabled || updates.sslMode || updates.sslRejectUnauthorized || updates.sslCaCert || updates.sslClientCert || updates.sslClientKey) {
        const testConfig = {
          ...existing,
          ...updates,
          type: existing.type,
          userId: userId
        };
        
        const testResult = await dbManager.testConnection(testConfig);
        if (!testResult.success) {
          return res.status(400).json({
            error: "Connection test failed",
            details: testResult.error,
          });
        }
      }

      const updatedConnection = await Connection.updateConnection(id, userId, updates);
      res.json(updatedConnection);
    } catch (error) {
      console.error("Update connection error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete connection
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleted = await Connection.deleteConnection(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Connection not found" });
    }

    res.json({ message: "Connection deleted successfully" });
  } catch (error) {
    console.error("Delete connection error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test connection
router.post("/test", authenticateToken, async (req, res) => {
  try {
    const testResult = await dbManager.testConnection(req.body);
    res.json(testResult);
  } catch (error) {
    console.error("Test connection error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get single connection
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const connection = await Connection.getConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    // Remove sensitive data
    delete connection.password;
    delete connection.password_encrypted;
    delete connection.sslCaCert;
    delete connection.sslClientCert;
    delete connection.sslClientKey;

    res.json(connection);
  } catch (error) {
    console.error("Get connection error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
