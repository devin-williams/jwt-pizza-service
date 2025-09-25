const request = require('supertest');
const app = require('../service.js');
const jwt = require('jsonwebtoken');
const { DB } = require('../database/database.js');

// Mock fetch for factory API calls
global.fetch = jest.fn();

describe('Order Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/order/menu', () => {
    test('should return menu items', async () => {
      const menuItems = [
        { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' }
      ];

      DB.getMenu.mockResolvedValue(menuItems);

      const response = await request(app).get('/api/order/menu');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(menuItems);
      expect(DB.getMenu).toHaveBeenCalledTimes(1);
    });

    test('should handle database errors', async () => {
      DB.getMenu.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/order/menu');

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/order/menu', () => {
    test('should add menu item for admin user', async () => {
      const adminUser = {
        id: 1,
        name: 'Admin',
        email: 'admin@test.com',
        roles: [{ role: 'admin' }],
        isRole: jest.fn((role) => role === 'admin')
      };
      const token = jwt.sign(adminUser, 'test-secret');

      const newMenuItem = { title: 'Pepperoni', description: 'Classic pepperoni', image: 'pizza2.png', price: 0.005 };
      const updatedMenu = [newMenuItem];

      DB.isLoggedIn.mockResolvedValue(true);
      DB.addMenuItem.mockResolvedValue(newMenuItem);
      DB.getMenu.mockResolvedValue(updatedMenu);

      const response = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${token}`)
        .send(newMenuItem);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedMenu);
      expect(DB.addMenuItem).toHaveBeenCalledWith(newMenuItem);
    });

    test('should return 403 for non-admin user', async () => {
      const regularUser = {
        id: 2,
        name: 'Regular User',
        email: 'user@test.com',
        roles: [{ role: 'diner' }],
        isRole: jest.fn(() => false)
      };
      const token = jwt.sign(regularUser, 'test-secret');

      DB.isLoggedIn.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hacker Pizza' });

      expect(response.status).toBe(403);
    });

    test('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .put('/api/order/menu')
        .send({ title: 'Anonymous Pizza' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/order', () => {
    test('should return orders for authenticated user', async () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        roles: [{ role: 'diner' }]
      };
      const token = jwt.sign(user, 'test-secret');

      const orders = {
        dinerId: 1,
        orders: [
          { id: 1, franchiseId: 1, storeId: 1, date: '2024-06-05T05:14:40.000Z', items: [] }
        ],
        page: 1
      };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.getOrders.mockResolvedValue(orders);

      const response = await request(app)
        .get('/api/order?page=1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(orders);
      expect(DB.getOrders).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), '1');
    });

    test('should return 401 for unauthenticated user', async () => {
      const response = await request(app).get('/api/order');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/order', () => {
    test('should create order successfully', async () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        roles: [{ role: 'diner' }]
      };
      const token = jwt.sign(user, 'test-secret');

      const orderRequest = {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Veggie', price: 0.05 }]
      };

      const createdOrder = { ...orderRequest, id: 1 };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.addDinerOrder.mockResolvedValue(createdOrder);

      // Mock successful factory response
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ reportUrl: 'https://factory.com/report/123', jwt: 'factory-jwt' })
      });

      const response = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${token}`)
        .send(orderRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('order');
      expect(response.body).toHaveProperty('followLinkToEndChaos');
      expect(response.body).toHaveProperty('jwt');
    });

    test('should handle factory failure', async () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        roles: [{ role: 'diner' }]
      };
      const token = jwt.sign(user, 'test-secret');

      const orderRequest = {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Veggie', price: 0.05 }]
      };

      const createdOrder = { ...orderRequest, id: 1 };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.addDinerOrder.mockResolvedValue(createdOrder);

      // Mock failed factory response
      fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ reportUrl: 'https://factory.com/report/error' })
      });

      const response = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${token}`)
        .send(orderRequest);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to fulfill order at factory');
    });

    test('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .post('/api/order')
        .send({ franchiseId: 1, storeId: 1, items: [] });

      expect(response.status).toBe(401);
    });
  });
});