import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { Navigate } from 'react-router-dom';
import { useConfig } from '../components/ConfigProvider';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const { user } = useAuth();
  const { t } = useConfig();

  if (user) return <Navigate to="/" />;

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="bg-glow">
        <div className="bg-glow-blue opacity-50" />
        <div className="bg-glow-emerald opacity-30" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative text-center">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-6 border border-white/20">
              <TrendingUp className="text-white w-10 h-10" strokeWidth={3} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
              سراج للصرافة <br/>
              <span className="text-blue-400">Seraj Exchange</span>
            </h1>
            <p className="mt-2 text-slate-400 text-sm font-medium">نظام الإدارة المالية والتحويلات المبتكر</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-4 bg-white hover:bg-slate-50 text-slate-900 py-4 px-6 rounded-2xl font-black transition-all shadow-xl active:scale-95 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors" />
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
              <span className="text-sm uppercase tracking-widest">{t('login')}</span>
            </button>
            <div className="flex items-center gap-4 px-2">
              <div className="h-px bg-white/10 flex-1" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">أو</span>
              <div className="h-px bg-white/10 flex-1" />
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
              <p className="text-[10px] text-blue-400 font-bold leading-relaxed">
                هذا النظام مخصص للموظفين المعتمدين فقط. <br/>
                سيتم تسجيل الدخول فوراً إذا كنت تمتلك صلاحية.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
              تم التطوير بواسطة فريق سراج التقني &copy; 2026
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
