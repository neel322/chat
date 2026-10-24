// chat-frontend/src/pages/chat/ui/ChatPage.jsx
import React, { useState, useEffect } from 'react';
import { ChatSidebar } from '../../../widgets/sidebar/ui/ChatSidebar';
import { ChatRoom } from '../../../widgets/chat-room/ui/ChatRoom';
import { NewChatModal } from '../../../features/create-conversation/ui/NewChatModal';
import { EditProfileModal } from '../../../features/edit-profile/ui/EditProfileModal';
import { GroupInfoModal } from '../../../features/group-info/ui/GroupInfoModal';
import { useConversationStore } from '../../../entities/conversation/model/useConversationStore';
import { useAuthStore } from '../../../entities/user/model/useAuthStore';

export function ChatPage() {
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const currentUser = useAuthStore((state) => state.user);
  const fetchConversations = useConversationStore((state) => state.fetchConversations);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Close group info automatically when the active conversation changes
  useEffect(() => {
    setGroupInfoOpen(false);
  }, [activeConversationId]);

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    const clean = name.trim().replace(/^@+/, '');
    if (!clean) return 'U';
    const words = clean.split(/[._\s-]+/).filter(Boolean);
    if (words.length >= 2 && words[0]?.[0] && words[1]?.[0]) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    if (clean.length >= 2) return clean.slice(0, 2).toUpperCase();
    return clean[0].toUpperCase();
  };

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-[#090d16] text-[#e2e8f0] overflow-hidden select-none">
      
      {/* Top Shell Header */}
      <header className="h-14 bg-[#060910]/95 backdrop-blur-xl shrink-0 z-40 border-b border-white/[0.08] px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.35)] text-white">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
          </div>
          <span className="font-bold text-base tracking-tight text-white hidden sm:inline">PulseChat</span>

          <div className="h-4 w-px bg-white/[0.08] hidden sm:block"></div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0e1320] border border-cyan-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
            </span>
            <span className="text-[11px] text-cyan-300 font-medium">Socket Live</span>
          </div>
        </div>

        {/* Right User Avatar */}
        <div className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] transition-colors">
          <div className="relative flex items-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center ring-1 ring-white/20 shadow-sm uppercase">
              {getInitials(currentUser?.username)}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#060910]"></span>
          </div>
          <span className="text-xs font-semibold text-white hidden sm:inline">{currentUser?.username}</span>
          </div>
      </header>

      {/* Main Responsive Body Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Sidebar Container: visible on desktop, or mobile when NO chat active */}
        <div
          className={`${
            activeConversationId ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 h-full shrink-0 flex-col border-r border-white/[0.06]`}
        >
          <ChatSidebar onOpenNewChat={() => setNewChatOpen(true)} />
        </div>

        {/* Chat Room Container: visible on desktop, or mobile when chat IS active */}
        <div
          className={`${
            !activeConversationId ? 'hidden md:flex' : 'flex'
          } flex-1 h-full min-h-0 flex-col overflow-hidden`}
        >
          <ChatRoom
            onBack={() => setActiveConversation(null)}
            onOpenGroupInfo={() => setGroupInfoOpen(true)}
          />
        </div>
      </div>

      <NewChatModal
        isOpen={newChatOpen}
        onClose={() => setNewChatOpen(false)}
      />

      <EditProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      {/* Group Info Modal — receives the active conversation ID directly */}
      <GroupInfoModal
        isOpen={groupInfoOpen}
        onClose={() => setGroupInfoOpen(false)}
        conversationId={activeConversationId}
      />
    </div>
  );
}
