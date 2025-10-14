const request = require("supertest");
const app = require("../service.js");
const jwt = require("jsonwebtoken");
const { DB } = require("../database/database.js");

describe("User Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/user/me", () => {
    test("should return user info when authenticated", async () => {
      const user = {
        id: 1,
        name: "Test User",
        email: "test@test.com",
        roles: [{ role: "diner" }],
      };
      const token = jwt.sign(user, "test-secret");

      DB.isLoggedIn.mockResolvedValue(true);

      const response = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe("Test User");
    });

    test("should return 401 when not authenticated", async () => {
      const response = await request(app).get("/api/user/me");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("unauthorized");
    });

    test("should return 401 with invalid token", async () => {
      DB.isLoggedIn.mockResolvedValue(false);

      const response = await request(app)
        .get("/api/user/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /api/user/:userId", () => {
    test("should allow user to update their own profile", async () => {
      const user = {
        id: 1,
        name: "Test User",
        email: "test@test.com",
        roles: [{ role: "diner" }],
        isRole: jest.fn(() => false),
      };
      const token = jwt.sign(user, "test-secret");

      const updatedUser = { ...user, name: "Updated Name" };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.updateUser.mockResolvedValue(updatedUser);
      DB.loginUser.mockResolvedValue();

      const response = await request(app)
        .put("/api/user/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Updated Name",
          email: "test@test.com",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
    });

    test("should allow admin to update any user", async () => {
      const adminUser = {
        id: 2,
        name: "Admin User",
        email: "admin@test.com",
        roles: [{ role: "admin" }],
        isRole: jest.fn((role) => role === "admin"),
      };
      const token = jwt.sign(adminUser, "test-secret");

      const updatedUser = {
        id: 1,
        name: "Updated User",
        email: "user@test.com",
        roles: [{ role: "diner" }],
      };

      DB.isLoggedIn.mockResolvedValue(true);
      DB.updateUser.mockResolvedValue(updatedUser);
      DB.loginUser.mockResolvedValue();

      const response = await request(app)
        .put("/api/user/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Updated User",
          email: "user@test.com",
        });

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe("Updated User");
    });

    test("should return 403 when user tries to update another user", async () => {
      const user = {
        id: 1,
        name: "Test User",
        email: "test@test.com",
        roles: [{ role: "diner" }],
        isRole: jest.fn(() => false),
      };
      const token = jwt.sign(user, "test-secret");

      DB.isLoggedIn.mockResolvedValue(true);

      const response = await request(app)
        .put("/api/user/2")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Hacker Name",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("unauthorized");
    });

    test("should return 401 when not authenticated", async () => {
      const response = await request(app).put("/api/user/1").send({
        name: "Updated Name",
      });

      expect(response.status).toBe(401);
    });

    test("list users unauthorized", async () => {
      const listUsersRes = await request(app).get("/api/user");
      expect(listUsersRes.status).toBe(401);
    });

    test("list users", async () => {
      const mockUser = {
        id: 1,
        name: "pizza diner",
        email: "test@test.com",
        roles: [{ role: "diner" }],
      };

      // Mock the database methods
      DB.addUser.mockResolvedValue(mockUser);
      DB.loginUser.mockResolvedValue();
      DB.isLoggedIn.mockResolvedValue(true);

      const [user, userToken] = await registerUser(request(app));
      const listUsersRes = await request(app)
        .get("/api/user")
        .set("Authorization", "Bearer " + userToken);
      expect(listUsersRes.status).toBe(200);
    });

    async function registerUser(service) {
      const testUser = {
        name: "pizza diner",
        email: `${randomName()}@test.com`,
        password: "a",
      };
      const registerRes = await service.post("/api/auth").send(testUser);

      // Check if registration was successful
      if (!registerRes.body || !registerRes.body.user) {
        throw new Error(`Registration failed: ${JSON.stringify(registerRes.body)}`);
      }

      registerRes.body.user.password = testUser.password;

      return [registerRes.body.user, registerRes.body.token];
    }

    function randomName() {
      return Math.random().toString(36).substring(2, 12);
    }
  });
});
