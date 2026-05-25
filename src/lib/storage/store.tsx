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
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(getInitialState());
  const [initDone, setInitDone] = useState(false);

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
    setState((prev) => ({
      ...prev,
      categorias: prev.categorias.filter((c) => c.id !== id),
      movimientos: prev.movimientos.map((m) => (m.categoria === id ? { ...m, categoria: 'sin-clasificar' } : m)),
      budgetTemplate: Object.fromEntries(Object.entries(prev.budgetTemplate).filter(([k]) => k !== id)),
    }));
  };

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
