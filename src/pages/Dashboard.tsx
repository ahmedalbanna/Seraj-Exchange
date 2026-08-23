import React, { useEffect, useState } from 'react';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeftRight, 
  TrendingUp,
  Clock,
  LucideIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transfer } from '../types';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export default function Dashboard() {
  const { t } = useConfig();
  const { profile, isAdministrator, isSupervisor } = useAuth();
  const [stats, setStats] = useState({ total_sent: 0, total_received: 0, pending: 0, daily_avg: 0 });
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!profile) return;
      setLoading(true);
      try {
        const transfersRef = collection(db, 'transfers');

        let allTransfers: Transfer[] = [];

        if (isAdministrator || isSupervisor) {
          const q = query(transfersRef, orderBy('issuedAt', 'desc'), limit(100));
          const snap = await getDocs(q);
          allTransfers = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Transfer));
        } else if (profile.branchId) {
          const qFrom = query(transfersRef, where('fromBranchId', '==', profile.branchId), orderBy('issuedAt', 'desc'), limit(50));
          const qTo = query(transfersRef, where('toBranchId', '==', profile.branchId), orderBy('issuedAt', 'desc'), limit(50));
          const [snapFrom, snapTo] = await Promise.all([
            getDocs(qFrom).catch(e => { console.error("Dashboard fromBranch query failed (missing index?)", e); return { docs: [] as any[] } as any; }),
            getDocs(qTo).catch(e => { console.error("Dashboard toBranch query failed (missing index for toBranchId+issuedAt)", e); return { docs: [] as any[] } as any; })
          ]);
          const from = snapFrom.docs.map((d: any) => ({ id: d.id, ...(d.data() as object) } as Transfer));
          const to = snapTo.docs.map((d: any) => ({ id: d.id, ...(d.data() as object) } as Transfer));
          const map = new Map<string, Transfer>();
          [...from, ...to].forEach(t => { if (t.id) map.set(t.id, t); });
          allTransfers = Array.from(map.values()).sort((a,b) => (b.issuedAt?.toMillis?.() ?? 0) - (a.issuedAt?.toMillis?.() ?? 0));
        } else {
          setRecentTransfers([]);
          setStats({ total_sent: 0, total_received: 0, pending: 0, daily_avg: 0 });
          setLoading(false);
          return;
        }

        // Recent 5 for UI
        setRecentTransfers(allTransfers.slice(0, 5));

        // Compute stats from fetched window (real app would use aggregation doc/Cloud Function)
        const pending = allTransfers.filter(t => t.status === 'pending').length;
        let total_sent = 0;
        let total_received = 0;
        if (isAdministrator || isSupervisor) {
          total_sent = allTransfers.reduce((s,t) => s + (t.amount || 0), 0);
          total_received = allTransfers.filter(t => t.status === 'received').reduce((s,t) => s + (t.amount || 0), 0);
        } else {
          total_sent = allTransfers.filter(t => t.fromBranchId === profile.branchId).reduce((s,t) => s + (t.amount || 0), 0);
          total_received = allTransfers.filter(t => t.toBranchId === profile.branchId && t.status === 'received').reduce((s,t) => s + (t.amount || 0), 0);
        }
        const daily_avg = total_sent ? Math.round(total_sent / 30) : 0;

        setStats({ total_sent, total_received, pending, daily_avg });
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [profile, isAdministrator, isSupervisor]);

  const chartData = [
    { name: '01/04', value: 4000 },
    { name: '05/04', value: 3000 },
    { name: '10/04', value: 2000 },
    { name: '15/04', value: 2780 },
    { name: '20/04', value: 1890 },
    { name: '25/04', value: 2390 },
    { name: '30/04', value: 3490 },
  ];

  const StatCard = ({ title, value, icon: Icon, color, trend }: { title: string, value: number, icon: LucideIcon, color: string, trend?: number }) => (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={cn(
            "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
            trend > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
          )}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-400 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-white">
        {value.toLocaleString()} 
        <span className="text-xs font-normal text-slate-500 ms-1">$</span>
      </h3>
    </motion.div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('dashboard')}</h1>
        <p className="text-slate-400 text-sm">مرحباً بك في لوحة تحويلات سراج للصرافة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="إجمالي الحوالات الصادرة" value={stats.total_sent} icon={ArrowUpRight} color="blue" trend={12} />
        <StatCard title="إجمالي الحوالات الواردة" value={stats.total_received} icon={ArrowDownRight} color="emerald" trend={8} />
        <StatCard title="الحوالات المعلقة" value={stats.pending} icon={Clock} color="amber" />
        <StatCard title="متوسط الحركة اليومي" value={stats.daily_avg} icon={TrendingUp} color="violet" trend={-2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-6 text-sm">
            <h3 className="font-bold text-white">إحصائيات العمليات</h3>
            <select className="bg-white/5 border border-white/10 text-[10px] font-bold rounded-lg px-3 py-1.5 text-slate-400 outline-none">
              <option className="bg-slate-900">آخر 30 يوم</option>
              <option className="bg-slate-900">آخر 7 أيام</option>
            </select>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(10px)',
                    color: '#fff'
                  }} 
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex flex-col">
          <h3 className="font-bold text-white mb-6 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            آخر العمليات
          </h3>
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {recentTransfers.map((t, idx) => (
              <div key={t.id || idx} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                  t.status === 'received' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                )}>
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{t.receiverName}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {t.amount} {t.currency}
                  </p>
                </div>
                <div className="text-end">
                  <span className={cn(
                    "text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-tighter",
                    t.status === 'received' ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
                  )}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
            {recentTransfers.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-40 opacity-30 italic">
                <p className="text-xs">لا يوجد حوالات مؤخراً</p>
              </div>
            )}
          </div>
          <button className="mt-6 w-full py-3 rounded-xl bg-white/5 border border-white/5 text-slate-300 text-xs font-bold hover:bg-white/10 transition-colors">
            عرض الكل
          </button>
        </div>
      </div>
    </div>
  );
}

const cn = (...inputs: (string | boolean | undefined)[]) => {
  return inputs.filter(Boolean).join(' ');
}
