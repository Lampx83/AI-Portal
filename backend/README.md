# Backend API Server

Backend API server for AI Portal, built with Express.js and TypeScript.

## Structure

```
backend/
├── src/
│   ├── lib/              # Shared libraries
│   │   ├── db.ts         # Database connection pool
│   │   ├── config.ts     # Configuration
│   │   └── orchestrator/ # Agent client utilities
│   ├── routes/           # API routes
│   │   ├── chat.ts       # Chat sessions & messages
│   │   ├── orchestrator.ts # AI orchestrator
│   │   ├── agents.ts     # Agent proxies
│   │   └── upload.ts     # File upload
│   └── server.ts         # Express server entry point
├── package.json
├── tsconfig.json
└── Dockerfile
```

## API Endpoints

### Chat
- `GET /api/chat/sessions` - List sessions
- `POST /api/chat/sessions` - Create new session
- `GET /api/chat/sessions/:sessionId/messages` - Get session messages
- `POST /api/chat/sessions/:sessionId/messages` - Add message
- `POST /api/chat/sessions/:sessionId/send` - Send message and call AI
- `GET /api/chat/messages/:messageId` - Get message details

### Orchestrator
- `POST /api/orchestrator/v1/ask` - Call AI orchestrator

### Agents
- `GET /api/agents/experts` - Proxy to experts agent
- `GET /api/agents/documents` - Proxy to documents agent
- `GET /api/agents/review` - Proxy to review agent

### Upload
- `POST /api/upload` - Upload files to S3/MinIO

### Health
- `GET /health` - Health check endpoint

## Setup

### Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` from `.env.example` at root:
```bash
cp ../.env.example ../.env
```

3. Update environment variables in root `.env`

4. Run development server:
```bash
npm run dev
```

Server runs at `http://localhost:3001`

### Production

Build and run:
```bash
npm run build
npm start
```

Or use Docker:
```bash
docker build -t ai-portal-backend .
docker run -p 3001:3001 --env-file .env ai-portal-backend
```

## Environment Variables

See `.env.example` at the root directory for the full list of required environment variables.

## Database

The backend uses PostgreSQL. Schema is defined in `schema.sql` (in the backend directory).

## CORS

CORS is configured to allow requests from the frontend. Update `CORS_ORIGIN` in `.env` to change the allowed origin.
