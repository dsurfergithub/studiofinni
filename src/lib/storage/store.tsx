import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppState, Movimiento, Categoria, MesFinanciero, Suscripcion, Theme } from './types';
import { loadState, saveState, getInitialState, maybeWeeklyBackup } from './storage';
import { derivarMeses } from '../finmes/finmes';
import { generarCargosSuscripciones } from '../suscripciones/suscripciones';
import { getLocalFechaIso } from '../utils';

interface StoreContextType {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
  resetState: () => void;
  importState: (newState: AppState) => void;
  addMovimiento: (mov: Movimiento) => void;
  updateMovimiento: (id: string, mov: Partial<Movimiento>) => void;
  deleteMovimientos: (ids: string[]) => void;
  addCategoria: (cat: Categoria) => void;
  updateCategoria: (id: string, cat: Partial<Categoria>) => void;
  deleteCategoria: (id: string) => void;
  // Suscripciones
  addSuscripcion: (s: Suscripcion) => void;
  updateSuscripcion: (id: string, s: Partial<Suscripcion>) => void;
  deleteSuscripcion: (id: string) => void;
  // Presupuesto independiente del catálogo de categorías
  isBudgeted: (catId: string) => boolean;
  getPresupuestoCat: (catId: string, mesId: string) => number;
  setBudgetTemplate: (catId: string, amount: number) => void;
  setBudgetForMonth: (catId: string, mesId: string, amount: number) => void;
  removeFromBudget: (catId: string) => void;
  // Tema
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  // Meses
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

  const getMesesActivos = useCallback(() => {
    const derived = derivarMeses(state.nominasAncla);
    const custom = state.mesesPersonalizados || [];
    const all = [...custom, ...derived];
    const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
    return unique.sort((a, b) => b.inicio.localeCompare(a.inicio));
  }, [state.nominasAncla, state.mesesPersonalizados]);

  // Carga inicial: estado + cargos de suscripciones + backup semanal.
  useEffect(() => {
    const loaded = loadState();
    const hoy = getLocalFechaIso();

    const { nuevosMovimientos, suscripcionesActualizadas, generados } =
      generarCargosSuscripciones(loaded.suscripciones || [], hoy);

    let next = loaded;
    if (generados > 0) {
      const existentesHashes = new Set(loaded.movimientos.map(m => m.hash));
      const movsAInsertar = nuevosMovimientos.filter(m => !existentesHashes.has(m.hash));
      next = {
        ...loaded,
        suscripciones: suscripcionesActualizadas,
        movimientos: [...movsAInsertar, ...loaded.movimientos]
          .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id)),
      };
    }

    const backupTs = maybeWeeklyBackup(next);
    if (backupTs) {
      next = { ...next, meta: { ...next.meta, ultimoAutoBackup: backupTs } };
    }

