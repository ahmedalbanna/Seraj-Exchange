import React, { useEffect, useState } from 'react';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { branchService } from '../services/branchService';
import { settlementService } from '../services/settlementService';
import { notificationService } from '../services/notificationService';
import { Branch, Settlement } from '../types';
import { 
  Scale, 
  ArrowRightLeft, 
  Building2, 
  ChevronRight, 
  FileText,
  Calculator,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function Reconciliation() {
  const { t } = useConfig();
  const { isAdministrator, isSupervisor, profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [outstanding, setOutstanding] = useState<Record<string, number>>({});
  const [isSettling, setIsSettling] = useState(false);
  
  const [settlementForm, setSettlementForm] = useState({
    currency: 'USD',
    amount: 0,
    rate: 1,
  });

  useEffect(() => {
    if (!isAdministrator && !isSupervisor) return;
    const unsubBranches = branchService.subscribeToBranches(setBranches);
    const unsubSettlements = settlementService.subscribeToSettlements(setSettlements);
    setLoading(false);
    return () => {
      unsubBranches();
      unsubSettlements();
    };
  }, [isAdministrator, isSupervisor]);

  const fetchOutstanding = async () => {
    if (sourceBranch && targetBranch) {
      const balances = await settlementService.getOutstandingBalances(sourceBranch, targetBranch);
      setOutstanding(balances || {});
      const currencies = Object.keys(balances || {});
      if (currencies.length > 0) {
        setSettlementForm(prev => ({ ...prev, currency: currencies[0], amount: balances![currencies[0]] }));
      }
    }
  };

  useEffect(() => {
    fetchOutstanding();
  }, [sourceBranch, targetBranch]);

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    await settlementService.createSettlement({
      fromBranchId: sourceBranch,
      toBranchId: targetBranch,
      currency: settlementForm.currency,
      amount: settlementForm.amount,
      appliedRate: settlementForm.rate,
      settledAmount: settlementForm.amount * settlementForm.rate,
      settledBy: profile.uid,
      transferIds: [], // In a real system, we'd link specific transfers
    });

    // Notify target branch about the settlement
    notificationService.sendToBranchManagers(targetBranch, {
      title: 'تم إغلاق تسوية مالية',
      message: `تم إجراء تسوية مالية لفرعكم بمبلغ ${settlementForm.amount} ${settlementForm.currency}`,
      type: 'success',
      link: '/reconciliation'
    });
    
    setIsSettling(false);
    fetchOutstanding();
  };

  if (!isAdministrator && !isSupervisor) return <Navigate to="/" />;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">التسويات المالية بين الفروع</h1>
        <p className="text-slate-400 text-sm font-medium">مطابقة الحسابات الوسيطة وتصفية الأرصدة المعلقة</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tool Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Scale className="text-white w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-white">أداة المطابقة</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">الفرع الأول</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={sourceBranch}
                  onChange={e => setSourceBranch(e.target.value)}
                >
                  <option className="bg-slate-900" value="">اختر الفرع...</option>
                  {branches.map(b => <option className="bg-slate-900" key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">الفرع الثاني</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={targetBranch}
                  onChange={e => setTargetBranch(e.target.value)}
                >
                  <option className="bg-slate-900" value="">اختر الفرع...</option>
                  {branches.map(b => <option className="bg-slate-900" key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <AnimatePresence>
              {sourceBranch && targetBranch && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">الأرصدة المعلقة (حوالات غير مستلمة)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Object.keys(outstanding).length === 0 ? (
                        <div className="col-span-full py-4 text-center text-slate-500 text-xs italic font-medium">لا يوجد أرصدة معلقة حالياً</div>
                      ) : Object.entries(outstanding).map(([curr, bal]) => (
                        <div key={curr} className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                          <div className="text-[10px] font-black text-blue-400 mb-1">{curr}</div>
                          <div className="text-lg font-black text-white">{bal.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {Object.keys(outstanding).length > 0 && (
                    <button 
                      onClick={() => setIsSettling(true)}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                      <Calculator className="w-4 h-4" />
                      إجراء تسوية مالية
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                سجل التسويات الأخيرة
              </h3>
              <button className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:underline">
                تحميل تقرير شامل
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="bg-white/[0.02] text-slate-500 font-black tracking-widest uppercase border-b border-white/5">
                    <th className="px-6 py-4 text-start font-bold">التاريخ</th>
                    <th className="px-6 py-4 text-start font-bold">الفروع</th>
                    <th className="px-6 py-4 text-start font-bold">المبلغ</th>
                    <th className="px-6 py-4 text-start font-bold">المعدل المطبق</th>
                    <th className="px-6 py-4 text-start font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {settlements.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">لا يوجد سجلات تسوية</td></tr>
                  ) : settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-slate-400 font-medium">
                          {s.settledAt && format(s.settledAt.toDate(), 'yyyy/MM/dd p', { locale: ar })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-white font-bold">
                          {branches.find(b => b.id === s.fromBranchId)?.name}
                          <ArrowRightLeft className="w-3 h-3 text-slate-600" />
                          {branches.find(b => b.id === s.toBranchId)?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-white">{s.amount.toLocaleString()} {s.currency}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-blue-400 font-black">{s.appliedRate}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-[9px] uppercase tracking-widest">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
              <FileText className="w-32 h-32 text-white" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-black text-white mb-4 leading-tight">تقارير الذمم المالية</h3>
              <p className="text-blue-100 text-xs font-medium mb-8 leading-relaxed">يمكنك إنشاء تقرير مفصل يوضح المديونية المتبادلة بين الفروع وتاريخ آخر تسوية تمت بينهم.</p>
              <button className="w-full py-4 bg-white text-blue-600 font-black rounded-2xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all text-[10px] uppercase tracking-widest">
                إنشاء تقرير الآن
              </button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">أهمية التسوية</h4>
            <ul className="space-y-3">
              {[
                "تقليل مخاطر تقلب العملات",
                "تحسين التدفق النقدي للفروع",
                "دقة أعلى في الميزانية العمومية",
                "مطابقة الحوالات المعلقة"
              ].map((txt, i) => (
                <li key={i} className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <ChevronRight className="w-3.5 h-3.5 text-blue-500" />
                  {txt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Settlement Modal */}
      <AnimatePresence>
        {isSettling && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettling(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80]" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-x-4 top-[20%] md:mx-auto max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-[90] overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-black text-white">إجراء تسوية جديدة</h3>
                  <p className="text-slate-500 text-xs font-medium mt-1">تحديد المبلغ وسعر الصرف المطبق للإغلاق</p>
                </div>

                <form onSubmit={handleSettle} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">العملة</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                        value={settlementForm.currency}
                        onChange={e => setSettlementForm({...settlementForm, currency: e.target.value})}
                      >
                        {Object.keys(outstanding).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">المبلغ المراد تسويته</label>
                      <input 
                        type="number" 
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                        value={settlementForm.amount}
                        onChange={e => setSettlementForm({...settlementForm, amount: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">سعر الصرف المطبق (للتصفية)</label>
                    <input 
                      type="number" 
                      step="any"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                      value={settlementForm.rate}
                      onChange={e => setSettlementForm({...settlementForm, rate: Number(e.target.value)})}
                    />
                  </div>
                  
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                    <div className="text-[10px] font-black text-slate-500 uppercase mb-1">المبلغ الصافي بالتسوية</div>
                    <div className="text-xl font-black text-blue-400">{(settlementForm.amount * settlementForm.rate).toLocaleString()} YER</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <button type="button" onClick={() => setIsSettling(false)} className="py-4 bg-white/5 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-white/10">إلغاء</button>
                    <button type="submit" className="py-4 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20">تأكيد التسوية</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
