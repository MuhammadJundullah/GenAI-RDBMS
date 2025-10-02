const express = require("express");
const router = express.Router();
const dbManager = require("../utils/databaseManager");

// ✅ PERBAIKAN: Import authenticateToken dengan benar
const { authenticateToken } = require("./auth");

// Get database schema for a connection
router.get("/:connectionId", authenticateToken, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;

    // Get connection from database (dengan security check)
    const connection = await getConnectionById(connectionId, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    // Get schema information
    const schemaInfo = await dbManager.getSchema(connection);

    res.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        type: connection.type,
      },
      schema: schemaInfo,
    });
  } catch (error) {
    console.error("Schema fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch schema",
      details: error.message,
    });
  }
});

// Get sample data from a table
router.get(
  "/:connectionId/tables/:tableName/sample",
  authenticateToken,
  async (req, res) => {
    try {
      const { connectionId, tableName } = req.params;
      const userId = req.user.id;

      // Validate table name (security)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        return res.status(400).json({ error: "Invalid table name" });
      }

      const connection = await getConnectionById(connectionId, userId);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Get sample data (limit to 10 rows for performance)
      const sampleQuery = `SELECT * FROM ${tableName} LIMIT 10`;
      const result = await dbManager.executeQuery(connection, sampleQuery);

      if (!result.success) {
        return res.status(400).json({
          error: "Failed to fetch sample data",
          details: result.error,
        });
      }

      res.json({
        success: true,
        table: tableName,
        sampleData: result.data,
        totalRows: result.rowCount,
      });
    } catch (error) {
      console.error("Sample data fetch error:", error);
      res.status(500).json({
        error: "Failed to fetch sample data",
        details: error.message,
      });
    }
  }
);

// Helper function to get connection dengan security check
async function getConnectionById(connectionId, userId) {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(
      `SELECT id, user_id, name, type, host, port, database, username, 
              password_encrypted, file_path 
       FROM database_connections 
       WHERE id = $1 AND user_id = $2`,
      [connectionId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const connection = result.rows[0];

    // Decrypt password jika ada
    if (connection.password_encrypted) {
      // ✅ PERBAIKAN: Tambahkan encryption/decryption
      const Cryptr = require("cryptr");
      const cryptr = new Cryptr(
        process.env.ENCRYPTION_KEY || "default-secret-key-123"
      );
      connection.password = cryptr.decrypt(connection.password_encrypted);
    }

    return connection;
  } catch (error) {
    console.error("Error getting connection:", error);
    return null;
  } finally {
    await pool.end();
  }
}

// Get database statistics
router.get("/:connectionId/statistics", authenticateToken, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;

    const connection = await getConnectionById(connectionId, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    let statsQuery = "";
    switch (connection.type) {
      case "postgres":
        statsQuery = `
          SELECT 
            schemaname as schema_name,
            tablename as table_name,
            tableowner as table_owner
          FROM pg_tables 
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          ORDER BY schemaname, tablename;
        `;
        break;
      case "mysql":
        statsQuery = `
          SELECT 
            TABLE_SCHEMA as schema_name,
            TABLE_NAME as table_name,
            TABLE_ROWS as approximate_rows
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
          ORDER BY TABLE_SCHEMA, TABLE_NAME;
        `;
        break;
      case "sqlite":
        statsQuery = `
          SELECT 
            name as table_name,
            sql as table_definition
          FROM sqlite_master 
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name;
        `;
        break;
    }

    const result = await dbManager.executeQuery(connection, statsQuery);

    res.json({
      success: true,
      statistics: result.success ? result.data : [],
    });
  } catch (error) {
    console.error("Statistics fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      details: error.message,
    });
  }
});

module.exports = router;
