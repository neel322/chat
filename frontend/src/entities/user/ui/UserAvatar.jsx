// chat-frontend/src/entities/user/ui/UserAvatar.jsx
import React from 'react';
import { usePresenceStore } from '../model/usePresenceStore';

export const UserAvatar = ({ user, size = 'md', isGroup = false }) => {
  const isOnline = usePresenceStore((state) => state.isUserOnline(user?.id));

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  }[size];

  const dotSize = {
    sm: 'w-2 h-2 ring-1',
    md: 'w-3 h-3 ring-2',
    lg: 'w-3.5 h-3.5 ring-2'
  }[size];

  return (
    <div className="relative inline-block shrink-0">
      {user?.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.username || 'User'}
          className={`${sizeClasses} rounded-full object-cover border border-slate-200`}
        />
      ) : (
        <div className={`${sizeClasses} rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center uppercase shadow-sm`}>
          {user?.username?.[0] || 'U'}
        </div>
      )}

      {/* Show presence indicator badge for 1-to-1 users */}
      {!isGroup && (
        <span
          className={`absolute bottom-0 right-0 ${dotSize} rounded-full ring-white ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};