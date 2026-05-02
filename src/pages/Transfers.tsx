import React, { useEffect, useState } from 'react';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { transferService } from '../services/transferService';
import { notificationService } from '../services/notificationService';
import { Transfer, Branch } from '../types';
import { 
  Plus, 
  Search, 
  XCircle, 
  ArrowRightLeft,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { branchService } from '../services/branchService';
import { currencyService } from '../services/currencyService';
import { Currency } from '../types';

export default function Transfers() {
  const { t } = useConfig();
  const { profile, isAdministrator, isSupervisor } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedTransferForReceive, setSelectedTransferForReceive] = useState<Transfer | null>(null);
  const [receiveDetails, setReceiveDetails] = useState({
    receiverIdType: 'nationalId',
    receiverIdNumber: '',
    notes: ''
  });
  const [filters, setFilters] = useState({
    status: 'all',
    currency: 'all',
    search: ''
  });
  const [newTransfer, setNewTransfer] = useState<Partial<Transfer>>({
    currency: 'USD',
    amount: 0,
    exchangeRate: 1,
    senderName: '',
    receiverName: '',
    senderPhone: '',
    receiverPhone: '',
    toBranchId: '',
  });

  useEffect(() => {
    if (!profile) return;
    
    setLoading(true);
    const unsubscribe = transferService.subscribeToBranchTransfers(
      profile.branchId || '', 
      isAdministrator, 
      isSupervisor,
      (data) => {
        setTransfers(data);
        setLoading(false);
      }
    );

    const branchesUnsub = branchService.subscribeToBranches(setBranches);
    const currenciesUnsub = currencyService.subscribeToCurrencies(setCurrencies);

    return () => {
      unsubscribe();
      branchesUnsub();
      currenciesUnsub();
    };
  }, [profile, isAdministrator, isSupervisor]);

  const filteredTransfers = transfers.filter(t => {
    const matchesStatus = filters.status === 'all' || t.status === filters.status;
    const matchesCurrency = filters.currency === 'all' || t.currency === filters.currency;
    const matchesSearch = !filters.search || 
      t.senderName.toLowerCase().includes(filters.search.toLowerCase()) ||
      t.receiverName.toLowerCase().includes(filters.search.toLowerCase()) ||
      t.senderPhone.includes(filters.search) ||
      t.receiverPhone.includes(filters.search) ||
      (t.id && t.id.toLowerCase().includes(filters.search.toLowerCase()));
    return matchesStatus && matchesCurrency && matchesSearch;
  });

  const handlePreCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newTransfer.senderName || !newTransfer.receiverName || !newTransfer.toBranchId) return;
    setIsConfirmOpen(true);
  };

  const handleFinalCreate = async () => {
    if (!profile) return;
    
    await transferService.create({
      ...newTransfer as Omit<Transfer, 'issuedAt' | 'issuedBy' | 'status' | 'id'>,
      fromBranchId: profile.branchId || 'main',
      totalAmount: (newTransfer.amount || 0) * (newTransfer.exchangeRate || 1),
    }, profile.uid);

    // Notify receiving branch managers
    if (newTransfer.toBranchId) {
      notificationService.sendToBranchManagers(newTransfer.toBranchId, {
        title: 'حوالة واردة جديدة',
        message: `تم إرسال حوالة جديدة بمبلغ ${newTransfer.amount} ${newTransfer.currency} من فرع ${branches.find(b => b.id === profile.branchId)?.name || 'المركز'}`,
        type: 'info',
        link: '/transfers'
      });
    }

    setIsModalOpen(false);
    setIsConfirmOpen(false);
    setNewTransfer({ currency: 'USD', amount: 0, exchangeRate: 1 });
  };

  const openReceiveModal = (transfer: Transfer) => {
    setSelectedTransferForReceive(transfer);
    setReceiveDetails({
      receiverIdType: 'nationalId',
      receiverIdNumber: '',
      notes: ''
    });
    setIsReceiveModalOpen(true);
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedTransferForReceive) return;
    await transferService.receive(selectedTransferForReceive.id!, profile.uid, selectedTransferForReceive, receiveDetails);
    setIsReceiveModalOpen(false);
    setSelectedTransferForReceive(null);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      processing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      received: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      failed: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      cancelled: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    };
    return (
      <span className={cn("px-2 py-1 rounded-md text-[9px] font-black border uppercase tracking-tighter", colors[status as keyof typeof colors])}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('transfers')}</h1>
          <p className="text-slate-400 text-sm">إدارة ومراقبة التحويلات المالية بين الفروع</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          {t('add_transfer')}
        </button>
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/5 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full text-slate-300">
            <Search className="absolute inset-y-0 start-4 my-auto w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="البحث بالاسم، الهاتف، أو الرقم المرجعي..." 
              className="w-full bg-white/5 border border-white/5 rounded-xl ps-11 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              value={filters.search}
              onChange={e => setFilters({...filters, search: e.target.value})}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select 
              className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-400 outline-none"
              value={filters.status}
              onChange={e => setFilters({...filters, status: e.target.value})}
            >
              <option value="all" className="bg-slate-900">كل الحالات</option>
              <option value="pending" className="bg-slate-900">معلقة</option>
              <option value="processing" className="bg-slate-900">قيد المعالجة</option>
              <option value="received" className="bg-slate-900">مستلمة</option>
              <option value="failed" className="bg-slate-900">فاشلة</option>
              <option value="cancelled" className="bg-slate-900">ملغاة</option>
            </select>
            <select 
              className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-400 outline-none"
              value={filters.currency}
              onChange={e => setFilters({...filters, currency: e.target.value})}
            >
              <option value="all" className="bg-slate-900">كل العملات</option>
              {currencies.filter(c => c.isActive).map(c => (
                <option key={c.id} value={c.code} className="bg-slate-900">{c.code}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 text-[10px] uppercase tracking-widest border-b border-white/5">
                <th className="px-6 py-4 text-start font-bold">المرسل / المستلم</th>
                <th className="px-6 py-4 text-start font-bold">المبلغ</th>
                <th className="px-6 py-4 text-start font-bold">الحالة</th>
                <th className="px-6 py-4 text-start font-bold">التاريخ</th>
                <th className="px-6 py-4 text-start font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">{t('loading')}</td></tr>
              ) : filteredTransfers.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic font-medium">{t('no_data')}</td></tr>
              ) : filteredTransfers.map((transfer) => (
                <tr key={transfer.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white uppercase">{transfer.senderName}</span>
                        <ArrowRightLeft className="w-3 h-3 text-slate-600 transform rtl:rotate-180" />
                        <span className="text-sm font-bold text-white uppercase">{transfer.receiverName}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-3">
                        <span className="flex items-center gap-1 opacity-70"><Phone className="w-2.5 h-2.5" /> {transfer.senderPhone}</span>
                        <span className="opacity-30">/</span>
                        <span className="flex items-center gap-1 opacity-70"><Phone className="w-2.5 h-2.5" /> {transfer.receiverPhone}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white">
                        {transfer.amount.toLocaleString()} {transfer.currency}
                      </span>
                      {transfer.exchangeRate !== 1 && (
                        <span className="text-[10px] text-blue-400 font-medium italic opacity-70 tracking-tight">
                          إجمالي: {transfer.totalAmount.toLocaleString()} YER
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-start">
                    <StatusBadge status={transfer.status} />
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-[10px] font-medium text-slate-500">
                      {transfer.issuedAt && format(transfer.issuedAt.toDate(), 'yyyy/MM/dd p', { locale: ar })}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {transfer.status === 'pending' && profile?.branchId === transfer.toBranchId && (
                      <button 
                        onClick={() => openReceiveModal(transfer)}
                        className="text-[10px] font-bold bg-emerald-600/90 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        تأكيد الاستلام
                      </button>
                    )}
                    {transfer.status === 'received' && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">تم الاستلام</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transfer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-10 md:top-20 md:mx-auto max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <h2 className="text-lg font-bold text-white">{t('add_transfer')}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                  <XCircle className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handlePreCreate} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                    <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em] flex items-center gap-2">
                       بيانات المرسل
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">اسم المرسل</label>
                        <input required type="text" className="w-full bg-white/5 border border-white/10 rounded-xl text-sm py-2.5 px-4 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="الاسم الكامل" 
                          value={newTransfer.senderName || ''}
                          onChange={e => setNewTransfer({...newTransfer, senderName: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">رقم هاتف المرسل</label>
                        <input required type="tel" className="w-full bg-white/5 border border-white/10 rounded-xl text-sm py-2.5 px-4 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="77XXXXXXX" 
                          value={newTransfer.senderPhone || ''}
                          onChange={e => setNewTransfer({...newTransfer, senderPhone: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <h3 className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] flex items-center gap-2">
                       بيانات المستلم
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">اسم المستلم</label>
                        <input required type="text" className="w-full bg-white/5 border border-white/10 rounded-xl text-sm py-2.5 px-4 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="الاسم الكامل" 
                          value={newTransfer.receiverName || ''}
                          onChange={e => setNewTransfer({...newTransfer, receiverName: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">رقم هاتف المستلم</label>
                        <input required type="tel" className="w-full bg-white/5 border border-white/10 rounded-xl text-sm py-2.5 px-4 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="77XXXXXXX" 
                          value={newTransfer.receiverPhone || ''}
                          onChange={e => setNewTransfer({...newTransfer, receiverPhone: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">العملة</label>
                    <select required className="w-full bg-white/5 border border-white/10 rounded-xl text-sm py-2.5 px-3 outline-none" value={newTransfer.currency} 
                      onChange={e => setNewTransfer({...newTransfer, currency: e.target.value})}>
                      {currencies.filter(c => c.isActive).map(c => (
                        <option key={c.id} className="bg-slate-900" value={c.code}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">المبلغ</label>
                    <input required type="number" step="any" className="w-full bg-white/5 border border-white/10 rounded-xl text-sm py-2.5 px-4 outline-none" value={newTransfer.amount || ''} 
                      onChange={e => setNewTransfer({...newTransfer, amount: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">إلى فرع</label>
                    <select required className="w-full bg-white/5 border border-white/10 rounded-xl text-sm py-2.5 px-3 outline-none" value={newTransfer.toBranchId} 
                      onChange={e => setNewTransfer({...newTransfer, toBranchId: e.target.value})}>
                      <option className="bg-slate-900" value="">اختر الفرع...</option>
                      {branches.map(b => <option className="bg-slate-900" key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-6">
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-2xl shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-wider text-xs">
                    مراجعة بيانات الحوالة
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {isConfirmOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[60]" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:mx-auto max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl z-[70] text-center">
              <h3 className="text-xl font-bold text-white mb-2">تأكيد الحوالة</h3>
              <p className="text-slate-400 text-sm mb-8">يرجى مراجعة البيانات بعناية قبل التأكيد</p>
              
              <div className="space-y-4 text-start mb-8">
                <div className="bg-white/5 p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold uppercase tracking-widest">المرسل:</span>
                    <span className="text-white font-black">{newTransfer.senderName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold uppercase tracking-widest">المستلم:</span>
                    <span className="text-white font-black">{newTransfer.receiverName}</span>
                  </div>
                  <div className="h-px bg-white/10 my-2" />
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">المبلغ:</span>
                    <span className="text-blue-400 font-black">{newTransfer.amount?.toLocaleString()} {newTransfer.currency}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-black hover:bg-white/10 transition-colors text-[10px] uppercase tracking-widest">إلغاء</button>
                <button onClick={handleFinalCreate} className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-500 shadow-xl shadow-emerald-500/20 text-[10px] uppercase tracking-widest">تأكيد وإرسال</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Receive Modal */}
      <AnimatePresence>
        {isReceiveModalOpen && selectedTransferForReceive && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[60]" onClick={() => setIsReceiveModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:mx-auto max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl z-[70]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">تأكيد استلام الحوالة</h3>
                <button onClick={() => setIsReceiveModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                  <XCircle className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="bg-white/5 p-4 rounded-2xl mb-6 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-widest">المستلم:</span>
                  <span className="text-white font-black hover:text-emerald-400 transition-colors">{selectedTransferForReceive.receiverName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-widest">المبلغ:</span>
                  <span className="text-emerald-400 font-black">{selectedTransferForReceive.amount.toLocaleString()} {selectedTransferForReceive.currency}</span>
                </div>
              </div>

              <form onSubmit={handleReceive} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">نوع إثبات الهوية</label>
                  <select 
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl text-sm py-2.5 px-4 outline-none"
                    value={receiveDetails.receiverIdType}
                    onChange={e => setReceiveDetails({...receiveDetails, receiverIdType: e.target.value})}
                  >
                    <option className="bg-slate-900" value="nationalId">بطاقة شخصية</option>
                    <option className="bg-slate-900" value="passport">جواز سفر</option>
                    <option className="bg-slate-900" value="familyCard">بطاقة عائلية</option>
                    <option className="bg-slate-900" value="other">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">ملاحظات / رقم الهوية</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl text-sm py-2.5 px-4 outline-none focus:border-emerald-500/50"
                    placeholder="رقم الهوية أو أي ملاحظات إضافية"
                    value={receiveDetails.receiverIdNumber}
                    onChange={e => setReceiveDetails({...receiveDetails, receiverIdNumber: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full mt-6 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-500 shadow-xl shadow-emerald-500/20 text-xs uppercase tracking-widest transition-all active:scale-95">تأكيد الاستلام وصرف المبلغ</button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
