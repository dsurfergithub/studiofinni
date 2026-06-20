import React, { useState } from 'react';
import { useStore } from '../lib/storage/store';
import { FinMesSelector } from '../components/ui/FinMesSelector';
import { formatCurrency } from '../lib/utils';
import { Sheet } from '../components/ui/Sheet';
import { Button } from '../components/ui/Button';
import { SavingsMeta } from '../lib/storage/types';
import { v4 as uuidv4 } from 'uuid';

interface PresupuestoProps {
  selectedMesId: string;
  onChangeMes: (id: string) => void;
}

const SAVING_ICONS = ['🎯','🏠','🚗','✈️','🎓','❤️','💻','📱','🎸','📷','🏋️','☕','🎁','🌴','🐾','🎮','💍','📚','⚽','🛒','💰','🏖️','🎉','🌟'];

function getBudgetBarColor(perc: number) {
  if (perc >= 100) return 'bg-danger';
  if (perc >= 70) return 'bg-warning';
  return 'bg-accent';
}

function getBudgetCardClass(perc: number) {
  if (perc >= 100) return 'border-danger/50 bg-[rgba(255,84,120,0.06)]';
  if (perc >= 70) return 'border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.04)]';
  return 'border-border hover:border-accent/40 hover:bg-surface-elevated';
}

