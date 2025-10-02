// utils/databaseManager.js
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();

class DatabaseManager {
  constructor() {
    this.connections = new Map();
  }

  async testConnection(dbConfig) {
    try {
      switch (dbConfig.type) {
        case 'postgres':
          const pgPool = new Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.username,
            password: dbConfig.password,
            max: 1,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
          });
          const client = await pgPool.connect();
          await client.query('SELECT 1');
          client.release();
          await pgPool.end();
          return { success: true };

        case 'mysql':
          const mysqlConn = await mysql.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.username,
            password: dbConfig.password,
          });
          await mysqlConn.execute('SELECT 1');
          await mysqlConn.end();
          return { success: true };

        case 'sqlite':
          return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbConfig.filePath || dbConfig.file_path, (err) => {
              if (err) {
                reject({ success: false, error: err.message });
              } else {
                db.close();
                resolve({ success: true });
              }
            });
          });

        default:
          return { success: false, error: 'Unsupported database type' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeQuery(dbConfig, query) {
    try {
      switch (dbConfig.type) {
        case 'postgres':
          const pgPool = new Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.username,
            password: dbConfig.password,
          });
          const result = await pgPool.query(query);
          await pgPool.end();
          return {
            success: true,
            data: result.rows,
            columns: result.fields?.map(field => field.name) || [],
            rowCount: result.rowCount
          };

        case 'mysql':
          const mysqlConn = await mysql.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.username,
            password: dbConfig.password,
          });
          const [rows, fields] = await mysqlConn.execute(query);
          await mysqlConn.end();
          return {
            success: true,
            data: rows,
            columns: fields?.map(field => field.name) || [],
            rowCount: rows.length
          };

        case 'sqlite':
          return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbConfig.filePath || dbConfig.file_path);
            db.all(query, (err, rows) => {
              if (err) {
                reject({ success: false, error: err.message });
              } else {
                resolve({
                  success: true,
                  data: rows,
                  columns: rows.length > 0 ? Object.keys(rows[0]) : [],
                  rowCount: rows.length
                });
              }
              db.close();
            });
          });

        default:
          return { success: false, error: 'Unsupported database type' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getSchema(dbConfig) {
    try {
      switch (dbConfig.type) {
        case 'postgres':
          return await this.getPostgresSchema(dbConfig);
        case 'mysql':
          return await this.getMySQLSchema(dbConfig);
        case 'sqlite':
          return await this.getSQLiteSchema(dbConfig);
        default:
          return {
            database_type: dbConfig.type,
            tables: []
          };
      }
    } catch (error) {
      console.error('Schema extraction error:', error);
      // Return minimal schema jika gagal
      return {
        database_type: dbConfig.type,
        error: error.message,
        tables: []
      };
    }
  }

  async getPostgresSchema(dbConfig) {
    const pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
    });

    try {
      const query = `
        SELECT 
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          tc.constraint_type
        FROM information_schema.tables t
        LEFT JOIN information_schema.columns c 
          ON t.table_name = c.table_name
        LEFT JOIN information_schema.key_column_usage kcu
          ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name, c.ordinal_position;
      `;

      const result = await pool.query(query);
      const tables = {};

      result.rows.forEach(row => {
        if (!tables[row.table_name]) {
          tables[row.table_name] = {
            columns: []
          };
        }
        tables[row.table_name].columns.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default,
          constraint: row.constraint_type
        });
      });

      return {
        database_type: 'postgres',
        database_name: dbConfig.database,
        tables: tables
      };
    } finally {
      await pool.end();
    }
  }

  async getMySQLSchema(dbConfig) {
    const conn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
    });

    try {
      const [rows] = await conn.execute(`
        SELECT 
          TABLE_NAME,
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `, [dbConfig.database]);

      const tables = {};
      rows.forEach(row => {
        if (!tables[row.TABLE_NAME]) {
          tables[row.TABLE_NAME] = { columns: [] };
        }
        tables[row.TABLE_NAME].columns.push({
          name: row.COLUMN_NAME,
          type: row.DATA_TYPE,
          nullable: row.IS_NULLABLE === 'YES',
          default: row.COLUMN_DEFAULT,
          key: row.COLUMN_KEY
        });
      });

      return {
        database_type: 'mysql',
        database_name: dbConfig.database,
        tables: tables
      };
    } finally {
      await conn.end();
    }
  }

  async getSQLiteSchema(dbConfig) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbConfig.filePath || dbConfig.file_path);
      
      db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }

        const schema = { database_type: 'sqlite', tables: {} };
        let completed = 0;

        if (tables.length === 0) {
          db.close();
          resolve(schema);
          return;
        }

        tables.forEach(table => {
          db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
            if (!err) {
              schema.tables[table.name] = {
                columns: columns.map(col => ({
                  name: col.name,
                  type: col.type,
                  nullable: col.notnull === 0,
                  default: col.dflt_value,
                  primary_key: col.pk === 1
                }))
              };
            }

            completed++;
            if (completed === tables.length) {
              db.close();
              resolve(schema);
            }
          });
        });
      });
    });
  }
}

module.exports = new DatabaseManager();