    setState(next);
    setInitDone(true);
  }, []);

  // Persistencia.
  useEffect(() => {
    if (initDone) saveState(state);
  }, [state, initDone]);

  // Aplica el tema al documento.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(state.theme === 'light' ? 'light' : 'dark');
  }, [state.theme]);

  const getDefaultSelectedMonthId = (mesesList: MesFinanciero[]) => {
    if (mesesList.length === 0) return '';
    const today = getLocalFechaIso();
    const todayMes = mesesList.find(m => today >= m.inicio && today <= m.fin);
    if (todayMes) return todayMes.id;
    const mesesWithMovs = mesesList.filter(mes =>
      state.movimientos.some(m => m.fecha >= mes.inicio && m.fecha <= mes.fin)
    );
    if (mesesWithMovs.length > 0) return mesesWithMovs[0].id;
    const currentOrPast = mesesList.find(m => m.inicio <= today);
    if (currentOrPast) return currentOrPast.id;
    return mesesList[0].id;
  };

  const activeMeses = getMesesActivos();
  useEffect(() => {
    if (initDone && !selectedMesId && activeMeses.length > 0) {
      setSelectedMesId(getDefaultSelectedMonthId(activeMeses));
    }
  }, [initDone, selectedMesId, activeMeses, state.movimientos]);

  const updateState = (newState: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...newState }));
  };

  const resetState = () => setState(getInitialState());

  const importState = (newState: AppState) => setState(newState);

  const setTheme = (t: Theme) => setState((prev) => ({ ...prev, theme: t }));
  const toggleTheme = () =>
    setState((prev) => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));

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

  // ---------- Suscripciones ----------
  const addSuscripcion = (s: Suscripcion) => {
    setState((prev) => {
      const conNueva = [...prev.suscripciones, s];
      const { nuevosMovimientos, suscripcionesActualizadas } =
        generarCargosSuscripciones(conNueva, getLocalFechaIso());
      const hashes = new Set(prev.movimientos.map(m => m.hash));
      const movsNuevos = nuevosMovimientos.filter(m => !hashes.has(m.hash));
      return {
        ...prev,
        suscripciones: suscripcionesActualizadas,
        movimientos: [...movsNuevos, ...prev.movimientos]
          .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id)),
      };
    });
  };

  const updateSuscripcion = (id: string, updates: Partial<Suscripcion>) => {
    setState((prev) => ({
      ...prev,
      suscripciones: prev.suscripciones.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  };

  const deleteSuscripcion = (id: string) => {
    setState((prev) => ({
      ...prev,
      suscripciones: prev.suscripciones.filter((s) => s.id !== id),
    }));
  };

  // ---------- Presupuesto independiente ----------
  const isBudgeted = (catId: string) =>
    Object.prototype.hasOwnProperty.call(state.budgetTemplate || {}, catId);

  const getPresupuestoCat = (catId: string, mesId: string) => {
    const override = state.budgetOverrides?.[mesId]?.[catId];
    if (override !== undefined) return override;
    const template = state.budgetTemplate?.[catId];
    return template !== undefined ? template : 0;
  };

  const setBudgetTemplate = (catId: string, amount: number) => {
    setState((prev) => ({
      ...prev,
      budgetTemplate: { ...prev.budgetTemplate, [catId]: amount },
    }));
  };

  const setBudgetForMonth = (catId: string, mesId: string, amount: number) => {
    setState((prev) => {
      const monthOverrides = prev.budgetOverrides?.[mesId] || {};
      return {
        ...prev,
        budgetOverrides: {
          ...(prev.budgetOverrides || {}),
          [mesId]: { ...monthOverrides, [catId]: amount },
        },
      };
    });
  };

  const removeFromBudget = (catId: string) => {
    setState((prev) => {
      const newOverrides = { ...prev.budgetOverrides };
      Object.keys(newOverrides).forEach(monthId => {
        newOverrides[monthId] = Object.fromEntries(
          Object.entries(newOverrides[monthId] || {}).filter(([k]) => k !== catId)
        );
      });
      return {
        ...prev,
        budgetTemplate: Object.fromEntries(Object.entries(prev.budgetTemplate).filter(([k]) => k !== catId)),
        budgetOverrides: newOverrides,
      };
    });
  };

  const getSaldoCalculado = () => {
    if (!state.cuenta.fechaSaldo && state.movimientos.length === 0) return 0;
    if (!state.cuenta.fechaSaldo) {
      return state.movimientos.reduce((acc, current) => acc + current.importe, 0);
    }
    const recientes = state.movimientos.filter(m => m.fecha > state.cuenta.fechaSaldo);
    const delta = recientes.reduce((sum, m) => sum + m.importe, 0);
    return state.cuenta.saldoActual + delta;
  };

  if (!initDone) return null;

  return (
    <StoreContext.Provider
      value={{
        state,
        updateState,
        resetState,
        importState,
        addMovimiento,
        updateMovimiento,
        deleteMovimientos,
        addCategoria,
        updateCategoria,
        deleteCategoria,
        addSuscripcion,
        updateSuscripcion,
        deleteSuscripcion,
        isBudgeted,
        getPresupuestoCat,
        setBudgetTemplate,
        setBudgetForMonth,
        removeFromBudget,
        theme: state.theme,
        setTheme,
        toggleTheme,
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
