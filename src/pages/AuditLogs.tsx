import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { auditService } from '../services/auditService';
import { AuditLog } from '../types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ShieldAlert, Search } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function AuditLogs() {
  const { isAdministrator, isSupervisor } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [limitCount, setLimitCount] = useState(50);

  useEffect(() => {
    if (!isAdministrator && !isSupervisor) return;
    setLoading(true);
    const unsubscribe = auditService.subscribeToAuditLogs((data) => {
      setLogs(data);
      setLoading(false);
    }, limitCount);

    return () => unsubscribe();
  }, [isAdministrator, isSupervisor, limitCount]);

  if (!isAdministrator && !isSupervisor) return <Navigate to="/" />;

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.entityId.toLowerCase().includes(search.toLowerCase()) ||
    log.userId.toLowerCase().includes(search.toLowerCase()) ||
    (log.amount && log.amount.toString().includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">سجل التدقيق</h1>
          <p className="text-slate-400 text-sm font-medium">سجل غير قابل للتعديل لكافة العمليات المالية</p>
        </div>
        <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-slate-400" />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/5">
          <div className="relative text-slate-300">
            <Search className="absolute inset-y-0 start-4 my-auto w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="البحث برقم العملية، نوع الإجراء، أو معرف المستخدم..." 
              className="w-full bg-white/5 border border-white/5 rounded-xl ps-11 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 text-[10px] uppercase tracking-widest border-b border-white/5">
                <th className="px-6 py-4 font-bold text-start">الوقت</th>
                <th className="px-6 py-4 font-bold text-start">الإجراء</th>
                <th className="px-6 py-4 font-bold text-start">الكيان</th>
                <th className="px-6 py-4 font-bold text-start">تفاصيل القيمة</th>
                <th className="px-6 py-4 font-bold text-start">المستخدم (المعرف)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic font-medium">جاري التحميل...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic font-medium">لا توجد سجلات مطابقة</td></tr>
              ) : filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-medium text-slate-300">
                      {log.timestamp && format(log.timestamp.toDate(), 'yyyy/MM/dd HH:mm:ss', { locale: ar })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-[10px] uppercase font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded truncate max-w-[200px] overflow-hidden">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{log.entityType}</div>
                    <div className="font-mono text-xs font-bold text-white truncate max-w-[150px]">{log.entityId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-black text-white">
                      {log.amount?.toLocaleString()} {log.currency}
                    </div>
                    {log.exchangeRate && log.exchangeRate !== 1 && (
                      <div className="text-[10px] font-bold text-slate-500 mt-1">المعدل المطبق: {log.exchangeRate}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono text-[10px] font-bold text-slate-400 truncate max-w-[150px]">{log.userId}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-white/5 bg-white/[0.02] flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-[10px] text-slate-500 font-medium">عرض {filteredLogs.length} من {logs.length} (الحد {limitCount}) • قراءة فقط، لا يمكن التعديل</span>
          <div className="flex gap-2">
            {logs.length >= limitCount ? (
              <button onClick={() => setLimitCount(v => v + 50)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10">تحميل المزيد</button>
            ) : logs.length > 0 ? (
              <span className="px-4 py-2 text-[10px] text-slate-500 font-bold">تم تحميل الكل</span>
            ) : null}
            {limitCount > 50 && (
              <button onClick={() => setLimitCount(50)} className="px-3 py-2 rounded-xl bg-transparent text-[10px] font-bold text-slate-400 hover:text-white">إعادة تعيين</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
