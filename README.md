# ⚡ PulseChat

> **Next-generation real-time direct messaging and group communication web application.**  
> *Developed as an engineering task during an internship.*

PulseChat is a full-stack, low-latency chat application featuring 1-on-1 direct conversations, multi-user channels with role-based administration, in-stream immutable system broadcasts, rich media file sharing, and a modern cyberpunk dark-slate interface.

---

## 📌 Internship Context
This project was designed and built as an internship engineering project task to demonstrate mastery of:
- Building scalable, low-latency real-time communication systems using **WebSockets (Socket.io)**.
- Secure authentication architectures using **JWT** and **bcryptjs**.
- Relational schema modeling and transactional integrity using **PostgreSQL**.
- Reactive client-side state management using **Zustand** in **React**.
- Media asset pipelines integrating **Multer** and **Cloudinary**.

---

## ✨ Key Features

- **Real-Time Messaging:** Sub-10ms event dispatch powered by **Socket.io** room multiplexing.
- **1-on-1 Direct Messaging & Group Channels:** Seamlessly start direct conversations or create multi-tenant channels.
- **Role-Based Group Governance:** 
  - Admin privileges to rename channels, invite members, or remove participants.
  - **Automated Random Admin Succession:** If the sole admin leaves a group, the backend randomly selects and promotes a remaining member via PostgreSQL (`ORDER BY RANDOM() LIMIT 1`).
- **In-Stream Centered System Broadcasts:**
  - Non-deletable, centered event pills directly in the timeline (joins, leaves, name updates, role promotions).
  - Preserved permanently across navigations using SQL `LEFT JOIN` queries.
  - Excluded from false unread badge counter increments.
- **Rich Media Attachments:** Direct photo and video uploads integrated via **Multer** and remote CDN storage (**Cloudinary**).
- **Security & Strict Input Validation:**
  - Case-insensitive unique handle validation (`^[a-zA-Z0-9_-]{3,20}$`).
  - Standard email format checks and secure password hashing using **bcryptjs** (8+ chars, uppercase, lowercase, number).
  - JWT token authentication for REST endpoints and WebSocket handshakes.
  - PostgreSQL schema strictly bound to UUID identifiers.
- **Cross-Platform Responsive UI:**
  - Cyberpunk/Dark-Slate aesthetic with cyan and indigo accents.
  - Responsive layout toggle: side-by-side desktop layout and clean single-column mobile view with back-navigation.
  - Screen-safe modals (`max-h-[85vh]`, `overflow-y-auto`) to prevent layout clipping.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18 (Vite)
- **Styling:** Tailwind CSS, Google Material Symbols & Geist / Space Grotesk fonts
- **State Management:** Zustand (`useAuthStore`, `useConversationStore`, `useMessageStore`, `usePresenceStore`)
- **Real-Time Client:** Socket.io-client
- **HTTP Client:** Axios (configured with base URL and JWT interceptors)

### Backend
- **Runtime:** Node.js & Express.js
- **Real-Time Engine:** Socket.io (WebSocket)
- **Database:** PostgreSQL (hosted on Supabase / PostgreSQL Pooler)
- **Database Driver:** `pg` (node-postgres connection pool with SSL enabled)
- **Authentication:** JSON Web Tokens (JWT) & bcryptjs
- **Media Uploads:** Multer & Cloudinary CDN

---

## 📂 Project Structure

```text
chat/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                 # pg Pool connection with SSL configuration
│   │   │   └── cloudinary.js         # Cloudinary & Multer configuration
│   │   ├── controllers/
│   │   │   ├── authController.js     # User registration, login, and profile updates
│   │   │   └── chatController.js     # DMs, groups, system broadcasts, and history
│   │   ├── middleware/
│   │   │   └── authMiddleware.js     # Bearer JWT verification
│   │   ├── routes/
│   │   │   ├── authRoutes.js         # Authentication endpoints
│   │   │   └── chatRoutes.js         # Chat and member management endpoints
│   │   ├── sockets/
│   │   │   └── chatHandler.js        # Socket.io room joins, message dispatches
│   │   ├── utils/
│   │   │   └── validators.js         # Regex and input format validators
│   │   ├── app.js                    # Express application configuration
│   │   └── server.js                 # HTTP + Socket.io server entry point
│   ├── schema.sql                    # PostgreSQL schema definition
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── providers/
    │   │   │   └── SocketProvider.jsx # Global WebSocket provider
    │   │   └── App.jsx               # Conditional auth / dashboard routing
    │   ├── entities/
    │   │   ├── conversation/model/   # useConversationStore.js
    │   │   ├── message/model/        # useMessageStore.js
    │   │   └── user/model/           # useAuthStore.js, usePresenceStore.js
    │   ├── features/
    │   │   ├── create-conversation/  # NewChatModal.jsx (DMs & new groups)
    │   │   ├── group-info/           # GroupInfoModal.jsx (Settings, members, admin actions)
    │   │   └── send-message/         # MessageInput.jsx (Text & media attachments)
    │   ├── pages/
    │   │   ├── auth/ui/              # AuthPage.jsx (Terminal-styled login/signup)
    │   │   └── chat/ui/              # ChatPage.jsx (Responsive main layout)
    │   ├── shared/api/               # Axios instance and Socket client instances
    │   ├── widgets/
    │   │   ├── chat-room/ui/         # ChatRoom.jsx (Message timeline & system badges)
    │   │   └── sidebar/ui/           # ChatSidebar.jsx (Search & conversation feed)
    │   └── index.css                 # Base resets, typography, and dark-theme variables
    ├── index.html
    ├── tailwind.config.js
    └── package.json
```

---

## 🚀 Getting Started

### 1. Database Setup
1. Create a PostgreSQL database (e.g. on [Supabase](https://supabase.com)).
2. Execute the queries inside `backend/schema.sql` using your SQL Editor.

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Fill in your database URL, JWT secret, and Cloudinary credentials in .env
npm install
npm run dev
```
The backend server starts on `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The application opens on `http://localhost:5173`.

---

## 🏷️ Tags
`#internship` `#webdevelopment` `#reactjs` `#nodejs` `#expressjs` `#socketio` `#postgresql` `#supabase` `#tailwindcss` `#zustand` `#fullstack` `#realtime` `#chat`
