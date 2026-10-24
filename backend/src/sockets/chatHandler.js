// chat-backend/src/sockets/chatHandler.js
const db = require('../config/db');

// Map<userIdString, Set<socketId>> to support multiple tabs/devices per user
const onlineUsers = new Map();

module.exports = function registerChatHandler(io, socket, onlineUsers) {
  const rawId = socket.user?.id || socket.user?._id;
  if (!rawId) return;

  const currentUserId = String(rawId).trim();
    // 1. Presence Registration
    if (!onlineUsers.has(currentUserId)) {
      onlineUsers.set(currentUserId, new Set());
    }
    onlineUsers.get(currentUserId).add(socket.id);

    console.log(`[Presence] Online: ${currentUserId} (${socket.user?.username})`);

    // Emit all currently active user IDs to this client
    socket.emit('presence:sync', Array.from(onlineUsers.keys()));

    // Broadcast to all other clients that this user is online
    socket.broadcast.emit('presence:online', currentUserId);

    // 2. Chat Room Join
    socket.on('chat:join', ({ conversationId }) => {
      if (!conversationId) return;
      const roomName = `conversation_${String(conversationId).trim()}`;
      socket.join(roomName);
    });

    // 3. Send Message Handler
    socket.on('message:send', async ({ conversationId, content, mediaUrl, mediaType }) => {
      try {
        if (!content && !mediaUrl) return;

        const convId = String(conversationId).trim();
        const roomName = `conversation_${convId}`;
        socket.join(roomName);

        const insertQuery = `
          INSERT INTO public.messages (conversation_id, sender_id, content, media_url, media_type)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, conversation_id, sender_id, content, media_url, media_type, created_at;
        `;
        const msgRes = await db.query(insertQuery, [
          convId,
          currentUserId,
          content || '',
          mediaUrl || null,
          mediaType || 'text'
        ]);
        const savedMessage = msgRes.rows[0];

        const userRes = await db.query(
          'SELECT id, username, avatar_url FROM public.users WHERE id::text = $1::text',
          [currentUserId]
        );

        const payload = {
          ...savedMessage,
          sender: userRes.rows[0] || { id: currentUserId, username: socket.user?.username || 'User' }
        };

        // Broadcast to everyone in the room (including sender to confirm delivery)
        io.to(roomName).emit('message:new', payload);

        // Notify other participants for sound / banner alerts
        socket.broadcast.emit('notification:new_message', {
          conversationId: convId,
          title: userRes.rows[0]?.username || 'New Message',
          body: content || 'Shared an attachment',
          playSound: true
        });
      } catch (err) {
        console.error('Socket message:send error:', err);
      }
    });

    // 4. Mark Messages Read
    socket.on('message:read', async ({ conversationId }) => {
      try {
        if (!conversationId) return;
        await db.query(
          `UPDATE public.conversation_participants
           SET last_read_at = CURRENT_TIMESTAMP
           WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
          [String(conversationId).trim(), currentUserId]
        );

        socket.to(`conversation_${conversationId}`).emit('message:read_receipt', {
          conversationId,
          userId: currentUserId,
          readAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    });

    // 5. Disconnection
    socket.on('disconnect', () => {
      if (onlineUsers.has(currentUserId)) {
        const userSockets = onlineUsers.get(currentUserId);
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          onlineUsers.delete(currentUserId);
          console.log(`[Presence] Offline: ${currentUserId}`);
          io.emit('presence:offline', currentUserId);
        }
      }
    });
}