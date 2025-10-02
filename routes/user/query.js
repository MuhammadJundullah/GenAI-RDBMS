const express = require("express");
const router = express.Router();
const geminiService = require("../../services/geminiService");
const dbManager = require("../../utils/databaseManager");
const { body, validationResult } = require("express-validator");
const Connection = require("../../models/Connection"); // Import Connection model
const QueryHistory = require("../../models/QueryHistory"); // Import QueryHistory model
const exportService = require("../../exports/exportService"); // Import ExportService

// Import authenticateToken middleware
const { authenticateToken } = require("./auth");

router.post(
  "/",
  authenticateToken,
  [
    body("connectionId").notEmpty(),
    body("question").notEmpty().trim(),
    body("autoExecute").optional().isBoolean(),
  ],
  async (req, res) => {
    let executionStartTime;
    let querySuccess = false;
    let errorMessage = null;
    let generatedSQL = null;
    let result = null;
    let explanation = null;

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { connectionId, question, autoExecute = true } = req.body;
      const userId = req.user.id;

      // Get connection from database using Connection model
      const connection = await Connection.getConnectionById(connectionId, userId);
      if (!connection) {
        errorMessage = "Connection not found";
        return res.status(404).json({ error: errorMessage });
      }

      // Get schema information
      const schemaInfo = await dbManager.getSchema(connection);

      // Generate SQL using Gemini
      generatedSQL = await geminiService.generateSQL(
        question,
        schemaInfo,
        connection.type
      );

      if (autoExecute) {
        executionStartTime = process.hrtime.bigint();
        // Execute the query
        result = await dbManager.executeQuery(connection, generatedSQL);
        const executionEndTime = process.hrtime.bigint();
        const executionTime = Number(executionEndTime - executionStartTime) / 1_000_000; // ms

        if (!result.success) {
          errorMessage = "Query execution failed";
          return res.status(400).json({
            error: errorMessage,
            details: result.error,
            generatedSQL,
          });
        }
        querySuccess = true;

        // Generate explanation with data context
        explanation = await geminiService.explainSQL(
          generatedSQL,
          schemaInfo,
          question,
          result // Pass the query result here
        );
      }

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
      errorMessage = error.message;
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    } finally {
      // Save to query history using QueryHistory model
      await QueryHistory.saveQuery({
        userId,
        connectionId,
        question,
        generatedSQL,
        result: result ? result : null,
        executionTime: executionStartTime ? Number(process.hrtime.bigint() - executionStartTime) / 1_000_000 : null,
        success: querySuccess,
        errorMessage: errorMessage,
        timestamp: new Date(),
      });
    }
  }
);

// Get SQL only without execution
router.post(
  "/sql-only",
  authenticateToken,
  [body("connectionId").notEmpty(), body("question").notEmpty().trim()],
  async (req, res) => {
    let generatedSQL = null;
    let errorMessage = null;

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { connectionId, question } = req.body;
      const userId = req.user.id;

      // Get connection from database using Connection model
      const connection = await Connection.getConnectionById(connectionId, userId);
      if (!connection) {
        errorMessage = "Connection not found";
        return res.status(404).json({ error: errorMessage });
      }

      // Get schema information
      const schemaInfo = await dbManager.getSchema(connection);

      // Generate SQL using Gemini
      generatedSQL = await geminiService.generateSQL(
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
      errorMessage = error.message;
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    } finally {
      // Save to query history using QueryHistory model
      await QueryHistory.saveQuery({
        userId,
        connectionId,
        question,
        generatedSQL,
        success: false, // SQL only is not considered a successful execution
        errorMessage: errorMessage,
        timestamp: new Date(),
      });
    }
  }
);

