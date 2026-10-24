// chat-frontend/src/app/providers/SocketProvider.jsx
import React, { createContext, useContext, useEffect } from 'react';
import { socket } from '../../shared/api/socket';
import { useAuthStore } from '../../entities/user/model/useAuthStore';
import { useMessageStore } from '../../entities/message/model/useMessageStore';
import { useConversationStore } from '../../entities/conversation/model/useConversationStore';
import { usePresenceStore } from '../../entities/user/model/usePresenceStore';
import {
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
  unlockAudioOnFirstInteraction,
} from '../../shared/lib/notifications';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) {
      if (socket.connected) {
        socket.disconnect();
      }
      return;
    }

    // 1. Authenticate and connect socket if disconnected
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }

    // Ask for OS-level notification permission once we know the user is logged in
    requestNotificationPermission();

    // Unlock the Web Audio context on the user's first tap/click so the
    // notification chime can actually play on mobile browsers later.
    unlockAudioOnFirstInteraction();

    // 2. Clear any lingering listeners first to guarantee single binding
    socket.off('connect');
    socket.off('message:new');
    socket.off('message:read_receipt');
    socket.off('presence:sync');
    socket.off('presence:online');
    socket.off('presence:offline');
    socket.off('conversation:updated');

    // 2b. Re-join whatever conversation room is currently open every time the
    // socket (re)connects. Without this, a dropped/renegotiated connection
    // (network blip, tab sleep, backend restart, etc.) silently loses room
    // membership server-side, so the recipient stops receiving live
    // "message:new" events for the open chat until they refresh the page.
    const handleConnect = () => {
      const activeConvoId = useConversationStore.getState().activeConversationId;
      if (activeConvoId) {
        socket.emit('chat:join', { conversationId: activeConvoId });
        socket.emit('message:read', { conversationId: activeConvoId });
      }
    };

    // 3. Incoming real-time message handler
    const handleNewMessage = (incomingMessage) => {
      const convoId = String(
        incomingMessage.conversation_id || incomingMessage.conversationId || ''
      ).trim();

      if (!convoId) return;

      const normalizedMessage = {
        ...incomingMessage,
        conversation_id: convoId,
        sender_id: incomingMessage.sender_id || incomingMessage.sender?.id,
      };

      // Append into message timeline
      useMessageStore.getState().appendMessage(convoId, normalizedMessage);

      // Inspect active room & sender dynamically to avoid stale closures
      const activeConvoId = String(
        useConversationStore.getState().activeConversationId || ''
      ).trim();
      const currentLoggedInUser = useAuthStore.getState().user;
      const senderId = String(normalizedMessage.sender_id || '');
      const isCurrentSender = currentLoggedInUser && String(currentLoggedInUser.id) === senderId;

      if (activeConvoId === convoId) {
        // Message arrived in the OPEN conversation — keep read state fresh on server
        if (!isCurrentSender && socket.connected) {
          socket.emit('message:read', { conversationId: convoId });
        }
      } else if (!isCurrentSender) {
        // Message arrived in a DIFFERENT conversation — alert the user
        useConversationStore.getState().incrementUnreadCount(convoId);
        playNotificationSound();
        const senderName = normalizedMessage.sender?.username || 'New message';
        showBrowserNotification(
          senderName,
          normalizedMessage.content || 'Sent an attachment',
          () => useConversationStore.getState().setActiveConversation(convoId)
        );
      }

      // Refresh sidebar metadata (fetchConversations will zero active convo's count)
      useConversationStore.getState().fetchConversations();
    };


    // 4. Presence listeners
    const handlePresenceSync = (onlineUserIds) => {
      if (usePresenceStore.getState().setOnlineUsers) {
        usePresenceStore.getState().setOnlineUsers(onlineUserIds);
      }
    };

    const handleUserOnline = (userId) => {
      if (usePresenceStore.getState().addUser) {
        usePresenceStore.getState().addUser(userId);
      }
    };

    const handleUserOffline = (userId) => {
      if (usePresenceStore.getState().removeUser) {
        usePresenceStore.getState().removeUser(userId);
      }
    };

    const handleConversationUpdated = () => {
      useConversationStore.getState().fetchConversations();
    };

    // 5. Read receipt — another participant opened/read the conversation.
    // readAt is the timestamp up to which THEY have read messages.
    const handleReadReceipt = ({ conversationId, userId, readAt }) => {
      if (!conversationId || !userId || !readAt) return;
      useMessageStore.getState().setReadReceipt(conversationId, userId, readAt);
    };

    // Bind listeners
    socket.on('connect', handleConnect);
    socket.on('message:new', handleNewMessage);
    socket.on('message:read_receipt', handleReadReceipt);
    socket.on('presence:sync', handlePresenceSync);
    socket.on('presence:online', handleUserOnline);
    socket.on('presence:offline', handleUserOffline);
    socket.on('conversation:updated', handleConversationUpdated);

    // Cover the case where this effect runs after the socket already
    // finished connecting (e.g. fast reload) and 'connect' won't fire again.
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('message:new', handleNewMessage);
      socket.off('message:read_receipt', handleReadReceipt);
      socket.off('presence:sync', handlePresenceSync);
      socket.off('presence:online', handleUserOnline);
      socket.off('presence:offline', handleUserOffline);
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};