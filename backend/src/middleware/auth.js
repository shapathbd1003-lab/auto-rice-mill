const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  const token = header.slice(7);
  req.user = jwt.verify(token, process.env.JWT_SECRET);
  next();
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    if (req.user.role === 'admin') return next();
    if (!roles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
