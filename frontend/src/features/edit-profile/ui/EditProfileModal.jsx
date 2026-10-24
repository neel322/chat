// chat-frontend/src/features/edit-profile/ui/EditProfileModal.jsx
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../entities/user/model/useAuthStore';

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

export const EditProfileModal = ({ isOpen, onClose }) => {
  const currentUser = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      setUsername(currentUser.username || '');
      setEmail(currentUser.email || '');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) {
      setError('Username and email are required');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    const ok = await updateProfile(username.trim(), email.trim());

    setIsSaving(false);
    if (ok) {
      setSuccess(true);
    } else {
      setError(useAuthStore.getState().error || 'Failed to update profile');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#0e1320] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/[0.08]">
        {/* Header */}
        <div className="p-4 flex items-center justify-between bg-[#111726] border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-[22px]">account_circle</span>
            <h3 className="font-bold text-slate-100 text-sm">Edit Profile</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#161e30] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4">
          {/* Avatar preview */}
          <div className="flex items-center gap-3 p-3 bg-[#111726] rounded-xl border border-white/[0.08]">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white text-sm font-bold flex items-center justify-center ring-1 ring-white/20 shadow-sm uppercase shrink-0">
              {getInitials(username || currentUser?.username)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-100 truncate">{currentUser?.username}</p>
              <p className="text-[10px] font-mono text-slate-400 truncate">{currentUser?.email}</p>
            </div>
          </div>

          {/* Username field */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#060910] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/60"
              placeholder="Your username"
            />
          </div>

          {/* Email field */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#060910] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/60"
              placeholder="you@example.com"
            />
          </div>

          {error && <p className="text-[11px] text-rose-400">{error}</p>}
          {success && <p className="text-[11px] text-emerald-400">Profile updated successfully.</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-[#161e30] hover:bg-[#1d2740] text-slate-300 text-xs font-semibold border border-white/[0.08] transition-colors"
            >
              Cancel
            </button>
          </div>

          </form>
      </div>
    </div>
  );
};