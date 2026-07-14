# Row Echelon Leaderboard API

Backend for player accounts and the daily leaderboard.

## Run Locally

```bash
cd leaderboard-api
npm start
```

The API runs at:

```text
http://localhost:8787
```

The website defaults to that API URL. For a deployed backend, set this in the browser console before loading the game:

```js
localStorage.setItem("rowEchelonApiBaseUrl", "https://your-api-host.example.com")
```

## Endpoints

- `POST /api/accounts` with `{ "name": "Player" }`
- `GET /api/leaderboard`
- `POST /api/complete` with `{ "level": 1, "steps": 7, "timeSeconds": 32 }` and `Authorization: Bearer <token>`

Ranking is by total daily score, highest first. The server calculates each solve with:

```text
Score = max(0, A * L^P - B * S - C * T)
```

The current constants are `A=165`, `P=1.22`, `B=7`, and `C=1.25`. Solved count, total steps, and total time are tie-breakers.
