import { queryClient } from '../main'

const CHANNEL_NAME = 'pdms_realtime_sync'

let broadcastChannel: BroadcastChannel | null = null

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME)
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'INVALIDATE_ALL') {
        queryClient.invalidateQueries()
      }
    }
  }
} catch {
  // Graceful fallback for environments without BroadcastChannel
}

/**
 * Universal instant state synchronizer.
 * Call this whenever any status transition occurs (billing paid, visit checked-in,
 * consultation completed, notification marked read, registration created).
 * Instantly invalidates all React Query caches locally AND across all open browser tabs/windows!
 */
export function notifyStateChange() {
  queryClient.invalidateQueries()
  try {
    broadcastChannel?.postMessage({ type: 'INVALIDATE_ALL', timestamp: Date.now() })
  } catch {}
}
