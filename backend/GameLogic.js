const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.1:8b';
const DB_PASSWORD = process.env.DB_PASSWORD;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: DB_PASSWORD,
  port: 5432,
});

pool.connect()
  .then(client => {
    console.log('Connected to PostgreSQL');
    client.release();
  })
  .catch(err => {
    console.error('PostgreSQL connection error:', err.stack);
  });

async function callLLM(prompt) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false })
  });
  const data = await response.json();
  console.log('Ollama API response:', data);
  return data.response?.trim() || '';
}

function capitalizeFirstLetter(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatResponse(value) {
  const cleaned = value.replace(/[^a-zA-Z\s]/g, '').trim();
  const firstWord = cleaned.split(/\s+/)[0] || '';
  return capitalizeFirstLetter(firstWord);
}

async function checkIfExists(first, second) {
  try {
    const result = await pool.query(
      'SELECT * FROM combinations WHERE first = $1 AND second = $2',
      [first, second]
    );

    if (result.rows.length > 0) {
      console.log('Match found:', result.rows[0]);
      return { exists: true, data: result.rows[0] };
    } else {
      console.log('No match found.');
      return { exists: false };
    }
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
}

async function checkWordsExistence(first, second) {
  let result1, result2;
  try {
    result1 = await pool.query(
      'SELECT * FROM combinations WHERE result = $1',
      [first]
    );
    result2 = await pool.query(
      'SELECT * FROM combinations WHERE result = $1',
      [second]
    );
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
  console.log('Word validity check:', first, 'exists:', result1.rows.length > 0, ',', second, 'exists:', result2.rows.length > 0);
  return (result1.rows.length > 0) && (result2.rows.length > 0);
}

async function generateCombination(string1, string2) {
  console.log('############ Processing strings:', string1, string2 ,'############');
  if (!string1 || !string2) {
    throw new Error('Both strings are required.');
  }

  string1 = string1.toLowerCase();
  string2 = string2.toLowerCase();

  // Ensure smallest value is first
  const [first, second] = string1 <= string2
    ? [string1, string2]
    : [string2, string1];


  console.log('Checking if exists for:', first, second);
  const result = await checkIfExists(first, second);
  if (result.exists) {
    console.log('Found existing combination in DB:', result.data.result);
    const dbWord = result.data.result;
    return capitalizeFirstLetter(dbWord);
  }

  // Check if first and second exist in db
  console.log('Checking existence of words:', first, second);
  const wordsExist = await checkWordsExistence(first, second);
  if(!wordsExist) {
    throw new Error('One or both words are not in the database.');
  }
  console.log('Both words are in the database.');

  results = await pool.query('SELECT result FROM combinations');

  llmQuery = 
  `You are a word-combination engine. Your task: Given two input nouns, output exactly ONE simple, common, everyday English word that a typical player would naturally expect when combining them.

   Rules:
    - Output ONE word only. No sentences, punctuation, or explanation.
    - The result must be a well-known, concrete word that a child would understand.
    - Avoid repeating either input word as the answer.
    - The result should be a natural combination or association of the two inputs, not a random or obscure word.
    - The answer can also be clever or a pun.
    - Do not use the following as the allready have been used: ${results.rows.map(r => r.result).join(', ')}.

   Example:
   fire + water = steam
   water + plant = algae
   air + water = cloud
   mud + fire = brick

    Now give the best possible result for:  
    ${first} + ${second} =`;

  let resultFromLLM = await callLLM(llmQuery);

  console.log('LLM raw result:', resultFromLLM);

  resultFromLLM = formatResponse(resultFromLLM);
  console.log('Formatted LLM result:', resultFromLLM);

  if (!resultFromLLM) {
    throw new Error('LLM returned an empty result after formatting.');
  }

  // Store new combination in DB
  try {
    await pool.query(
      'INSERT INTO combinations (first, second, result) VALUES ($1, $2, $3)',
      [first, second, resultFromLLM.toLowerCase()]
    );
    console.log('Stored new combination in DB:', first, '+', second, '=', resultFromLLM);
  } catch (err) {
    throw new Error('Failed to store combination in DB.');
  }

  return resultFromLLM;
}

module.exports = { generateCombination };