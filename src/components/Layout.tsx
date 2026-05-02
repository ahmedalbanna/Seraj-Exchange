import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useConfig } from './ConfigProvider';
import { useAuth } from './AuthProvider';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  TrendingUp, 
  LogOut, 
  Menu, 
  X, 
  Moon, 
  Sun,
  Languages,
  Building2,
  Users as UsersIcon,
  Scale,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

import NotificationCenter from './NotificationCenter';

export default function Layout() {
  const { t, lang, setLang, theme, setTheme } = useConfig();
  const { profile, isAdministrator, isSupervisor } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', path: '/', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'transfers', path: '/transfers', label: t('transfers'), icon: ArrowLeftRight },
    { id: 'rates', path: '/rates', label: t('exchange_rates'), icon: TrendingUp },
    ...(isAdministrator ? [
      { id: 'branches', path: '/branches', label: 'إدارة الفروع', icon: Building2 },
      { id: 'users', path: '/users', label: 'المخدمين', icon: UsersIcon },
    ] : []),
    ...(isAdministrator || isSupervisor ? [
      { id: 'reconciliation', path: '/reconciliation', label: 'التسويات المالية', icon: Scale },
      { id: 'audit-logs', path: '/audit-logs', label: 'سجل التدقيق', icon: ShieldAlert },
    ] : [])
  ];

  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  const NavItem = ({ item }: { item: any }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    
    return (
      <Link
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
          isActive 
            ? "bg-white/10 text-blue-400 shadow-xl shadow-blue-500/10 border border-white/10" 
            : "text-slate-400 hover:bg-white/5"
        )}
      >
        <Icon className={cn("w-5 h-5", isActive ? "text-blue-400" : "group-hover:text-blue-400")} />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex transition-colors duration-300 relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="bg-glow">
        <div className="bg-glow-blue" />
        <div className="bg-glow-emerald" />
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 border-e border-white/10 bg-white/5 backdrop-blur-2xl z-30">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <TrendingUp className="text-white w-6 h-6" strokeWidth={3} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              {t('app_name')}
            </h1>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map(item => <NavItem key={item.id} item={item} />)}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-white/5 border border-white/5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {profile?.displayName?.[0] || profile?.email?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {profile?.displayName || profile?.email}
              </p>
              <select 
                className="bg-transparent text-xs text-blue-400 font-bold outline-none cursor-pointer mt-0.5"
                value={profile?.role || ''}
                onChange={async (e) => {
                  if (profile) {
                    try {
                      await updateDoc(doc(db, 'users', profile.uid), { role: e.target.value });
                    } catch (err) {
                      console.error("Error updating role", err);
                    }
                  }
                }}
              >
                <option className="bg-slate-900" value="Administrator">Administrator</option>
                <option className="bg-slate-900" value="Supervisor">Supervisor</option>
                <option className="bg-slate-900" value="Teller">Teller</option>
              </select>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ms-72 flex flex-col z-10">
        {/* Header */}
        <header className="h-16 px-4 lg:px-8 flex items-center justify-between bg-white/[0.02] backdrop-blur-md border-b border-white/10 sticky top-0 z-20">
          <button 
            className="lg:hidden p-2 text-slate-400"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <NotificationCenter />
            <div className="hidden md:flex items-center gap-2 me-4 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              حالة النظام: نشط
            </div>
            <button 
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 flex items-center gap-1"
            >
              <Languages className="w-5 h-5" />
              <span className="text-sm font-medium uppercase">{lang}</span>
            </button>
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Sidebar - Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside 
              initial={{ x: lang === 'ar' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: lang === 'ar' ? '100%' : '-100%' }}
              className={cn(
                "fixed inset-y-0 w-72 bg-slate-900/95 backdrop-blur-xl z-50 flex flex-col lg:hidden border-white/10",
                lang === 'ar' ? "right-0 border-l" : "left-0 border-r"
              )}
            >
              <div className="p-6 flex items-center justify-between border-b border-white/10">
                <h1 className="text-xl font-bold text-blue-500 flex items-center gap-2">
                  <TrendingUp />
                  {t('app_name')}
                </h1>
                <button onClick={() => setSidebarOpen(false)}>
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {menuItems.map(item => <NavItem key={item.id} item={item} />)}
              </nav>
              <div className="p-4 border-t border-white/10">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 bg-rose-500/10 font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  {t('logout')}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
