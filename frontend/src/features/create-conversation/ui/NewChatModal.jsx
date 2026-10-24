import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/axiosInstance';
import { useConversationStore } from '../../../entities/conversation/model/useConversationStore';

export const NewChatModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('direct');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const [groupTitle, setGroupTitle] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { fetchConversations, setActiveConversation } = useConversationStore();

  // Reset ALL state whenever the modal is closed so it opens fresh every time
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('direct');
      setSearchTerm('');
      setSearchResults([]);
      setSearching(false);
      setError(null);
      setGroupTitle('');
      setSelectedFriends([]);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Early return AFTER all hooks — safe, no Rules of Hooks violation
  if (!isOpen) return null;

  const handleSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    setError(null);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(searchTerm.trim())}`);
      setSearchResults(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleStartDirectChat = async (recipientId) => {
    try {
      setIsSubmitting(true);
      const res = await api.post('/chats/direct', { recipientId });
      await fetchConversations();
      setActiveConversation(res.data.conversationId);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start direct dispatch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSelectMember = (user) => {
    if (selectedFriends.some((f) => String(f.id) === String(user.id))) {
      setSelectedFriends(selectedFriends.filter((f) => String(f.id) !== String(user.id)));
    } else {
      setSelectedFriends([...selectedFriends, user]);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupTitle.trim()) {
      setError('Channel name is required');
      return;
    }
    // A group needs at least 2 other participants (3 total including creator)
    if (selectedFriends.length < 2) {
      setError('A group requires at least 2 other participants (3 members total)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.post('/chats/group', {
        title: groupTitle.trim(),
        participantIds: selectedFriends.map((f) => f.id),
      });

      await fetchConversations();
      if (res.data?.id) {
        setActiveConversation(res.data.id);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create channel');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#0e1320] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/[0.08]">

        {/* Header with Segmented Tabs */}
        <div className="p-4 bg-[#111726] space-y-3 border-b border-white/[0.08]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">Start Conversation</h3>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="flex p-1 bg-[#060910] rounded-xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => { setActiveTab('direct'); setError(null); setSearchResults([]); setSearchTerm(''); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all text-center ${
                activeTab === 'direct'
                  ? 'bg-[#161e30] text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Direct Message
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('group'); setError(null); setSearchResults([]); setSearchTerm(''); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all text-center ${
                activeTab === 'group'
                  ? 'bg-[#161e30] text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              New Group Channel
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {error && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">{error}</p>}

          {activeTab === 'direct' ? (
            <div className="space-y-3">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a name or @handle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-[#111726] text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3 py-2 border border-white/[0.08] focus:border-cyan-500 outline-none"
                />
                <button type="submit" disabled={searching} className="px-4 bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50">
                  Find
                </button>
              </form>

              <div className="space-y-1 max-h-48 overflow-y-auto">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-[#111726] border border-white/[0.06]">
                    <div>
                      <p className="text-xs font-semibold text-white">{u.username}</p>
                      <p className="text-[10px] font-mono text-slate-400">{u.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartDirectChat(u.id)}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-[10px] rounded-lg transition"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Channel Name</label>
                <input
                  type="text"
                  placeholder="e.g. engineering-core"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  className="w-full bg-[#111726] text-slate-100 text-xs rounded-xl px-3 py-2 border border-white/[0.08] focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Selected ({selectedFriends.length})
                </label>
                {selectedFriends.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedFriends.map((f) => (
                      <span key={f.id} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md">
                        {f.username}
                        <button type="button" onClick={() => handleToggleSelectMember(f)}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Search users to add..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                    className="flex-1 bg-[#111726] text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3 py-1.5 border border-white/[0.08] outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-3 bg-[#161e30] text-slate-200 text-xs font-bold rounded-xl border border-white/[0.08] disabled:opacity-50"
                  >
                    {searching ? '...' : 'Find'}
                  </button>
                </div>

                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {searchResults
                    .filter((u) => !selectedFriends.some((f) => String(f.id) === String(u.id)))
                    .map((u) => {
                      const isSelected = selectedFriends.some((f) => String(f.id) === String(u.id));
                      return (
                        <div
                          key={u.id}
                          onClick={() => handleToggleSelectMember(u)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                              : 'bg-[#111726] border-white/[0.06]'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-100">{u.username}</p>
                            <p className="text-[10px] font-mono text-slate-400">{u.email}</p>
                          </div>
                          <span className="material-symbols-outlined text-[16px] text-slate-400">
                            {isSelected ? 'check_box' : 'add_box'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-xl shadow-[0_0_12px_rgba(6,182,212,0.3)] transition disabled:opacity-50"
              >
                {isSubmitting ? 'Initializing Channel...' : 'Create Channel'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};