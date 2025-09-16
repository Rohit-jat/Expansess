const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      if (req.baseUrl.startsWith('/api')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      } else {
        return res.redirect('/login');
      }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      if (req.baseUrl.startsWith('/api')) {
        return res.status(401).json({ error: 'Invalid token.' });
      } else {
        return res.redirect('/login');
      }
    }

    req.user = user;
    next();
  } catch (err) {
    if (req.baseUrl.startsWith('/api')) {
      return res.status(400).json({ error: 'Invalid token.' });
    } else {
      return res.redirect('/login');
    }
  }
};