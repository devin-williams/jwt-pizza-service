const request = require('supertest');
const app = require('../service.js');
const jwt = require('jsonwebtoken');
const { DB } = require('../database/database.js');

describe('Auth Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth - Register', () => {
    test('should register a new user successfully', async () => {
      const newUser = {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        roles: [{ role: 'diner' }],
      };

      DB.addUser.mockResolvedValue(newUser);
      DB.loginUser.mockResolvedValue();

      const response = await request(app)
        .post('/api/auth')
        .send({
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('test@test.com');
    });

    test('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/auth')
        .send({
          email: 'test@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('name, email, and password are required');
    });

    test('should return 400 if email is missing', async () => {
      const response = await request(app)
        .post('/api/auth')
        .send({
          name: 'Test User',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('name, email, and password are required');
    });

    test('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/api/auth')
        .send({
          name: 'Test User',
          email: 'test@test.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('name, email, and password are required');
    });
  });

  describe('PUT /api/auth - Login', () => {
    test('should login user successfully', async () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        roles: [{ role: 'diner' }],
      };

      DB.getUser.mockResolvedValue(user);
      DB.loginUser.mockResolvedValue();

      const response = await request(app)
        .put('/api/auth')
        .send({
          email: 'test@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
    });

    test('should handle invalid credentials', async () => {
      DB.getUser.mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .put('/api/auth')
        .send({
          email: 'wrong@test.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/auth - Logout', () => {
    test('should logout user successfully', async () => {
      const token = jwt.sign({ id: 1 }, 'test-secret');

      DB.isLoggedIn.mockResolvedValue(true);
      DB.logoutUser.mockResolvedValue();

      const response = await request(app)
        .delete('/api/auth')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('logout successful');
    });

    test('should return 401 if not authenticated', async () => {
      const response = await request(app).delete('/api/auth');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('unauthorized');
    });

    test('should return 401 if token is invalid', async () => {
      DB.isLoggedIn.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/auth')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('setAuthUser middleware', () => {
    test('should set user if valid token provided', async () => {
      const user = { id: 1, roles: [{ role: 'diner' }] };
      const token = jwt.sign(user, 'test-secret');

      DB.isLoggedIn.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/docs')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    test('should not set user if invalid token provided', async () => {
      DB.isLoggedIn.mockResolvedValue(false);

      const response = await request(app)
        .get('/api/docs')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(200);
    });
  });
});