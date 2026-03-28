import { fetchEvents } from '@/lib/api';
import { NextResponse } from 'next/server';

export const revalidate = 86400; // Cache the entire API route for 24 hours (ISR)

export async function GET() {
  try {
    const events = await fetchEvents();
    return NextResponse.json(events);
  } catch (error) {
    console.error('API /events error:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
