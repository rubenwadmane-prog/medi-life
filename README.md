# 🩺 Arogya Backend

Express + SQLite backend for the Arogya AI Health Companion with Google OAuth.

---

## 📁 Project Structure

```
arogya-backend/
├── src/
│   ├── server.js              # Entry point
│   ├── config/
│   │   └── passport.js        # Google OAuth strategy
│   ├── db/
│   │   └── database.js        # SQLite schema & connection
│   ├── middleware/
│   │   └── auth.js            # JWT verify middleware
│   └── routes/
│       ├── auth.js            # /api/auth/*
│       ├── consultations.js   # /api/consultations/*
│       ├── ai.js              # /api/ai/analyse (Anthropic proxy)
│       └── users.js           # /api/users/*
├── public/
│   └── index.html             # Frontend (served by Express)
├── data/                      # SQLite DB stored here (auto-created)
├── .env.example               # Copy to .env and fill in
└── package.json
```

---

## 🚀 Setup (Step by Step)

### 1. Install dependencies
```bash
npm install
```

### 2. Create your `.env` file
```bash
cp .env.example .env
```

### 3. Set up Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add Authorized redirect URI:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
7. Copy **Client ID** and **Client Secret** into your `.env`

### 4. Fill in your `.env`
```env
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
JWT_SECRET=run_this_to_generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SESSION_SECRET=another_random_string
FRONTEND_URL=http://localhost:5000
```

### 5. Start the server
```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 6. Open in browser
```
http://localhost:5000
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login with email/password |
| GET  | `/api/auth/me` | Get current user (JWT required) |
| GET  | `/api/auth/google` | Initiate Google OAuth |
| GET  | `/api/auth/google/callback` | Google OAuth callback |
| POST | `/api/auth/logout` | Logout |

### Consultations (JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/consultations` | Save a consultation |
| GET    | `/api/consultations` | List all (paginated) |
| GET    | `/api/consultations/:id` | Get single with doctors |
| DELETE | `/api/consultations/:id` | Delete single |
| DELETE | `/api/consultations` | Clear all |

### AI Proxy (JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/analyse` | Analyse symptoms via Anthropic |

**Body:** `{ "symptoms": "...", "mode": "online" | "offline" }`

### Users (JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/users/profile` | Profile + stats |
| PATCH  | `/api/users/profile` | Update name |
| POST   | `/api/users/change-password` | Change password |
| DELETE | `/api/users/account` | Delete account |

### Health
```
GET /api/health
```

---

## 🔐 Authentication Flow

### Email / Password
```
Client → POST /api/auth/login → JWT token
Client stores token in localStorage
Client sends: Authorization: Bearer <token>
```

### Google OAuth
```
Client → GET /api/auth/google
→ Google consent screen
→ GET /api/auth/google/callback
→ Redirect to frontend with ?token=<jwt>
Frontend stores token, removes from URL
```

---

## 🛡️ Security Features

- Passwords hashed with **bcrypt** (12 rounds)
- **JWT** authentication (7 day expiry)
- **Helmet** security headers
- **Rate limiting**: 20 auth req/15min, 10 AI req/min
- **CORS** restricted to configured frontend URL
- SQL injection protected via **parameterized queries**
- API key never exposed to client (server-side Anthropic proxy)

---

## 🌐 Deploying to Production

### Render / Railway / Fly.io
1. Set all environment variables in dashboard
2. Set `NODE_ENV=production`
3. Set `FRONTEND_URL=https://yourdomain.com`
4. Update Google OAuth redirect URI to `https://yourdomain.com/api/auth/google/callback`
5. Deploy!

### Environment variables needed in production:
- `PORT`
- `NODE_ENV=production`
- `FRONTEND_URL`
- `JWT_SECRET`
- `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `ANTHROPIC_API_KEY`
- `DB_PATH=/data/arogya.db` (use a persistent volume)
