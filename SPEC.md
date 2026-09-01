# Vancouver Community Centre Calendar - Technical Specification

## 1. Overview
A web application hosted on Vercel that fetches Vancouver community centre events from an external API, displays them grouped by location and title, and allows users to generate customized Google Calendar subscriptions (`.ics` format) for their selected event series. Users can either create stable saved subscriptions backed by Vercel KV/Upstash Redis or generate backward-compatible encoded event ID calendar URLs.

## 2. Architecture & Data Flow
- **Hosting:** Vercel (Hobby Tier).
- **Framework:** Next.js (App Router).
- **Data Fetching Strategy:** Data is fetched from the external community centre API across all configured community centre IDs (20+ locations). Centre requests are made independently so each response remains below the Next.js Data Cache size limit.
- **Caching & ISR:** The application leverages Next.js App Router's native `fetch` cache and Incremental Static Regeneration (ISR). The upstream data fetch to the community centre API is cached with a revalidation interval of **24 Hours** (`next: { revalidate: 86400 }`). This ensures fast page loads and `.ics` generation without exceeding API rate limits.
- **Storage:** Saved subscription records are stored in Vercel KV/Upstash Redis using `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Subscription records store selected `event_item_id` values only, plus creation/update timestamps. Event details are always resolved from the latest cached community centre API data.

## 3. Data Processing & Schema Rules
- **Identification:** Each unique event series is represented by a sequential integer `event_item_id`.
- **Timezone Enforcement:** All events in the generated `.ics` file must be strictly hardcoded to the `America/Vancouver` timezone.
- **Data Fallbacks:** If an event instance returned by the API is missing an `end_time`, calendar generation defaults the end time to exactly 1 hour after the `start_time`. The UI displays a fallback message when no description is available.
- **Subscription IDs:** Subscription IDs must be 3-80 characters and may contain letters, numbers, dashes, and underscores. They are treated as secrets; anyone with a subscription ID can load, update, delete, or subscribe to it.

## 4. User Interface & Experience (UI/UX)
- **Hierarchy & Layout:** Events are grouped hierarchically: **Location → Title**. The interface relies on collapsible accordions to prevent visual clutter and manage the massive list of events.
- **Series Details:** Series titles display their respective day of the week and active time duration (based on the first instance) to provide quick schedule context at a glance.
- **Search & Filtering:** To improve navigation, the page includes a multi-select Location filter and a text search bar, allowing users to quickly locate their desired class across multiple centres simultaneously. The user's selected locations are persisted to local storage and restored on subsequent page loads to maintain their preferences.
- **Subscription Management:** Users can browse events before creating or loading a subscription. They can enter an existing subscription ID, choose a custom new ID, or generate a readable random ID. The last used subscription ID is persisted to local storage and loaded automatically on subsequent page loads.
- **Selection & Management:** Users select an entire "Series" (e.g., all instances of "Yoga at Location A") rather than individual event dates. For saved subscriptions, changing selections only updates local UI state until the user explicitly clicks **Save Subscription**. The action bar includes an explicit clear capability to quickly reset selections.
- **URL Mode Selection:** The UI lets users choose between a stable **Subscription URL** and a legacy **Encoded Event IDs** URL. After a saved subscription is loaded or saved, Subscription URL is selected by default.
- **Error Handling:** If the client-side fetch fails due to network issues on page load, the application will automatically attempt to retry the fetch before presenting a fallback error state.

## 5. Calendar Generation (.ics) & Integration
- **Output:** The dynamic endpoint returns standard `text/calendar` `.ics` format data.
- **Route Handling:** The `.ics` route is dynamic and supports two query modes:
  - `?subscription=<subscription-id>` loads selected event IDs from Redis, then resolves matching event instances from the cached community centre API data.
  - `?ids=1042-1045` preserves the original encoded event ID URL behavior for existing links and one-off calendars.
- **Delivery Methods:** 
  - **Subscribe Link:** Generates a dynamic URL that users can add to Google Calendar. The default copied link uses the stable subscription ID when one has been saved. Google Calendar's periodic polling will hit the Vercel endpoint, which serves data derived from the 24-hour ISR cache and the saved Redis subscription record.
  - **Download Button:** Offers a static, one-time `.ics` download for immediate access.
- **Disclaimer:** The UI explicitly warns users that Google Calendar subscriptions are notoriously slow to sync (often taking 12-24 hours), encouraging the Download option if immediate updates are required.
- **URL Compression:** Encoded event ID URLs continue to compress sequential integer IDs into ranges such as `?ids=1042-1045` to prevent excessive URL length. Stable subscription URLs avoid this issue by storing selected IDs in Redis.

## 6. Security & Infrastructure Safeguards
- **Abuse Prevention:** Next.js Proxy (`src/proxy.ts`) is implemented to enforce basic rate-limiting on the `.ics` generation endpoint, protecting the Hobby Tier serverless execution quota from bot abuse.
- **Redis Safeguards:** Subscription route handlers validate subscription IDs and normalize saved event IDs before writing to Redis.
- **Timeout Management:** Generating the `.ics` text from the cached data is nearly instantaneous, comfortably bypassing Vercel's strict 10-second Hobby Tier timeout constraint.

## 7. API Surface
- `GET /api/events`: Returns grouped event series.
- `GET /api/subscriptions/[id]`: Loads a saved subscription or returns `404`.
- `PUT /api/subscriptions/[id]`: Creates or updates a subscription with `{ "ids": number[] }`.
- `DELETE /api/subscriptions/[id]`: Permanently deletes a subscription record.
- `GET /api/calendar?subscription=<id>`: Generates an `.ics` calendar from a saved subscription.
- `GET /api/calendar?ids=<ranges>`: Generates an `.ics` calendar from encoded event IDs.
