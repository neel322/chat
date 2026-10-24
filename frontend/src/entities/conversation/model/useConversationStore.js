// chat-frontend/src/entities/conversation/model/useConversationStore.js
import { create } from 'zustand';
import api from '../../../shared/api/axiosInstance';
import { socket } from '../../../shared/api/socket';

export const useConversationStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isLoading: false,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/chats/conversations');
      let list = Array.isArray(res.data) ? res.data : res.data?.conversations || [];

      // Never let a server-side stale unread_count override what we already
      // know: if a conversation is currently open, the user has read it.
      const activeId = get().activeConversationId;
      if (activeId) {
        const cleanActiveId = String(activeId).trim();
        list = list.map((c) =>
          String(c.id).trim() === cleanActiveId ? { ...c, unread_count: 0 } : c
        );
      }

      set({ conversations: list, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      set({ conversations: [], isLoading: false });
    }
  },

  setActiveConversation: (id) => {
    const cleanId = id ? String(id).trim() : null;
    set({ activeConversationId: cleanId });

    if (cleanId) {
      // 1. Immediately zero-out unread badge locally
      set((state) => ({
        conversations: state.conversations.map((c) =>
          String(c.id).trim() === cleanId ? { ...c, unread_count: 0 } : c
        ),
      }));

      // 2. Inform backend via socket and REST to persist read timestamp
      if (socket.connected) {
        socket.emit('message:read', { conversationId: cleanId });
      }
      api.post(`/chats/conversations/${cleanId}/read`).catch(() => {});
    }
  },

  incrementUnreadCount: (conversationId) => {
    if (!conversationId) return;
    const cleanId = String(conversationId).trim();

    set((state) => ({
      conversations: state.conversations.map((c) =>
        String(c.id).trim() === cleanId
          ? { ...c, unread_count: (Number(c.unread_count) || 0) + 1 }
          : c
      ),
    }));
  },
}));

if (typeof window !== 'undefined') {
  window.useConversationStore = useConversationStore;
}