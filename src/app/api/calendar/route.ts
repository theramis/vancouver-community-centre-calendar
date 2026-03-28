import { fetchEvents } from '@/lib/api';
import * as ics from 'ics';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function decompressIds(compressed: string): number[] {
  if (!compressed) return [];
  const ids: number[] = [];
  const ranges = compressed.split(',');
  for (const range of ranges) {
    if (range.includes('-')) {
      const [start, end] = range.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) ids.push(i);
      }
    } else {
      const val = Number(range);
      if (!isNaN(val)) ids.push(val);
    }
  }
  return ids;
}

function parseDate(dateStr: string): ics.DateArray {
  // "2026-03-23 12:00:00" -> [2026, 3, 23, 12, 0]
  const [datePart, timePart] = dateStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return [year, month, day, hour, minute];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const idsParam = searchParams.get('ids');

  if (!idsParam) {
    return new NextResponse('Missing ids parameter', { status: 400 });
  }

  const selectedIds = new Set(decompressIds(idsParam));
  
  if (selectedIds.size === 0) {
    return new NextResponse('Invalid ids parameter', { status: 400 });
  }

  try {
    const allSeries = await fetchEvents();
    
    const events: ics.EventAttributes[] = [];

    for (const series of allSeries) {
      if (selectedIds.has(series.event_item_id)) {
        for (const instance of series.instances) {
          const start = parseDate(instance.start_time);
          let end: ics.DateArray;

          if (instance.end_time) {
            end = parseDate(instance.end_time);
          } else {
            const endDate = new Date(
              start[0] as number, (start[1] as number) - 1, start[2] as number, (start[3] || 0) + 1, start[4] || 0
            );
            end = [
              endDate.getFullYear(),
              endDate.getMonth() + 1,
              endDate.getDate(),
              endDate.getHours(),
              endDate.getMinutes()
            ];
          }

          events.push({
            title: series.title,
            start: start,
            end: end,
            startOutputType: 'local',
            endOutputType: 'local',
            description: instance.description,
            location: series.location,
            url: instance.activity_detail_url,
          });
        }
      }
    }

    if (events.length === 0) {
      return new NextResponse('No events found for given IDs', { status: 404 });
    }

    const { error, value } = ics.createEvents(events);

    if (error || !value) {
      console.error('Failed to create ICS:', error);
      return new NextResponse('Failed to generate calendar', { status: 500 });
    }

    // Spec: All events strictly hardcoded to America/Vancouver timezone
    let icsContent = value;
    icsContent = icsContent.replace(/DTSTART:(.*)/g, 'DTSTART;TZID=America/Vancouver:$1');
    icsContent = icsContent.replace(/DTEND:(.*)/g, 'DTEND;TZID=America/Vancouver:$1');

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="vancouver-community-centre-calendar.ics"',
      },
    });

  } catch (err) {
    console.error('Error fetching/generating calendar:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
