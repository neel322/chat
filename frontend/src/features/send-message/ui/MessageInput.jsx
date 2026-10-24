// chat-frontend/src/features/send-message/ui/MessageInput.jsx
import React, { useState, useRef } from 'react';
import api from '../../../shared/api/axiosInstance';
import { socket } from '../../../shared/api/socket';
import { useMessageStore } from '../../../entities/message/model/useMessageStore';
import { useAuthStore } from '../../../entities/user/model/useAuthStore';
import { primeAudio } from '../../../shared/lib/notifications';

export const MessageInput = ({ conversationId }) => {
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const currentUser = useAuthStore((state) => state.user);
  const appendMessage = useMessageStore((state) => state.appendMessage);

  const handleSend = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    const trimmed = content.trim();
    if ((!trimmed && !file) || isSubmitting || !conversationId) return;

    setIsSubmitting(true);

    let mediaUrl = null;
    let mediaType = 'text';

    if (file) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('media', file);
      try {
        const uploadRes = await api.post('/chats/upload', formData);
        mediaUrl = uploadRes.data.mediaUrl;
        mediaType = uploadRes.data.mediaType;
      } catch (err) {
        console.error('Attachment upload failed:', err);
        setIsUploading(false);
        setIsSubmitting(false);
        return;
      }
      setIsUploading(false);
    }

    const convId = String(conversationId).trim();
    const payload = {
      conversationId: convId,
      content: trimmed,
      mediaUrl,
      mediaType,
    };

    // Optimistic UI push
    appendMessage(convId, {
      id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: convId,
      sender_id: currentUser?.id,
      sender: {
        id: currentUser?.id,
        username: currentUser?.username,
      },
      content: trimmed,
      media_url: mediaUrl,
      media_type: mediaType,
      created_at: new Date().toISOString(),
    });

    // Send via socket with HTTP fallback
    if (socket && socket.connected) {
      socket.emit('message:send', payload);
    } else {
      console.warn('Socket disconnected. Using HTTP fallback...');
      api.post(`/chats/conversations/${convId}/messages`, payload).catch((err) => {
        console.error('HTTP send fallback failed:', err);
      });
    }

    setContent('');
    setFile(null);
    setIsSubmitting(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <form
      onSubmit={handleSend}
      className="relative flex flex-col bg-[#0e1320] rounded-2xl p-2 border border-white/[0.08] focus-within:border-cyan-500/60 focus-within:bg-[#111726] transition-all duration-200 shadow-lg w-full"
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*"
        onChange={(e) => setFile(e.target.files[0])}
      />

      {file && (
        <div className="flex items-center gap-2 p-2 bg-[#161e30] rounded-xl border border-white/[0.08] w-fit mb-2 text-xs text-slate-200">
          <span className="material-symbols-outlined text-cyan-400 text-[18px]">attachment</span>
          <span className="truncate max-w-xs">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-rose-400">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      <div className="w-full flex items-center px-2">
        <textarea
          rows={1}
          value={content}
          onChange={(e) => { primeAudio(); setContent(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message or share photos & videos..."
          className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs sm:text-sm resize-none outline-none py-1 max-h-32"
        />
      </div>

      <div className="flex items-center justify-between pt-2 px-1 border-t border-white/[0.06] mt-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-cyan-300 hover:text-white bg-[#161e30] hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">photo_library</span>
            <span className="hidden sm:inline">Photo & Video</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500 hidden md:inline">Return to send</span>
          <button
            type="submit"
            disabled={isUploading || isSubmitting || (!content.trim() && !file)}
            className="w-9 h-9 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.4)] disabled:opacity-40 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px] font-bold">arrow_upward</span>
          </button>
        </div>
      </div>
    </form>
  );
};