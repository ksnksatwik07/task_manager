const { pool } = require('../db');

const toTask = (r) => ({ ...r, completed: Boolean(r.completed) });

exports.getTasks = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
    res.json(rows.map(toTask));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.getTask = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(toTask(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

exports.createTask = async (req, res) => {
  try {
    const { title, description = '' } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    const [result] = await pool.query(
      'INSERT INTO tasks (title, description) VALUES (?, ?)',
      [String(title).trim(), description]
    );
    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    res.status(201).json(toTask(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { title, description, completed } = req.body || {};
    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (completed !== undefined) { fields.push('completed = ?'); values.push(completed ? 1 : 0); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const [result] = await pool.query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
      [...values, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(toTask(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};
