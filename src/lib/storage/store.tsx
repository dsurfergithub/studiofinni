import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, Movimiento, Categoria, MesFinanciero, NominaAncla } from './types';
import { loadState, saveState, getInitialState } from './storage';
import { derivarMeses } from '../finmes/finmes';

interface StoreContextType {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
  resetState: () => void;
  addMovimiento: (mov: Movimiento) => void;
  updateMovimiento: (id: string, mov: Partial<Movimiento>) => void;
  deleteMovimientos: (ids: string[]) => void;
  addCategoria: (cat: Categoria) => void;
  updateCategoria: (id: string, cat: Partial<Categoria>) => void;
  deleteCategoria: (id: string) => void;
  getMesesActivos: () => MesFinanciero[];
  getSaldoCalculado: () => number;
  selectedMesId: string;
  setSelectedMesId: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(getInitialState());
  const [initDone, setInitDone] = useState(false);
  const [selectedMesId, setSelectedMesId] = useState('');

  const getMesesActivos = () => {
    const derived = derivarMeses(state.nominasAncla);
    const custom = state.mesesPersonalizados || [];
    
    // Merge both
    const all = [...custom, ...derived];
    
    // Deduplicate by ID
    const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
    
    // Sort oldest to newest or newest to oldest? Derived sorts newest first
    return unique.sort((a, b) => b.inicio.localeCompare(a.inicio));
  };

  useEffect(() => {
    setState(loadState());
    setInitDone(true);
  }, []);

  // Whenever state changes, persist it
  useEffect(() => {
    if (initDone) {
      saveState(state);
    }
  }, [state, initDone]);

  const getDefaultSelectedMonthId = (mesesList: MesFinanciero[]) => {
    if (mesesList.length === 0) return '';
    
    // 1. If there's a month that contains today's date, use that!
    const today = new Date().toISOString().slice(0, 10);
    const todayMes = mesesList.find(m => today >= m.inicio && today <= m.fin);
    if (todayMes) return todayMes.id;

    // 2. Otherwise, find the newest month that actually has movements in the database.
    const mesesWithMovs = mesesList.filter(mes => 
      state.movimientos.some(m => m.fecha >= mes.inicio && m.fecha <= mes.fin)
    );
    if (mesesWithMovs.length > 0) {
      // Return the newest of the ones with movements (since mesesList is sorted newest first)
      return mesesWithMovs[0].id;
    }

    // 3. Otherwise, return the first one that is not in the future (i.e. start date <= today)
    const currentOrPast = mesesList.find(m => m.inicio <= today);
    if (currentOrPast) return currentOrPast.id;

    // 4. Default to first in list (newest)
    return mesesList[0].id;
  };

  // Fallback / Auto-select the smartest month if selectedMesId is empty
  const activeMeses = getMesesActivos();
  useEffect(() => {
    if (initDone && !selectedMesId && activeMeses.length > 0) {
      setSelectedMesId(getDefaultSelectedMonthId(activeMeses));
    }
  }, [initDone, selectedMesId, activeMeses, state.movimientos]);

  const updateState = (newState: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...newState }));
  };

  const resetState = () => {
    setState(getInitialState());
  };

  const addMovimiento = (mov: Movimiento) => {
    setState((prev) => ({
      ...prev,
      movimientos: [mov, ...prev.movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id)),
    }));
  };

  const updateMovimiento = (id: string, updates: Partial<Movimiento>) => {
    setState((prev) => ({
      ...prev,
      movimientos: prev.movimientos.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  };

  const deleteMovimientos = (ids: string[]) => {
    setState((prev) => ({
      ...prev,
      movimientos: prev.movimientos.filter((m) => !ids.includes(m.id)),
    }));
  };

  const addCategoria = (cat: Categoria) => {
    setState((prev) => ({ ...prev, categorias: [...prev.categorias, cat] }));
  };

  const updateCategoria = (id: string, updates: Partial<Categoria>) => {
    setState((prev) => ({
      ...prev,
      categorias: prev.categorias.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const deleteCategoria = (id: string) => {
    // Re-assign category to "sin-clasificar"
    setState((prev) => {
      const newOverrides = { ...prev.budgetOverrides };
      Object.keys(newOverrides).forEach(monthId => {
        if (newOverrides[monthId]) {
          newOverrides[monthId] = Object.fromEntries(
            Object.entries(newOverrides[monthId]).filter(([k]) => k !== id)
          );
        }
      });
      return {
        ...prev,
        categorias: prev.categorias.filter((c) => c.id !== id),
        movimientos: prev.movimientos.map((m) => (m.categoria === id ? { ...m, categoria: 'sin-clasificar' } : m)),
        budgetTemplate: Object.fromEntries(Object.entries(prev.budgetTemplate).filter(([k]) => k !== id)),
        budgetOverrides: newOverrides,
      };
    });
  };

  const getSaldoCalculado = () => {
    if (!state.cuenta.fechaSaldo && state.movimientos.length === 0) return 0;
    
    // Si no hay saldo base importado, el saldo es la suma de todo.
    if (!state.cuenta.fechaSaldo) {
      return state.movimientos.reduce((acc, current) => acc + current.importe, 0);
    }
    
    // Suma los movimientos posteriores a fechaSaldo.
    // Usamos lexicographical comparison since dates are YYYY-MM-DD
    const recientes = state.movimientos.filter(m => m.fecha > state.cuenta.fechaSaldo);
    const delta = recientes.reduce((sum, m) => sum + m.importe, 0);
    return state.cuenta.saldoActual + delta;
  };

  if (!initDone) return null; // or a loader

  return (
    <StoreContext.Provider
      value={{
        state,
        updateState,
        resetState,
        addMovimiento,
        updateMovimiento,
        deleteMovimientos,
        addCategoria,
        updateCategoria,
        deleteCategoria,
        getMesesActivos,
        getSaldoCalculado,
        selectedMesId,
        setSelectedMesId,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
}
