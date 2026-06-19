/**
 * Offline-first IndexedDB storage for AgroWealth field agents
 * Cooperative model: farmers → purchases → dispatches → deliveries
 * Mirrors the real business flow: Buy from farmer → Load truck → Off-taker receipt → Settle
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

// ── Types ─────────────────────────────────────────────────────────────────

export interface Farmer {
  id: string;
  phone: string;
  fullName: string;
  farmState: string;
  farmLga: string;
  gpsLat: number;
  gpsLng: number;
  farmHectares: number;
  cassavaVariety: string;
  registeredAt: string;
  synced: boolean;
}

/** Cooperative BUYS cassava from a farmer */
export interface Purchase {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  weightKg: number;
  pricePerKg: number;
  totalAmount: number; // weightKg * pricePerKg
  gpsLat: number;
  gpsLng: number;
  photoDataUrl?: string;
  dispatchId?: string | null; // null = available, set when loaded onto truck
  agentName: string;
  createdAt: string;
  synced: boolean;
}

/** Truck loaded with cassava, dispatched to an off-taker */
export interface Dispatch {
  id: string;
  truckId: string;
  driverName: string;
  driverPhone: string;
  offTakerName: string;
  destination: string;
  totalWeightKg: number;
  purchaseIds: string[];
  status: 'in_transit' | 'delivered' | 'rejected';
  createdAt: string;
  synced: boolean;
}

/** Off-taker (processing company) confirms receipt of a truck */
export interface Delivery {
  id: string;
  dispatchId: string;
  truckId: string;
  receivedWeightKg: number;
  accepted: boolean;
  rejectionReason?: string;
  offTakerRep: string;
  sellPricePerKg: number;
  totalRevenue: number; // receivedWeightKg * sellPricePerKg
  gpsLat: number;
  gpsLng: number;
  photoDataUrl?: string;
  createdAt: string;
  synced: boolean;
}

export interface SyncQueueItem {
  id: string;
  type: 'farmer' | 'purchase' | 'dispatch' | 'delivery';
  action: 'create' | 'update';
  data: Record<string, unknown>;
  createdAt: string;
  retries: number;
}

// ── DB Schema ─────────────────────────────────────────────────────────────

interface AgrowealthDB extends DBSchema {
  farmers: {
    key: string;
    value: Farmer;
    indexes: { 'by-phone': string; 'by-state': string };
  };
  purchases: {
    key: string;
    value: Purchase;
    indexes: { 'by-farmer': string; 'by-dispatch': string };
  };
  dispatches: {
    key: string;
    value: Dispatch;
    indexes: { 'by-status': string };
  };
  deliveries: {
    key: string;
    value: Delivery;
    indexes: { 'by-dispatch': string; 'by-truck': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-type': string; 'by-created': string };
  };
}

const DB_NAME = 'agrowealth-field';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<AgrowealthDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AgrowealthDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AgrowealthDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Farmers (kept from v1)
      if (!db.objectStoreNames.contains('farmers')) {
        const f = db.createObjectStore('farmers', { keyPath: 'id' });
        f.createIndex('by-phone', 'phone');
        f.createIndex('by-state', 'farmState');
      }

      // Remove old v1 stores (bypass TS type check — these names aren't in the new schema)
      const rawDb = db as unknown as {
        objectStoreNames: { contains: (n: string) => boolean },
        deleteObjectStore: (n: string) => void,
      };
      if (rawDb.objectStoreNames.contains('harvests')) {
        rawDb.deleteObjectStore('harvests');
      }
      if (rawDb.objectStoreNames.contains('deliveries')) {
        rawDb.deleteObjectStore('deliveries');
      }

      // v2: Purchases (replaces harvests)
      if (!db.objectStoreNames.contains('purchases')) {
        const p = db.createObjectStore('purchases', { keyPath: 'id' });
        p.createIndex('by-farmer', 'farmerId');
        p.createIndex('by-dispatch', 'dispatchId');
      }

