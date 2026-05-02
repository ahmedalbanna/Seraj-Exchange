import React, { useEffect, useState } from 'react';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { branchService } from '../services/branchService';
import { currencyService } from '../services/currencyService';
import { Branch, Currency, ExchangeRate } from '../types';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Building2, 
  MapPin,
  Wallet
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';

export default function Branches() {
  const { t } = useConfig();
  const { isAdministrator } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [baseCurrency, setBaseCurrency] = useState('USD');

  useEffect(() => {
    if (!isAdministrator) return;
    const unsubBranches = branchService.subscribeToBranches((data) => {
      setBranches(data);
      setLoading(false);
    });
    
    const unsubCurrencies = currencyService.subscribeToCurrencies(setCurrencies);
    
    // Fetch latest rates for conversion
    const q = query(collection(db, 'exchange_rates'), orderBy('date', 'desc'), limit(50));
    const unsubRates = onSnapshot(q, (snap) => {
      setRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExchangeRate)));
    });

    return () => {
      unsubBranches();
      unsubCurrencies();
      unsubRates();
    };
  }, [isAdministrator]);

  if (!isAdministrator) return <Navigate to="/" />;

  // Utility to convert amount from any currency to baseCurrency
  const convertToBase = (amount: number, fromCurrency: string) => {
    if (fromCurrency === baseCurrency) return amount;
    
    // Look for a direct rate where we are converting TO base (e.g. YER to USD -> we need base YER, target USD)
    const directRate = rates.find(r => r.baseCurrency === fromCurrency && r.targetCurrency === baseCurrency);
    if (directRate) return amount * directRate.officialRate; // or marketRate depending on business logic

    // Look for reverse rate (e.g. base USD, target YER -> dividing YER by rate gives USD)
    const reverseRate = rates.find(r => r.baseCurrency === baseCurrency && r.targetCurrency === fromCurrency);
    if (reverseRate && reverseRate.officialRate > 0) return amount / reverseRate.officialRate;

    return 0; // cannot convert
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">إدارة الفروع</h1>
          <p className="text-slate-400 text-sm font-medium">نظرة عامة على أداء الفروع والأرصدة الحالية</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
          <Wallet className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">عملة التقييم:</span>
          <select 
            className="bg-transparent text-white font-bold text-sm outline-none border-none cursor-pointer"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
          >
            {currencies.filter(c => c.isActive).map(c => (
              <option key={c.id} className="bg-slate-900" value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
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
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">الأرصدة الحالية</div>
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">
                    إجمالي تقديري: {
                      Object.entries(branch.balances || {}).reduce((acc: number, [curr, amt]) => acc + convertToBase(amt as number, curr), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    } {baseCurrency}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(branch.balances || {}).map(([currencyCode, amount]) => (
                    <div key={currencyCode} className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                      <div className="text-[10px] text-slate-500 font-bold mb-1">{currencyCode}</div>
                      <div className="text-sm font-black text-white">{amount.toLocaleString()}</div>
                    </div>
                  ))}
                  {Object.keys(branch.balances || {}).length === 0 && (
                    <div className="col-span-3 p-3 rounded-2xl bg-white/5 border border-white/5 text-center text-xs text-slate-500 italic font-medium">
                      لا يوجد رصيد مسجل
                    </div>
                  )}
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
