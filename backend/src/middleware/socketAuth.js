const jwt = require('jsonwebtoken');

function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return next(new Error('Authentication required'));

  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}

module.exports = socketAuth;
