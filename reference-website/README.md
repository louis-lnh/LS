# SHD Lifesteal

Website for `lifesteal.shd-esports.com`.

The player list and landing population widget read live public data first, then fall back to mock data when the API is unavailable or empty.

## Run

```bash
npm install
npm run dev
```

The dev server defaults to Vite's local URL. During the initial review pass it was checked on:

```text
http://127.0.0.1:5180
```

Optional live API target:

```env
VITE_LIFESTEAL_API_BASE_URL=http://localhost:3000/api/v1/public
```

## Mock Pages

```text
/
/rules
/players
/events
/world
/signup
/punishments
```
