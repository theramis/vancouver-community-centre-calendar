# Vancouver Community Centre Calendar - Technical Specification

## 1. Overview
A web application hosted on Vercel that fetches Vancouver community centre events from an external API, displays them grouped by location and title, and allows users to generate customized Google Calendar subscriptions (`.ics` format) for their selected event series.

## 2. Architecture & Data Flow
- **Hosting:** Vercel (Hobby Tier).
- **Framework:** Next.js (App Router).
- **Data Fetching Strategy:** Data is fetched from the external community centre API utilizing the logic from `fetch_script.js`. It queries across all available community centre IDs (20+ locations) in a single request.
- **Caching & ISR:** The application leverages Next.js App Router's native `fetch` cache and Incremental Static Regeneration (ISR). The upstream data fetch to the community centre API is cached with a revalidation interval of **24 Hours** (`next: { revalidate: 86400 }`). This ensures fast page loads and `.ics` generation without exceeding API rate limits.
- **Storage:** No persistent database or external storage is used. Everything is generated dynamically based on the cached API data and URL query parameters.

## 3. Data Processing & Schema Rules
- **Identification:** Each unique event series is represented by a sequential integer `event_item_id`.
- **Timezone Enforcement:** All events in the generated `.ics` file must be strictly hardcoded to the `America/Vancouver` timezone.
- **Data Fallbacks:** If an event instance returned by the API is missing an `end_time` or `description`, the application will gracefully default the `end_time` to exactly 1 hour after the `start_time`.

## 4. User Interface & Experience (UI/UX)
- **Hierarchy & Layout:** Events are grouped hierarchically: **Location → Title**. The interface relies on collapsible accordions to prevent visual clutter and manage the massive list of events.
- **Series Details:** Series titles display their respective day of the week and active time duration (based on the first instance) to provide quick schedule context at a glance.
- **Search & Filtering:** To improve navigation, the page includes a Location filter dropdown and a text search bar, allowing users to quickly locate their desired class.
- **Selection & Management:** Users select an entire "Series" (e.g., all instances of "Yoga at Location A") rather than individual event dates. Because they subscribe to the series, any future instances added to that series by the community centre will automatically sync to their calendar. The sticky action bar includes an explicit "Deselect All" capability to allow users to quickly reset their selections.
- **Error Handling:** If the client-side fetch fails due to network issues on page load, the application will automatically attempt to retry the fetch before presenting a fallback error state.

## 5. Calendar Generation (.ics) & Integration
- **Output:** The dynamic endpoint returns standard `text/calendar` `.ics` format data.
- **Route Handling:** The `.ics` route is dynamic and relies on query parameters (e.g., `?ids=1042-1045`). It reads the pre-cached API data (via Next.js `fetch` ISR cache) to instantly generate the customized calendar without re-fetching from the external API on every request.
- **Delivery Methods:** 
  - **Subscribe Link:** Generates a dynamic URL that users can add to Google Calendar. Google Calendar's periodic polling will hit the Vercel endpoint, which serves data derived from the 24-hour ISR cache.
  - **Download Button:** Offers a static, one-time `.ics` download for immediate access.
- **Disclaimer:** The UI explicitly warns users that Google Calendar subscriptions are notoriously slow to sync (often taking 12-24 hours), encouraging the Download option if immediate updates are required.
- **URL Compression:** Since the dynamic `.ics` URL relies entirely on query parameters to specify the selected `event_item_id`s, and those IDs are sequential integers, the query parameters will compress the selection (e.g., using integer ranges `?ids=1042-1045` or base64 arrays) to prevent exceeding URL length limits.

## 6. Security & Infrastructure Safeguards
- **Abuse Prevention:** Vercel Edge Middleware is implemented to enforce basic rate-limiting on the `.ics` generation endpoint, protecting the Hobby Tier serverless execution quota from bot abuse.
- **Timeout Management:** Generating the `.ics` text from the cached data is nearly instantaneous, comfortably bypassing Vercel's strict 10-second Hobby Tier timeout constraint.