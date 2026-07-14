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

The deployed API base URL will look like:

```text
https://YOUR_PROJECT_REF.functions.supabase.co/row-echelon-api
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
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy row-echelon-api --no-verify-jwt
```

Supabase Edge Functions provide `SUPABASE_URL` and secret API keys as environment variables automatically.

## Connect The Website

Open the game once with:

```text
https://netiyiy.github.io/row-echelon/?api=https://YOUR_PROJECT_REF.functions.supabase.co/row-echelon-api
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
