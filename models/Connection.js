const { Pool } = require('pg');
const Cryptr = require('cryptr');

const cryptr = new Cryptr(process.env.ENCRYPTION_KEY || "default-secret-key-123");

class Connection {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async getUserConnections(userId) {
    const result = await this.pool.query(
      `SELECT id, user_id, name, type, host, port, database, username,
              file_path, created_at, updated_at
       FROM database_connections
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async getConnectionById(connectionId, userId) {
    const result = await this.pool.query(
      `SELECT id, user_id, name, type, host, port, database, username,
              password_encrypted, file_path, created_at, updated_at,
              ssl_enabled, ssl_mode, ssl_reject_unauthorized, ssl_ca_cert, ssl_client_cert, ssl_client_key
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
    // Decrypt SSL certificates if exists
    if (connection.ssl_ca_cert) {
      connection.sslCaCert = cryptr.decrypt(connection.ssl_ca_cert);
    }
    if (connection.ssl_client_cert) {
      connection.sslClientCert = cryptr.decrypt(connection.ssl_client_cert);
    }
    if (connection.ssl_client_key) {
      connection.sslClientKey = cryptr.decrypt(connection.ssl_client_key);
    }

    return connection;
  }

  async saveConnection(connectionData) {
    let passwordEncrypted = null;
    if (connectionData.password) {
      passwordEncrypted = cryptr.encrypt(connectionData.password);
    }

    let sslCaCertEncrypted = null;
    let sslClientCertEncrypted = null;
    let sslClientKeyEncrypted = null;

    if (connectionData.sslCaCert) {
      sslCaCertEncrypted = cryptr.encrypt(connectionData.sslCaCert);
    }
    if (connectionData.sslClientCert) {
      sslClientCertEncrypted = cryptr.encrypt(connectionData.sslClientCert);
    }
    if (connectionData.sslClientKey) {
      sslClientKeyEncrypted = cryptr.encrypt(connectionData.sslClientKey);
    }

    const result = await this.pool.query(
      `INSERT INTO database_connections
       (user_id, name, type, host, port, database, username, password_encrypted, file_path,
        ssl_enabled, ssl_mode, ssl_reject_unauthorized, ssl_ca_cert, ssl_client_cert, ssl_client_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, user_id, name, type, host, port, database, username, file_path,
                 ssl_enabled, ssl_mode, ssl_reject_unauthorized, created_at`,
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
        connectionData.sslEnabled || false,
        connectionData.sslMode || 'prefer',
        connectionData.sslRejectUnauthorized !== undefined ? connectionData.sslRejectUnauthorized : true,
        sslCaCertEncrypted,
        sslClientCertEncrypted,
        sslClientKeyEncrypted,
      ]
    );

    return result.rows[0];
  }

  async updateConnection(connectionId, userId, updates) {
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

    if (updates.sslEnabled !== undefined) {
      updateFields.push(`ssl_enabled = $${paramCount}`);
      values.push(updates.sslEnabled);
      paramCount++;
    }
    if (updates.sslMode !== undefined) {
      updateFields.push(`ssl_mode = $${paramCount}`);
      values.push(updates.sslMode);
      paramCount++;
    }
    if (updates.sslRejectUnauthorized !== undefined) {
      updateFields.push(`ssl_reject_unauthorized = $${paramCount}`);
      values.push(updates.sslRejectUnauthorized);
      paramCount++;
    }
    if (updates.sslCaCert !== undefined) {
      const sslCaCertEncrypted = cryptr.encrypt(updates.sslCaCert);
      updateFields.push(`ssl_ca_cert = $${paramCount}`);
      values.push(sslCaCertEncrypted);
      paramCount++;
    }
    if (updates.sslClientCert !== undefined) {
      const sslClientCertEncrypted = cryptr.encrypt(updates.sslClientCert);
      updateFields.push(`ssl_client_cert = $${paramCount}`);
      values.push(sslClientCertEncrypted);
      paramCount++;
    }
    if (updates.sslClientKey !== undefined) {
      const sslClientKeyEncrypted = cryptr.encrypt(updates.sslClientKey);
      updateFields.push(`ssl_client_key = $${paramCount}`);
      values.push(sslClientKeyEncrypted);
      paramCount++;
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    values.push(connectionId, userId);

    const query = `
      UPDATE database_connections
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING id, user_id, name, type, host, port, database, username, file_path, created_at, updated_at
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("Connection not found or unauthorized");
    }

    return result.rows[0];
  }

  async deleteConnection(connectionId, userId) {
    const result = await this.pool.query(
      `DELETE FROM database_connections
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [connectionId, userId]
    );

    return result.rows.length > 0;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new Connection();
