import { useEffect, useState } from 'react';

// Relative URL: Nginx (same origin) proxies /api to the backend service.
const API = '/api/tasks';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const loadTasks = async () => {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTasks(await res.json());
      setError('');
    } catch (e) {
      setError('Cannot reach the backend API: ' + e.message);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  const addTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    setTitle('');
    setDescription('');
    loadTasks();
  };

  const toggleTask = async (task) => {
    await fetch(`${API}/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !task.completed }),
    });
    loadTasks();
  };

  const deleteTask = async (id) => {
    await fetch(`${API}/${id}`, { method: 'DELETE' });
    loadTasks();
  };

  return (
    <div className="container">
      <h1>Task Manager</h1>

      <form className="card" onSubmit={addTask}>
        <label>Task Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Learn Kubernetes" />
        <label>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Practice PV and PVC" />
        <button type="submit" className="primary">Add Task</button>
      </form>

      {error && <p className="error">{error}</p>}

      <h2>Tasks</h2>
      <ul className="tasks">
        {tasks.map((t) => (
          <li key={t.id} className={t.completed ? 'done' : ''}>
            <input type="checkbox" checked={t.completed} onChange={() => toggleTask(t)} />
            <div className="text">
              <strong>{t.title}</strong>
              <span>{t.description}</span>
            </div>
            <span className="status">{t.completed ? 'Completed' : 'Pending'}</span>
            <button className="danger" onClick={() => deleteTask(t.id)}>Delete</button>
          </li>
        ))}
        {tasks.length === 0 && !error && <li className="empty">No tasks yet.</li>}
      </ul>
    </div>
  );
}
