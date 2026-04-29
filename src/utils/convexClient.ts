import { ConvexHttpClient } from 'convex/browser'; // works in Node + browser
import dotenv from 'dotenv';

dotenv.config();

let client: ConvexHttpClient | null = null;

/**
 * Get a Convex client instance (singleton).
 */
export function getConvexClient(): ConvexHttpClient {
  if (!client) {
    const convexUrl =
      process.env.CONVEX_URL ?? 'https://placeholder.convex.cloud';
    client = new ConvexHttpClient(convexUrl);
  }

  return client;
}
