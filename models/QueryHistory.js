const { Pool } = require('pg');

class QueryHistory {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async saveQuery(historyData) {
    console.log("QueryHistory.saveQuery invoked.");
    try {
      // Check if query_history table exists
      const tableCheck = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'query_history'
        );
      `);

      console.log("QueryHistory table exists check result:", tableCheck.rows[0].exists);

      if (!tableCheck.rows[0].exists) {
        console.error("Error: query_history table does not exist. Please run schema.sql.");
        // Temporarily re-throw to get a clearer error if the table is indeed missing
        throw new Error("query_history table does not exist");
      }

      console.log("Attempting to save query history:", historyData);

      await this.pool.query(
        `INSERT INTO query_history
         (user_id, connection_id, question, generated_sql, result, execution_time, success, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          historyData.userId,
          historyData.connectionId,
          historyData.question,
          historyData.generatedSQL,
          historyData.result ? JSON.stringify(historyData.result) : null,
          historyData.executionTime || null,
          historyData.success !== undefined ? historyData.success : true,
          historyData.errorMessage || null,
          historyData.timestamp || new Date(),
        ]
      );
    } catch (error) {
      console.error("Warning: Could not save query history:", error.message);
      // Do not re-throw, as history saving should not block main functionality
    }
  }

  async getQueryHistory(userId, limit = 10, offset = 0) {
    const result = await this.pool.query(
      `SELECT id, connection_id, question, generated_sql, result, execution_time, success, error_message, created_at
       FROM query_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  async getQueryHistoryById(queryId, userId) {
    const result = await this.pool.query(
      `SELECT id, connection_id, question, generated_sql, result, execution_time, success, error_message, created_at
       FROM query_history
       WHERE id = $1 AND user_id = $2`,
      [queryId, userId]
    );
    return result.rows[0];
  }

  async deleteQueryHistory(queryId, userId) {
    const result = await this.pool.query(
      `DELETE FROM query_history
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [queryId, userId]
    );
    return result.rows.length > 0;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new QueryHistory();
