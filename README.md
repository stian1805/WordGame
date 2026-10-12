# React Word Game

A small React and Node.js word-combination game. Add words to the canvas and
drag two tiles together to combine them. Existing combinations are loaded from
PostgreSQL; new combinations are generated with a local Ollama model.


## Run

Start the frontend from the project root:

```bash
npm run dev
```

```bash
cd backend
node server.js
```

