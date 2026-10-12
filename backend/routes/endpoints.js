const express = require('express');
const { generateCombination } = require('../GameLogic');

const router = express.Router();

router.get('/', (req, res) => {
  res.send('Backend is running!');
});

router.post('/process-strings', async (req, res) => {
  const { string1, string2 } = req.body;

  try {
    const result = await generateCombination(string1, string2);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;