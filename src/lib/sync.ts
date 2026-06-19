/**
 * Sync engine — pushes local data to the AgroWealth API when online
 * Cooperative model: farmers, purchases, dispatches, deliveries
 */

import {
  getSyncQueue,
  removeSyncItem,
  incrementRetry,
  type SyncQueueItem,
} from './db';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function syncAll(): Promise<{
  success: number;
  failed: number;
  remaining: number;
}> {
  const queue = await getSyncQueue();
  let success = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const endpoint = getEndpoint(item);
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });

      if (response.ok) {
        await removeSyncItem(item.id);
        success++;
      } else {
        console.warn(`Sync failed for ${item.type}: ${response.status}`);
        await incrementRetry(item.id);
        failed++;
      }
    } catch (err) {
      console.error(`Network error syncing ${item.type}:`, err);
      await incrementRetry(item.id);
      failed++;
    }
  }

  const remaining = queue.length - success;
  return { success, failed, remaining };
}

function getEndpoint(item: SyncQueueItem): string {
  switch (item.type) {
    case 'farmer':
      return '/farmers/register';
    case 'purchase':
      return '/coop/buy';
    case 'dispatch':
      return '/coop/dispatch';
    case 'delivery':
      return '/coop/deliver';
    default:
      return '/';
  }
}

export function setupAutoSync(intervalMs: number = 30000): () => void {
  const interval = setInterval(async () => {
    if (navigator.onLine) {
      try {
        const result = await syncAll();
        if (result.success > 0) {
          console.log(`Auto-synced ${result.success} items`);
        }
      } catch (e) {
        console.error('Auto-sync error:', e);
      }
    }
  }, intervalMs);

  // Also sync when coming back online
  const onlineHandler = async () => {
    try {
      await syncAll();
    } catch (e) {
      console.error('Online sync error:', e);
    }
  };

  window.addEventListener('online', onlineHandler);

  return () => {
    clearInterval(interval);
    window.removeEventListener('online', onlineHandler);
  };
}
