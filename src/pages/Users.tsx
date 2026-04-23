import React, { useEffect, useState } from 'react';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { userService } from '../services/userService';
import { branchService } from '../services/branchService';
import { UserProfile, UserRole, Branch } from '../types';
import { 
  Users as UsersIcon, 
  Shield, 
  Building2, 
  Mail, 
  Settings2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Users() {
  const { t } = useConfig();
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubUsers = userService.subscribeToUsers(setUsers);
    const unsubBranches = branchService.subscribeToBranches((data) => {
      setBranches(data);
      setLoading(false);
    });
    return () => {
      unsubUsers();
      unsubBranches();
    };
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" />;

  const handleUpdateUser = async (userId: string, role: UserRole, branchId: string) => {
    try {
      await userService.updateRoleAndBranch(userId, role, branchId);
      setEditingUser(null);
    } catch (error) {
      console.error(error);
    }
  };

  const RoleBadge = ({ role }: { role: UserRole }) => {
    const config = {
      admin: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      manager: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      clerk: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border", config[role])}>
        {role}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">إدارة الصلاحيات والمستخدمين</h1>
          <p className="text-slate-400 text-sm font-medium">تخصيص الأدوار وتعيين الفروع للموظفين</p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] border-b border-white/5">
                <th className="px-8 py-5 text-start">الموظف</th>
                <th className="px-8 py-5 text-start">الدور</th>
                <th className="px-8 py-5 text-start">الفرع المعين</th>
                <th className="px-8 py-5 text-start">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-500 italic">{t('loading')}</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-500 italic">{t('no_data')}</td></tr>
              ) : users.map((user) => (
                <tr key={user.uid} className="group hover:bg-white/[0.02] transition-all">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white shadow-xl shadow-blue-500/20 border border-white/20">
                        {user.displayName?.[0] || <UsersIcon className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-sm font-black text-white tracking-tight">{user.displayName}</div>
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <Mail className="w-2.5 h-2.5 opacity-50" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-tight">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      {branches.find(b => b.id === user.branchId)?.name || 'غير معين'}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <button 
                      onClick={() => setEditingUser(user)}
                      className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white"
                    >
                      <Settings2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {editingUser && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80]" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[15%] md:mx-auto max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-[90] overflow-hidden"
            >
              <div className="p-8 space-y-8">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/20 mb-4">
                    <Shield className="text-blue-400 w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-white">تعديل صلاحيات المستخدم</h2>
                  <p className="text-slate-500 text-xs font-medium mt-1">{editingUser.displayName}</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">اختيار الدور</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['admin', 'manager', 'clerk'] as UserRole[]).map(r => (
                        <button
                          key={r}
                          onClick={() => setEditingUser({...editingUser, role: r})}
                          className={cn(
                            "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                            editingUser.role === r 
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                              : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">الفرع المخصص</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={editingUser.branchId}
                      onChange={e => setEditingUser({...editingUser, branchId: e.target.value})}
                    >
                      <option className="bg-slate-900" value="">بدون فرع</option>
                      {branches.map(b => (
                        <option className="bg-slate-900" key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-500 font-black hover:bg-white/10 transition-all text-[10px] uppercase tracking-widest"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={() => handleUpdateUser(editingUser.uid, editingUser.role, editingUser.branchId)}
                    className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    حفظ التغييرات
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
