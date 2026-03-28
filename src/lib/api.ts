export type APIEventItem = {
  title: string;
  start_time: string;
  end_time: string | null;
  description: string;
  event_item_id: number;
  activity_detail_url?: string;
  facilities?: { facility_name: string; center_name: string }[];
};

export type APICenterEvent = {
  center_id: number;
  center_name: string;
  events: APIEventItem[];
};

export type APIData = {
  body: {
    center_events: APICenterEvent[];
  };
};

export type Series = {
  location: string;
  title: string;
  event_item_id: number;
  instances: APIEventItem[];
};

export async function fetchEvents(): Promise<Series[]> {
  try {
    const allCenterIds = [38,57,6,29,48,50,43,44,39,55,33,35,40,54,53,46,42,41,58,32,7,49];

    // Fetch all centers in parallel to bypass the 2MB Next.js Data Cache limit per request
    const fetchCenter = async (id: number) => {
      const response = await fetch("https://anc.ca.apm.activecommunities.com/vancouver/rest/onlinecalendar/multicenter/events?locale=en-US", {
        headers: {
          "accept": "*/*",
          "accept-language": "en-NZ,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
          "content-type": "application/json;charset=utf-8",
          "page_info": "{\"page_number\":1,\"total_records_per_page\":1000}",
          "x-requested-with": "XMLHttpRequest"
        },
        body: JSON.stringify({
          calendar_id: 15,
          center_ids: [id],
          display_all: 0,
          search_start_time: "",
          search_end_time: "",
          facility_ids: [],
          activity_category_ids: [],
          activity_sub_category_ids: [],
          activity_ids: [],
          activity_min_age: null,
          activity_max_age: null,
          event_type_ids: []
        }),
        method: "POST",
        next: {
          revalidate: 86400 // 24 hours ISR cache per center
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch center ${id}: ${response.status}`);
        return null;
      }

      return response.json() as Promise<APIData>;
    };

    const results = await Promise.all(allCenterIds.map(fetchCenter));

    const seriesMap = new Map<number, Series>();

    for (const data of results) {
      if (!data) continue;
      const centers = data.body?.center_events || [];

      for (const center of centers) {
        const locationName = center.center_name.replace(/^\*/, ''); // Remove leading * from location names
        
        for (const event of center.events || []) {
          if (!seriesMap.has(event.event_item_id)) {
            seriesMap.set(event.event_item_id, {
              location: locationName,
              title: event.title,
              event_item_id: event.event_item_id,
              instances: [],
            });
          }
          seriesMap.get(event.event_item_id)!.instances.push(event);
        }
      }
    }

    // Convert map to array and sort by location then title
    return Array.from(seriesMap.values()).sort((a, b) => {
      if (a.location < b.location) return -1;
      if (a.location > b.location) return 1;
      return a.title.localeCompare(b.title);
    });

  } catch (error) {
    console.error("Failed to fetch events:", error);
    throw new Error("Failed to load events. Please try again later.");
  }
}
