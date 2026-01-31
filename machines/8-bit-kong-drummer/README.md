# 8-Bit Kong Drummer

A retro Donkey Kong inspired rhythm game. Place drum triggers on platforms for rolling barrels to play. Control the BPM, compose beats in real-time.

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Preview with `npm run preview`.

## Deploy as a Website

The app is a static site. Deploy the `dist/` folder to any static host.

**Netlify:** Connect your repo. Build command: `npm run build`, publish directory: `dist`.

**Vercel:** Connect your repo. Auto-detects Vite.

**GitHub Pages:** Set `base: '/your-repo-name/'` in `vite.config.ts`, then build and push `dist/` to a `gh-pages` branch or use GitHub Actions.
