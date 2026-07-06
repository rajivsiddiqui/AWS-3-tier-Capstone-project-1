require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { initDB } = require('./db');
const taskRoutes = require('./routes/tasks');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/tasks', taskRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  initDB()
    .then(() => {
      app.listen(PORT, () =>
        console.log(`Backend API running on http://localhost:${PORT}`)
      );
    })
    .catch(err => {
      console.error('DB init failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;
