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

The local web app defaults to `http://localhost:8787` for the API. The public
GitHub Pages site defaults to the Supabase backend:

```text
https://fkoupqflxcwyofsbgjgw.functions.supabase.co/row-echelon-api
```

See `SUPABASE_SETUP.md` for deployment notes.

Player sessions time out after 30 minutes without keyboard or pointer activity.
While a player is active, the web app sends a lightweight heartbeat every five
minutes so long levels do not expire unexpectedly.

On iPhone Safari, open the hosted URL, tap the Share button, then choose
**Add to Home Screen**.

## Tutorial

Choose **How to Play** from the player screen or Settings to start the guided
practice matrix. It teaches Swap, Add, and Scale with highlighted controls,
exact fractions, and a complete RREF example. Tutorial actions do not affect
the current level, score, timer, leaderboard, or saved progress.

## Audio

The bundled audio is CC0. Source details are in
`assets/audio/AudioCredits.txt`.

## iOS App Store project

The ready-to-open Xcode project is at `ios/RowEchelon/RowEchelon.xcodeproj`.
It bundles the game for offline launch and adds native haptics, background audio
suspension, an App Store privacy manifest, and Release build configuration.
See `ios/RowEchelon/README.md` and `ios/RowEchelon/APP_STORE_CHECKLIST.md`.
