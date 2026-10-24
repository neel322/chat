// chat-frontend/src/widgets/chat-room/ui/ChatRoom.jsx
import React, { useEffect, useRef } from 'react';
import { useConversationStore } from '../../../entities/conversation/model/useConversationStore';
import { useMessageStore } from '../../../entities/message/model/useMessageStore';
import { useAuthStore } from '../../../entities/user/model/useAuthStore';
import { usePresenceStore } from '../../../entities/user/model/usePresenceStore';
import { socket } from '../../../shared/api/socket';
import { MessageInput } from '../../../features/send-message/ui/MessageInput';
import { getInitials } from '../../sidebar/ui/ChatSidebar';
import { primeAudio } from '../../../shared/lib/notifications';

export const ChatRoom = ({ onBack, onOpenGroupInfo }) => {
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const conversations = useConversationStore((state) => state.conversations) || [];
  const messagesByRoom = useMessageStore((state) => state.messagesByRoom);
  const readReceiptsByRoom = useMessageStore((state) => state.readReceiptsByRoom);
  const fetchMessages = useMessageStore((state) => state.fetchMessages);
  const currentUser = useAuthStore((state) => state.user);
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds) || [];

  const messagesEndRef = useRef(null);

  const activeChat = conversations.find(
    (c) => String(c?.id) === String(activeConversationId)
  );

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
      if (socket && socket.connected) {
        socket.emit('chat:join', { conversationId: activeConversationId });
        socket.emit('message:read', { conversationId: activeConversationId });
      }
    }
  }, [activeConversationId, fetchMessages]);

  const messages = (activeConversationId && messagesByRoom[activeConversationId]) || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeChat) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-[#070b14] text-slate-500 font-mono text-xs p-4">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3 text-slate-600">
          <span className="material-symbols-outlined text-2xl">forum</span>
        </div>
        Select a conversation from the sidebar to begin messaging.
      </div>
    );
  }

  const isGroup = Boolean(activeChat.is_group);
  const otherUserId = activeChat.direct_recipient?.id
    ? String(activeChat.direct_recipient.id).toLowerCase().trim()
    : null;

  const isRecipientOnline = Boolean(
    !isGroup &&
    otherUserId &&
    onlineUserIds.some((id) => String(id).toLowerCase().trim() === otherUserId)
  );

  const roomTitle = isGroup
    ? activeChat.title || 'Group Channel'
    : activeChat.direct_recipient?.username || 'Direct Message';

  return (
    <div className="flex-1 h-full w-full min-h-0 flex flex-col bg-[#0b101d] overflow-hidden relative">
      {/* 1. Header */}
      <header className="h-14 min-h-[56px] px-4 border-b border-white/[0.08] bg-[#070b14] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all flex items-center justify-center shrink-0"
            aria-label="Back to conversations"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>

          <div className="relative shrink-0">
            <div
              className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center ring-1 ${
                isGroup
                  ? 'bg-indigo-500/20 text-indigo-300 ring-indigo-500/30'
                  : 'bg-gradient-to-tr from-cyan-600 to-teal-500 text-slate-950 ring-cyan-400/40'
              }`}
            >
              {isGroup ? (
                <span className="material-symbols-outlined text-[16px]">terminal</span>
              ) : (
                getInitials(roomTitle)
              )}
            </div>

            {isRecipientOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#070b14]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xs font-bold text-white font-mono truncate">
              {isGroup ? `# ${roomTitle}` : roomTitle}
            </h2>
            {!isGroup ? (
              <p className="text-[10px] font-mono flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRecipientOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                <span className={isRecipientOnline ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                  {isRecipientOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </p>
            ) : (
              <p className="text-[10px] text-indigo-400 font-mono">GROUP_CHANNEL</p>
            )}
          </div>
        </div>

        {isGroup && (
          <button
            type="button"
            onClick={onOpenGroupInfo}
            className="p-1.5 rounded-lg bg-white/[0.04] text-slate-300 hover:text-cyan-400 border border-white/[0.06] transition-colors shrink-0"
            title="Channel Settings"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>
        )}
      </header>

      {/* 2. Messages List */}
      {/* onClick + onTouchStart: prime audio on any tap in the chat area.
          Covers recipients who are only reading (never type into the input). */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
        onClick={primeAudio}
        onTouchStart={primeAudio}
      >
        {messages.map((m) => {
          const isSystem = m.media_type === 'system' || !m.sender_id;
          const isMe = String(m.sender_id || m.sender?.id) === String(currentUser?.id);

          if (isSystem) {
            return (
              <div key={m.id} className="flex justify-center my-2">
                <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400 text-[10px] font-mono tracking-wide">
                  {m.content}
                </span>
              </div>
            );
          }

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              {isGroup && !isMe && (
                <span className="text-[10px] text-slate-400 font-mono mb-1 ml-1">
                  {m.sender?.username || 'Member'}
                </span>
              )}

              <div
                className={`max-w-[85%] md:max-w-[70%] px-3.5 py-2 rounded-2xl text-xs break-words shadow-sm ${
                  isMe
                    ? 'bg-cyan-500 text-slate-950 font-medium rounded-tr-none'
                    : 'bg-[#131929] border border-white/[0.06] text-slate-200 rounded-tl-none'
                }`}
              >
                {m.media_url && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-black/20">
                    {m.media_type === 'video' ? (
                      <video src={m.media_url} controls className="max-h-60 w-full" />
                    ) : (
                      <img src={m.media_url} alt="Attachment" className="max-h-60 w-full object-cover" />
                    )}
                  </div>
                )}

                {m.content && <p className="leading-relaxed">{m.content}</p>}

                {/* Timestamp + read receipt ticks (only on my messages) */}
                <div
                  className={`flex items-center gap-0.5 justify-end mt-1 text-[9px] font-mono ${
                    isMe ? 'text-slate-900/70' : 'text-slate-500'
                  }`}
                >
                  <span>
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {/* Ticks — only shown on messages I sent */}
                  {isMe && (() => {
                    // A temp message hasn't been confirmed by server yet — no tick
                    const isTemp = String(m.id).startsWith('temp_');
                    if (isTemp) return null;

                    const receiptsMap =
                      (activeConversationId && readReceiptsByRoom[String(activeConversationId).trim()]) || {};
                    const otherReadTimestamps = Object.values(receiptsMap);

                    // "Seen by everyone": every OTHER participant we have a
                    // receipt for has read up to/after this message. For a
                    // DM that's a single person; for a group it's every
                    // member — so as long as even one member hasn't caught
                    // up yet, this stays a single tick.
                    const isSeenByAll =
                      otherReadTimestamps.length > 0 &&
                      otherReadTimestamps.every(
                        (readAt) => readAt && new Date(m.created_at) <= new Date(readAt)
                      );

                    return isSeenByAll ? (
                      // Double tick — message was seen by everyone in the chat
                      <span
                        className="material-symbols-outlined text-[13px] text-cyan-200 leading-none"
                        title="Seen by everyone"
                      >
                        done_all
                      </span>
                    ) : (
                      // Single tick — message sent, not yet seen by everyone
                      <span
                        className="material-symbols-outlined text-[13px] text-slate-900/50 leading-none"
                        title="Sent"
                      >
                        done
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Pinned Input Footer */}
      <footer className="p-3 border-t border-white/[0.08] bg-[#070b14] shrink-0 z-30">
        <MessageInput conversationId={activeConversationId} />
      </footer>
    </div>
  );
};