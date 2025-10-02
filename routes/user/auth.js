const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const User = require("../../models/User"); // Import the User model
const audit = require("../../middleware/auditMiddleware"); // Import audit middleware

// Middleware untuk verifikasi JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    // Fetch user from DB to get the latest role and other info
    const fullUser = await User.findById(user.id);
    if (!fullUser) {
      return res.status(404).json({ error: "User not found" });
    }
    req.user = fullUser; // Attach full user object including role
    next();
  });
};

// Register user
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("name").notEmpty().trim(),
  ],
  audit("register", "user", null, (req) => ({ email: req.body.email })),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user (default role is 'user')
      const user = await User.create(email, passwordHash, name, 'user');

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role, // Include role in JWT
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Login user
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  audit("login", "user", (req, res, body) => body.user ? body.user.id : null, (req) => ({ email: req.body.email })),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash
      );
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role, // Include role in JWT
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get current user profile
router.get("/me", authenticateToken, async (req, res) => {
  try {
    // req.user is already populated by authenticateToken with full user object
    const user = req.user;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Remove sensitive data before sending
    const { password_hash, ...userWithoutHash } = user;
    res.json({ user: userWithoutHash });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user profile
router.put(
  "/profile",
  authenticateToken,
  [
    body("name").optional().notEmpty().trim(),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  audit("update_profile", "user", (req) => req.user.id, (req) => ({ updatedFields: Object.keys(req.body) })),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email } = req.body;
      const userId = req.user.id;
      const updates = {};

      if (name) {
        updates.name = name;
      }
      if (email) {
        // Check if email already exists for another user
        const existingUser = await User.findByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({ error: "Email already exists" });
        }
        updates.email = email;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const updatedUser = await User.update(userId, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove sensitive data before sending
      const { password_hash, ...userWithoutHash } = updatedUser;
      res.json({ user: userWithoutHash });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Change password
router.put(
  "/change-password",
  authenticateToken,
  [
    body("currentPassword").notEmpty(),
    body("newPassword").isLength({ min: 6 }),
  ],
  audit("change_password", "user", (req) => req.user.id),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get current password hash
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password_hash
      );
      if (!isValidPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await User.updatePassword(userId, newPasswordHash);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
module.exports.authenticateToken = authenticateToken;
