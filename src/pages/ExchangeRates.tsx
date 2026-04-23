import React, { useEffect, useState } from 'react';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ExchangeRate } from '../types';
import { TrendingUp, Plus, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function ExchangeRates() {
  const { t } = useConfig();
  const { profile, isManager } = useAuth();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRate, setNewRate] = useState({
    baseCurrency: 'USD',
    targetCurrency: 'YER',
    officialRate: 0,
    marketRate: 0,
  });

  useEffect(() => {
    const q = query(collection(db, 'exchange_rates'), orderBy('date', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExchangeRate)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    try {
      await addDoc(collection(db, 'exchange_rates'), {
        ...newRate,
        updatedBy: profile.uid,
        date: serverTimestamp(),
      });
      setNewRate({ baseCurrency: 'USD', targetCurrency: 'YER', officialRate: 0, marketRate: 0 });
    } catch (err) {
      console.error("Error adding rate", err);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">إدارة أسعار الصرف</h1>
        <p className="text-slate-400 text-sm font-medium">تسجيل الأسعار الرسمية والموازية المعتمدة للمحاسبة الداخلية</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rate Entry Form (Managers only) */}
        {isManager && (
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl sticky top-24">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2 text-sm">
                <Plus className="w-5 h-5 text-blue-400" />
                تحديث سعر الصرف
              </h3>
              <form onSubmit={handleAddRate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">من عملة</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-xl text-xs py-2.5 px-3 outline-none focus:ring-1 focus:ring-blue-500" value={newRate.baseCurrency} onChange={e => setNewRate({...newRate, baseCurrency: e.target.value})}>
                      <option className="bg-slate-900" value="USD">USD - دولار</option>
                      <option className="bg-slate-900" value="SAR">SAR - سعودي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">إلى عملة</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-xl text-xs py-2.5 px-3 outline-none focus:ring-1 focus:ring-blue-500" value={newRate.targetCurrency} onChange={e => setNewRate({...newRate, targetCurrency: e.target.value})}>
                      <option className="bg-slate-900" value="YER">YER - ريال يمني</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{t('official_rate')}</label>
                  <input required type="number" step="any" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 outline-none focus:ring-1 focus:ring-blue-500 text-sm" value={newRate.officialRate} onChange={e => setNewRate({...newRate, officialRate: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{t('market_rate')}</label>
                  <input required type="number" step="any" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 outline-none focus:ring-1 focus:ring-blue-500 text-sm" value={newRate.marketRate} onChange={e => setNewRate({...newRate, marketRate: Number(e.target.value)})} />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 text-[10px] uppercase tracking-widest mt-4">
                  حفظ البيانات
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Rates History List */}
        <div className={isManager ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="font-bold text-white text-sm">السجل التاريخي</h3>
              <Clock className="w-5 h-5 text-slate-500" />
            </div>
            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="p-12 text-center text-slate-500 italic text-sm">{t('loading')}</div>
              ) : rates.length === 0 ? (
                <div className="p-12 text-center text-slate-500 italic text-sm font-medium">{t('no_data')}</div>
              ) : rates.map((rate, idx) => (
                <div key={rate.id} className="p-6 hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white">{rate.baseCurrency}</span>
                        <span className="text-slate-600 font-bold">→</span>
                        <span className="font-black text-white">{rate.targetCurrency}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {rate.date && format(rate.date.toDate(), 'EEEE, d MMMM yyyy', { locale: ar })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-8">
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-500 mb-1 tracking-wider">الرسمي</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-white">{rate.officialRate.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-600 font-bold">YER</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-500 mb-1 tracking-wider">الموازي (السوق)</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-blue-400">{rate.marketRate.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-600 font-bold">YER</span>
                        {idx < rates.length - 1 && (
                          <span className={rates[idx].marketRate >= (rates[idx+1]?.marketRate || 0) ? "text-emerald-500" : "text-rose-500"}>
                            {rates[idx].marketRate >= (rates[idx+1]?.marketRate || 0) ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
