// Mock database for testing
const Role = {
  Admin: 'admin',
  Diner: 'diner',
  Franchisee: 'franchisee',
};

const DB = {
  addUser: jest.fn(),
  getUser: jest.fn(),
  getUsers: jest.fn(),
  loginUser: jest.fn(),
  logoutUser: jest.fn(),
  isLoggedIn: jest.fn(),
  getMenu: jest.fn(),
  addMenuItem: jest.fn(),
  getOrders: jest.fn(),
  addDinerOrder: jest.fn(),
  createFranchise: jest.fn(),
  deleteFranchise: jest.fn(),
  getFranchises: jest.fn(),
  getUserFranchises: jest.fn(),
  getFranchise: jest.fn(),
  createStore: jest.fn(),
  deleteStore: jest.fn(),
  updateUser: jest.fn(),
};

module.exports = { DB, Role };