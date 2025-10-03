const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    this.modelName = "gemini-2.5-flash";

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
        generationConfig: this.generationConfig,
      });

      // Format schema info menjadi string yang lebih readable
      const schemaStr =
        typeof schemaInfo === "object"
          ? JSON.stringify(schemaInfo, null, 2)
          : schemaInfo;

      const prompt = `You are a senior SQL expert. Convert the following natural language query to ${dbType} SQL. For explanations, adapt them to the user's language.

      DATABASE SCHEMA:
      ${schemaStr}

      NATURAL LANGUAGE QUERY: "${naturalLanguageQuery}"

      IMPORTANT RULES:
      1. Generate ONLY the SQL code without any explanation or markdown.
      2. Do not wrap the SQL in code blocks or quotes.
      3. For SELECT queries: Use proper JOINs based on schema relationships, include WHERE clauses if filtering is mentioned, use appropriate aggregate functions (COUNT, SUM, AVG, etc.) when needed, always use table aliases for better readability.
      4. For INSERT, UPDATE, DELETE queries: Ensure the syntax is correct for ${dbType}, include WHERE clauses for UPDATE/DELETE to prevent unintended changes, and ensure all necessary columns are provided for INSERT.
      5. Return only valid ${dbType} SQL syntax.
      6. End the query with a semicolon.

      SQL QUERY:`;

      // Generate content
      const result = await model.generateContent(prompt);
      const response = result.response;
      let sql = response.text().trim();

      // Clean up SQL - remove markdown code blocks if any
      sql = sql.replace(/```sql\n?/gi, "");
      sql = sql.replace(/```\n?/g, "");
      sql = sql.trim();

      // Remove any leading/trailing quotes
      sql = sql.replace(/^["']|["']$/g, "");

      console.log("Generated SQL:", sql);
      return sql;
    } catch (error) {
      console.error("Gemini API Error:", error);

      // Better error handling
      if (error.message?.includes("API key")) {
        throw new Error(
          "Invalid Gemini API key. Please check your GEMINI_API_KEY in .env file"
        );
      } else if (error.message?.includes("quota")) {
        throw new Error("Gemini API quota exceeded. Please try again later");
      } else if (error.message?.includes("429")) {
        throw new Error(
          "Too many requests to Gemini API. Please wait a moment"
        );
      } else {
        throw new Error(`AI service error: ${error.message}`);
      }
    }
  }

  async explainSQL(sqlQuery, schemaInfo, userQuestion, queryResult) {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: this.generationConfig,
      });

      const schemaStr =
        typeof schemaInfo === "object"
          ? JSON.stringify(schemaInfo, null, 2)
          : schemaInfo;

      // Menyiapkan sampel hasil untuk prompt
      const resultSample =
        queryResult && queryResult.data ? queryResult.data.slice(0, 5) : [];
      const rowCount = queryResult ? queryResult.rowCount : 0;

      const prompt = `Analyze the business relevance and implications of the following user request, its generated SQL query, and the result.

      USER QUESTION:
      ${userQuestion}

      SQL QUERY:
      ${sqlQuery}

      DATABASE SCHEMA:
      ${schemaStr}

      QUERY RESULT:
      - Total rows: ${rowCount}
      - Data sample (first 5 rows):
      ${JSON.stringify(resultSample, null, 2)}

      Please provide a clear, concise, and business-focused explanation based on the data. The structure should be:

      1.  **Direct Answer & Data Summary**: Start with a direct answer to the user's question. 
          - If the query returned data (Total rows > 0), summarize the key findings from the result sample. 
          - If the query returned no data (Total rows = 0), state that clearly and explain what it means (e.g., "No sales were recorded for this period.").

      2.  **Business Context**: Briefly explain what the user was trying to achieve from a business perspective.

      3.  **Actionable Insight**: Based on the findings (or lack thereof), provide a short, actionable insight. (e.g., "This data suggests a need to review marketing efforts for the current week," or "The sales performance is strong, consider restocking popular items.")
      
      Keep the explanation easy to understand for a non-technical audience and use the same language as the user's question.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text().trim();
    } catch (error) {
      console.error("Gemini API Error:", error);
      // Return a default explanation if AI fails
      return `This query retrieves data from your database. The SQL statement is: ${sqlQuery}`;
    }
  }

  async summarizeResults(userQuestion, queryResult) {
    if (!queryResult || !queryResult.data || queryResult.data.length === 0) {
      return "There is no data to summarize.";
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const resultSample = queryResult.data.slice(0, 5); // Ambil sampel data

      const prompt = `You are a data analyst. Based on the user's question and the following query result, provide a concise summary of the findings.

      USER QUESTION: "${userQuestion}"

      QUERY RESULT (sample):
      ${JSON.stringify(resultSample, null, 2)}
      
      Total rows: ${queryResult.rowCount}

      Instructions:
      1.  Start with a direct answer to the user's question.
      2.  Highlight key insights, trends, or important figures from the data.
      3.  Keep it brief and easy to understand for a non-technical audience.
      4.  If the data seems to indicate a problem or a significant success, mention it.
      5.  The language of the summary should match the language of the user's question.

      SUMMARY:`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text().trim();
    } catch (error) {
      console.error("Gemini API Error during summarization:", error);
      return "Could not generate a summary for the results.";
    }
  }

  async generateChart(queryResult, userQuestion) {
    if (!queryResult || !queryResult.data || queryResult.data.length === 0) {
      return null;
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const columns = queryResult.columns;
      const resultSample = queryResult.data.slice(0, 3);

      const prompt = `You are a chart generation expert. Based on the query result and user's question, suggest the most appropriate chart type and its configuration.

      USER QUESTION: "${userQuestion}"

      AVAILABLE COLUMNS: ${columns.join(", ")}
      
      DATA PREVIEW (first 3 rows):
      ${JSON.stringify(resultSample, null, 2)}

      Instructions:
      1.  Analyze the columns and data types to determine the best chart.
      2.  Choose from: 'bar', 'line', 'pie', 'scatter', 'table'.
      3.  Provide a JSON object with 'type', 'title', and 'mapping'.
      4.  'mapping' should define which columns map to 'x', 'y', 'label', 'value', etc.
      5.  'title' should be a short, descriptive title for the chart.
      6.  If no chart is suitable, return null.
      7.  ONLY return the JSON object, no other text or markdown.

      Example for a bar chart showing sales by product:
      {
        "type": "bar",
        "title": "Total Sales by Product",
        "mapping": {
          "x": "product_name",
          "y": "total_sales"
        }
      }

      Example for a pie chart:
      {
        "type": "pie",
        "title": "Sales Distribution by Category",
        "mapping": {
          "label": "category_name",
          "value": "sales_amount"
        }
      }

      CHART CONFIGURATION JSON:`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      let jsonText = response.text().trim();

      // Clean up to get only the JSON
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.substring(7, jsonText.length - 3).trim();
      }

      return JSON.parse(jsonText);
    } catch (error) {
      console.error("Gemini API Error during chart generation:", error);
      return null; // Return null if chart generation fails
    }
  }

  // Method untuk test connection ke Gemini API
  async testConnection() {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });

      const result = await model.generateContent(
        "Say 'Hello, I am working!' in one sentence."
      );
      const response = result.response;

      return {
        success: true,
        message: response.text(),
        model: this.modelName,
        apiKeyValid: true,
      };
    } catch (error) {
      console.error("Gemini test error:", error);
      return {
        success: false,
        error: error.message,
        model: this.modelName,
        apiKeyValid: false,
      };
    }
  }

  // Method untuk list available models
  async listAvailableModels() {
    try {
      const models = await this.genAI.listModels();
      return {
        success: true,
        models: models.map((m) => ({
          name: m.name,
          displayName: m.displayName,
          description: m.description,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new GeminiService();
