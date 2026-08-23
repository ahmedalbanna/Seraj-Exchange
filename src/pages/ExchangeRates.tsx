import React, { useEffect, useState } from 'react';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { ExchangeRate } from '../types';
import { TrendingUp, Plus, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

import { currencyService } from '../services/currencyService';
import { exchangeRateService } from '../services/exchangeRateService';
import { Currency } from '../types';

export default function ExchangeRates() {
  const { t } = useConfig();
  const { profile, isAdministrator, isSupervisor } = useAuth();
  const canManage = isAdministrator || isSupervisor;
  const [activeTab, setActiveTab] = useState<'rates' | 'currencies'>('rates');
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rateLimit, setRateLimit] = useState(20);
  const [newCurrency, setNewCurrency] = useState<Omit<Currency, 'id'>>({ code: '', name: '', symbol: '', isActive: true });
  const [newRate, setNewRate] = useState({
    baseCurrency: 'USD',
    targetCurrency: 'YER',
    officialRate: 0,
    marketRate: 0,
  });

  useEffect(() => {
    setLoading(true);
    const unsubscribeRates = exchangeRateService.subscribeToRates((data) => {
      setRates(data);
      setLoading(false);
    }, rateLimit);
    
    const unsubscribeCurrencies = currencyService.subscribeToCurrencies(setCurrencies);
    
    return () => {
      unsubscribeRates();
      unsubscribeCurrencies();
    };
  }, [rateLimit]);

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    try {
      await exchangeRateService.addRate({
        ...newRate,
        updatedBy: profile.uid,
      });
      setNewRate({ baseCurrency: currencies[0]?.code || 'USD', targetCurrency: currencies[1]?.code || 'YER', officialRate: 0, marketRate: 0 });
    } catch (err) {
      console.error("Error adding rate", err);
    }
  };

  const handleAddCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await currencyService.addCurrency(newCurrency);
      setNewCurrency({ code: '', name: '', symbol: '', isActive: true });
    } catch (err) {
      console.error("Error adding currency", err);
    }
  };

  const toggleCurrencyActive = async (id: string, isActive: boolean) => {
    try {
      await currencyService.updateCurrency(id, { isActive: !isActive });
    } catch (err) {
      console.error("Error updating currency", err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">إدارة أسعار الصرف والعملات</h1>
          <p className="text-slate-400 text-sm font-medium">إعدادات العملات وتحديث أسعار الصرف</p>
        </div>
        <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('rates')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'rates' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            أسعار الصرف
          </button>
          <button 
            onClick={() => setActiveTab('currencies')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'currencies' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            العملات المدعومة
          </button>
        </div>
      </div>

      {activeTab === 'rates' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rate Entry Form (Managers only) */}
        {canManage && (
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
                      {currencies.filter(c => c.isActive).map(c => (
                        <option key={c.id} className="bg-slate-900" value={c.code}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">إلى عملة</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-xl text-xs py-2.5 px-3 outline-none focus:ring-1 focus:ring-blue-500" value={newRate.targetCurrency} onChange={e => setNewRate({...newRate, targetCurrency: e.target.value})}>
                      {currencies.filter(c => c.isActive).map(c => (
                        <option key={c.id} className="bg-slate-900" value={c.code}>{c.code} - {c.name}</option>
                      ))}
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
        <div className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
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
            <div className="p-4 border-t border-white/5 bg-white/[0.02] flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-medium">عرض {rates.length} (الحد {rateLimit})</span>
              <div className="flex gap-2">
                {rates.length >= rateLimit ? (
                  <button onClick={() => setRateLimit(v => v + 20)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10">تحميل المزيد</button>
                ) : rates.length > 0 ? (
                  <span className="text-[10px] text-slate-500 font-bold">تم تحميل الكل</span>
                ) : null}
                {rateLimit > 20 && <button onClick={() => setRateLimit(20)} className="px-3 py-2 text-[10px] font-bold text-slate-400 hover:text-white">إعادة تعيين</button>}
              </div>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {canManage && (
            <div className="lg:col-span-1">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl sticky top-24">
                <h3 className="font-bold text-white mb-6 flex items-center gap-2 text-sm">
                  <Plus className="w-5 h-5 text-blue-400" />
                  إضافة عملة جديدة
                </h3>
                <form onSubmit={handleAddCurrency} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">رمز العملة (مثال: USD)</label>
                    <input required type="text" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 outline-none focus:ring-1 focus:ring-blue-500 text-sm uppercase" value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">الاسم (مثال: دولار أمريكي)</label>
                    <input required type="text" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 outline-none focus:ring-1 focus:ring-blue-500 text-sm" value={newCurrency.name} onChange={e => setNewCurrency({...newCurrency, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">الرمز (مثال: $)</label>
                    <input required type="text" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 outline-none focus:ring-1 focus:ring-blue-500 text-sm" value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 text-[10px] uppercase tracking-widest mt-4">
                    إضافة عملة
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                <h3 className="font-bold text-white text-sm">العملات المدعومة</h3>
              </div>
              <div className="divide-y divide-white/5">
                {currencies.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 italic text-sm font-medium">لا توجد عملات مدعومة</div>
                ) : currencies.map((currency) => (
                  <div key={currency.id} className={`p-6 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4 ${!currency.isActive ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-black text-xl">
                        {currency.symbol}
                      </div>
                      <div>
                        <div className="font-black text-white text-lg">{currency.code}</div>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{currency.name}</p>
                      </div>
                    </div>
                    {canManage && (
                      <button 
                        onClick={() => toggleCurrencyActive(currency.id!, currency.isActive)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${currency.isActive ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'}`}
                      >
                        {currency.isActive ? 'مفعل' : 'معطل'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
