// chat-frontend/src/entities/user/model/usePresenceStore.js
import { create } from 'zustand';

export const usePresenceStore = create((set, get) => ({
  onlineUserIds: [],

  setOnlineUsers: (ids) => {
    if (!Array.isArray(ids)) return;
    const cleanIds = ids.map((id) => String(id).toLowerCase().trim());
    set({ onlineUserIds: Array.from(new Set(cleanIds)) });
  },

  addUser: (userId) => {
    if (!userId) return;
    const cleanId = String(userId).toLowerCase().trim();
    set((state) => {
      if (state.onlineUserIds.includes(cleanId)) return state;
      return { onlineUserIds: [...state.onlineUserIds, cleanId] };
    });
  },

  removeUser: (userId) => {
    if (!userId) return;
    const cleanId = String(userId).toLowerCase().trim();
    set((state) => ({
      onlineUserIds: state.onlineUserIds.filter((id) => id !== cleanId),
    }));
  },

  isUserOnline: (userId) => {
    if (!userId) return false;
    const cleanId = String(userId).toLowerCase().trim();
    return get().onlineUserIds.includes(cleanId);
  },
}));

// Expose to window for rapid console debugging
if (typeof window !== 'undefined') {
  window.usePresenceStore = usePresenceStore;
}