import React, { useState } from 'react';
import { StoreProvider, useStore } from './lib/storage/store';
import { BottomNav } from './components/ui/BottomNav';
import { Onboarding } from './screens/Onboarding';
import { Dashboard } from './screens/Dashboard';
import { Movimientos } from './screens/Movimientos';
import { Presupuesto } from './screens/Presupuesto';
import { Categorias } from './screens/Categorias';
import { Ajustes } from './screens/Ajustes';
import { Insights } from './screens/Insights';

function AppContent() {
  const { state, selectedMesId, setSelectedMesId } = useStore();
  const [currentTab, setCurrentTab] = useState('dashboard');

  if (!state.hasOnboarded && state.movimientos.length === 0 && !state.cuenta.fechaSaldo) {
    return <Onboarding onFinish={() => setCurrentTab('dashboard')} />;
  }

  return (
    <div className="flex flex-col h-screen bg-bg text-text w-full max-w-md mx-auto relative shadow-2xl overflow-hidden">
      <main className="flex-1 overflow-hidden relative">
        {currentTab === 'dashboard' && <Dashboard selectedMesId={selectedMesId} onChangeMes={setSelectedMesId} />}
        {currentTab === 'movimientos' && <Movimientos selectedMesId={selectedMesId} onChangeMes={setSelectedMesId} />}
        {currentTab === 'presupuesto' && <Presupuesto selectedMesId={selectedMesId} onChangeMes={setSelectedMesId} />}
        {currentTab === 'insights' && <Insights selectedMesId={selectedMesId} onChangeMes={setSelectedMesId} />}
        {currentTab === 'categorias' && <Categorias />}
        {currentTab === 'ajustes' && <Ajustes />}
      </main>
      <BottomNav current={currentTab} onChange={setCurrentTab} />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}

