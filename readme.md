# GenAI RDBMS - API Documentation

## Table of Contents
- [Overview](#overview)
- [Setup and Running the Application](#setup-and-running-the-application)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [Authentication Routes](#authentication-routes)
  - [Connection Management](#connection-management)
  - [Query Routes](#query-routes)
  - [Query History & Export](#query-history--export)
  - [Schema Routes](#schema-routes)
  - [Admin API Endpoints](#admin-api-endpoints)
    - [User Management (Admin)](#user-management-admin)
    - [Audit Logs (Admin)](#audit-logs-admin)
- [Error Handling](#error-handling)
- [Data Models](#data-models)
- [Environment Variables](#environment-variables)
- [Security Notes](#security-notes)
- [Testing Endpoints](#testing-endpoints)
- [Support](#support)

---

## Overview

GenAI RDBMS adalah aplikasi backend yang memungkinkan pengguna untuk mengelola koneksi database, mengeksekusi query menggunakan natural language dengan bantuan AI (Google Gemini), dan mendapatkan informasi schema database. Aplikasi ini mendukung dua peran pengguna: **User** dan **Admin**.

**Fitur Pengguna:**
1.  Input pertanyaan dengan bahasa alami.
2.  Mendapat hasil query dalam bentuk tabel.
3.  Melihat hasil dalam bentuk visualisasi (chart) bisa di perintahkan.
4.  Export output chat ke CSV, Excel, atau PDF.
5.  Mendapat penjelasan hasil query (summary).
6.  Melakukan CRUD menggunakan bahasa alami.
7.  Menggunakan sorting otomatis (ditangani oleh AI).
8.  Mendapat predictive query / forecasting (fitur masa depan).
9.  Mendapat autocomplete / suggestion (fitur masa depan).
10. Menyimpan & melihat history pertanyaan.

**Fitur Admin:**
1.  Kelola user & hak akses.
2.  Monitoring aktivitas user & query.
3.  Audit trail/logging query.
4.  Monitoring resource server & kinerja DB (fitur masa depan).
5.  Backup & restore database (fitur masa depan).
6.  Manajemen skema database (fitur masa depan).
7.  Role management (admin/user).

**Tech Stack:**
- Node.js + Express.js
- PostgreSQL (Main Application Database)
- Support: PostgreSQL, MySQL, SQLite (Target Databases)
- Google Gemini AI untuk NL to SQL, penjelasan, dan rekomendasi chart.
- JWT Authentication
- Bcrypt untuk Password Hashing
- Cryptr untuk enkripsi kredensial database
- `csv-stringify`, `exceljs`, `pdfkit` untuk ekspor data

---

## Setup and Running the Application

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd GenAI-RDBMS
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Buat file `.env` di root project dan isi dengan variabel lingkungan yang diperlukan (lihat bagian [Environment Variables](#environment-variables)).

4.  **Setup Database:**
    Pastikan Anda memiliki instance PostgreSQL yang berjalan. Buat database baru untuk aplikasi ini (misalnya, `genai_rdbms`).
    Jalankan skema database:
    ```bash
    psql -d your_database_name -U your_username -W -f schema.sql
    ```
    Ganti `your_database_name` dan `your_username` dengan kredensial PostgreSQL Anda.

5.  **Start the server:**
    ```bash
    npm run dev
    ```
    Server akan berjalan di `http://localhost:3000` (atau port yang Anda tentukan di `.env`).

---

## Base URL

```
http://localhost:3000
```

Production URL akan disesuaikan dengan deployment server.

---

## Authentication

Aplikasi menggunakan **JWT (JSON Web Token)** untuk autentikasi dan otorisasi berbasis peran.

### How to Use
Setelah login atau register, Anda akan menerima token. Gunakan token tersebut di header request:

```
Authorization: Bearer <your_jwt_token>
```

### Token Payload
Payload JWT sekarang mencakup peran pengguna:
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "User Name",
  "role": "user" | "admin", // New: User's role
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

### Authentication Routes

Base path: `/api/auth`

#### 1. Register User

##### POST `/api/auth/register`

Mendaftarkan user baru. Default role adalah `user`.

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
    "name": "John Doe",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `409 Conflict`: User already exists
- `500 Internal Server Error`: Server error

---

#### 2. Login User

##### POST `/api/auth/login`

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
    "name": "John Doe",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

---

#### 3. Get Current User Profile

##### GET `/api/auth/me`

Mendapatkan informasi user yang sedang login.

**Authentication:** Required (Bearer Token)

**Success Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "created_at": "2024-01-01T10:00:00.000Z",
    "updated_at": "2024-01-01T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Token missing or invalid
- `403 Forbidden`: Token expired
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

#### 4. Update User Profile

##### PUT `/api/auth/profile`

Mengupdate profile user yang sedang login.

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
    "role": "user",
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

#### 5. Change Password

##### PUT `/api/auth/change-password`

Mengubah password user yang sedang login.

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

### Connection Management

Base path: `/api/connections`

#### 1. Get All Connections

##### GET `/api/connections`

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

**Note:** Password dan kredensial SSL tidak pernah di-return dalam response untuk keamanan.

---

#### 2. Get Single Connection

##### GET `/api/connections/:id`

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

#### 3. Create New Connection

##### POST `/api/connections`

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
  "password": "secret123",
  "sslEnabled": false,
  "sslMode": "prefer",
  "sslRejectUnauthorized": true,
  "sslCaCert": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "sslClientCert": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "sslClientKey": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
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
- `sslEnabled`: Optional boolean, default `false`
- `sslMode`: Optional string, default `prefer`
- `sslRejectUnauthorized`: Optional boolean, default `true`
- `sslCaCert`, `sslClientCert`, `sslClientKey`: Optional string (PEM format)

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
  "ssl_enabled": false,
  "ssl_mode": "prefer",
  "ssl_reject_unauthorized": true,
  "created_at": "2024-01-01T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors or connection test failed
- `401 Unauthorized`: Not authenticated
- `500 Internal Server Error`: Server error

**Note:** Connection akan di-test terlebih dahulu sebelum disimpan.

---

#### 4. Test Connection

##### POST `/api/connections/test`

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

#### 5. Update Connection

##### PUT `/api/connections/:id`

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
  "password": "newsecret",
  "sslEnabled": true
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
  "ssl_enabled": true,
  "ssl_mode": "prefer",
  "ssl_reject_unauthorized": true,
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

#### 6. Delete Connection

##### DELETE `/api/connections/:id`

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

### Query Routes

Base path: `/api/query`

#### 1. Generate and Execute SQL Query

##### POST `/api/query`

Generate SQL dari natural language menggunakan AI dan eksekusi query. Dapat menghasilkan `SELECT`, `INSERT`, `UPDATE`, atau `DELETE`.

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
- `autoExecute`: Optional boolean (default: `true`). Jika `false`, hanya akan mengembalikan `generatedSQL`.

**Success Response (200):**
```json
{
  "success": true,
  "question": "Show me all users who registered in the last 30 days",
  "generatedSQL": "SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '30 days' ORDER BY created_at DESC;",
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

#### 2. Generate SQL Only (Without Execution)

##### POST `/api/query/sql-only`

Generate SQL dari natural language tanpa mengeksekusi query.

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
  "generatedSQL": "SELECT * FROM users;",
  "autoExecuted": false
}
```

---

#### 3. Analyze Query (with Summary and Chart Suggestion)

##### POST `/api/query/analyze`

Generate SQL, eksekusi, dan dapatkan ringkasan serta saran konfigurasi chart dari hasil query.

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "connectionId": 1,
  "question": "Total sales by product category"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "question": "Total sales by product category",
  "generatedSQL": "SELECT category, SUM(sales) AS total_sales FROM products GROUP BY category;",
  "result": { /* ... query result data ... */ },
  "summary": "The total sales for Electronics is $1500, for Clothing is $1200, and for Books is $800.",
  "chart": {
    "type": "bar",
    "title": "Total Sales by Product Category",
    "mapping": {
      "x": "category",
      "y": "total_sales"
    }
  }
}
```

---

### Query History & Export

Base path: `/api/query`

#### 1. Get Query History

##### GET `/api/query/history`

Mendapatkan riwayat query pengguna yang sedang login.

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `limit`: Optional, integer (default: 10)
- `offset`: Optional, integer (default: 0)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "connection_id": 1,
    "question": "Show me all users",
    "generated_sql": "SELECT * FROM users;",
    "result": { /* ... query result data ... */ },
    "execution_time": 123.45,
    "success": true,
    "error_message": null,
    "created_at": "2024-01-15T10:00:00.000Z"
  }
]
```

---

#### 2. Get Single Query History Entry

##### GET `/api/query/history/:id`

Mendapatkan detail entri riwayat query tertentu.

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `id`: Query History ID (integer)

**Success Response (200):**
```json
{
  "id": 1,
  "connection_id": 1,
  "question": "Show me all users",
  "generated_sql": "SELECT * FROM users;",
  "result": { /* ... query result data ... */ },
  "execution_time": 123.45,
  "success": true,
  "error_message": null,
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Entry not found or unauthorized

---

#### 3. Delete Query History Entry

##### DELETE `/api/query/history/:id`

Menghapus entri riwayat query tertentu.

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `id`: Query History ID (integer)

**Success Response (200):**
```json
{
  "message": "Query history entry deleted successfully"
}
```

**Error Responses:**
- `404 Not Found`: Entry not found or unauthorized

---

#### 4. Export Query Results

##### GET `/api/query/export/:queryId/:format`

Mengekspor hasil query dari riwayat dalam format CSV, XLSX, atau PDF.

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `queryId`: Query History ID (integer)
- `format`: `csv`, `xlsx`, atau `pdf`

**Success Response (200):**
- Mengembalikan file yang diunduh (`Content-Type` dan `Content-Disposition` akan diatur sesuai format).

**Error Responses:**
- `400 Bad Request`: Format ekspor tidak didukung
- `404 Not Found`: Hasil query tidak ditemukan
- `500 Internal Server Error`: Server error

---

### Schema Routes

Base path: `/api/schema`

#### 1. Get Database Schema

##### GET `/api/schema/:connectionId`

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

#### 2. Get Sample Data from Table

##### GET `/api/schema/:connectionId/tables/:tableName/sample`

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

#### 3. Get Database Statistics

##### GET `/api/schema/:connectionId/statistics`

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

### Admin API Endpoints

Base path: `/api/admin`

**Authentication:** Required (Bearer Token) & **Admin Role Required**

#### User Management (Admin)

##### 1. Get All Users

###### GET `/api/admin/users`

Mendapatkan daftar semua pengguna dalam sistem.

**Authentication:** Required (Admin Role)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin",
    "created_at": "2024-01-01T10:00:00.000Z",
    "updated_at": "2024-01-01T10:00:00.000Z"
  },
  {
    "id": 2,
    "email": "user@example.com",
    "name": "Regular User",
    "role": "user",
    "created_at": "2024-01-02T10:00:00.000Z",
    "updated_at": "2024-01-02T10:00:00.000Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `500 Internal Server Error`: Server error

---

##### 2. Get User by ID

###### GET `/api/admin/users/:id`

Mendapatkan detail pengguna berdasarkan ID.

**Authentication:** Required (Admin Role)

**URL Parameters:**
- `id`: User ID (integer)

**Success Response (200):**
```json
{
  "id": 1,
  "email": "admin@example.com",
  "name": "Admin User",
  "role": "admin",
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-01T10:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

##### 3. Create User (by Admin)

###### POST `/api/admin/users`

Membuat pengguna baru dengan peran tertentu.

**Authentication:** Required (Admin Role)

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword",
  "name": "New User",
  "role": "admin" // Can be 'user' or 'admin'
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `password`: Minimum 6 characters, required
- `name`: Not empty, required
- `role`: Optional, must be `user` or `admin` (default: `user`)

**Success Response (201):**
```json
{
  "id": 3,
  "email": "newuser@example.com",
  "name": "New User",
  "role": "admin",
  "created_at": "2024-01-15T11:00:00.000Z",
  "updated_at": "2024-01-15T11:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `409 Conflict`: Email already exists
- `500 Internal Server Error`: Server error

---

##### 4. Update User (by Admin)

###### PUT `/api/admin/users/:id`

Mengupdate detail pengguna, termasuk peran.

**Authentication:** Required (Admin Role)

**URL Parameters:**
- `id`: User ID (integer)

**Request Body:**
```json
{
  "name": "Updated Admin Name",
  "email": "updated_admin@example.com",
  "role": "user",
  "password": "newadminpass"
}
```

**Validation Rules:**
- `name`: Optional, not empty if provided
- `email`: Optional, valid email if provided
- `role`: Optional, must be `user` or `admin`
- `password`: Optional, minimum 6 characters if provided

**Success Response (200):**
```json
{
  "id": 1,
  "email": "updated_admin@example.com",
  "name": "Updated Admin Name",
  "role": "user",
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-15T11:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `404 Not Found`: User not found
- `409 Conflict`: Email already exists
- `500 Internal Server Error`: Server error

---

##### 5. Delete User (by Admin)

###### DELETE `/api/admin/users/:id`

Menghapus pengguna dari sistem.

**Authentication:** Required (Admin Role)

**URL Parameters:**
- `id`: User ID (integer)

**Success Response (200):**
```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

#### Audit Logs (Admin)

##### 1. Get All Audit Logs

###### GET `/api/admin/logs`

Mendapatkan semua log aktivitas dalam sistem.

**Authentication:** Required (Admin Role)

**Query Parameters:**
- `limit`: Optional, integer (default: 20)
- `offset`: Optional, integer (default: 0)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "user_email": "admin@example.com",
    "action": "login",
    "target_type": "user",
    "target_id": null,
    "details": null,
    "ip_address": "::1",
    "created_at": "2024-01-15T12:00:00.000Z"
  },
  {
    "id": 2,
    "user_id": 2,
    "user_email": "user@example.com",
    "action": "create_connection",
    "target_type": "connection",
    "target_id": 5,
    "details": {"name": "New DB"},
    "ip_address": "::1",
    "created_at": "2024-01-15T12:05:00.000Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `500 Internal Server Error`: Server error

---

##### 2. Get Audit Logs by User ID

###### GET `/api/admin/logs/user/:userId`

Mendapatkan log aktivitas untuk pengguna tertentu.

**Authentication:** Required (Admin Role)

**URL Parameters:**
- `userId`: User ID (integer)

**Query Parameters:**
- `limit`: Optional, integer (default: 20)
- `offset`: Optional, integer (default: 0)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "user_email": "admin@example.com",
    "action": "login",
    "target_type": "user",
    "target_id": null,
    "details": null,
    "ip_address": "::1",
    "created_at": "2024-01-15T12:00:00.000Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
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
| 403 | Forbidden | Token expired or insufficient permissions (e.g., not an admin) |
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
  role: 'user' | 'admin'; // New: User's role
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
  ssl_enabled: boolean;
  ssl_mode: string;
  ssl_reject_unauthorized: boolean;
  ssl_ca_cert: string | null; // Encrypted, never returned
  ssl_client_cert: string | null; // Encrypted, never returned
  ssl_client_key: string | null; // Encrypted, never returned
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Query History Model

```typescript
{
  id: number;
  user_id: number;
  connection_id: number;
  question: string;
  generated_sql: string;
  result: object | null; // JSONB field, stores query result
  execution_time: number | null; // in milliseconds
  success: boolean;
  error_message: string | null;
  created_at: timestamp;
}
```

### Audit Log Model

```typescript
{
  id: number;
  user_id: number | null; // Null if action is not tied to a specific user (e.g., system event)
  user_email: string | null; // Joined from users table
  action: string; // e.g., 'login', 'register', 'delete_user', 'run_query'
  target_type: string | null; // e.g., 'user', 'connection', 'query'
  target_id: number | null;
  details: object | null; // JSONB field for additional context
  ip_address: string | null;
  created_at: timestamp;
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
ENCRYPTION_KEY=your-encryption-key-for-passwords-and-db-credentials-min-32-chars
BCRYPT_ROUNDS=12

# AI Service
GEMINI_API_KEY=your-google-gemini-api-key
```

---

## Security Notes

1.  **Password Storage:**
    -   User passwords: Hashed menggunakan bcrypt (12 rounds)
    -   Database connection passwords & SSL credentials: Encrypted menggunakan Cryptr

2.  **JWT Tokens:**
    -   Expire dalam 7 hari
    -   Signed dengan HS256 algorithm
    -   Harus disimpan dengan aman di client side

3.  **SQL Injection Protection:**
    -   Semua query menggunakan parameterized queries
    -   Table names divalidasi dengan regex
    -   User input di-sanitize

4.  **Rate Limiting:**
    -   Implementasi rate limiting direkomendasikan untuk production
    -   Terutama untuk endpoint `/api/auth/login` dan `/api/query`

5.  **Audit Logging:**
    -   Aktivitas penting pengguna dan admin dicatat dalam tabel `audit_logs` untuk pemantauan dan jejak audit.

---

## Testing Endpoints

### Using cURL

**1. Register User (Default `user` role):**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d 
```json
{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }
```

**2. Login User:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d 
```json
{
    "email": "test@example.com",
    "password": "password123"
  }
```
# Save the token from the response for subsequent requests

**3. Get Profile (with user token):**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**4. Create Connection (with user token):**
```bash
curl -X POST http://localhost:3000/api/connections \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d 
```json
{
    "name": "Test DB",
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "your_external_db",
    "username": "your_db_user",
    "password": "your_db_password"
  }
```
# Save the connection ID from the response

**5. Natural Language Query (with user token):**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d 
```json
{
    "connectionId": YOUR_CONNECTION_ID,
    "question": "Show me all users",
    "autoExecute": true
  }
```
# Save the query history ID from the response if you want to export

**6. Get Query History (with user token):**
```bash
curl -X GET http://localhost:3000/api/query/history \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**7. Export Query Results (with user token):**
```bash
# Replace YOUR_QUERY_HISTORY_ID and choose format (csv, xlsx, pdf)
curl -X GET http://localhost:3000/api/query/export/YOUR_QUERY_HISTORY_ID/csv \
  -H "Authorization: Bearer YOUR_USER_TOKEN" -o query_result.csv
```

**8. Admin Actions (Requires Admin Role):**
   - **Manual Step:** Update the `role` of `test@example.com` to `admin` directly in your PostgreSQL database:
     ```sql
     UPDATE users SET role = 'admin' WHERE email = 'test@example.com';
     ```
   - **Login again** with `test@example.com` to get a new token with the `admin` role.

   **Get All Users (with admin token):**
   ```bash
   curl -X GET http://localhost:3000/api/admin/users \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

   **Get All Audit Logs (with admin token):**
   ```bash
   curl -X GET http://localhost:3000/api/admin/logs \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

---

## Support

Untuk pertanyaan atau issue, silakan hubungi developer atau buat issue di repository.

**Version:** 1.0.0  
**Last Updated:** 2024-01-15
