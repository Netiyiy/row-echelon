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

The web app defaults to `http://localhost:8787` for the API. For the public
GitHub Pages site, deploy `leaderboard-api` somewhere public and set:

```js
localStorage.setItem("rowEchelonApiBaseUrl", "https://your-api-host.example.com")
```

On iPhone Safari, open the hosted URL, tap the Share button, then choose
**Add to Home Screen**.

## Audio

The bundled audio is CC0. Source details are in
`assets/audio/AudioCredits.txt`.
