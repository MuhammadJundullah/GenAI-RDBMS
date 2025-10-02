const User = require("../models/User");
const bcrypt = require("bcryptjs");

class AdminController {
  async getAllUsers(req, res) {
    try {
      const users = await User.getAllUsers();
      // Remove sensitive data before sending
      const usersWithoutHash = users.map(user => {
        const { password_hash, ...rest } = user;
        return rest;
      });
      res.json(usersWithoutHash);
    } catch (error) {
      console.error("Error getting all users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password_hash, ...userWithoutHash } = user;
      res.json(userWithoutHash);
    } catch (error) {
      console.error("Error getting user by ID:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, email, role, password } = req.body;

      const updates = {};
      if (name) updates.name = name;
      if (email) {
        const existingUser = await User.findByEmail(email);
        if (existingUser && existingUser.id !== parseInt(id)) {
          return res.status(409).json({ error: "Email already in use" });
        }
        updates.email = email;
      }
      if (role) updates.role = role;
      if (password) {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        updates.password_hash = await bcrypt.hash(password, saltRounds);
      }

      const updatedUser = await User.update(id, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password_hash, ...userWithoutHash } = updatedUser;
      res.json(userWithoutHash);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const deleted = await User.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async createUser(req, res) {
    try {
      const { email, password, name, role } = req.body;

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists" });
      }

      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const newUser = await User.create(email, passwordHash, name, role || 'user');
      const { password_hash, ...userWithoutHash } = newUser;
      res.status(201).json(userWithoutHash);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = new AdminController();
