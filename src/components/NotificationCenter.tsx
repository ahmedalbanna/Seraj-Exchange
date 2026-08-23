import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { notificationService } from '../services/notificationService';
import { Notification } from '../types';
import { Bell, Check, ExternalLink, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = notificationService.subscribeToNotifications(user.uid, setNotifications);
    return () => unsubscribe();
  }, [user]);

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    if (user) notificationService.markAllAsRead(user.uid);
  };

  const handleClearAll = () => {
    if (user) notificationService.clearAll(user.uid);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group"
      >
        <Bell className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-lg shadow-rose-500/40">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute end-0 mt-3 w-80 md:w-96 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">التنبيهات</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    تحديد الكل كمقروء
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 italic text-xs font-medium">
                    لا يوجد تنبيهات حالياً
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={cn(
                          "p-4 transition-colors relative group",
                          n.read ? "bg-transparent" : "bg-blue-500/5"
                        )}
                        onClick={() => !n.read && handleMarkAsRead(n.id!)}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                            n.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            n.type === 'warning' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            n.type === 'error' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                            "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          )}>
                            <Circle className="w-3 h-3 fill-current" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <p className="text-xs font-black text-white uppercase tracking-tight">{n.title}</p>
                              <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                                {n.createdAt && format(n.createdAt.toDate(), 'p', { locale: ar })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            {n.link && (
                              <button className="mt-2 text-[10px] font-black text-blue-400 flex items-center gap-1 hover:underline">
                                <ExternalLink className="w-2.5 h-2.5" />
                                عرض التفاصيل
                              </button>
                            )}
                          </div>
                        </div>
                        {!n.read && (
                          <div className="absolute top-4 end-4 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-white/5 bg-white/[0.02] flex gap-2">
                <button onClick={handleClearAll} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 text-[10px] uppercase font-black tracking-widest hover:bg-white/10 transition-colors">
                  مسح جميع التنبيهات
                </button>
                <button onClick={() => setIsOpen(false)} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500">إغلاق</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
