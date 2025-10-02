const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../routes/user/auth"); // Re-use auth middleware
const authorizeAdmin = require("../../middleware/authorizeAdmin");
const adminController = require("../../controllers/adminController");
const { body, validationResult } = require("express-validator");

// Apply authentication and admin authorization to all admin routes
router.use(authenticateToken);
router.use(authorizeAdmin);

// Get all users
router.get("/users", adminController.getAllUsers);

// Get user by ID
router.get("/users/:id", adminController.getUserById);

// Create a new user (by admin)
router.post(
  "/users",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("name").notEmpty().trim(),
    body("role").optional().isIn(['user', 'admin']),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  adminController.createUser
);

// Update user (by admin)
router.put(
  "/users/:id",
  [
    body("name").optional().notEmpty().trim(),
    body("email").optional().isEmail().normalizeEmail(),
    body("role").optional().isIn(['user', 'admin']),
    body("password").optional().isLength({ min: 6 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  adminController.updateUser
);

// Delete user (by admin)
router.delete("/users/:id", adminController.deleteUser);

module.exports = router;
