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
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';

export default function Branches() {
  const { t } = useConfig();
  const { profile, isAdministrator } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [adjustType, setAdjustType] = useState<'deposit' | 'withdraw'>('deposit');
  const [adjustCurrency, setAdjustCurrency] = useState('USD');
  const [adjustAmount, setAdjustAmount] = useState<number>(0);

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

  // Convert any currency amount to baseCurrency using latest officialRate
  // Returns null if no rate path exists (caller should skip in totals)
  const convertToBase = (amount: number, fromCurrency: string): number | null => {
    if (fromCurrency === baseCurrency) return amount;
    
    // Direct: from -> base (e.g. YER -> USD if rate YER/USD exists)
    const directRate = rates.find(r => r.baseCurrency === fromCurrency && r.targetCurrency === baseCurrency);
    if (directRate && directRate.officialRate > 0) return amount * directRate.officialRate;

    // Reverse: base -> from (e.g. USD -> YER 530, so YER / 530 = USD)
    const reverseRate = rates.find(r => r.baseCurrency === baseCurrency && r.targetCurrency === fromCurrency);
    if (reverseRate && reverseRate.officialRate > 0) return amount / reverseRate.officialRate;

    return null; // no conversion path
  };

  const openAdjust = (branch: Branch, type: 'deposit' | 'withdraw') => {
    setSelectedBranch(branch);
    setAdjustType(type);
    setAdjustCurrency(currencies.find(c => c.isActive)?.code || 'USD');
    setAdjustAmount(0);
    setIsAdjustOpen(true);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch?.id || !profile) return;
    try {
      if (adjustType === 'deposit') {
        await branchService.deposit(selectedBranch.id, adjustCurrency, adjustAmount, profile.uid);
      } else {
        await branchService.withdraw(selectedBranch.id, adjustCurrency, adjustAmount, profile.uid);
      }
      setIsAdjustOpen(false);
    } catch (err) {
      console.error("Balance adjust failed", err);
    }
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
                  {(() => {
                    const entries = Object.entries(branch.balances || {}) as [string, number][];
                    const converted = entries.map(([c,a]) => convertToBase(a, c));
                    const total = converted.reduce((acc: number, v) => v !== null ? acc + v : acc, 0);
                    const hasUnconvertible = converted.some(v => v === null);
                    return (
                      <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">
                        إجمالي تقديري: {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseCurrency}
                        {hasUnconvertible && <span className="text-amber-400 ms-1">• غير مكتمل</span>}
                      </div>
                    );
                  })()}
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
                <button onClick={() => openAdjust(branch, 'deposit')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-xs tracking-tight">إيداع</button>
                <button onClick={() => openAdjust(branch, 'withdraw')} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl border border-white/5 transition-all text-xs tracking-tight">سحب</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isAdjustOpen && selectedBranch && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdjustOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80]" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-x-4 top-[15%] md:mx-auto max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-[90] overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                <h3 className="font-bold text-white text-sm">{adjustType === 'deposit' ? 'إيداع رصيد' : 'سحب رصيد'} — {selectedBranch.name}</h3>
                <button onClick={() => setIsAdjustOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400">✕</button>
              </div>
              <form onSubmit={handleAdjust} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">العملة</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm outline-none" value={adjustCurrency} onChange={e => setAdjustCurrency(e.target.value)}>
                      {currencies.filter(c => c.isActive).map(c => (
                        <option key={c.id} className="bg-slate-900" value={c.code}>{c.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">المبلغ</label>
                    <input required type="number" step="any" min="0.01" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm outline-none" value={adjustAmount || ''} onChange={e => setAdjustAmount(Number(e.target.value))} />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsAdjustOpen(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 font-bold border border-white/5">إلغاء</button>
                  <button type="submit" className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg ${adjustType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'}`}>{adjustType === 'deposit' ? 'تأكيد الإيداع' : 'تأكيد السحب'}</button>
                </div>
                <p className="text-[10px] text-slate-500 text-center">سيتم تسجيل العملية في سجل التدقيق</p>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
