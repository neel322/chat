import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/axiosInstance';
import { useAuthStore } from '../../../entities/user/model/useAuthStore';
import { useConversationStore } from '../../../entities/conversation/model/useConversationStore';

export const GroupInfoModal = ({ isOpen, onClose, conversationId }) => {
  const currentUser = useAuthStore((state) => state.user);
  const { conversations, updateConversationTitle, setActiveConversation, fetchConversations } = useConversationStore();

  const [members, setMembers] = useState([]);
  const [activeMenuUserId, setActiveMenuUserId] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addError, setAddError] = useState(null);

  const activeChat = conversations.find((c) => String(c.id) === String(conversationId));
  const currentUserMember = members.find((m) => String(m.id) === String(currentUser?.id));
  const isCurrentUserAdmin = currentUserMember?.role === 'admin';

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/[._\s-]+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    if (isOpen && conversationId) {
      loadMembers();
      if (activeChat) setGroupTitle(activeChat.title || '');
      setShowAddMember(false);
      setSearchTerm('');
      setSearchResults([]);
      setAddError(null);
    }
  }, [isOpen, conversationId, activeChat?.title]);

  const loadMembers = async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      const res = await api.get(`/chats/conversations/${conversationId}/members`);
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load group members:', err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUsers = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setAddError(null);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(searchTerm.trim())}`);
      const existingMemberIds = new Set(members.map((m) => String(m.id)));
      setSearchResults(res.data.filter((u) => !existingMemberIds.has(String(u.id))));
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async (targetUserId) => {
    try {
      await api.post(`/chats/conversations/${conversationId}/members`, { newUserId: targetUserId });
      await loadMembers();
      await fetchConversations();
      setSearchResults((prev) => prev.filter((u) => String(u.id) !== String(targetUserId)));
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleSaveTitle = async () => {
    if (!groupTitle.trim()) return;
    try {
      const res = await api.patch(`/chats/conversations/${conversationId}/title`, { title: groupTitle.trim() });
      updateConversationTitle(conversationId, res.data.title);
      setIsEditingTitle(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update title');
    }
  };

  const handleMakeAdmin = async (targetUserId) => {
    try {
      await api.post(`/chats/conversations/${conversationId}/make-admin`, { targetUserId });
      await loadMembers();
      setActiveMenuUserId(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to promote');
    }
  };

  const handleKickMember = async (targetUserId) => {
    if (!confirm('Remove this member from the channel?')) return;
    try {
      await api.post(`/chats/conversations/${conversationId}/kick`, { targetUserId });
      await loadMembers();
      setActiveMenuUserId(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Leave this channel?')) return;
    try {
      await api.post(`/chats/conversations/${conversationId}/leave`);
      await fetchConversations();
      setActiveConversation(null);
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to leave channel');
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Permanently delete channel for all members?')) return;
    try {
      await api.delete(`/chats/conversations/${conversationId}`);
      await fetchConversations();
      setActiveConversation(null);
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete channel');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0e1320] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/[0.08]">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between bg-[#111726] border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-[22px]">hub</span>
            <h3 className="font-bold text-slate-100 text-sm">Channel & Group Details</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#161e30] transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* Banner */}
          <div className="flex items-center gap-3 p-3 bg-[#111726] rounded-xl border border-white/[0.08]">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center text-slate-950 font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <span className="material-symbols-outlined text-[24px]">group</span>
            </div>
            <div className="min-w-0 flex-1">
              {isEditingTitle && isCurrentUserAdmin ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    className="flex-1 bg-[#060910] border border-cyan-500/40 rounded-lg px-2 py-1 text-xs text-white"
                  />
                  <button type="button" onClick={handleSaveTitle} className="px-3 bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold">Save</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-100 text-sm">{activeChat?.title || groupTitle}</h4>
                  {isCurrentUserAdmin && (
                    <button type="button" onClick={() => setIsEditingTitle(true)} className="text-slate-400 hover:text-cyan-400 text-xs">Edit</button>
                  )}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5">{members.length} participants registered</p>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Members Roster</span>
              <button
                type="button"
                onClick={() => setShowAddMember(!showAddMember)}
                className="text-xs text-cyan-300 font-medium hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                {showAddMember ? 'Close' : 'Add Members'}
              </button>
            </div>

            {showAddMember && (
              <div className="p-3 bg-[#111726] rounded-xl border border-white/[0.08] space-y-2">
                <form onSubmit={handleSearchUsers} className="flex gap-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by handle or email..."
                    className="flex-1 bg-[#060910] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                  <button type="submit" disabled={isSearching} className="px-3 bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold disabled:opacity-50">
                    Find
                  </button>
                </form>

                {addError && <p className="text-[11px] text-rose-400">{addError}</p>}

                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {searchResults.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-2 bg-[#060910] rounded-lg">
                      <span className="text-xs text-white">{u.username}</span>
                      <button
                        type="button"
                        onClick={() => handleAddMember(u.id)}
                        className="px-2.5 py-1 bg-cyan-400 text-slate-950 text-[10px] font-bold rounded"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {loading ? (
                <p className="text-xs text-slate-500 text-center py-2">Loading roster...</p>
              ) : (
                members.map((m) => {
                  const isSelf = String(m.id) === String(currentUser?.id);
                  const isMemberAdmin = m.role === 'admin';

                  return (
                    <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#111726] border border-white/[0.06]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center">
                          {getInitials(m.username)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                            {isSelf ? 'You' : m.username}
                            {isMemberAdmin && (
                              <span className="text-[10px] px-1.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded font-medium">Admin</span>
                            )}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">{m.email}</p>
                        </div>
                      </div>

                      {!isSelf && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveMenuUserId(activeMenuUserId === m.id ? null : m.id)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </button>

                          {activeMenuUserId === m.id && (
                            <div className="absolute right-0 mt-1 w-36 bg-[#161e30] rounded-xl shadow-xl py-1 z-30 text-xs border border-white/[0.08]">
                              {isCurrentUserAdmin && (
                                <>
                                  {!isMemberAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleMakeAdmin(m.id)}
                                      className="w-full text-left px-3 py-1.5 text-cyan-300 hover:bg-[#111726]"
                                    >
                                      Make Admin
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleKickMember(m.id)}
                                    className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-[#111726]"
                                  >
                                    Remove Member
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleLeaveGroup}
              className="w-full py-2 px-4 rounded-xl bg-[#111726] hover:bg-rose-500/15 text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/[0.08]"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Leave Channel</span>
            </button>

            {isCurrentUserAdmin && (
              <button
                type="button"
                onClick={handleDeleteGroup}
                className="w-full py-2 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 border border-rose-500/30"
              >
                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                <span>Delete Channel</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};