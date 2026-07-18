import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DoctorRoomSettings {
  room1Name: string
  room1Number: string
  room2Name: string
  room2Number: string
}

interface DoctorRoomSettingsStore {
  settings: DoctorRoomSettings | null
  setSettings: (settings: DoctorRoomSettings) => void
}

/**
 * Stopgap for the Doctor Dashboard hero banner's room labels (D-2): the
 * `users`/`doctors` tables have no room-label columns yet, so this is
 * `localStorage`-only, scoped per browser rather than per doctor account.
 * TODO: once `room_name_1`/`room_name_2` columns (or a `doctor_settings`
 * table) exist and `PATCH /users/me` accepts them, replace this with a real
 * fetch/mutation and delete this store.
 */
export const useDoctorRoomSettingsStore = create<DoctorRoomSettingsStore>()(
  persist(
    (set) => ({
      settings: null,
      setSettings: (settings) => set({ settings }),
    }),
    {
      name: 'pdms-doctor-room-settings',
    },
  ),
)
