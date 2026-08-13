import { FirestoreAdapter } from './firestoreAdapter.js';

// =============================================================================
// SYNC ENGINE
// Sits between OfflineAdapter (local source of truth) and Firestore.
// Only active when Data.mode === 'online'.
//
// Upload cycle:
//   1. Read pending items from syncQueue.
//   2. Upload each to Firestore (idempotent set).
//   3. On success → mark done. On error → increment retryCount.
//
// Download cycle:
//   4. Fetch all records from each syncable entity type.
//   5. Merge into IndexedDB using conflict rules (mergeRemoteRecord).
//   6. Update lastSyncAt.
//
// Real-time listener subscribes after initial sync and merges changes as they
// arrive. Listener is torn down when Online Mode is disabled.
//
// Retry: exponential backoff, max 5 retries per item (then status = 'error').
// =============================================================================
export const SyncEngine = (() => {
  const SYNCABLE = ['users', 'rounds', 'submissions'];
  const MAX_RETRIES = 5;
  let _running = false;
  let _unsubscribers = [];
  let _syncLoopTimer = null;
  const SYNC_INTERVAL_MS = 60 * 1000; // poll every 60 s in addition to real-time

  // Resolve Data lazily to avoid circular dependency at module parse time.
  const getData = () => globalThis._tenlbData;

  // Notify the UI that sync state changed
  const notifySyncState = () => {
    window.dispatchEvent(new CustomEvent('tenlb:syncstate'));
  };

  const updateMeta = async (patch) => {
    const data = getData();
    const meta = await data.adapter.getDeviceMeta();
    await data.adapter.saveDeviceMeta({ ...meta, ...patch });
    notifySyncState();
  };

  const backoffMs = (retryCount) => Math.min(30000, 1000 * Math.pow(2, retryCount));

  // Upload one pending sync item to Firestore
  const uploadItem = async (item) => {
    const data = getData();
    if (item.operation === 'DELETE') {
      await FirestoreAdapter.deleteRecord(item.entityType, item.entityId, item.payload.deletedAt || new Date().toISOString());
    } else {
      await FirestoreAdapter.writeRecord(item.entityType, item.payload);
    }
    await data.adapter.deleteSyncItem(item.changeId);
  };

  // Upload all pending items
  const uploadPending = async () => {
    const data = getData();
    const items = await data.adapter.listPendingSyncItems();
    for (const item of items) {
      // Skip items in backoff period
      if (item.retryCount > 0 && item.lastError) {
        const retryAfter = new Date(item.timestamp).getTime() + backoffMs(item.retryCount);
        if (Date.now() < retryAfter) continue;
      }
      try {
        await data.adapter.updateSyncItem({ ...item, status: 'uploading' });
        await uploadItem(item);
      } catch (err) {
        const retryCount = item.retryCount + 1;
        const status = retryCount >= MAX_RETRIES ? 'error' : 'pending';
        await data.adapter.updateSyncItem({ ...item, status, retryCount, lastError: String(err?.message || err), timestamp: new Date().toISOString() });
      }
    }
  };

  // Download all remote records and merge into IndexedDB
  const downloadAll = async () => {
    const data = getData();
    for (const entityType of SYNCABLE) {
      const records = await FirestoreAdapter.downloadAll(entityType);
      for (const record of records) {
        await data.adapter.mergeRemoteRecord(entityType, record);
      }
    }
  };

  // Subscribe to real-time Firestore changes
  const subscribeAll = () => {
    const data = getData();
    _unsubscribers.forEach((fn) => fn());
    _unsubscribers = [];
    for (const entityType of SYNCABLE) {
      const unsub = FirestoreAdapter.subscribe(entityType, async (record) => {
        await data.adapter.mergeRemoteRecord(entityType, record);
        notifySyncState();
        window.dispatchEvent(new CustomEvent('tenlb:remotechange', { detail: { entityType } }));
      });
      _unsubscribers.push(unsub);
    }
  };

  // Enqueue a mutation for later upload (called by App after local writes)
  const enqueue = (entityType, entityId, operation, payload, userId) => {
    const data = getData();
    return data.adapter.enqueueSyncOperation(entityType, entityId, operation, payload, userId);
  };

  return {
    // Start sync engine (called when enabling Online Mode)
    async start() {
      if (_running) return;
      _running = true;
      await updateMeta({ syncStatus: 'syncing', syncError: null });
      try {
        await downloadAll();
        await uploadPending();
        await updateMeta({ syncStatus: 'synced', lastSyncAt: new Date().toISOString(), syncError: null });
      } catch (err) {
        await updateMeta({ syncStatus: 'error', syncError: String(err?.message || err) });
      }
      subscribeAll();
      // Periodic sync loop
      _syncLoopTimer = setInterval(async () => {
        if (!_running) return;
        const data = getData();
        try {
          await uploadPending();
          const pending = await data.adapter.countPendingSyncItems();
          const status = pending > 0 ? 'pending' : 'synced';
          await updateMeta({ syncStatus: status, lastSyncAt: new Date().toISOString(), syncError: null });
        } catch (err) {
          await updateMeta({ syncStatus: 'error', syncError: String(err?.message || err) });
        }
      }, SYNC_INTERVAL_MS);
    },

    // Stop sync engine (called when disabling Online Mode)
    async stop() {
      _running = false;
      _unsubscribers.forEach((fn) => fn());
      _unsubscribers = [];
      if (_syncLoopTimer) { clearInterval(_syncLoopTimer); _syncLoopTimer = null; }
      await updateMeta({ syncStatus: 'idle' });
    },

    // Manual retry
    async retryNow() {
      if (!_running) return;
      const data = getData();
      await updateMeta({ syncStatus: 'syncing' });
      try {
        await uploadPending();
        await downloadAll();
        const pending = await data.adapter.countPendingSyncItems();
        await updateMeta({ syncStatus: pending > 0 ? 'pending' : 'synced', lastSyncAt: new Date().toISOString(), syncError: null });
      } catch (err) {
        await updateMeta({ syncStatus: 'error', syncError: String(err?.message || err) });
      }
    },

    // Enqueue a local mutation for upload
    enqueue,

    isRunning: () => _running
  };
})();
