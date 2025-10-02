const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    this.modelName = "gemini-2.5-pro"; 
    
    this.generationConfig = {
      temperature: 0.1, 
      maxOutputTokens: 2000,
      topP: 0.8,
      topK: 10,
    };
  }


  async generateSQL(naturalLanguageQuery, schemaInfo, dbType) {
    try {
      // Get the generative model
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: this.generationConfig
      });

      // Format schema info menjadi string yang lebih readable
      const schemaStr = typeof schemaInfo === 'object' 
        ? JSON.stringify(schemaInfo, null, 2) 
        : schemaInfo;

      const prompt = `You are a senior SQL expert. Convert the following natural language query to ${dbType} SQL. For explanations, adapt them to the user's language.

DATABASE SCHEMA:
${schemaStr}

NATURAL LANGUAGE QUERY: "${naturalLanguageQuery}"

IMPORTANT RULES:
1. Generate ONLY the SQL code without any explanation or markdown
2. Do not wrap the SQL in code blocks or quotes
3. Use proper JOINs based on schema relationships
4. Include WHERE clauses if filtering is mentioned
5. Use appropriate aggregate functions (COUNT, SUM, AVG, etc.) when needed
6. Always use table aliases for better readability
7. Return only valid ${dbType} SQL syntax
8. End the query with a semicolon

SQL QUERY:`;

      // Generate content
      const result = await model.generateContent(prompt);
      const response = result.response;
      let sql = response.text().trim();
      
      // Clean up SQL - remove markdown code blocks if any
      sql = sql.replace(/```sql\n?/gi, '');
      sql = sql.replace(/```\n?/g, '');
      sql = sql.trim();
      
      // Remove any leading/trailing quotes
      sql = sql.replace(/^["']|["']$/g, '');
      
      console.log('Generated SQL:', sql);
      return sql;
      
    } catch (error) {
      console.error('Gemini API Error:', error);
      
      // Better error handling
      if (error.message?.includes('API key')) {
        throw new Error('Invalid Gemini API key. Please check your GEMINI_API_KEY in .env file');
      } else if (error.message?.includes('quota')) {
        throw new Error('Gemini API quota exceeded. Please try again later');
      } else if (error.message?.includes('429')) {
        throw new Error('Too many requests to Gemini API. Please wait a moment');
      } else {
        throw new Error(`AI service error: ${error.message}`);
      }
    }
  }

  async explainSQL(sqlQuery, schemaInfo) {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: this.generationConfig
      });

      const schemaStr = typeof schemaInfo === 'object' 
        ? JSON.stringify(schemaInfo, null, 2) 
        : schemaInfo;

      const prompt = `Explain this SQL query in simple, non-technical terms:

SQL QUERY:
${sqlQuery}

DATABASE SCHEMA:
${schemaStr}

Please provide a clear explanation that includes:
1. What data this query will retrieve
2. Which tables are being used
3. How the tables are connected (if any JOINs)
4. What filters or conditions are applied
5. What the results will look like

Keep the explanation concise, friendly, and easy to understand for non-technical users.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text().trim();
      
    } catch (error) {
      console.error('Gemini API Error:', error);
      // Return a default explanation if AI fails
      return `This query retrieves data from your database. The SQL statement is: ${sqlQuery}`;
    }
  }

  // ✅ Method untuk test connection ke Gemini API
  async testConnection() {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName 
      });
      
      const result = await model.generateContent("Say 'Hello, I am working!' in one sentence.");
      const response = result.response;
      
      return {
        success: true,
        message: response.text(),
        model: this.modelName,
        apiKeyValid: true
      };
    } catch (error) {
      console.error('Gemini test error:', error);
      return {
        success: false,
        error: error.message,
        model: this.modelName,
        apiKeyValid: false
      };
    }
  }

  // ✅ Method untuk list available models
  async listAvailableModels() {
    try {
      const models = await this.genAI.listModels();
      return {
        success: true,
        models: models.map(m => ({
          name: m.name,
          displayName: m.displayName,
          description: m.description
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new GeminiService();