export function Presupuesto({ selectedMesId, onChangeMes }: PresupuestoProps) {
  const { state, getMesesActivos, updateState } = useStore();

  // Budget state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [amountVal, setAmountVal] = useState('');

  // Savings meta state
  const [metaEditorOpen, setMetaEditorOpen] = useState(false);
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [metaNombre, setMetaNombre] = useState('');
  const [metaIcono, setMetaIcono] = useState('🎯');
  const [metaTotal, setMetaTotal] = useState('');
  const [metaAcumulado, setMetaAcumulado] = useState('');

  const activeMeses = getMesesActivos();
  const cMes = activeMeses.find(m => m.id === selectedMesId) || activeMeses[0];

  const getPresupuestoCat = (catId: string) => {
    return state.budgetOverrides?.[selectedMesId]?.[catId] || 0;
  };

  const spentPerCat: Record<string, number> = {};
  let totalGastos = 0;
  let totalIngresos = 0;

  if (cMes) {
    state.movimientos.forEach(m => {
      if (m.fecha >= cMes.inicio && m.fecha <= cMes.fin) {
        if (m.importe < 0) {
          const absImp = Math.abs(m.importe);
          spentPerCat[m.categoria] = (spentPerCat[m.categoria] || 0) + absImp;
          totalGastos += absImp;
        } else {
          totalIngresos += m.importe;
        }
      }
    });
  }

  const activeCategorias = state.categorias.filter(
    c => c.tipo !== 'ingreso' && (getPresupuestoCat(c.id) > 0 || (spentPerCat[c.id] || 0) > 0)
  );

  const totalPresupuestado = activeCategorias.reduce((acc, cat) => acc + getPresupuestoCat(cat.id), 0);
  const ppc = totalPresupuestado > 0 ? (totalGastos / totalPresupuestado) * 100 : 0;
  const isHealthy = ppc <= 100;

  const savingsMetas: SavingsMeta[] = state.savingsMetas || [];

  // Budget handlers
  const handleEditCat = (catId: string) => {
    setEditingCatId(catId);
    setAmountVal(getPresupuestoCat(catId).toString());
    setEditorOpen(true);
  };

  const handleNewBudget = () => {
    setEditingCatId(null);
    setAmountVal('');
    setEditorOpen(true);
  };

  const handleSaveBudget = () => {
    if (!editingCatId) return;
    const val = parseFloat(amountVal.replace(',', '.'));
    if (isNaN(val) || val < 0) return;
    const currentMonthOverrides = state.budgetOverrides?.[selectedMesId] || {};
    updateState({
      budgetOverrides: {
        ...(state.budgetOverrides || {}),
        [selectedMesId]: { ...currentMonthOverrides, [editingCatId]: val },
      },
    });
    setEditorOpen(false);
  };

  // Savings meta handlers
  const handleNewMeta = () => {
    setEditingMetaId(null);
    setMetaNombre('');
    setMetaIcono('🎯');
    setMetaTotal('');
    setMetaAcumulado('');
    setMetaEditorOpen(true);
  };

  const handleEditMeta = (meta: SavingsMeta) => {
    setEditingMetaId(meta.id);
    setMetaNombre(meta.nombre);
    setMetaIcono(meta.icono);
    setMetaTotal(meta.meta.toString());
    setMetaAcumulado(meta.acumulado.toString());
    setMetaEditorOpen(true);
  };

  const handleSaveMeta = () => {
    const totalVal = parseFloat(metaTotal.replace(',', '.'));
    const acumuladoVal = parseFloat(metaAcumulado.replace(',', '.'));
    if (!metaNombre.trim() || isNaN(totalVal) || totalVal <= 0) return;
    const current = state.savingsMetas || [];
    if (editingMetaId) {
      updateState({
        savingsMetas: current.map(m =>
          m.id === editingMetaId
            ? { ...m, nombre: metaNombre, icono: metaIcono, meta: totalVal, acumulado: isNaN(acumuladoVal) ? m.acumulado : acumuladoVal }
            : m
        ),
      });
    } else {
      updateState({
        savingsMetas: [
          ...current,
          { id: uuidv4(), nombre: metaNombre, icono: metaIcono, meta: totalVal, acumulado: isNaN(acumuladoVal) ? 0 : acumuladoVal },
        ],
      });
    }
    setMetaEditorOpen(false);
  };

  const handleDeleteMeta = () => {
    if (!editingMetaId || !window.confirm('¿Eliminar esta meta de ahorro?')) return;
    updateState({ savingsMetas: (state.savingsMetas || []).filter(m => m.id !== editingMetaId) });
    setMetaEditorOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <FinMesSelector selectedMesId={selectedMesId} onChange={onChangeMes} />
      </div>

      <div className="p-4 space-y-6 mt-4">
        {/* Header */}
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xl font-bold font-mono tracking-tight text-text">Presupuesto</h2>
          <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${isHealthy ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
            {isHealthy ? 'SALUDABLE' : 'EXCEDIDO'}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex gap-4">
          <div className="flex-1 bg-surface border border-border rounded-3xl p-5 flex flex-col items-center justify-center">
            <div className={`w-20 h-20 rounded-full border-[8px] flex items-center justify-center rotate-45 mb-3 ${isHealthy ? 'border-surface-elevated border-t-accent border-r-accent' : 'border-surface-elevated border-t-danger border-r-danger'}`}>
              <div className="-rotate-45 font-black font-mono text-sm">{Math.round(Math.min(ppc, 999))}%</div>
            </div>
            <p className="text-[10px] uppercase font-bold text-muted tracking-widest text-center">Gasto vs<br/>Presupuesto</p>
          </div>
          <div className="flex-1 bg-surface border border-border rounded-3xl p-5 flex flex-col justify-center">
            <p className="text-[10px] uppercase font-bold text-muted tracking-widest mb-1">Total Gastado</p>
            <p className="font-mono font-bold text-lg mb-2 truncate">{formatCurrency(totalGastos)}</p>
            <p className="text-[10px] uppercase font-bold text-muted tracking-widest mb-1 mt-2">Límite Mes</p>
            <p className="font-mono font-bold text-lg truncate">{formatCurrency(totalPresupuestado)}</p>
          </div>
        </div>

        {/* Savings metas */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs uppercase tracking-wider font-bold text-muted">Objetivos de Ahorro</h3>
            <button
              onClick={handleNewMeta}
              className="text-xs font-bold text-accent border border-accent/35 rounded-lg px-3 py-1 hover:bg-accent/10 transition-colors"
            >
              + Nueva meta
            </button>
          </div>

          {savingsMetas.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <p className="text-sm text-muted font-bold mb-4">Aún no has creado ningún objetivo de ahorro.</p>
              <Button onClick={handleNewMeta} className="w-full h-12 text-sm font-bold">Crear primer objetivo</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {savingsMetas.map(meta => {
                const perc = meta.meta > 0 ? (meta.acumulado / meta.meta) * 100 : 0;
                const restante = Math.max(0, meta.meta - meta.acumulado);
                const done = perc >= 100;
                return (
                  <button
                    key={meta.id}
                    onClick={() => handleEditMeta(meta)}
                    className="w-full bg-surface border-2 border-border hover:border-accent/50 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl leading-none">{meta.icono}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text truncate">{meta.nombre}</p>
                        <p className="text-xs text-muted font-mono mt-0.5">
                          {done ? '¡Meta alcanzada! 🎉' : `${formatCurrency(restante)} restantes`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-mono font-bold text-sm ${done ? 'text-success' : 'text-text'}`}>{formatCurrency(meta.acumulado)}</p>
                        <p className="text-xs text-muted font-mono">de {formatCurrency(meta.meta)}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono font-bold">
                        <span className={done ? 'text-success' : 'text-muted'}>{Math.round(Math.min(perc, 100))}%</span>
                      </div>
                      <div className="h-2.5 bg-surface-elevated rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-700 ease-out ${done ? 'bg-success' : 'bg-accent'}`}
                          style={{ width: `${Math.min(perc, 100)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Budget categories */}
        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-wider font-bold text-muted pl-1">Presupuestos por Categoría</h3>

          <div className="grid gap-3">
            {activeCategorias.map(c => {
              const spent = spentPerCat[c.id] || 0;
              const budget = getPresupuestoCat(c.id);
              const perc = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);
              const over = perc >= 100;
              const warn = perc >= 70 && !over;

              return (
                <button
                  key={c.id}
                  onClick={() => handleEditCat(c.id)}
                  className={`w-full bg-surface border p-4 rounded-2xl text-left transition-all active:scale-[0.98] ${getBudgetCardClass(perc)}`}
                >
                  <div className="flex justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="font-bold text-text truncate">{c.nombre}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className={`font-mono font-bold ${over ? 'text-danger' : warn ? 'text-warning' : 'text-text'}`}>{formatCurrency(spent)}</span>
                      <span className="font-mono text-xs text-muted ml-1">/ {formatCurrency(budget)}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono font-bold">
                      <span className={over ? 'text-danger' : warn ? 'text-warning' : 'text-muted'}>{Math.round(Math.min(perc, 999))}%</span>
                      {over && <span className="text-danger">Excedido</span>}
                      {warn && <span className="text-warning">Atención</span>}
                    </div>
                    <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${getBudgetBarColor(perc)}`}
                        style={{ width: `${Math.min(perc, 100)}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}

            {activeCategorias.length === 0 && (
              <p className="text-center text-muted font-mono text-sm py-8">No hay presupuestos activos ni gastos registrados este mes.</p>
            )}

            <Button variant="secondary" className="w-full mt-2" onClick={handleNewBudget}>
              + Añadir Presupuesto a Categoría
            </Button>
          </div>
        </div>
      </div>

      {/* Budget editor sheet */}
      <Sheet isOpen={editorOpen} onClose={() => setEditorOpen(false)} title={editingCatId ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}>
        <div className="space-y-6 pb-6 mt-4">
          {!editingCatId && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Categoría</label>
              <select
                value={editingCatId || ''}
                onChange={e => setEditingCatId(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-4 text-sm font-bold text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent appearance-none"
              >
                <option value="">Selecciona una categoría...</option>
                {state.categorias.filter(c => c.tipo !== 'ingreso').map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {editingCatId && (
            <p className="text-sm text-muted">
              Límite mensual para <span className="font-bold text-text">{state.categorias.find(c => c.id === editingCatId)?.nombre}</span>.
            </p>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Límite mensual</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-mono text-muted">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="5"
                value={amountVal}
                onChange={e => setAmountVal(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-4 text-3xl font-black font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-text transition-all"
              />
            </div>
          </div>
          <Button onClick={handleSaveBudget} disabled={!editingCatId || amountVal === ''} className="w-full h-14 text-lg font-bold mt-4">Guardar Límite</Button>
        </div>
      </Sheet>

      {/* Savings meta editor sheet */}
      <Sheet isOpen={metaEditorOpen} onClose={() => setMetaEditorOpen(false)} title={editingMetaId ? 'Editar Objetivo' : 'Nueva Meta de Ahorro'}>
        <div className="space-y-6 pb-6 mt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Nombre</label>
            <input
              type="text"
              placeholder="Ej: Vacaciones en Italia"
              value={metaNombre}
              onChange={e => setMetaNombre(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Icono</label>
            <div className="grid grid-cols-8 gap-2">
              {SAVING_ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setMetaIcono(icon)}
                  className={`h-10 rounded-xl text-xl flex items-center justify-center transition-all ${metaIcono === icon ? 'bg-accent/20 border-2 border-accent scale-110' : 'bg-surface border border-border hover:border-accent/40'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Meta total (€)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-mono text-muted">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="50"
                placeholder="0"
                value={metaTotal}
                onChange={e => setMetaTotal(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-4 text-3xl font-black font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-text transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Ya ahorrado (€)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-mono text-muted">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="10"
                placeholder="0"
                value={metaAcumulado}
                onChange={e => setMetaAcumulado(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-4 text-3xl font-black font-mono focus:outline-none focus:border-success focus:ring-1 focus:ring-success text-success transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={handleSaveMeta} disabled={!metaNombre.trim() || metaTotal === ''} className="w-full h-14 text-lg font-bold">
              {editingMetaId ? 'Guardar Cambios' : 'Crear Meta'}
            </Button>
            {editingMetaId && (
              <Button variant="danger" onClick={handleDeleteMeta} className="w-full h-12 text-base font-bold bg-transparent border border-border">
                Eliminar meta
              </Button>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
