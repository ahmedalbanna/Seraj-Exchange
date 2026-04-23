import React, { createContext, useContext, useEffect, useState } from 'react';

interface ConfigContextType {
  lang: 'ar' | 'en';
  setLang: (l: 'ar' | 'en') => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  t: (key: string) => string;
}

const translations = {
  ar: {
    app_name: 'سراج للصرافة',
    dashboard: 'لوحة التحكم',
    transfers: 'التحوالات',
    pending_transfers: 'التحوالات المعلقة',
    exchange_rates: 'أسعار الصرف',
    branches: 'الفروع',
    users: 'المستخدمون',
    profile: 'الملف الشخصي',
    logout: 'تسجيل الخروج',
    login: 'تسجيل الدخول',
    add_transfer: 'إضافة تحويل',
    currency: 'العملة',
    amount: 'المبلغ',
    sender: 'المرسل',
    receiver: 'المستلم',
    status: 'الحالة',
    actions: 'الإجراءات',
    official_rate: 'السعر الرسمي',
    market_rate: 'سعر السوق',
    date: 'التاريخ',
    loading: 'جاري التحميل...',
    no_data: 'لا توجد بيانات',
  },
  en: {
    app_name: 'Seraj Exchange',
    dashboard: 'Dashboard',
    transfers: 'Transfers',
    pending_transfers: 'Pending Transfers',
    exchange_rates: 'Exchange Rates',
    branches: 'Branches',
    users: 'Users',
    profile: 'Profile',
    logout: 'Logout',
    login: 'Login',
    add_transfer: 'Add Transfer',
    currency: 'Currency',
    amount: 'Amount',
    sender: 'Sender',
    receiver: 'Receiver',
    status: 'Status',
    actions: 'Actions',
    official_rate: 'Official Rate',
    market_rate: 'Market Rate',
    date: 'Date',
    loading: 'Loading...',
    no_data: 'No Data',
  }
};

const ConfigContext = createContext<ConfigContextType | null>(null);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within ConfigProvider');
  return context;
};

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const t = (key: string) => {
    return (translations[lang] as any)[key] || key;
  };

  return (
    <ConfigContext.Provider value={{ lang, setLang, theme, setTheme, t }}>
      {children}
    </ConfigContext.Provider>
  );
};
