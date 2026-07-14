# Supabase Setup

This is the production backend for the Row Echelon website and future iOS app.

## What It Provides

- Player account creation
- Daily leaderboard
- Server-side score calculation
- The same API paths as the local Node backend:
  - `GET /health`
  - `POST /api/accounts`
  - `GET /api/leaderboard`
  - `POST /api/complete`
  - `POST /api/session`
  - `POST /api/logout`

Player sessions expire after 30 minutes without activity. Active browser
sessions send a heartbeat every five minutes, and expired sessions release
their usernames for reuse.

The deployed API base URL is:

```text
https://fkoupqflxcwyofsbgjgw.functions.supabase.co/row-echelon-api
```

## Create The Supabase Project

1. Go to <https://supabase.com/dashboard/projects>
2. Create a new project.
3. Copy the project ref from the project URL.

Example:

```text
https://supabase.com/dashboard/project/abcdefghijklmnopqrst
```

The project ref is:

```text
abcdefghijklmnopqrst
```

## Deploy

From the repo root:

```bash
npx supabase login
npx supabase link --project-ref fkoupqflxcwyofsbgjgw
npx supabase db push
npx supabase functions deploy row-echelon-api --no-verify-jwt
```

Supabase Edge Functions provide `SUPABASE_URL` and secret API keys as environment variables automatically.

## Connect The Website

The public website now uses Supabase by default. If you ever need to force it manually, open:

```text
https://netiyiy.github.io/row-echelon/?api=https://fkoupqflxcwyofsbgjgw.functions.supabase.co/row-echelon-api
```

The website saves that API URL in `localStorage`, so future visits use it automatically.

## Scoring

The backend calculates score. The browser/iPhone does not decide the final score.

```text
Score = max(0, A * L^P - B * S - C * T)
```

Current constants:

```text
A = 165
P = 1.22
B = 7
C = 1.25
```

Leaderboard rank is by total daily score, then solved count, then fewer steps, then faster total time.
