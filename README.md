# Row Echelon Web

Mobile web version of the Row Echelon iPhone game. It is a static installable
PWA, so it can be hosted free on GitHub Pages, Netlify, or Cloudflare Pages.

## Run Locally

```bash
cd row-echelon-web
python3 -m http.server 4173
```

Open <http://localhost:4173>.

For accounts and the multiplayer daily leaderboard, run the backend in a
second terminal:

```bash
cd leaderboard-api
npm start
```

The web app defaults to `http://localhost:8787` for the API. The production
backend is designed for Supabase Edge Functions; see `SUPABASE_SETUP.md`.

After deploying Supabase, open the public site once with:

```text
https://netiyiy.github.io/row-echelon/?api=https://YOUR_PROJECT_REF.functions.supabase.co/row-echelon-api
```

The app stores that API URL in `localStorage` for future visits.

On iPhone Safari, open the hosted URL, tap the Share button, then choose
**Add to Home Screen**.

## Audio

The bundled audio is CC0. Source details are in
`assets/audio/AudioCredits.txt`.
