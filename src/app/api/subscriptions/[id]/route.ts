import { deleteSubscription, getSubscription, isValidSubscriptionId, saveSubscription } from '@/lib/subscriptions';
import { NextRequest, NextResponse } from 'next/server';

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return null;

  const ids = value
    .map((id) => Number(id))
    .filter((id) => Number.isSafeInteger(id) && id > 0);

  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

export async function GET(_request: NextRequest, context: RouteContext<'/api/subscriptions/[id]'>) {
  const { id } = await context.params;

  if (!isValidSubscriptionId(id)) {
    return NextResponse.json({ error: 'Invalid subscription ID' }, { status: 400 });
  }

  try {
    const subscription = await getSubscription(id);

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json(subscription);
  } catch (error) {
    console.error('API /subscriptions GET error:', error);
    return NextResponse.json({ error: 'Failed to load subscription' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext<'/api/subscriptions/[id]'>) {
  const { id } = await context.params;

  if (!isValidSubscriptionId(id)) {
    return NextResponse.json({ error: 'Invalid subscription ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const ids = normalizeIds(body?.ids);

    if (!ids) {
      return NextResponse.json({ error: 'Expected ids to be an array' }, { status: 400 });
    }

    const subscription = await saveSubscription(id, ids);
    return NextResponse.json(subscription);
  } catch (error) {
    console.error('API /subscriptions PUT error:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext<'/api/subscriptions/[id]'>) {
  const { id } = await context.params;

  if (!isValidSubscriptionId(id)) {
    return NextResponse.json({ error: 'Invalid subscription ID' }, { status: 400 });
  }

  try {
    await deleteSubscription(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('API /subscriptions DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