router.post(
  "/analyze",
  authenticateToken,
  [body("connectionId").notEmpty(), body("question").notEmpty().trim()],
  async (req, res) => {
    let executionStartTime;
    let querySuccess = false;
    let errorMessage = null;
    let generatedSQL = null;
    let result = null;
    let userId = req.user.id;
    const { connectionId, question } = req.body; // Declare connectionId and question here

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // 1. Get Connection
      const connection = await Connection.getConnectionById(connectionId, userId);
      if (!connection) {
        errorMessage = "Connection not found";
        return res.status(404).json({ error: errorMessage });
      }

      // 2. Get Schema
      const schemaInfo = await dbManager.getSchema(connection);

      // 3. Generate SQL
      generatedSQL = await geminiService.generateSQL(
        question,
        schemaInfo,
        connection.type
      );

      // 4. Execute Query
      executionStartTime = process.hrtime.bigint();
      result = await dbManager.executeQuery(connection, generatedSQL);
      const executionEndTime = process.hrtime.bigint();
      const executionTime = Number(executionEndTime - executionStartTime) / 1_000_000; // ms

      if (!result.success) {
        errorMessage = "Query execution failed";
        return res.status(400).json({
          error: errorMessage,
          details: result.error,
          generatedSQL,
        });
      }
      querySuccess = true;

      // 5. Generate Summary and Chart in Parallel
      const [summary, chart] = await Promise.all([
        geminiService.summarizeResults(question, result),
        geminiService.generateChart(result, question),
      ]);

      // 7. Return enriched response
      res.json({
        success: true,
        question,
        generatedSQL,
        result,
        summary,
        chart,
      });
    } catch (error) {
      console.error("Analysis error:", error);
      errorMessage = error.message;
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    } finally {
      console.log("Finally block reached in /api/query/analyze. Attempting to save query history.");
      // Save to history using QueryHistory model
      await QueryHistory.saveQuery({
        userId,
        connectionId,
        question,
        generatedSQL,
        result: result ? result : null,
        executionTime: executionStartTime ? Number(process.hrtime.bigint() - executionStartTime) / 1_000_000 : null,
        success: querySuccess,
        errorMessage: errorMessage,
        timestamp: new Date(),
      });
    }
  }
);

// New route to get query history for a user
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, offset = 0 } = req.query;
    const history = await QueryHistory.getQueryHistory(userId, parseInt(limit), parseInt(offset));
    res.json(history);
  } catch (error) {
    console.error("Error fetching query history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// New route to get a single query history entry
router.get("/history/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const historyEntry = await QueryHistory.getQueryHistoryById(id, userId);
    if (!historyEntry) {
      return res.status(404).json({ error: "Query history entry not found" });
    }
    res.json(historyEntry);
  } catch (error) {
    console.error("Error fetching single query history entry:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// New route to delete a query history entry
router.delete("/history/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const deleted = await QueryHistory.deleteQueryHistory(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Query history entry not found" });
    }
    res.json({ message: "Query history entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting query history entry:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Export query results
router.get("/export/:queryId/:format", authenticateToken, async (req, res) => {
  try {
    const { queryId, format } = req.params;
    const userId = req.user.id;

    const historyEntry = await QueryHistory.getQueryHistoryById(queryId, userId);
    if (!historyEntry || !historyEntry.result || !historyEntry.result.data) {
      return res.status(404).json({ error: "Query results not found for export" });
    }

    const data = historyEntry.result.data;
    const columns = historyEntry.result.columns.map(col => ({ header: col, key: col }));
    const filename = `query_result_${queryId}`;

    switch (format.toLowerCase()) {
      case "csv":
        const csvString = await exportService.exportToCsv(data, columns);
        res.header("Content-Type", "text/csv");
        res.attachment(`${filename}.csv`);
        return res.send(csvString);

      case "xlsx":
        const excelBuffer = await exportService.exportToExcel(data, columns, `Query ${queryId}`);
        res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.attachment(`${filename}.xlsx`);
        return res.send(excelBuffer);

      case "pdf":
        const pdfBuffer = await exportService.exportToPdf(data, columns, `Query Results for ${historyEntry.question}`);
        res.header("Content-Type", "application/pdf");
        res.attachment(`${filename}.pdf`);
        return res.send(pdfBuffer);

      default:
        return res.status(400).json({ error: "Unsupported export format. Choose csv, xlsx, or pdf." });
    }
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

module.exports = router;
