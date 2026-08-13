import { RuntimeConfig } from '../../../config.js';
import { OfflineAdapter } from '../classes/offlineAdapter.js';

// =============================================================================
// DATA — active adapter reference + mode management
// =============================================================================
export const Data = {
  adapter: null,
  mode: 'local', // 'local' | 'online'

  async init() {
    this.adapter = OfflineAdapter;
    await this.adapter.init();
    // Runtime mode is controlled by config.js
    const meta = await this.adapter.getDeviceMeta();
    this.mode = RuntimeConfig.serverMode === 'firebase' ? 'online' : 'local';
    if ((meta.storageMode || 'local') !== this.mode) {
      await this.adapter.saveDeviceMeta({ ...meta, storageMode: this.mode });
    }
    // Expose on globalThis so OfflineAdapter and SyncEngine can resolve lazily
    // without circular imports at parse time.
    globalThis._tenlbData = this;
  },

  isOnline() { return this.mode === 'online'; }
};
