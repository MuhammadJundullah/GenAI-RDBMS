# GenAI RDBMS - API Documentation

## Table of Contents
- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [Authentication Routes](#authentication-routes)
  - [Connection Management](#connection-management)
  - [Query Routes](#query-routes)
  - [Schema Routes](#schema-routes)
- [Error Handling](#error-handling)
- [Data Models](#data-models)

---

## Overview

GenAI RDBMS adalah aplikasi backend yang memungkinkan pengguna untuk mengelola koneksi database, mengeksekusi query menggunakan natural language dengan bantuan AI (Google Gemini), dan mendapatkan informasi schema database.

**Tech Stack:**
- Node.js + Express.js
- PostgreSQL (Main Database)
- Support: PostgreSQL, MySQL, SQLite (Target Databases)
- Google Gemini AI untuk NL to SQL
- JWT Authentication
- Bcrypt untuk Password Hashing

---

## Base URL

```
http://localhost:3000
```

Production URL akan disesuaikan dengan deployment server.

---

## Authentication

Aplikasi menggunakan **JWT (JSON Web Token)** untuk autentikasi.

### How to Use
Setelah login atau register, Anda akan menerima token. Gunakan token tersebut di header request:

```
Authorization: Bearer <your_jwt_token>
```

### Token Format
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "User Name",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Token Expiration:** 7 hari

---

## API Endpoints

### Health Check

#### GET `/health`
Mengecek status server.

**Authentication:** None

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "GenAI RDBMS Backend"
}
```

---

## Authentication Routes

Base path: `/api/auth`

### 1. Register User

#### POST `/api/auth/register`

Mendaftarkan user baru.

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `password`: Minimum 6 characters, required
- `name`: Not empty, required

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `409 Conflict`: User already exists
- `500 Internal Server Error`: Server error

---

### 2. Login User

#### POST `/api/auth/login`

Login user yang sudah terdaftar.

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

---

### 3. Get Current User Profile

#### GET `/api/auth/me`

Mendapatkan informasi user yang sedang login.

**Authentication:** Required (Bearer Token)

**Success Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-01-01T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Token missing or invalid
- `403 Forbidden`: Token expired
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

### 4. Update User Profile

#### PUT `/api/auth/profile`

Mengupdate profile user.

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "name": "John Smith",
  "email": "newemail@example.com"
}
```

**Validation Rules:**
- `name`: Optional, not empty if provided
- `email`: Optional, valid email if provided

**Success Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "newemail@example.com",
    "name": "John Smith",
    "created_at": "2024-01-01T10:00:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors or no fields to update
- `401 Unauthorized`: Not authenticated
- `409 Conflict`: Email already exists
- `500 Internal Server Error`: Server error

---

### 5. Change Password

#### PUT `/api/auth/change-password`

Mengubah password user.

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

**Validation Rules:**
- `currentPassword`: Required
- `newPassword`: Minimum 6 characters, required

**Success Response (200):**
```json
{
  "message": "Password updated successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Current password incorrect or not authenticated
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

## Connection Management

Base path: `/api/connections`

### 1. Get All Connections

#### GET `/api/connections`

Mendapatkan semua database connections milik user.

**Authentication:** Required (Bearer Token)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "name": "Production PostgreSQL",
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
    "username": "postgres",
    "file_path": null,
    "created_at": "2024-01-01T10:00:00.000Z",
    "updated_at": "2024-01-01T10:00:00.000Z"
  },
  {
    "id": 2,
    "user_id": 1,
    "name": "Local SQLite",
    "type": "sqlite",
    "host": null,
    "port": null,
    "database": null,
    "username": null,
    "file_path": "/path/to/database.db",
    "created_at": "2024-01-02T10:00:00.000Z",
    "updated_at": "2024-01-02T10:00:00.000Z"
  }
]
```

**Note:** Password tidak pernah di-return dalam response untuk keamanan.

---

### 2. Get Single Connection

#### GET `/api/connections/:id`

Mendapatkan detail satu connection.

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `id`: Connection ID (integer)

**Success Response (200):**
```json
{
  "id": 1,
  "user_id": 1,
  "name": "Production PostgreSQL",
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "username": "postgres",
  "file_path": null,
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-01T10:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Connection not found or unauthorized
- `500 Internal Server Error`: Server error

---

### 3. Create New Connection

#### POST `/api/connections`

Membuat database connection baru.

**Authentication:** Required (Bearer Token)

**Request Body (PostgreSQL/MySQL):**
```json
{
  "name": "Production DB",
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "username": "postgres",
  "password": "secret123"
}
```

**Request Body (SQLite):**
```json
{
  "name": "Local SQLite",
  "type": "sqlite",
  "filePath": "/path/to/database.db"
}
```

**Validation Rules:**
- `name`: Required, not empty
- `type`: Required, must be one of: `postgres`, `mysql`, `sqlite`
- `host`: Required for postgres/mysql
- `port`: Optional integer for postgres/mysql
- `database`: Required for postgres/mysql
- `username`: Required for postgres/mysql
- `password`: Optional for postgres/mysql
- `filePath`: Required for sqlite

**Success Response (201):**
```json
{
  "id": 1,
  "user_id": 1,
  "name": "Production DB",
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "username": "postgres",
  "file_path": null,
  "created_at": "2024-01-01T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors or connection test failed
- `401 Unauthorized`: Not authenticated
- `500 Internal Server Error`: Server error

**Note:** Connection akan di-test terlebih dahulu sebelum disimpan.

---

### 4. Test Connection

#### POST `/api/connections/test`

Test database connection tanpa menyimpan.

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "username": "postgres",
  "password": "secret123"
}
```

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Response (200):**
```json
{
  "success": false,
  "error": "Connection error message"
}
```

---

### 5. Update Connection

#### PUT `/api/connections/:id`

Mengupdate connection yang sudah ada.

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `id`: Connection ID (integer)

**Request Body:**
```json
{
  "name": "Updated Name",
  "host": "newhost.com",
  "port": 5433,
  "database": "newdb",
  "username": "newuser",
  "password": "newsecret"
}
```

**Validation Rules:** Sama seperti create, semua field optional

**Success Response (200):**
```json
{
  "id": 1,
  "user_id": 1,
  "name": "Updated Name",
  "type": "postgres",
  "host": "newhost.com",
  "port": 5433,
  "database": "newdb",
  "username": "newuser",
  "file_path": null,
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors or connection test failed
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Connection not found
- `500 Internal Server Error`: Server error

---

### 6. Delete Connection

#### DELETE `/api/connections/:id`

Menghapus connection.

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `id`: Connection ID (integer)

**Success Response (200):**
```json
{
  "message": "Connection deleted successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Connection not found
- `500 Internal Server Error`: Server error

---

## Query Routes

Base path: `/api/query`

### 1. Generate and Execute SQL Query

#### POST `/api/query`

Generate SQL dari natural language menggunakan AI dan eksekusi query.

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "connectionId": 1,
  "question": "Show me all users who registered in the last 30 days",
  "autoExecute": true
}
```

**Parameters:**
- `connectionId`: Required, integer
- `question`: Required, natural language query
- `autoExecute`: Optional boolean (default: true)

**Success Response (200):**
```json
{
  "success": true,
  "question": "Show me all users who registered in the last 30 days",
  "generatedSQL": "SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '30 days' ORDER BY created_at DESC",
  "explanation": "This query retrieves all user records from the users table where the created_at timestamp is within the last 30 days. The results are ordered by creation date in descending order.",
  "result": {
    "success": true,
    "data": [
      {
        "id": 1,
        "email": "user@example.com",
        "name": "John Doe",
        "created_at": "2024-01-10T10:00:00.000Z"
      }
    ],
    "columns": ["id", "email", "name", "created_at"],
    "rowCount": 1
  },
  "autoExecuted": true
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors or query execution failed
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Connection not found
- `500 Internal Server Error`: Server error or AI service error

---

### 2. Generate SQL Only (Without Execution)

#### POST `/api/query/sql-only`

Generate SQL tanpa mengeksekusi query.

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "connectionId": 1,
  "question": "Show me all users"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "question": "Show me all users",
  "generatedSQL": "SELECT * FROM users",
  "autoExecuted": false
}
```

---

## Schema Routes

Base path: `/api/schema`

### 1. Get Database Schema

#### GET `/api/schema/:connectionId`

Mendapatkan informasi schema database.

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `connectionId`: Connection ID (integer)

**Success Response (200):**
```json
{
  "success": true,
  "connection": {
    "id": 1,
    "name": "Production DB",
    "type": "postgres"
  },
  "schema": {
    "database_type": "postgres",
    "tables": {
      "users": {
        "columns": [
          {
            "name": "id",
            "type": "integer",
            "nullable": false,
            "primary_key": true
          },
          {
            "name": "email",
            "type": "varchar",
            "nullable": false
          }
        ],
        "indexes": ["users_pkey", "users_email_idx"],
        "foreign_keys": []
      }
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Connection not found
- `500 Internal Server Error`: Server error

---

### 2. Get Sample Data from Table

#### GET `/api/schema/:connectionId/tables/:tableName/sample`

Mendapatkan sample data dari tabel (10 rows pertama).

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `connectionId`: Connection ID (integer)
- `tableName`: Table name (string, alphanumeric + underscore only)

**Success Response (200):**
```json
{
  "success": true,
  "table": "users",
  "sampleData": [
    {
      "id": 1,
      "email": "user1@example.com",
      "name": "John Doe",
      "created_at": "2024-01-01T10:00:00.000Z"
    },
    {
      "id": 2,
      "email": "user2@example.com",
      "name": "Jane Smith",
      "created_at": "2024-01-02T10:00:00.000Z"
    }
  ],
  "totalRows": 2
}
```

**Error Responses:**
- `400 Bad Request`: Invalid table name
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Connection not found
- `500 Internal Server Error`: Server error

---

### 3. Get Database Statistics

#### GET `/api/schema/:connectionId/statistics`

Mendapatkan statistik database (list tables, row counts, dll).

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `connectionId`: Connection ID (integer)

**Success Response (200) - PostgreSQL:**
```json
{
  "success": true,
  "statistics": [
    {
      "schema_name": "public",
      "table_name": "users",
      "table_owner": "postgres"
    },
    {
      "schema_name": "public",
      "table_name": "database_connections",
      "table_owner": "postgres"
    }
  ]
}
```

**Success Response (200) - MySQL:**
```json
{
  "success": true,
  "statistics": [
    {
      "schema_name": "mydb",
      "table_name": "users",
      "approximate_rows": 150
    }
  ]
}
```

**Success Response (200) - SQLite:**
```json
{
  "success": true,
  "statistics": [
    {
      "table_name": "users",
      "table_definition": "CREATE TABLE users (id INTEGER PRIMARY KEY...)"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Connection not found
- `500 Internal Server Error`: Server error

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Validation error or bad input |
| 401 | Unauthorized | Authentication required or token invalid |
| 403 | Forbidden | Token expired or insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 500 | Internal Server Error | Server error |

### Validation Error Format

```json
{
  "errors": [
    {
      "msg": "Invalid email format",
      "param": "email",
      "location": "body"
    },
    {
      "msg": "Password must be at least 6 characters",
      "param": "password",
      "location": "body"
    }
  ]
}
```

---

## Data Models

### User Model

```typescript
{
  id: number;
  email: string;
  password_hash: string;  // Never returned in API responses
  name: string;
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Database Connection Model

```typescript
{
  id: number;
  user_id: number;
  name: string;
  type: 'postgres' | 'mysql' | 'sqlite';
  host: string | null;
  port: number | null;
  database: string | null;
  username: string | null;
  password_encrypted: string | null;  // Never returned in API responses
  file_path: string | null;
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Query Result Model

```typescript
{
  success: boolean;
  data: Array<Record<string, any>>;
  columns: string[];
  rowCount: number;
  error?: string;  // Only present if success is false
}
```

---

## Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database (Main Application Database)
DATABASE_URL=postgresql://user:password@localhost:5432/genai_rdbms

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ENCRYPTION_KEY=your-encryption-key-for-passwords
BCRYPT_ROUNDS=12

# AI Service
GEMINI_API_KEY=your-google-gemini-api-key
```

---

## Security Notes

1. **Password Storage:**
   - User passwords: Hashed menggunakan bcrypt (12 rounds)
   - Database connection passwords: Encrypted menggunakan Cryptr

2. **JWT Tokens:**
   - Expire dalam 7 hari
   - Signed dengan HS256 algorithm
   - Harus disimpan dengan aman di client side

3. **SQL Injection Protection:**
   - Semua query menggunakan parameterized queries
   - Table names divalidasi dengan regex
   - User input di-sanitize

4. **Rate Limiting:**
   - Implementasi rate limiting direkomendasikan untuk production
   - Terutama untuk endpoint `/api/auth/login` dan `/api/query`

---

## Testing Endpoints

### Using cURL

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Get Profile (with token):**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Create Connection:**
```bash
curl -X POST http://localhost:3000/api/connections \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test DB",
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "testdb",
    "username": "postgres",
    "password": "postgres"
  }'
```

**Natural Language Query:**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": 1,
    "question": "Show me all users",
    "autoExecute": true
  }'
```

---

## Support

Untuk pertanyaan atau issue, silakan hubungi developer atau buat issue di repository.

**Version:** 1.0.0  
**Last Updated:** 2024-01-15