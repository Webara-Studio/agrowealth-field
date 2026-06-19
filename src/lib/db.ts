/**
 * Offline-first IndexedDB storage for field agent data
 * Stores farmers, harvests, deliveries, and sync queue
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

// ── Types ─────────────────────────────────────────────────────────────────

export interface Farmer {
  id: string;
  phone: string;
  bvn: string;
  fullName: string;
  farmState: string;
  farmLga: string;
  gpsLat: number;
  gpsLng: number;
  farmHectares: number;
  cassavaVariety: string;
  registeredAt: string;
  verified: boolean;
  synced: boolean;
}

export interface Harvest {
  id: string;
  farmerId: string;
  farmerPhone: string;
  estimatedKg: number;
  gpsLat: number;
  gpsLng: number;
  photoDataUrl: string;
  loggedAt: string;
  verified: boolean;
  synced: boolean;
}

export interface Delivery {
  id: string;
  farmerId: string;
  farmerPhone: string;
  actualKg: number;
  offTakerName: string;
  truckId: string;
  gpsLat: number;
  gpsLng: number;
  photoDataUrl: string;
  deliveredAt: string;
  verified: boolean;
  synced: boolean;
}

export interface SyncQueueItem {
  id: string;
  type: 'farmer' | 'harvest' | 'delivery';
  action: 'create' | 'update' | 'verify';
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
  harvests: {
    key: string;
    value: Harvest;
    indexes: { 'by-farmer': string; 'by-date': string };
  };
  deliveries: {
    key: string;
    value: Delivery;
    indexes: { 'by-farmer': string; 'by-date': string; 'by-truck': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-type': string; 'by-created': string };
  };
}

const DB_NAME = 'agrowealth-field';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<AgrowealthDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AgrowealthDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AgrowealthDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Farmers store
      const farmerStore = db.createObjectStore('farmers', { keyPath: 'id' });
      farmerStore.createIndex('by-phone', 'phone');
      farmerStore.createIndex('by-state', 'farmState');

      // Harvests store
      const harvestStore = db.createObjectStore('harvests', { keyPath: 'id' });
      harvestStore.createIndex('by-farmer', 'farmerId');
      harvestStore.createIndex('by-date', 'loggedAt');

      // Deliveries store
      const deliveryStore = db.createObjectStore('deliveries', { keyPath: 'id' });
      deliveryStore.createIndex('by-farmer', 'farmerId');
      deliveryStore.createIndex('by-date', 'deliveredAt');
      deliveryStore.createIndex('by-truck', 'truckId');

      // Sync queue
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
      syncStore.createIndex('by-type', 'type');
      syncStore.createIndex('by-created', 'createdAt');
    },
  });

  return dbInstance;
}

// ── Farmer Operations ─────────────────────────────────────────────────────

export async function registerFarmer(
  data: Omit<Farmer, 'id' | 'registeredAt' | 'verified' | 'synced'>
): Promise<Farmer> {
  const db = await getDB();
  const farmer: Farmer = {
    ...data,
    id: uuidv4(),
    registeredAt: new Date().toISOString(),
    verified: false,
    synced: false,
  };

  await db.put('farmers', farmer);
  await addToSyncQueue('farmer', 'create', farmer as unknown as Record<string, unknown>);

  return farmer;
}

export async function getFarmer(id: string): Promise<Farmer | undefined> {
  const db = await getDB();
  return db.get('farmers', id);
}

export async function getFarmerByPhone(phone: string): Promise<Farmer | undefined> {
  const db = await getDB();
  return db.getFromIndex('farmers', 'by-phone', phone);
}

export async function getAllFarmers(): Promise<Farmer[]> {
  const db = await getDB();
  return db.getAll('farmers');
}

export async function getUnsyncedFarmers(): Promise<Farmer[]> {
  const db = await getDB();
  const all = await db.getAll('farmers');
  return all.filter(f => !f.synced);
}

// ── Harvest Operations ────────────────────────────────────────────────────

export async function logHarvest(
  data: Omit<Harvest, 'id' | 'loggedAt' | 'verified' | 'synced'>
): Promise<Harvest> {
  const db = await getDB();
  const harvest: Harvest = {
    ...data,
    id: uuidv4(),
    loggedAt: new Date().toISOString(),
    verified: false,
    synced: false,
  };

  await db.put('harvests', harvest);
  await addToSyncQueue('harvest', 'create', harvest as unknown as Record<string, unknown>);

  return harvest;
}

export async function getHarvestsByFarmer(farmerId: string): Promise<Harvest[]> {
  const db = await getDB();
  return db.getAllFromIndex('harvests', 'by-farmer', farmerId);
}

export async function getAllHarvests(): Promise<Harvest[]> {
  const db = await getDB();
  return db.getAll('harvests');
}

// ── Delivery Operations ───────────────────────────────────────────────────

export async function logDelivery(
  data: Omit<Delivery, 'id' | 'deliveredAt' | 'verified' | 'synced'>
): Promise<Delivery> {
  const db = await getDB();
  const delivery: Delivery = {
    ...data,
    id: uuidv4(),
    deliveredAt: new Date().toISOString(),
    verified: false,
    synced: false,
  };

  await db.put('deliveries', delivery);
  await addToSyncQueue('delivery', 'create', delivery as unknown as Record<string, unknown>);

  return delivery;
}

export async function getDeliveriesByFarmer(farmerId: string): Promise<Delivery[]> {
  const db = await getDB();
  return db.getAllFromIndex('deliveries', 'by-farmer', farmerId);
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

// ── Stats ─────────────────────────────────────────────────────────────────

export async function getLocalStats(): Promise<{
  farmers: number;
  harvests: number;
  deliveries: number;
  pendingSync: number;
  totalHarvestKg: number;
  totalDeliveryKg: number;
}> {
  const db = await getDB();

  const farmers = await db.count('farmers');
  const harvests = await db.count('harvests');
  const deliveries = await db.count('deliveries');
  const pendingSync = await db.count('syncQueue');

  const allHarvests = await db.getAll('harvests');
  const totalHarvestKg = allHarvests.reduce((sum, h) => sum + h.estimatedKg, 0);

  const allDeliveries = await db.getAll('deliveries');
  const totalDeliveryKg = allDeliveries.reduce((sum, d) => sum + d.actualKg, 0);

  return { farmers, harvests, deliveries, pendingSync, totalHarvestKg, totalDeliveryKg };
}
