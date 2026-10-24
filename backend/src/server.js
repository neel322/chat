// chat-backend/src/server.js
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const setupSockets = require('./sockets');

const server = http.createServer(app);

// Allow any local network origin (localhost, 127.0.0.1, and 192.168.x.x for mobile)
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

// Attach io to express app
app.set('io', io);

setupSockets(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PulseChat backend running at http://0.0.0.0:${PORT}`);
});