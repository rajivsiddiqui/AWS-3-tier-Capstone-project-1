// Mock the DB so tests run without a real MySQL connection
jest.mock('../src/db', () => {
  const tasks = [];
  let nextId = 1;
  return {
    initDB: jest.fn().mockResolvedValue(true),
    getPool: () => ({
      execute: jest.fn(async (sql, params) => {
        if (sql.includes('CREATE TABLE')) return [[], []];

        if (sql.startsWith('SELECT * FROM tasks ORDER')) {
          return [[...tasks].reverse(), []];
        }
        if (sql.startsWith('SELECT * FROM tasks WHERE id')) {
          const found = tasks.find(t => t.id === parseInt(params[0]));
          return [found ? [found] : [], []];
        }
        if (sql.startsWith('INSERT')) {
          const task = { id: nextId++, title: params[0], description: params[1], status: params[2] };
          tasks.push(task);
          return [{ insertId: task.id }, []];
        }
        if (sql.startsWith('UPDATE')) {
          const t = tasks.find(t => t.id === parseInt(params[3]));
          if (t) { t.title = params[0]; t.description = params[1]; t.status = params[2]; }
          return [{ affectedRows: t ? 1 : 0 }, []];
        }
        if (sql.startsWith('DELETE')) {
          const idx = tasks.findIndex(t => t.id === parseInt(params[0]));
          if (idx !== -1) tasks.splice(idx, 1);
          return [{ affectedRows: idx !== -1 ? 1 : 0 }, []];
        }
        return [[], []];
      }),
    }),
  };
});

const request = require('supertest');
const app     = require('../src/server');

describe('Health check', () => {
  test('GET /api/health returns OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

describe('Tasks CRUD', () => {
  test('GET /api/tasks returns empty array', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/tasks creates a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test task', description: 'Test desc' });
    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Test task');
    expect(res.body.id).toBeDefined();
  });

  test('POST /api/tasks without title returns 400', async () => {
    const res = await request(app).post('/api/tasks').send({});
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/tasks/:id returns a task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Find me' });
    const res = await request(app).get(`/api/tasks/${created.body.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Find me');
  });

  test('PUT /api/tasks/:id updates a task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Old title' });
    const res = await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .send({ title: 'New title', description: '', status: 'done' });
    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('New title');
  });

  test('DELETE /api/tasks/:id deletes a task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Delete me' });
    const res = await request(app).delete(`/api/tasks/${created.body.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Task deleted');
  });

  test('GET /api/tasks/:id returns 404 for missing task', async () => {
    const res = await request(app).get('/api/tasks/99999');
    expect(res.statusCode).toBe(404);
  });
});
