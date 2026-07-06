const express = require('express');
const router  = express.Router();
const { getPool } = require('../db');

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      'SELECT * FROM tasks ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      'SELECT * FROM tasks WHERE id = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  const { title, description, status = 'todo' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  try {
    const [result] = await getPool().execute(
      'INSERT INTO tasks (title, description, status) VALUES (?, ?, ?)',
      [title, description || '', status]
    );
    res.status(201).json({ id: result.insertId, title, description, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  const { title, description, status } = req.body;
  try {
    const [result] = await getPool().execute(
      'UPDATE tasks SET title=?, description=?, status=? WHERE id=?',
      [title, description, status, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Task not found' });
    res.json({ id: req.params.id, title, description, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await getPool().execute(
      'DELETE FROM tasks WHERE id = ?', [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
