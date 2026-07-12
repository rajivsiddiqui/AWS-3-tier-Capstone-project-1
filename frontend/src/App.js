import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_URL || '';

function App() {
  const [tasks,   setTasks]   = useState([]);
  const [form,    setForm]    = useState({ title: '', description: '', status: 'todo' });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch {
      setError('Could not load tasks. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const url    = editing ? `${API}/api/tasks/${editing}` : `${API}/api/tasks`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Request failed');
      setForm({ title: '', description: '', status: 'todo' });
      setEditing(null);
      fetchTasks();
    } catch {
      setError('Failed to save task.');
    }
  };

  const handleEdit = (task) => {
    setEditing(task.id);
    setForm({ title: task.title, description: task.description, status: task.status });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    await fetch(`${API}/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  };

  const statusColor = { todo: '#64748b', 'in-progress': '#f59e0b', done: '#22c55e' };

  return (
    <div className="app">
      <header>
        <h1>📋 Task Manager-1 </h1>
        <p>3-Tier AWS Capstone — Node.js + React + MySQL on RDS</p>
      </header>

      <main>
        <section className="form-card">
          <h2>{editing ? 'Edit Task' : 'New Task'}</h2>
          {error && <div className="error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <input
              placeholder="Task title *"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editing ? 'Update Task' : 'Add Task'}
              </button>
              {editing && (
                <button type="button" className="btn-secondary"
                  onClick={() => { setEditing(null); setForm({ title: '', description: '', status: 'todo' }); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="tasks">
          <h2>All Tasks {loading && <span className="loading">Loading…</span>}</h2>
          {tasks.length === 0 && !loading && (
            <div className="empty">No tasks yet. Add your first one!</div>
          )}
          <div className="task-grid">
            {tasks.map(task => (
              <div key={task.id} className="task-card">
                <div className="task-header">
                  <h3>{task.title}</h3>
                  <span className="badge" style={{ background: statusColor[task.status] }}>
                    {task.status}
                  </span>
                </div>
                {task.description && <p>{task.description}</p>}
                <div className="task-footer">
                  <small>{new Date(task.created_at).toLocaleDateString()}</small>
                  <div>
                    <button className="btn-edit" onClick={() => handleEdit(task)}>Edit</button>
                    <button className="btn-delete" onClick={() => handleDelete(task.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
