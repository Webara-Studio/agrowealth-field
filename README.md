# Agrowealth Field Agent

Offline-first PWA for field data collection in the Agrowealth Cooperative supply chain. Built for agents working in rural Nigeria with unreliable connectivity.

## Features

- **Farmer Registration** — Phone, BVN, GPS location, farm size, cassava variety
- **Harvest Logging** — Weight estimation, GPS capture, photo evidence
- **Delivery Confirmation** — Actual weight, off-taker, truck ID, photo proof
- **Offline-First** — All data stored in IndexedDB, syncs when connectivity returns
- **Auto-Sync** — Background sync every 30 seconds when online; manual sync button
- **PWA Installable** — Add to home screen on Android/iOS, works fully offline

## Tech Stack

- **Next.js 14** (App Router, static export)
- **TypeScript**
- **IndexedDB** (via `idb`) — local storage with typed schema
- **Service Worker** — app shell caching for offline page loads
- **Tailwind CSS v4** — royal blue + gold cooperative theme

## Getting Started

```bash
npm install
npm run dev      # localhost:3000
npm run build    # production build
npm start        # serve production build
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000  # Agrowealth API endpoint
```

If unset, sync will fail silently (data stays in local IndexedDB until configured).

## Architecture

```
src/
├── app/
│   ├── layout.tsx    # Root layout + SW registration + PWA metadata
│   ├── page.tsx      # Main UI — dashboard, farmer/harvest/delivery/sync tabs
│   └── globals.css   # Tailwind theme (royal blue + gold)
├── lib/
│   ├── db.ts         # IndexedDB schema + CRUD (farmers, harvests, deliveries, sync queue)
│   ├── gps.ts        # Geolocation + photo capture/compression utilities
│   └── sync.ts       # Sync engine — POST queued items to API, retry on failure
public/
├── manifest.json     # PWA manifest
├── sw.js             # Service worker (app shell cache)
├── icon-192.png      # PWA icon (192×192)
└── icon-512.png      # PWA icon (512×512)
```

## Data Flow

1. Agent captures data (GPS + photo + details) → saved to IndexedDB + sync queue
2. Background sync (30s interval or on reconnect) → POST to API
3. Successful sync → item removed from queue
4. Failed sync → retry count incremented, stays in queue

## Deployment

Deployed on Vercel: **https://agrowealth-field.vercel.app**

```bash
vercel --prod
```

## License

MIT — Agrowealth Cooperative Society Limited
