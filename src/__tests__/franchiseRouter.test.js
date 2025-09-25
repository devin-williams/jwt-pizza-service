const request = require('supertest');
const app = require('../service.js');
const jwt = require('jsonwebtoken');
const { DB } = require('../database/database.js');

describe('Franchise Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/franchise', () => {
    test('should return franchises list', async () => {
      const franchises = [
        { id: 1, name: 'Test Franchise', stores: [] }
      ];

      DB.getFranchises.mockResolvedValue([franchises, false]);

      const response = await request(app)
        .get('/api/franchise?page=0&limit=10');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('franchises');
      expect(response.body).toHaveProperty('more');
      expect(response.body.franchises).toEqual(franchises);
    });

    test('should handle query parameters', async () => {
      DB.getFranchises.mockResolvedValue([[], false]);

      await request(app)
        .get('/api/franchise?page=1&limit=5&name=test');

      expect(DB.getFranchises).toHaveBeenCalledWith(
        undefined,
        '1',
        '5',
        'test'
      );
    });
  });

  describe('GET /api/franchise/:userId', () => {
    test('should return user franchises for owner', async () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        roles: [{ role: 'franchisee' }],
        isRole: jest.fn(() => false)
      };
      const token = jwt.sign(user, 'test-secret');

      const franchises = [
        { id: 1, name: 'User Franchise', stores: [] }
      ];

      DB.isLoggedIn.mockResolvedValue(true);
      DB.getUserFranchises.mockResolvedValue(franchises);

      const response = await request(app)
        .get('/api/franchise/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(franchises);
    });

    test('should return user franchises for admin', async () => {
      const adminUser = {
        id: 2,
        name: 'Admin User',
        email: 'admin@test.com',
        roles: [{ role: 'admin' }],
        isRole: jest.fn((role) => role === 'admin')
      };
      const token = jwt.sign(adminUser, 'test-secret');

      const franchises = [
        { id: 1, name: 'Any User Franchise', stores: [] }
      ];

      DB.isLoggedIn.mockResolvedValue(true);
      DB.getUserFranchises.mockResolvedValue(franchises);

      const response = await request(app)
        .get('/api/franchise/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(franchises);
    });

    test('should return empty array for unauthorized access', async () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        roles: [{ role: 'diner' }],
        isRole: jest.fn(() => false)
      };
      const token = jwt.sign(user, 'test-secret');

      DB.isLoggedIn.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/franchise/2')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('should return 401 for unauthenticated user', async () => {
      const response = await request(app).get('/api/franchise/1');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/franchise', () => {
    test('should create franchise for admin', async () => {
      const adminUser = {
        id: 1,
        name: 'Admin',
        email: 'admin@test.com',
        roles: [{ role: 'admin' }],
        isRole: jest.fn((role) => role === 'admin')
      };
      const token = jwt.sign(adminUser, 'test-secret');

      const franchiseData = {
        name: 'New Franchise',
        admins: [{ email: 'franchisee@test.com' }]
      };

      const createdFranchise = { ...franchiseData, id: 1 };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.createFranchise.mockResolvedValue(createdFranchise);

      const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${token}`)
        .send(franchiseData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(createdFranchise);
    });

    test('should return 403 for non-admin', async () => {
      const user = {
        id: 1,
        name: 'User',
        email: 'user@test.com',
        roles: [{ role: 'diner' }],
        isRole: jest.fn(() => false)
      };
      const token = jwt.sign(user, 'test-secret');

      DB.isLoggedIn.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacker Franchise' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/franchise/:franchiseId', () => {
    test('should delete franchise', async () => {
      DB.deleteFranchise.mockResolvedValue();

      const response = await request(app).delete('/api/franchise/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('franchise deleted');
      expect(DB.deleteFranchise).toHaveBeenCalledWith(1);
    });

    test('should handle database errors', async () => {
      DB.deleteFranchise.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/franchise/1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/franchise/:franchiseId/store', () => {
    test('should create store for franchise admin', async () => {
      const franchiseeUser = {
        id: 1,
        name: 'Franchisee',
        email: 'franchisee@test.com',
        roles: [{ role: 'franchisee' }],
        isRole: jest.fn(() => false)
      };
      const token = jwt.sign(franchiseeUser, 'test-secret');

      const franchise = {
        id: 1,
        name: 'Test Franchise',
        admins: [{ id: 1, name: 'Franchisee', email: 'franchisee@test.com' }]
      };

      const storeData = { name: 'New Store' };
      const createdStore = { id: 1, franchiseId: 1, name: 'New Store' };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.getFranchise.mockResolvedValue(franchise);
      DB.createStore.mockResolvedValue(createdStore);

      const response = await request(app)
        .post('/api/franchise/1/store')
        .set('Authorization', `Bearer ${token}`)
        .send(storeData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(createdStore);
    });

    test('should create store for admin', async () => {
      const adminUser = {
        id: 2,
        name: 'Admin',
        email: 'admin@test.com',
        roles: [{ role: 'admin' }],
        isRole: jest.fn((role) => role === 'admin')
      };
      const token = jwt.sign(adminUser, 'test-secret');

      const franchise = {
        id: 1,
        name: 'Test Franchise',
        admins: [{ id: 1, name: 'Franchisee', email: 'franchisee@test.com' }]
      };

      const storeData = { name: 'Admin Store' };
      const createdStore = { id: 2, franchiseId: 1, name: 'Admin Store' };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.getFranchise.mockResolvedValue(franchise);
      DB.createStore.mockResolvedValue(createdStore);

      const response = await request(app)
        .post('/api/franchise/1/store')
        .set('Authorization', `Bearer ${token}`)
        .send(storeData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(createdStore);
    });

    test('should return 403 for unauthorized user', async () => {
      const user = {
        id: 3,
        name: 'Random User',
        email: 'user@test.com',
        roles: [{ role: 'diner' }],
        isRole: jest.fn(() => false)
      };
      const token = jwt.sign(user, 'test-secret');

      const franchise = {
        id: 1,
        name: 'Test Franchise',
        admins: [{ id: 1, name: 'Franchisee', email: 'franchisee@test.com' }]
      };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.getFranchise.mockResolvedValue(franchise);

      const response = await request(app)
        .post('/api/franchise/1/store')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacker Store' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/franchise/:franchiseId/store/:storeId', () => {
    test('should delete store for franchise admin', async () => {
      const franchiseeUser = {
        id: 1,
        name: 'Franchisee',
        email: 'franchisee@test.com',
        roles: [{ role: 'franchisee' }],
        isRole: jest.fn(() => false)
      };
      const token = jwt.sign(franchiseeUser, 'test-secret');

      const franchise = {
        id: 1,
        name: 'Test Franchise',
        admins: [{ id: 1, name: 'Franchisee', email: 'franchisee@test.com' }]
      };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.getFranchise.mockResolvedValue(franchise);
      DB.deleteStore.mockResolvedValue();

      const response = await request(app)
        .delete('/api/franchise/1/store/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('store deleted');
      expect(DB.deleteStore).toHaveBeenCalledWith(1, 1);
    });

    test('should return 403 for unauthorized user', async () => {
      const user = {
        id: 3,
        name: 'Random User',
        email: 'user@test.com',
        roles: [{ role: 'diner' }],
        isRole: jest.fn(() => false)
      };
      const token = jwt.sign(user, 'test-secret');

      const franchise = {
        id: 1,
        name: 'Test Franchise',
        admins: [{ id: 1, name: 'Franchisee', email: 'franchisee@test.com' }]
      };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.getFranchise.mockResolvedValue(franchise);

      const response = await request(app)
        .delete('/api/franchise/1/store/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });
});