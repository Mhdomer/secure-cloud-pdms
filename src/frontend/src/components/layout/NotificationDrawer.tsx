import { useState } from 'react'
import { Bell, Check, User, AlertCircle, ShieldCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/hooks/useLanguage'
import { notificationsApi } from '@/lib/api'
import { notifyStateChange } from '@/lib/syncChannel'

interface NotificationItem {
  id: string
  titleEn: string
  titleAr: string
  messageEn: string
  messageAr: string
  timeAgo?: string
  type: string
  read: boolean
}

const LOCAL_STORAGE_KEY = 'pdms_read_notification_ids'

export function NotificationDrawer() {
  const { isRtl } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  // Initialize read notification IDs from browser localStorage (persists across tab refreshes)
  const [readIds, setReadIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 5000,
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      notifyStateChange()
    },
  })

  const rawNotifications = data?.notifications || []

  // Apply persistent read state
  const notifications: NotificationItem[] = rawNotifications.map((n) => ({
    ...n,
    read: n.read || !!readIds[n.id],
  }))

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllRead = () => {
    const updated: Record<string, boolean> = { ...readIds }
    notifications.forEach((n) => {
      updated[n.id] = true
    })
    setReadIds(updated)
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
    } catch {}
    markAllMutation.mutate()
  }

  const handleToggle = () => {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)
    if (nextOpen && unreadCount > 0) {
      markAllRead()
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-neutral-900">
              {unreadCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute end-0 mt-2 w-80 sm:w-96 p-0 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-50">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                {isRtl ? 'مركز التنبيهات والإشعارات الفورية' : 'Live Clinic Notification Center'}
              </h4>
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-[11px] text-emerald-600 hover:text-emerald-700 p-1">
                <Check className="w-3 h-3 me-1" />
                {isRtl ? 'تحديد الكل كمقروء' : 'Mark all as read'}
              </Button>
            )}
          </div>

          {/* Notification List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-600 dark:text-slate-300">
                  {isRtl ? 'لا توجد إشعارات جديدة حالياً' : 'No new notifications right now'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isRtl ? 'سيتم إشعارك فور وصول مريض أو اكتمال زيارة' : 'Alerts will appear here when patients check in'}
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 flex gap-3 text-xs transition-colors ${
                    !item.read ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="pt-0.5">
                    {item.type === 'arrival' && <User className="w-4 h-4 text-blue-600" />}
                    {item.type === 'sla_warning' && <AlertCircle className="w-4 h-4 text-rose-500" />}
                    {item.type === 'billing' && <ShieldCheck className="w-4 h-4 text-amber-500" />}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {isRtl ? item.titleAr : item.titleEn}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.timeAgo}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                      {isRtl ? item.messageAr : item.messageEn}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