      // v2: Dispatches (new)
      if (!db.objectStoreNames.contains('dispatches')) {
        const d = db.createObjectStore('dispatches', { keyPath: 'id' });
        d.createIndex('by-status', 'status');
      }

      // v2: Deliveries (recreated with new indexes)
      if (!db.objectStoreNames.contains('deliveries')) {
        const del = db.createObjectStore('deliveries', { keyPath: 'id' });
        del.createIndex('by-dispatch', 'dispatchId');
        del.createIndex('by-truck', 'truckId');
      }

      // Sync queue (kept from v1)
      if (!db.objectStoreNames.contains('syncQueue')) {
        const s = db.createObjectStore('syncQueue', { keyPath: 'id' });
        s.createIndex('by-type', 'type');
        s.createIndex('by-created', 'createdAt');
      }
    },
  });

  return dbInstance;
}

// ── Farmer Operations ─────────────────────────────────────────────────────

export async function registerFarmer(
  data: Omit<Farmer, 'id' | 'registeredAt' | 'synced'>
): Promise<Farmer> {
  const db = await getDB();
  const farmer: Farmer = {
    ...data,
    id: uuidv4(),
    registeredAt: new Date().toISOString(),
    synced: false,
  };
  await db.put('farmers', farmer);
  await addToSyncQueue('farmer', 'create', farmer as unknown as Record<string, unknown>);
  return farmer;
}

export async function getFarmerByPhone(phone: string): Promise<Farmer | undefined> {
  const db = await getDB();
  return db.getFromIndex('farmers', 'by-phone', phone);
}

export async function getAllFarmers(): Promise<Farmer[]> {
  const db = await getDB();
  return db.getAll('farmers');
}

// ── Purchase Operations (Buy from farmer) ─────────────────────────────────

export async function logPurchase(
  data: Omit<Purchase, 'id' | 'createdAt' | 'synced' | 'totalAmount' | 'dispatchId'>
): Promise<Purchase> {
  const db = await getDB();
  const totalAmount = data.weightKg * data.pricePerKg;
  const purchase: Purchase = {
    ...data,
    id: uuidv4(),
    totalAmount,
    dispatchId: null,
    createdAt: new Date().toISOString(),
    synced: false,
  };
  await db.put('purchases', purchase);
  await addToSyncQueue('purchase', 'create', purchase as unknown as Record<string, unknown>);
  return purchase;
}

