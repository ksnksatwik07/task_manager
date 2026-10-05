const express = require('express');
const { pool, waitForDb, ensureSchema } = require('./db');
const taskRoutes = require('./routes/taskRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check: also verifies the database connection (used by readiness probe).
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', pod: process.env.HOSTNAME });
  } catch (err) {
    res.status(503).json({ status: 'db-unavailable' });
  }
});

app.use('/api/tasks', taskRoutes);

// Start listening immediately so probes get an answer, then connect to MySQL with retries.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
  waitForDb()
    .then(ensureSchema)
    .catch((err) => {
      console.error(err.message);
      process.exit(1); // let Docker/Kubernetes restart us
    });
});
