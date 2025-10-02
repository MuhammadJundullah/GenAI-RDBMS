// server.js
require('dotenv').config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/connections", require("./routes/connections"));
app.use("/api/query", require("./routes/query"));
app.use("/api/schema", require("./routes/schema"));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'GenAI RDBMS Backend'
  });
});

// ✅ Test Gemini API connection
app.get('/api/test-gemini', async (req, res) => {
  try {
    const geminiService = require("./services/geminiService");
    const result = await geminiService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ List available Gemini models
app.get('/api/gemini-models', async (req, res) => {
  try {
    const geminiService = require("./services/geminiService");
    const result = await geminiService.listAvailableModels();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Database connection manager
const dbManager = require("./utils/databaseManager");

const PORT = process.env.PORT || 3000;

// Debug: Log startup info
console.log('='.repeat(50));
console.log('GenAI RDBMS Server Starting...');
console.log('='.repeat(50));
console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));
console.log('JWT Secret exists:', !!process.env.JWT_SECRET);
console.log('Gemini API Key exists:', !!process.env.GEMINI_API_KEY);
console.log('Gemini API Key prefix:', process.env.GEMINI_API_KEY?.substring(0, 10) + '...');
console.log('='.repeat(50));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Test Gemini: http://localhost:${PORT}/api/test-gemini`);
  console.log(`List Models: http://localhost:${PORT}/api/gemini-models`);
  console.log('='.repeat(50));
});
