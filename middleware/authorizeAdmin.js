const authorizeAdmin = (req, res, next) => {
  // req.user should be populated by authenticateToken middleware
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};

module.exports = authorizeAdmin;
