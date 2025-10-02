const { Pool } = require('pg');

class AuditLog {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async createLog(userId, action, targetType, targetId, details, ipAddress) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs
         (user_id, action, target_type, target_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          action,
          targetType,
          targetId,
          details ? JSON.stringify(details) : null,
          ipAddress,
        ]
      );
    } catch (error) {
      console.error("Error creating audit log:", error.message);
      // Do not re-throw, audit logging should not block main functionality
    }
  }

  async getAllLogs(limit = 20, offset = 0) {
    const result = await this.pool.query(
      `SELECT al.id, al.user_id, u.email as user_email, al.action, al.target_type, al.target_id, al.details, al.ip_address, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  async getLogsByUserId(userId, limit = 20, offset = 0) {
    const result = await this.pool.query(
      `SELECT al.id, al.user_id, u.email as user_email, al.action, al.target_type, al.target_id, al.details, al.ip_address, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.user_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new AuditLog();
