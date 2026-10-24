import React, { useState, useEffect, useRef } from 'react';
import { useConversationStore } from '../../../entities/conversation/model/useConversationStore';
import { useAuthStore } from '../../../entities/user/model/useAuthStore';
import { usePresenceStore } from '../../../entities/user/model/usePresenceStore';
import { EditProfileModal } from '../../../features/edit-profile/ui/EditProfileModal';
import { primeAudio } from '../../../shared/lib/notifications';

export const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'U';
  const clean = name.trim().replace(/^@+/, '');
  if (!clean) return 'U';
  const words = clean.split(/[._\s-]+/).filter(Boolean);
  if (words.length >= 2 && words[0]?.[0] && words[1]?.[0]) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return clean[0].toUpperCase();
};

export const ChatSidebar = ({ onOpenNewChat }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);
  const popoverRef = useRef(null);
  const conversations = useConversationStore((state) => state.conversations) || [];
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds) || [];
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isUserPopoverOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsUserPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserPopoverOpen]);

  const filteredConversations = conversations.filter((item) => {
    if (!item) return false;
    const title = item.is_group
      ? item.title || 'Group'
      : item.direct_recipient?.username || 'User';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <aside className="w-full md:w-80 h-full flex flex-col bg-[#090d16] border-r border-white/[0.06] select-none">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-white font-mono uppercase">PulseChat</h1>
            <p className="text-[10px] text-slate-400 font-mono">NODE_ONLINE</p>
          </div>
        </div>

        <button
          onClick={onOpenNewChat}
          className="p-2 rounded-lg bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 text-slate-300 border border-white/[0.06] transition-colors"
          title="New Conversation"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-white/[0.04]">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-[16px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search channels & DMs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#0d1322] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02]">
        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 font-mono">
            No active conversations
          </div>
        ) : (
          filteredConversations.map((item) => {
            if (!item) return null;

            const isGroup = Boolean(item.is_group);
            const otherUserId = item.direct_recipient?.id;
            const isOnline = !isGroup && otherUserId && onlineUserIds.includes(String(otherUserId));

            const displayName = isGroup
              ? item.title || 'Untitled Group'
              : item.direct_recipient?.username || 'User';

            const isActive = String(activeConversationId) === String(item.id);

            return (
              <div
                key={item.id}
                onClick={() => { primeAudio(); setActiveConversation(item.id); }}
                className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 border-l-2 border-cyan-400'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                {/* Avatar with dynamic presence indicator */}
                <div className="relative shrink-0">
                  <div
                    className={`w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center ring-1 ${
                      isGroup
                        ? 'bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-300 ring-indigo-500/30'
                        : 'bg-gradient-to-tr from-cyan-600 to-teal-500 text-slate-950 ring-cyan-400/40'
                    }`}
                  >
                    {isGroup ? (
                      <span className="material-symbols-outlined text-[18px]">terminal</span>
                    ) : (
                      getInitials(displayName)
                    )}
                  </div>

                  {isOnline && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#090d16]"
                      title="Online"
                    />
                  )}
                </div>

                {/* Conversation Meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-white truncate font-mono">
                      {isGroup ? `# ${displayName}` : displayName}
                    </span>
                    {item.last_message?.created_at && (
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {new Date(item.last_message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.last_message?.content || (
                        <span className="italic text-slate-600">No messages yet</span>
                      )}
                    </p>

                    {Number(item.unread_count) > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 bg-cyan-400 text-slate-950 text-[10px] font-bold rounded-full font-mono">
                        {item.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer: click to open user profile popover */}
      <div className="relative p-3 border-t border-white/[0.06] shrink-0" ref={popoverRef}>
        {/* User Profile Popover */}
        {isUserPopoverOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 z-50 bg-[#0e1320] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
            {/* User Info Card */}
            <div className="p-3">
              <div className="flex items-center gap-3 p-3 bg-[#111726] rounded-xl border border-white/[0.08]">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white text-sm font-bold flex items-center justify-center ring-1 ring-white/20 shadow-sm uppercase shrink-0">
                  {getInitials(currentUser?.username)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-100 truncate">{currentUser?.username}</p>
                  <p className="text-[10px] font-mono text-slate-400 truncate">{currentUser?.email}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-3 pb-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsUserPopoverOpen(false);
                  setIsProfileOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 text-slate-300 border border-white/[0.06] transition-colors text-[12px] font-semibold"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit Profile
              </button>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#111726] hover:bg-rose-500/15 text-rose-400 border border-white/[0.08] transition-colors text-[12px] font-semibold"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Log Out
              </button>
            </div>
          </div>
        )}

        {/* Footer Trigger Button */}
        <button
          type="button"
          onClick={() => setIsUserPopoverOpen((prev) => !prev)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors group"
          title="Profile & Settings"
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center ring-1 ring-white/20 shadow-sm uppercase">
              {getInitials(currentUser?.username)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#090d16]" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-semibold text-white truncate">{currentUser?.username || 'You'}</p>
            <p className="text-[10px] text-slate-400 font-mono truncate">{currentUser?.email}</p>
          </div>
          <span
            className={`material-symbols-outlined text-[16px] text-slate-500 group-hover:text-slate-300 transition-all duration-150 ${
              isUserPopoverOpen ? 'rotate-180 text-cyan-400' : ''
            }`}
          >
            expand_less
          </span>
        </button>
      </div>

      <EditProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </aside>
  );
};