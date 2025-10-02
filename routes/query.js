// routes/query.js
const express = require("express");
const router = express.Router();
const geminiService = require("../services/geminiService");
const dbManager = require("../utils/databaseManager");
const { body, validationResult } = require("express-validator");
const { Pool } = require("pg");
const Cryptr = require("cryptr");

// ✅ PERBAIKAN: Import authenticateToken middleware
const { authenticateToken } = require("./auth");

// Initialize cryptr for password decryption
const cryptr = new Cryptr(process.env.ENCRYPTION_KEY || "default-secret-key-123");

// ✅ PERBAIKAN: Tambahkan authenticateToken middleware
router.post(
  "/",
  authenticateToken,
  [
    body("connectionId").notEmpty(),
    body("question").notEmpty().trim(),
    body("autoExecute").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { connectionId, question, autoExecute = true } = req.body;
      const userId = req.user.id; // Sekarang req.user sudah ada

      // Get connection from database
      const connection = await getConnectionById(connectionId, userId);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Get schema information
      const schemaInfo = await dbManager.getSchema(connection);

      // Generate SQL using Gemini
      const generatedSQL = await geminiService.generateSQL(
        question,
        schemaInfo,
        connection.type
      );

      let result = null;
      let explanation = null;

      if (autoExecute) {
        // Execute the query
        result = await dbManager.executeQuery(connection, generatedSQL);

        if (!result.success) {
          return res.status(400).json({
            error: "Query execution failed",
            details: result.error,
            generatedSQL,
          });
        }

        // Generate explanation
        explanation = await geminiService.explainSQL(generatedSQL, schemaInfo);
      }

      // Save to query history
      await saveQueryHistory({
        userId,
        connectionId,
        question,
        generatedSQL,
        result: autoExecute ? result : null,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        question,
        generatedSQL,
        explanation,
        result: autoExecute ? result : null,
        autoExecuted: autoExecute,
      });
    } catch (error) {
      console.error("Query error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  }
);

// Get SQL only without execution
router.post(
  "/sql-only",
  authenticateToken, // <-- Middleware ditambahkan di sini juga
  [
    body("connectionId").notEmpty(),
    body("question").notEmpty().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { connectionId, question } = req.body;
      const userId = req.user.id;

      // Get connection from database
      const connection = await getConnectionById(connectionId, userId);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Get schema information
      const schemaInfo = await dbManager.getSchema(connection);

      // Generate SQL using Gemini
      const generatedSQL = await geminiService.generateSQL(
        question,
        schemaInfo,
        connection.type
      );

      res.json({
        success: true,
        question,
        generatedSQL,
        autoExecuted: false,
      });
    } catch (error) {
      console.error("Query error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  }
);

// ✅ Helper function: Get connection by ID dengan security check
async function getConnectionById(connectionId, userId) {
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

// ✅ Helper function: Save query history
async function saveQueryHistory(historyData) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Check if query_history table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'query_history'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log("query_history table doesn't exist yet, skipping save...");
      return;
    }

    await pool.query(
      `INSERT INTO query_history 
       (user_id, connection_id, question, generated_sql, result, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        historyData.userId,
        historyData.connectionId,
        historyData.question,
        historyData.generatedSQL,
        historyData.result ? JSON.stringify(historyData.result) : null,
        historyData.timestamp,
      ]
    );
  } catch (error) {
    // Jangan throw error, hanya log saja
    console.error("Warning: Could not save query history:", error.message);
  } finally {
    await pool.end();
  }
}

module.exports = router;
