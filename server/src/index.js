// ============================================================
// Server entry point — `npm run dev` / `npm start`
// ============================================================
// .env must be loaded BEFORE requiring the app, because the database pool
// reads DATABASE_URL the moment it is constructed.
require('dotenv').config({ quiet: true });

const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3001;

const app = createApp();
app.listen(PORT, () => {
  console.log(`[server] SprintBoard API listening on http://localhost:${PORT}`);
  console.log(`[server] environment: ${process.env.NODE_ENV || 'development'}`);
});
