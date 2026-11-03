# Продукты24

A local grocery storefront built with React, Vite, Express, and SQLite.

## Requirements

- Node.js 20.19+ (Node.js 22 LTS recommended)
- npm

## Run locally

1. Copy `.env.example` to `.env`.
2. Set a unique, long `JWT_SECRET` and a strong `ADMIN_PASSWORD` in `.env`.
3. Install dependencies and start the app:

   ```powershell
   npm install
   npm start
   ```

4. Open <http://localhost:3000>.

The start command builds the React storefront before starting the Express server. SQLite data is stored in the local `shop.db` file and is intentionally not tracked by Git.

The configured admin account is seeded when the database is first created. Use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values in your local `.env`. The demo payment flow is a mock and must not be used to process real payments.

## Development

```powershell
npm run build
npm run dev
```

`npm run dev` watches the Express server; rebuild the React frontend with `npm run build` after frontend changes.

## Project layout

- `client/` — React storefront source and Vite entry point
- `public/` — static pages, styles, and browser scripts
- `routes/` — Express API routes
- `middleware/` — authentication middleware
- `db.js` — SQLite schema and demo seed data
