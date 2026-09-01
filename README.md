# Vancouver Community Centre Calendar

A Next.js app that fetches Vancouver community centre events, lets users select event series, and generates custom `.ics` calendars for Google Calendar or direct download.

## Features

- Fetches event data from the Vancouver Active Communities calendar API.
- Groups events by community centre location and event title.
- Supports text search and multi-select location filtering.
- Lets users select whole event series rather than individual event dates.
- Supports saved subscriptions backed by Vercel KV/Upstash Redis.
- Generates stable subscription calendar URLs such as `/api/calendar?subscription=my-secret-id`.
- Preserves backward-compatible encoded event ID URLs such as `/api/calendar?ids=1042-1045`.
- Lets users choose which URL format to copy or download from the UI.

## Tech Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Vercel KV/Upstash Redis via `@upstash/redis`
- `ics` for calendar file generation

## Environment Variables

The app expects Vercel KV REST environment variables:

```env
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

When Vercel provisions KV for the project, these are usually added automatically. They are required for subscription load, save, delete, and stable subscription calendar URLs.

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run verification:

```bash
npm run lint
npm run build
```

## Subscription Workflow

Users can browse and select events without a saved subscription. To create a stable calendar link, they enter a subscription ID or generate a readable one, then click `Save Subscription`.

Subscription IDs are treated as secrets. Anyone with a subscription ID can load, update, delete, or subscribe to that subscription.

Selection changes are not auto-saved. After changing selected events, the user must click `Save Subscription` for the stable subscription URL to reflect the new selections.

The last used subscription ID is stored in `localStorage`. On the next page load, the app attempts to load it and preselect its saved event IDs.

## Calendar URLs

The UI offers two calendar URL modes:

- `Subscription URL`: `/api/calendar?subscription=<subscription-id>` loads selected event IDs from Redis and generates the calendar from current event data.
- `Encoded Event IDs`: `/api/calendar?ids=<compressed-id-ranges>` embeds selected event IDs directly in the URL for one-off or backward-compatible links.

After a subscription is saved or loaded, the UI defaults to `Subscription URL`. If no saved subscription exists, encoded event IDs remain available.

## API Routes

- `GET /api/events`: returns grouped event series data.
- `GET /api/subscriptions/[id]`: returns a saved subscription or `404`.
- `PUT /api/subscriptions/[id]`: creates or updates a subscription with `{ "ids": number[] }`.
- `DELETE /api/subscriptions/[id]`: permanently deletes a subscription.
- `GET /api/calendar?subscription=<id>`: generates an `.ics` calendar from a saved subscription.
- `GET /api/calendar?ids=<ranges>`: generates an `.ics` calendar from encoded event IDs.

## Caching

External community centre API fetches use Next.js fetch revalidation with a 24-hour interval. The `/api/events` route also revalidates every 24 hours.

Subscription data is stored in Redis without an expiry.

## Deployment

Deploy on Vercel and ensure `KV_REST_API_URL` and `KV_REST_API_TOKEN` are available in the target environment. Redeploy after changing environment variables.
