import React, { useState, useEffect, Suspense, lazy } from 'react';
import { StoreProvider, useStore } from './lib/storage/store';
import { ToastProvider } from './components/ui/Toast';
import { BottomNav } from './components/ui/BottomNav';
import { Novedades } from './components/ui/Novedades';
import { hayNovedadesSinVer, marcarVersionVista } from './lib/changelog';
import { Onboarding } from './screens/Onboarding';
import { Dashboard } from './screens/Dashboard';
import { Movimientos } from './screens/Movimientos';
import { Presupuesto } from './screens/Presupuesto';
import { PlanAnual } from './screens/PlanAnual';
import { Categorias } from './screens/Categorias';
import { Ajustes } from './screens/Ajustes';
import { Suscripciones } from './screens/Suscripciones';

// Insights carga recharts (pesado): lo diferimos para aligerar el arranque.
const Insights = lazy(() => import('./screens/Insights').then(m => ({ default: m.Insights })));

function AppContent() {
  const { state, selectedMesId, setSelectedMesId } = useStore();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [novedadesOpen, setNovedadesOpen] = useState(false);

  const esUsuarioNuevo = !state.hasOnboarded && state.movimientos.length === 0 && !state.cuenta.fechaSaldo;

  // Aviso de novedades: solo para quien ya usaba la app y acaba de recibir una versión nueva.
  useEffect(() => {
    if (esUsuarioNuevo) {
      // Un usuario recién llegado no necesita ver "qué ha cambiado".
      marcarVersionVista();
    } else if (hayNovedadesSinVer()) {
      setNovedadesOpen(true);
    }
  }, [esUsuarioNuevo]);

  const cerrarNovedades = () => {
    marcarVersionVista();
    setNovedadesOpen(false);
  };

  if (esUsuarioNuevo) {
    return <Onboarding onFinish={() => setCurrentTab('dashboard')} />;
  }

  return (
    <div className="flex flex-col h-screen bg-bg text-text w-full max-w-md mx-auto relative shadow-2xl overflow-hidden">
      <main className="flex-1 overflow-hidden relative">
        {currentTab === 'dashboard' && <Dashboard selectedMesId={selectedMesId} onChangeMes={setSelectedMesId} onNavigate={setCurrentTab} />}
        {currentTab === 'movimientos' && <Movimientos selectedMesId={selectedMesId} onChangeMes={setSelectedMesId} />}
        {currentTab === 'presupuesto' && <Presupuesto selectedMesId={selectedMesId} onChangeMes={setSelectedMesId} onNavigate={setCurrentTab} />}
        {currentTab === 'plan' && <PlanAnual onNavigate={setCurrentTab} />}
        {currentTab === 'insights' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full text-muted text-sm">Cargando insights…</div>}>
            <Insights selectedMesId={selectedMesId} onChangeMes={setSelectedMesId} />
          </Suspense>
        )}
        {currentTab === 'suscripciones' && <Suscripciones onBack={() => setCurrentTab('dashboard')} />}
        {currentTab === 'categorias' && <Categorias onBack={() => setCurrentTab('ajustes')} />}
        {currentTab === 'ajustes' && <Ajustes onNavigate={setCurrentTab} />}
      </main>
      <BottomNav current={currentTab} onChange={setCurrentTab} />

      <Novedades isOpen={novedadesOpen} onClose={cerrarNovedades} soloUltima />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ToastProvider>
  );
}
