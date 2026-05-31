import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { useEffect, useState, useCallback } from 'react';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import DeliveryOrders from './pages/DeliveryOrders';
import BalcaoOrders from './pages/BalcaoOrders';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import WhatsApp from './pages/WhatsApp';
import Messages from './pages/Messages';
import License from './pages/License';
import PDV from './pages/PDV';
import Reports from './pages/Reports';
import Suppliers from './pages/Suppliers';
import Users from './pages/Users';
import UpdateToast from './components/UpdateToast';
import LicenseServerDownModal from './components/LicenseServerDownModal';
import api from './api/client';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { loadUser, token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [licenseServerDown, setLicenseServerDown] = useState(false);

  const checkLicenseServer = useCallback(async () => {
    try {
      const { data } = await api.get('/system/license-health');
      setLicenseServerDown(!data.reachable);
    } catch {
      setLicenseServerDown(true);
    }
  }, []);

  useEffect(() => {
    // Check if setup is needed + license-server health
    Promise.all([
      api.get('/setup/status'),
      api.get('/system/license-health').catch(() => ({ data: { reachable: false } })),
    ]).then(([setupRes, healthRes]) => {
      const serverReachable = (healthRes as any).data?.reachable !== false;
      setLicenseServerDown(!serverReachable);

      if (setupRes.data.data?.needsSetup) {
        setNeedsSetup(true);
        setLoading(false);
      } else if (token) {
        loadUser().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (token) {
        loadUser().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, [token, loadUser]);

  // Periodic license-server health check (every 2 minutes)
  useEffect(() => {
    const interval = setInterval(checkLicenseServer, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkLicenseServer]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
      {licenseServerDown && (
        <LicenseServerDownModal onRetry={checkLicenseServer} />
      )}
      <BrowserRouter>
        <Toaster position="top-right" />
        <UpdateToast />
        <Routes>
        {needsSetup && (
          <Route path="/setup" element={<Setup />} />
        )}
        {needsSetup && (
          <Route path="*" element={<Navigate to="/setup" replace />} />
        )}
        {!needsSetup && (
          <>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="delivery-orders" element={<DeliveryOrders />} />
              <Route path="balcao-orders" element={<BalcaoOrders />} />
              <Route path="pdv" element={<PDV />} />
              <Route path="products" element={<Products />} />
              <Route path="customers" element={<Customers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="users" element={<Users />} />
              <Route path="settings" element={<Settings />} />
              <Route path="whatsapp" element={<WhatsApp />} />
              <Route path="messages" element={<Messages />} />
              <Route path="license" element={<License />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
    </>
  );
}
