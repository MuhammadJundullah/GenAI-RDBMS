-- Database Schema for GenAI RDBMS
-- Updated to include roles, audit trails, and SSL fields for database connections

-- Users table with roles
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')), -- Added role
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Database connections table
CREATE TABLE IF NOT EXISTS database_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('postgres', 'mysql', 'sqlite')),
    host VARCHAR(255),
    port INTEGER,
    database VARCHAR(255),
    username VARCHAR(255),
    password_encrypted TEXT,
    file_path TEXT,
    ssl_enabled BOOLEAN DEFAULT FALSE, -- New: SSL enabled flag
    ssl_mode VARCHAR(50) DEFAULT 'prefer', -- New: SSL mode (e.g., disable, require, verify-ca)
    ssl_reject_unauthorized BOOLEAN DEFAULT TRUE, -- New: Reject unauthorized SSL certs
    ssl_ca_cert TEXT, -- New: CA certificate for SSL
    ssl_client_cert TEXT, -- New: Client certificate for SSL
    ssl_client_key TEXT, -- New: Client key for SSL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT connection_unique UNIQUE (user_id, name)
);

-- Query history table
CREATE TABLE IF NOT EXISTS query_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id INTEGER NOT NULL REFERENCES database_connections(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    generated_sql TEXT NOT NULL,
    result JSONB,
    execution_time REAL, -- in milliseconds
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail/logging table for admin monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Keep log even if user is deleted
    action VARCHAR(255) NOT NULL, -- e.g., 'login', 'delete_user', 'run_query'
    target_type VARCHAR(100), -- e.g., 'user', 'connection', 'query'
    target_id INTEGER,
    details JSONB, -- For extra information, like the query text or changed fields
    ip_address VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role); -- Index on role
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON database_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_query_history_user_id ON query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_query_history_connection_id ON query_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON query_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);


-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON database_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();