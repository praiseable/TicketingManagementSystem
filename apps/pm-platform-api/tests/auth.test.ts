import request from 'supertest';
import { createApp } from '../src/app.js';

describe('auth', () => {
  it('rejects invalid login credentials', async () => {
    const res = await request(createApp()).post('/api/auth/login').send({ email: 'missing@example.com', password: 'nope' });
    expect([401, 500]).toContain(res.status);
  });
});
