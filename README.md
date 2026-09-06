# OneWay Bot

Slimmed-down, single-business AI assistant: a bot that learns your business
(website, docs, FAQs) and chats with customers 24/7 — answering questions,
booking appointments, and capturing leads.

## What's inside

```
onewaybot/
├── frontend/          # Next.js 14 dashboard (login + dashboard only)
│   └── pages/         # login, signup, dashboard, knowledge, bookings, leads, inbox, admin
├── backend/           # Express API
│   ├── src/routes/    # chat, knowledge, bookings, leads, inbox, analytics, org, admin
│   ├── src/services/  # RAG, embeddings, Groq LLM (+ OpenRouter fallback), ingest, tools
│   └── supabase/
│       └── schema.sql # Full DB schema + RLS (run once)
└── render.yaml
```

Removed from the original project: landing pages, channels (WhatsApp/Messenger/Instagram),
agency/clients, billing/payments, widget, keep-alive, onboarding, settings page.

## Quick start

1. **Database (one-time)** — create a free project at supabase.com, open the SQL
   Editor and run `backend/supabase/schema.sql`.
2. **Backend**
   ```
   cd backend
   npm install
   cp .env.example .env   # fill in Supabase + Groq + OpenRouter keys
   npm run dev            # http://localhost:5000
   ```
3. **Frontend**
   ```
   cd frontend
   npm install
   cp .env.example .env.local  # Supabase URL/anon key + NEXT_PUBLIC_API_URL=http://localhost:5000
   npm run dev                 # http://localhost:3000
   ```

## LLM providers

- **Groq** is the primary provider (`GROQ_API_KEY`).
- **OpenRouter** is the automatic fallback (`OPENROUTER_API_KEY`) when Groq
  fails or rate-limits.

## Deployment

| Piece    | Platform | Root dir |
|----------|----------|----------|
| Frontend | Vercel   | `frontend` |
| Backend  | Render   | `backend`  |
| Database | Supabase | —          |

After deploying, set the backend `CORS_ORIGINS` to include your Vercel URL.