export async function getAvailablePurchases(): Promise<Purchase[]> {
  const db = await getDB();
  const all = await db.getAll('purchases');
  return all
    .filter((p) => !p.dispatchId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAllPurchases(): Promise<Purchase[]> {
  const db = await getDB();
  return db.getAll('purchases');
}

async function assignPurchasesToDispatch(dispatchId: string, purchaseIds: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('purchases', 'readwrite');
  for (const pid of purchaseIds) {
    const purchase = await tx.store.get(pid);
    if (purchase) {
      purchase.dispatchId = dispatchId;
      await tx.store.put(purchase);
    }
  }
  await tx.done;
}

// ── Dispatch Operations (Load truck, send to off-taker) ───────────────────

export async function createDispatch(
  data: Omit<Dispatch, 'id' | 'createdAt' | 'synced' | 'status'>
): Promise<Dispatch> {
  const db = await getDB();
  const dispatch: Dispatch = {
    ...data,
    id: uuidv4(),
    status: 'in_transit',
    createdAt: new Date().toISOString(),
    synced: false,
  };
  await db.put('dispatches', dispatch);
  await assignPurchasesToDispatch(dispatch.id, dispatch.purchaseIds);
  await addToSyncQueue('dispatch', 'create', dispatch as unknown as Record<string, unknown>);
  return dispatch;
}

export async function getDispatchesByStatus(status?: Dispatch['status']): Promise<Dispatch[]> {
  const db = await getDB();
  const all = await db.getAll('dispatches');
  const filtered = status ? all.filter((d) => d.status === status) : all;
  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function updateDispatchStatus(dispatchId: string, status: Dispatch['status']): Promise<void> {
  const db = await getDB();
  const dispatch = await db.get('dispatches', dispatchId);
  if (dispatch) {
    dispatch.status = status;
    await db.put('dispatches', dispatch);
  }
}

// ── Delivery Operations (Off-taker confirms receipt) ──────────────────────

export async function logDelivery(
  data: Omit<Delivery, 'id' | 'createdAt' | 'synced' | 'totalRevenue'>
): Promise<Delivery> {
  const db = await getDB();
  const totalRevenue = data.receivedWeightKg * data.sellPricePerKg;
  const delivery: Delivery = {
    ...data,
    id: uuidv4(),
    totalRevenue,
    createdAt: new Date().toISOString(),
    synced: false,
  };
  await db.put('deliveries', delivery);
  await updateDispatchStatus(delivery.dispatchId, delivery.accepted ? 'delivered' : 'rejected');
  await addToSyncQueue('delivery', 'create', delivery as unknown as Record<string, unknown>);
  return delivery;
}

export async function getAllDeliveries(): Promise<Delivery[]> {
  const db = await getDB();
  return db.getAll('deliveries');
}

// ── Sync Queue Operations ─────────────────────────────────────────────────

async function addToSyncQueue(
  type: SyncQueueItem['type'],
  action: SyncQueueItem['action'],
  data: Record<string, unknown>
): Promise<void> {
  const db = await getDB();
  const item: SyncQueueItem = {
    id: uuidv4(),
    type,
    action,
    data,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  await db.put('syncQueue', item);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

export async function getPendingSyncCount(): Promise<number> {
  const db = await getDB();
  return db.count('syncQueue');
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    item.retries++;
    await db.put('syncQueue', item);
  }
}

// ── Cycle Stats (Reconciliation + Profit) ─────────────────────────────────

export interface CycleStats {
  totalBoughtKg: number;
  totalBoughtCost: number;
  totalDispatchedKg: number;
  activeDispatches: number;
  totalDeliveredKg: number;
  totalRevenue: number;
  weightLossKg: number;
  weightLossPct: number;
  estLogistics: number;
  estProfit: number;
  farmerCount: number;
  purchaseCount: number;
  deliveryCount: number;
}

export async function getCycleStats(): Promise<CycleStats> {
  const db = await getDB();
  const [purchases, dispatches, deliveries, farmers] = await Promise.all([
    db.getAll('purchases'),
    db.getAll('dispatches'),
    db.getAll('deliveries'),
    db.getAll('farmers'),
  ]);

  const totalBoughtKg = purchases.reduce((s, p) => s + p.weightKg, 0);
  const totalBoughtCost = purchases.reduce((s, p) => s + p.totalAmount, 0);
  const activeDispatches = dispatches.filter((d) => d.status === 'in_transit').length;
  const acceptedDeliveries = deliveries.filter((d) => d.accepted);
  const totalDeliveredKg = acceptedDeliveries.reduce((s, d) => s + d.receivedWeightKg, 0);
  const totalRevenue = acceptedDeliveries.reduce((s, d) => s + d.totalRevenue, 0);
  const weightLossKg = totalBoughtKg - totalDeliveredKg;
  const weightLossPct = totalBoughtKg > 0 ? (weightLossKg / totalBoughtKg) * 100 : 0;
  // Logistics estimate: ~15% of buy cost (transport, loading, handling)
  const estLogistics = totalBoughtCost * 0.15;
  const estProfit = totalRevenue - totalBoughtCost - estLogistics;

  return {
    totalBoughtKg,
    totalBoughtCost,
    totalDispatchedKg: dispatches.reduce((s, d) => s + d.totalWeightKg, 0),
    activeDispatches,
    totalDeliveredKg,
    totalRevenue,
    weightLossKg,
    weightLossPct,
    estLogistics,
    estProfit,
    farmerCount: farmers.length,
    purchaseCount: purchases.length,
    deliveryCount: deliveries.length,
  };
}
