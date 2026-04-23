import React, { useEffect, useState } from 'react';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { branchService } from '../services/branchService';
import { Branch } from '../types';
import { 
  Building2, 
  MapPin
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';

export default function Branches() {
  const { t } = useConfig();
  const { isAdmin } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = branchService.subscribeToBranches((data) => {
      setBranches(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">إدارة الفروع</h1>
        <p className="text-slate-400 text-sm font-medium">نظرة عامة على أداء الفروع والأرصدة الحالية</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full h-64 flex items-center justify-center text-slate-500 italic">
            {t('loading')}
          </div>
        ) : branches.map((branch, idx) => (
          <motion.div
            key={branch.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 hover:bg-white/[0.08] transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Building2 className="w-24 h-24 text-white" />
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/20">
                  <Building2 className="text-blue-400 w-6 h-6" />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                  نشط
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-black text-white mb-1">{branch.name}</h3>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  {branch.location}
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-white/5">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">الأرصدة الحالية</div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                    <div className="text-[10px] text-slate-500 font-bold mb-1">USD</div>
                    <div className="text-sm font-black text-white">{branch.balances.USD.toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                    <div className="text-[10px] text-slate-500 font-bold mb-1">SAR</div>
                    <div className="text-sm font-black text-white">{branch.balances.SAR.toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                    <div className="text-[10px] text-slate-500 font-bold mb-1">YER</div>
                    <div className="text-sm font-black text-white font-mono">{branch.balances.YER.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl border border-white/5 transition-all text-xs tracking-tight">التفاصيل</button>
                <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all text-xs tracking-tight">إيداع / سحب</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
