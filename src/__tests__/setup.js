// Test setup file for Jest
process.env.NODE_ENV = 'test';

// Mock the config first
jest.mock('../config.js', () => ({
  jwtSecret: 'test-secret',
  db: {
    connection: {
      host: 'localhost',
      user: 'test',
      password: 'test',
      database: 'pizza_test',
      connectTimeout: 60000,
    },
    listPerPage: 10,
  },
  factory: {
    url: 'https://test-factory.com',
    apiKey: 'test-api-key',
  },
}));

// Mock the database entirely to prevent connection issues
jest.mock('../database/database.js', () => {
  const mockDB = {
    getMenu: jest.fn(),
    addMenuItem: jest.fn(),
    addUser: jest.fn(),
    getUser: jest.fn(),
    getUsers: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    loginUser: jest.fn(),
    logoutUser: jest.fn(),
    isLoggedIn: jest.fn(),
    getOrders: jest.fn(),
    addDinerOrder: jest.fn(),
    createFranchise: jest.fn(),
    deleteFranchise: jest.fn(),
    getFranchises: jest.fn(),
    getUserFranchises: jest.fn(),
    getFranchise: jest.fn(),
    createStore: jest.fn(),
    deleteStore: jest.fn(),
  };

  const Role = {
    Admin: 'admin',
    Diner: 'diner',
    Franchisee: 'franchisee',
  };

  return { DB: mockDB, Role };
});