// chat-frontend/src/app/App.jsx
import React from 'react';
import { useAuthStore } from '../entities/user/model/useAuthStore';
import { AuthPage } from '../pages/auth/ui/AuthPage';
import { ChatPage } from '../pages/chat/ui/ChatPage';
import { SocketProvider } from './providers/SocketProvider';

export default function App() {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <AuthPage />;
  }

  return (
    <SocketProvider>
      <ChatPage />
    </SocketProvider>
  );
}