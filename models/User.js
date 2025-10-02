const { Pool } = require('pg');

class User {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async findByEmail(email) {
    const result = await this.pool.query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await this.pool.query(
      'SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async create(email, passwordHash, name, role = 'user') {
    const result = await this.pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email, passwordHash, name, role]
    );
    return result.rows[0];
  }

  async update(id, updates) {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const key in updates) {
      if (updates.hasOwnProperty(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return null; // No fields to update
    }

    values.push(id); // Add id for WHERE clause

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, email, name, role, created_at, updated_at
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async updatePassword(id, newPasswordHash) {
    const result = await this.pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [newPasswordHash, id]
    );
    return result.rows[0];
  }

  async getAllUsers() {
    const result = await this.pool.query(
      'SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async deleteUser(id) {
    const result = await this.pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id'
      , [id]
    );
    return result.rows.length > 0;
  }

  // Close the pool when the application shuts down
  async close() {
    await this.pool.end();
  }
}

module.exports = new User();
