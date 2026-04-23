import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ConfigProvider } from './components/ConfigProvider';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transfers from './pages/Transfers';
import ExchangeRates from './pages/ExchangeRates';
import Branches from './pages/Branches';
import Users from './pages/Users';
import Reconciliation from './pages/Reconciliation';
import Login from './pages/Login';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
};

export default function App() {
  return (
    <ConfigProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="transfers" element={<Transfers />} />
              <Route path="rates" element={<ExchangeRates />} />
              <Route path="branches" element={<Branches />} />
              <Route path="users" element={<Users />} />
              <Route path="reconciliation" element={<Reconciliation />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
