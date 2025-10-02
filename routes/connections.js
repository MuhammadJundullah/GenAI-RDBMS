const express = require("express");
const router = express.Router();
const dbManager = require("../utils/databaseManager");
const { body, validationResult } = require("express-validator");
const { Pool } = require("pg");
const Cryptr = require("cryptr");

// Import authenticateToken middleware
const { authenticateToken } = require("./auth");

// Initialize cryptr for password encryption
const cryptr = new Cryptr(process.env.ENCRYPTION_KEY || "default-secret-key-123");

// Get all connections for user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const connections = await getUserConnections(userId);
    res.json(connections);
  } catch (error) {
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
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const connectionData = { ...req.body, userId: req.user.id };

      // Test connection first
      const testResult = await dbManager.testConnection(connectionData);
      if (!testResult.success) {
        return res.status(400).json({
          error: "Connection test failed",
          details: testResult.error,
        });
      }

      // Save connection to database
      const savedConnection = await saveConnection(connectionData);
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
      const existing = await getConnectionById(id, userId);
      if (!existing) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Test new connection if credentials changed
      if (updates.host || updates.port || updates.database || updates.username || updates.password) {
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

      const updatedConnection = await updateConnection(id, userId, updates);
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

    const deleted = await deleteConnection(id, userId);
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
    res.status(500).json({ error: error.message });
  }
});

// Get single connection
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const connection = await getConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    // Remove sensitive data
    delete connection.password;
    delete connection.password_encrypted;

    res.json(connection);
  } catch (error) {
    console.error("Get connection error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function getUserConnections(userId) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(
      `SELECT id, user_id, name, type, host, port, database, username, 
              file_path, created_at, updated_at 
       FROM database_connections 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error("Error getting connections:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function getConnectionById(connectionId, userId) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(
      `SELECT id, user_id, name, type, host, port, database, username, 
              password_encrypted, file_path, created_at, updated_at 
       FROM database_connections 
       WHERE id = $1 AND user_id = $2`,
      [connectionId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const connection = result.rows[0];

    // Decrypt password if exists
    if (connection.password_encrypted) {
      connection.password = cryptr.decrypt(connection.password_encrypted);
    }

    return connection;
  } catch (error) {
    console.error("Error getting connection:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function saveConnection(connectionData) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    let passwordEncrypted = null;
    if (connectionData.password) {
      passwordEncrypted = cryptr.encrypt(connectionData.password);
    }

    const result = await pool.query(
      `INSERT INTO database_connections 
       (user_id, name, type, host, port, database, username, password_encrypted, file_path) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, user_id, name, type, host, port, database, username, file_path, created_at`,
      [
        connectionData.userId,
        connectionData.name,
        connectionData.type,
        connectionData.host || null,
        connectionData.port || null,
        connectionData.database || null,
        connectionData.username || null,
        passwordEncrypted,
        connectionData.filePath || null,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error saving connection:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function updateConnection(connectionId, userId, updates) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      values.push(updates.name);
      paramCount++;
    }

    if (updates.host !== undefined) {
      updateFields.push(`host = $${paramCount}`);
      values.push(updates.host);
      paramCount++;
    }

    if (updates.port !== undefined) {
      updateFields.push(`port = $${paramCount}`);
      values.push(updates.port);
      paramCount++;
    }

    if (updates.database !== undefined) {
      updateFields.push(`database = $${paramCount}`);
      values.push(updates.database);
      paramCount++;
    }

    if (updates.username !== undefined) {
      updateFields.push(`username = $${paramCount}`);
      values.push(updates.username);
      paramCount++;
    }

    if (updates.password !== undefined) {
      const passwordEncrypted = cryptr.encrypt(updates.password);
      updateFields.push(`password_encrypted = $${paramCount}`);
      values.push(passwordEncrypted);
      paramCount++;
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(connectionId, userId);

    const query = `
      UPDATE database_connections 
      SET ${updateFields.join(", ")} 
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING id, user_id, name, type, host, port, database, username, file_path, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error("Connection not found or unauthorized");
    }

    return result.rows[0];
  } catch (error) {
    console.error("Error updating connection:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function deleteConnection(connectionId, userId) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(
      `DELETE FROM database_connections 
       WHERE id = $1 AND user_id = $2 
       RETURNING id`,
      [connectionId, userId]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error("Error deleting connection:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

module.exports = router;
