// chat-backend/src/sockets/index.js
const socketAuth = require('../middleware/socketAuth');
const registerChatHandler = require('./chatHandler');
const db = require('../config/db');

// In-memory registry: userId -> Set of active socket IDs
const onlineUsers = new Map();

module.exports = (io) => {
  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    const socketId = socket.id;

    // 1. Manage Multi-tab User Connections
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());

      // Update database status
      try {
        await db.query(
          'UPDATE public.users SET is_online = TRUE, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
          [userId]
        );
      } catch (err) {
        console.error('Error updating user online state:', err);
      }

      // Broadcast to all other connected clients that this user is online
      socket.broadcast.emit('presence:status', {
        userId,
        status: 'online',
        lastSeen: new Date().toISOString()
      });
    }
    onlineUsers.get(userId).add(socketId);

    // 2. Send the current roster of online users to the newly connected client
    const currentOnlineIds = Array.from(onlineUsers.keys());
    socket.emit('presence:initial', { onlineUserIds: currentOnlineIds });

    // 3. Mount chat messaging handlers
    registerChatHandler(io, socket, onlineUsers);

    // 4. Handle Disconnect
    socket.on('disconnect', async () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);

        // Only mark offline if ALL open tabs/devices for this user disconnected
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);

          const lastSeenTime = new Date().toISOString();
          try {
            await db.query(
              'UPDATE public.users SET is_online = FALSE, last_seen = $1 WHERE id = $2',
              [lastSeenTime, userId]
            );
          } catch (err) {
            console.error('Error updating user offline state:', err);
          }

          // Broadcast offline event
          io.emit('presence:status', {
            userId,
            status: 'offline',
            lastSeen: lastSeenTime
          });
        }
      }
    });
  });
};