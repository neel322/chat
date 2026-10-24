// chat-frontend/src/entities/message/model/useMessageStore.js
import { create } from 'zustand';
import api from '../../../shared/api/axiosInstance';

export const useMessageStore = create((set, get) => ({
  messagesByRoom: {},
  // { [conversationId]: { [userId]: readAtISOString } }
  // Tracks, per OTHER participant, the latest timestamp up to which THEY have
  // read the conversation. For a 1:1 DM this map has one entry. For a group
  // it has one entry per member besides the current user.
  // A message only gets a double tick once EVERY entry in the map is
  // >= that message's created_at — i.e. everyone in the chat has seen it,
  // not just the first person to open it.
  readReceiptsByRoom: {},
  isLoading: false,

  fetchMessages: async (conversationId) => {
    if (!conversationId) return;
    const convId = String(conversationId).trim();
    set({ isLoading: true });

    try {
      const res = await api.get(`/chats/conversations/${convId}/messages`);
      const list = Array.isArray(res.data) ? res.data : res.data?.messages || [];
      // otherParticipantReads: [{ userId, readAt }, ...] — one entry per OTHER
      // participant, returned by the backend so we can restore accurate
      // double-tick state immediately after a page refresh.
      const otherParticipantReads = res.data?.otherParticipantReads || [];

      set((state) => {
        const next = {
          messagesByRoom: {
            ...state.messagesByRoom,
            [convId]: list,
          },
          isLoading: false,
        };

        // Merge the REST-provided roster with whatever live socket events we
        // may already have for this room, keeping whichever timestamp is
        // newer per user (a socket event could have arrived after this
        // fetch was kicked off but before it resolved).
        const existingMap = state.readReceiptsByRoom[convId] || {};
        const mergedMap = { ...existingMap };
        otherParticipantReads.forEach(({ userId, readAt }) => {
          if (!userId || !readAt) return;
          const key = String(userId);
          const existingReadAt = mergedMap[key];
          if (!existingReadAt || new Date(readAt) > new Date(existingReadAt)) {
            mergedMap[key] = readAt;
          }
        });

        next.readReceiptsByRoom = {
          ...state.readReceiptsByRoom,
          [convId]: mergedMap,
        };

        return next;
      });
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      set({ isLoading: false });
    }
  },

  appendMessage: (conversationId, message) => {
    if (!conversationId || !message) return;
    const convId = String(conversationId).trim();

    set((state) => {
      const existing = state.messagesByRoom[convId] || [];

      // Avoid duplicate by exact ID
      if (existing.some((m) => String(m.id) === String(message.id))) {
        return state;
      }

      // Check if this confirms an existing optimistic temporary message
      const tempIndex = existing.findIndex(
        (m) =>
          String(m.id).startsWith('temp_') &&
          m.content === message.content &&
          String(m.sender_id) === String(message.sender_id)
      );

      let updatedList;
      if (tempIndex !== -1 && !String(message.id).startsWith('temp_')) {
        updatedList = [...existing];
        updatedList[tempIndex] = message;
      } else {
        updatedList = [...existing, message];
      }

      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [convId]: updatedList,
        },
      };
    });
  },

  // Called when ANOTHER participant reads the conversation.
  // readAt is the ISO timestamp up to which THAT user has read messages.
  // Stored per-user so a group only shows "seen by all" once every member's
  // entry clears a given message's timestamp.
  setReadReceipt: (conversationId, userId, readAt) => {
    if (!conversationId || !userId || !readAt) return;
    const convId = String(conversationId).trim();
    const userKey = String(userId);

    set((state) => {
      const existingMap = state.readReceiptsByRoom[convId] || {};
      const existingReadAt = existingMap[userKey];
      // Only update if this readAt is newer than what we already have for this user
      if (existingReadAt && new Date(existingReadAt) >= new Date(readAt)) {
        return state;
      }
      return {
        readReceiptsByRoom: {
          ...state.readReceiptsByRoom,
          [convId]: {
            ...existingMap,
            [userKey]: readAt,
          },
        },
      };
    });
  },
}));

if (typeof window !== 'undefined') {
  window.useMessageStore = useMessageStore;
}