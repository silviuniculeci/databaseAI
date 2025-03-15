const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const OpenAI = require('openai');

const app = express();
app.use(express.static('public'));
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `
You are a SQL expert. Convert natural language queries to PostgreSQL queries for a CRM database with these tables:

clients:
- id
- company_name
- contact_person
- email
- phone
- industry

contracts:
- id
- client_id (references clients.id)
- contract_name
- start_date
- end_date
- value (numeric)
- status (active, expired, pending, cancelled)

offers:
- id
- client_id (references clients.id)
- offer_name
- description
- value (numeric)
- status (pending, accepted, rejected)
- valid_until

For the query "Show active contracts under $31,000", you should return:
SELECT 
    c.contract_name,
    cl.company_name as client,
    c.value,
    c.start_date,
    c.end_date,
    c.status
FROM contracts c
JOIN clients cl ON c.client_id = cl.id
WHERE c.status = 'active'
AND c.value < 31000
ORDER BY c.value DESC;

Return ONLY the SQL query, no explanations. Use appropriate JOINs when needed.
`;

app.post('/api/query', async (req, res) => {
    try {
        const { prompt } = req.body;
        console.log('Received prompt:', prompt);

        // Get SQL query from OpenAI
        const sqlResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt }
            ],
            temperature: 0.7
        });

        const sqlQuery = sqlResponse.choices[0].message.content.trim();
        console.log('Generated SQL:', sqlQuery);

        // Execute the dynamic query using the stored procedure
        const { data: queryResult, error: queryError } = await supabase
            .rpc('execute_query', {
                query_text: sqlQuery
            });

        if (queryError) throw queryError;

        // Get insights from OpenAI
        const analysisPrompt = `
        Analyze this CRM data in the context of the query: "${prompt}"
        Data: ${JSON.stringify(queryResult, null, 2)}
        Provide 3-4 key insights about the data, focusing on the most relevant aspects for this query.
        Return the insights as a JSON array of strings.
        `;

        const analysisResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: "You are a business analyst. Provide clear, actionable insights." },
                { role: "user", content: analysisPrompt }
            ],
            temperature: 0.7
        });

        let insights;
        try {
            insights = JSON.parse(analysisResponse.choices[0].message.content);
        } catch (e) {
            insights = [analysisResponse.choices[0].message.content];
        }

        res.json({
            success: true,
            query: sqlQuery,
            data: queryResult,
            insights: insights
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

const PORT = 8082;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
}); 