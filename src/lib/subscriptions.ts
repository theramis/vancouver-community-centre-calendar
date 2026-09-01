import { Redis } from '@upstash/redis';

export type Subscription = {
  ids: number[];
  createdAt: string;
  updatedAt: string;
};

const SUBSCRIPTION_ID_PATTERN = /^[a-zA-Z0-9_-]{3,80}$/;

let redis: Redis | null = null;

function getRedis() {
  if (redis) return redis;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error('Missing Vercel KV environment variables');
  }

  redis = new Redis({ url, token });
  return redis;
}

export function isValidSubscriptionId(id: string) {
  return SUBSCRIPTION_ID_PATTERN.test(id);
}

export function subscriptionKey(id: string) {
  return `subscription:${id}`;
}

export async function getSubscription(id: string) {
  if (!isValidSubscriptionId(id)) return null;
  return getRedis().get<Subscription>(subscriptionKey(id));
}

export async function saveSubscription(id: string, ids: number[]) {
  if (!isValidSubscriptionId(id)) {
    throw new Error('Invalid subscription ID');
  }

  const now = new Date().toISOString();
  const existing = await getSubscription(id);
  const subscription: Subscription = {
    ids,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await getRedis().set(subscriptionKey(id), subscription);
  return subscription;
}

export async function deleteSubscription(id: string) {
  if (!isValidSubscriptionId(id)) return 0;
  return getRedis().del(subscriptionKey(id));
}
