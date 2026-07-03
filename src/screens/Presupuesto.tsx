import React, { useState } from 'react';
import { useStore } from '../lib/storage/store';
import { FinMesSelector } from '../components/ui/FinMesSelector';
import { useToast } from '../components/ui/Toast';
import { formatCurrency, getLocalFechaIso } from '../lib/utils';
import { movimientoEnMes } from '../lib/finmes/finmes';
import { Sheet } from '../components/ui/Sheet';
import { Button } from '../components/ui/Button';
import { SavingsMeta } from '../lib/storage/types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Tag, Sparkle, PiggyBank } from 'lucide-react';

interface PresupuestoProps {
  selectedMesId: string;
  onChangeMes: (id: string) => void;
  onNavigate?: (tab: string) => void;
}

const SAVING_ICONS = ['🎯','🏠','🚗','✈️','🎓','❤️','💻','📱','🎸','📷','🏋️','☕','🎁','🌴','🐾','🎮','💍','📚','⚽','🛒','💰','🏖️','🎉','🌟'];

function barColor(perc: number) {
  if (perc >= 100) return 'bg-danger';
  if (perc >= 80) return 'bg-warning';
  return 'bg-success';
}

export function Presupuesto({ selectedMesId, onChangeMes, onNavigate }: PresupuestoProps) {
  const {
    state, getMesesActivos, updateState, addMovimiento, addCategoria,
    isBudgeted, getPresupuestoCat, setBudgetTemplate, setBudgetForMonth, removeFromBudget,
  } = useStore();
  const { toast } = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [amountVal, setAmountVal] = useState('');
  const [scopeAllMonths, setScopeAllMonths] = useState(true);

  // Savings meta state
  const [metaEditorOpen, setMetaEditorOpen] = useState(false);
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [metaNombre, setMetaNombre] = useState('');
  const [metaIcono, setMetaIcono] = useState('🎯');
  const [metaTotal, setMetaTotal] = useState('');
  const [metaAcumulado, setMetaAcumulado] = useState('');
  const [aporteVal, setAporteVal] = useState('');

  const activeMeses = getMesesActivos();
  const cMes = activeMeses.find(m => m.id === selectedMesId) || activeMeses[0];

  // Gasto por categoría (solo lo que cuenta para presupuesto) + gasto puntual aparte.
  const spentPerCat: Record<string, number> = {};
  let gastoPuntual = 0;
  if (cMes) {
    state.movimientos.forEach(m => {
      if (m.importe < 0 && movimientoEnMes(m, cMes, activeMeses)) {
        if (m.enPresupuesto === false) {
          gastoPuntual += Math.abs(m.importe);
        } else {
          spentPerCat[m.categoria] = (spentPerCat[m.categoria] || 0) + Math.abs(m.importe);
        }
      }
    });
  }

  // Categorías con presupuesto en este mes (template global u override del mes).
  const budgetedIds = new Set<string>([
    ...Object.keys(state.budgetTemplate || {}),
    ...Object.keys(state.budgetOverrides?.[selectedMesId] || {}),
  ]);
  const budgetedCats = state.categorias
    .filter(c => budgetedIds.has(c.id))
    .map(c => ({ cat: c, budget: getPresupuestoCat(c.id, selectedMesId), spent: spentPerCat[c.id] || 0 }))
    .sort((a, b) => b.budget - a.budget);

  // Categorías con gasto presupuestable pero sin límite asignado.
  const sinPresupuesto = state.categorias
    .filter(c => !budgetedIds.has(c.id) && (spentPerCat[c.id] || 0) > 0)
    .map(c => ({ cat: c, spent: spentPerCat[c.id] || 0 }))
    .sort((a, b) => b.spent - a.spent);

  const totalPresupuestado = budgetedCats.reduce((acc, b) => acc + b.budget, 0);
  const totalGastado = budgetedCats.reduce((acc, b) => acc + b.spent, 0);
  const disponible = totalPresupuestado - totalGastado;
  const ppc = totalPresupuestado > 0 ? (totalGastado / totalPresupuestado) * 100 : 0;
  const isHealthy = ppc <= 100;

  const savingsMetas: SavingsMeta[] = state.savingsMetas || [];

  // ---- Budget handlers ----
  const handleEditCat = (catId: string) => {
    setEditingCatId(catId);
    setAmountVal(String(getPresupuestoCat(catId, selectedMesId) || ''));
    setScopeAllMonths(!(state.budgetOverrides?.[selectedMesId]?.[catId] !== undefined));
    setEditorOpen(true);
  };

  const handleNewBudget = (presetCatId?: string) => {
    setEditingCatId(presetCatId || null);
    setAmountVal('');
    setScopeAllMonths(true);
    setEditorOpen(true);
  };

  const handleSaveBudget = () => {
    if (!editingCatId) return;
    const val = parseFloat(amountVal.replace(',', '.'));
    if (isNaN(val) || val < 0) return;
    if (scopeAllMonths) {
      setBudgetTemplate(editingCatId, val);
    } else {
      setBudgetForMonth(editingCatId, selectedMesId, val);
    }
    setEditorOpen(false);
  };

  const handleRemoveBudget = () => {
    if (!editingCatId) return;
    if (window.confirm('¿Quitar el presupuesto de esta categoría? Sus gastos seguirán registrados.')) {
      removeFromBudget(editingCatId);
      setEditorOpen(false);
    }
  };

  // ---- Savings handlers ----
  const handleNewMeta = () => {
    setEditingMetaId(null); setMetaNombre(''); setMetaIcono('🎯'); setMetaTotal(''); setMetaAcumulado('');
    setAporteVal('');
    setMetaEditorOpen(true);
  };
  const handleEditMeta = (meta: SavingsMeta) => {
    setEditingMetaId(meta.id); setMetaNombre(meta.nombre); setMetaIcono(meta.icono);
    setMetaTotal(meta.meta.toString()); setMetaAcumulado(meta.acumulado.toString());
    setAporteVal('');
    setMetaEditorOpen(true);
  };
  const handleSaveMeta = () => {
    const totalVal = parseFloat(metaTotal.replace(',', '.'));
    const acumuladoVal = parseFloat(metaAcumulado.replace(',', '.'));
    if (!metaNombre.trim() || isNaN(totalVal) || totalVal <= 0) return;
    const current = state.savingsMetas || [];
    if (editingMetaId) {
      updateState({
        savingsMetas: current.map(m => m.id === editingMetaId
          ? { ...m, nombre: metaNombre, icono: metaIcono, meta: totalVal, acumulado: isNaN(acumuladoVal) ? m.acumulado : acumuladoVal }
          : m),
      });
    } else {
      updateState({
        savingsMetas: [...current, { id: uuidv4(), nombre: metaNombre, icono: metaIcono, meta: totalVal, acumulado: isNaN(acumuladoVal) ? 0 : acumuladoVal }],
      });
    }
    setMetaEditorOpen(false);
  };
  const handleDeleteMeta = () => {
    if (!editingMetaId || !window.confirm('¿Eliminar esta meta de ahorro?')) return;
    updateState({ savingsMetas: (state.savingsMetas || []).filter(m => m.id !== editingMetaId) });
    setMetaEditorOpen(false);
  };

  // Aporta dinero a la meta: suma al acumulado y lo registra como movimiento para que
  // el saldo y el historial reflejen el traspaso al ahorro (fuera del presupuesto).
  const handleAportar = () => {
    if (!editingMetaId) return;
    const val = parseFloat(aporteVal.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      toast('Escribe cuánto quieres aportar.', 'error');
      return;
    }
    if (!state.categorias.some(c => c.id === 'ahorro')) {
      addCategoria({ id: 'ahorro', nombre: 'Ahorro', color: '#22d3ee', icono: 'star', tipo: 'gasto', macro: 'inversion' });
    }
    addMovimiento({
      id: uuidv4(),
      fecha: getLocalFechaIso(),
      importe: -val,
      concepto: `Aportación a ${metaNombre || 'meta de ahorro'}`,
      categoria: 'ahorro',
      fuente: 'manual',
      hash: uuidv4(),
      enPresupuesto: false,
    });
    updateState({
      savingsMetas: (state.savingsMetas || []).map(m =>
        m.id === editingMetaId ? { ...m, acumulado: m.acumulado + val } : m),
    });
    setAporteVal('');
    setMetaEditorOpen(false);
    toast(`${formatCurrency(val)} aportados a "${metaNombre}". Registrado en tus movimientos.`, 'ok');
  };

  const catsDisponiblesParaPresupuestar = state.categorias.filter(c => c.tipo !== 'ingreso' && !budgetedIds.has(c.id));

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <FinMesSelector selectedMesId={selectedMesId} onChange={onChangeMes} />
      </div>

      <div className="p-4 space-y-6 mt-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xl font-bold font-display tracking-tight text-text">Presupuesto</h2>
          {totalPresupuestado > 0 && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isHealthy ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
              {isHealthy ? 'Vas bien' : 'Te has pasado'}
            </span>
          )}
        </div>

        {/* Resumen disponible */}
        <div className="bg-surface border border-border rounded-3xl p-5 shadow-card">
          <p className="text-xs uppercase font-bold text-muted tracking-widest mb-1">
            {disponible >= 0 ? 'Te queda por gastar' : 'Te has pasado en'}
          </p>
          <p className={`text-4xl font-black font-mono tracking-tight mb-4 ${disponible >= 0 ? 'text-text' : 'text-danger'}`}>
            {formatCurrency(Math.abs(disponible))}
          </p>

          <div className="h-3 bg-surface-elevated rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor(ppc)}`} style={{ width: `${Math.min(ppc, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted">{formatCurrency(totalGastado)} gastado</span>
            <span className="font-bold text-text">{Math.round(ppc)}% de {formatCurrency(totalPresupuestado)}</span>
          </div>
          {gastoPuntual > 0 && (
            <p className="text-[11px] text-muted mt-3 flex items-center gap-1">
              <Sparkle size={11} className="text-warning" />
              {formatCurrency(gastoPuntual)} en gastos puntuales (no cuentan para el presupuesto)
            </p>
          )}
        </div>

        {/* Objetivos de ahorro */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs uppercase tracking-wider font-bold text-muted">Objetivos de ahorro</h3>
            <button onClick={handleNewMeta} className="text-xs font-bold text-accent border border-accent/35 rounded-lg px-3 py-1 hover:bg-accent/10 transition-colors">+ Nueva meta</button>
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
                  <button key={meta.id} onClick={() => handleEditMeta(meta)} className="w-full bg-surface border border-border hover:border-accent/50 rounded-2xl p-4 text-left transition-all active:scale-[0.98]">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl leading-none">{meta.icono}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text truncate">{meta.nombre}</p>
                        <p className="text-xs text-muted font-mono mt-0.5">{done ? '¡Meta alcanzada! 🎉' : `${formatCurrency(restante)} restantes`}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-mono font-bold text-sm ${done ? 'text-success' : 'text-text'}`}>{formatCurrency(meta.acumulado)}</p>
                        <p className="text-xs text-muted font-mono">de {formatCurrency(meta.meta)}</p>
                      </div>
                    </div>
                    <div className="h-2.5 bg-surface-elevated rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${done ? 'bg-success' : 'bg-accent'}`} style={{ width: `${Math.min(perc, 100)}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Presupuestos por categoría */}
        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-wider font-bold text-muted pl-1">Presupuestos por categoría</h3>

          <div className="grid gap-3">
            {budgetedCats.map(({ cat: c, budget, spent }) => {
              const perc = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);
              const remaining = budget - spent;
              const over = perc >= 100;
              const warn = perc >= 80 && !over;
              return (
                <button key={c.id} onClick={() => handleEditCat(c.id)}
                  className={`w-full bg-surface border p-4 rounded-2xl text-left transition-all active:scale-[0.98] ${over ? 'border-danger/40' : warn ? 'border-warning/40' : 'border-border hover:border-accent/40'}`}>
                  <div className="flex justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="font-bold text-text truncate">{c.nombre}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className={`font-mono font-bold ${over ? 'text-danger' : warn ? 'text-warning' : 'text-text'}`}>{formatCurrency(spent)}</span>
                      <span className="font-mono text-xs text-muted ml-1">/ {formatCurrency(budget)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-surface-elevated rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full transition-all duration-500 ${barColor(perc)}`} style={{ width: `${Math.min(perc, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className={over ? 'text-danger font-bold' : 'text-muted'}>{Math.round(perc)}%</span>
                    <span className={remaining < 0 ? 'text-danger font-bold' : 'text-success font-bold'}>
                      {remaining >= 0 ? `Quedan ${formatCurrency(remaining)}` : `Excedido ${formatCurrency(-remaining)}`}
                    </span>
                  </div>
                </button>
              );
            })}

            {budgetedCats.length === 0 && (
              <p className="text-center text-muted text-sm py-6">Todavía no has puesto presupuesto a ninguna categoría.</p>
            )}

            <Button variant="secondary" className="w-full mt-1" onClick={() => handleNewBudget()}>
              <Plus size={18} className="mr-1" /> Añadir presupuesto a una categoría
            </Button>
          </div>
        </div>

        {/* Gastos sin presupuesto: opt-in */}
        {sinPresupuesto.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-bold text-muted pl-1">Gastos sin presupuesto</h3>
            <p className="text-xs text-muted px-1 -mt-1">Estás gastando aquí pero no les has puesto límite. Añádelos cuando quieras.</p>
            <div className="grid gap-2">
              {sinPresupuesto.map(({ cat: c, spent }) => (
                <div key={c.id} className="w-full bg-surface border border-border rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="font-bold text-text truncate">{c.nombre}</span>
                    <span className="font-mono text-xs text-muted">{formatCurrency(spent)}</span>
                  </div>
                  <button onClick={() => handleNewBudget(c.id)} className="text-xs font-bold text-accent border border-accent/35 rounded-lg px-3 py-1 hover:bg-accent/10 transition-colors flex-shrink-0">
                    + Presupuesto
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => onNavigate?.('categorias')} className="w-full flex items-center justify-center gap-2 text-sm text-muted hover:text-text transition-colors py-2">
          <Tag size={16} /> Gestionar categorías
        </button>
      </div>

      {/* Budget editor */}
      <Sheet isOpen={editorOpen} onClose={() => setEditorOpen(false)} title={editingCatId && isBudgeted(editingCatId) ? 'Editar presupuesto' : 'Nuevo presupuesto'}>
        <div className="space-y-6 pb-6 mt-4">
          {!editingCatId && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Categoría</label>
              <select value={editingCatId || ''} onChange={e => setEditingCatId(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-4 text-sm font-bold text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent appearance-none">
                <option value="">Selecciona una categoría...</option>
                {catsDisponiblesParaPresupuestar.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {editingCatId && (
            <p className="text-sm text-muted">
              Límite para <span className="font-bold text-text">{state.categorias.find(c => c.id === editingCatId)?.nombre}</span>.
            </p>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Límite</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-mono text-muted">€</span>
              <input type="number" inputMode="decimal" step="5" value={amountVal} onChange={e => setAmountVal(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-4 text-3xl font-black font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-text" />
            </div>
          </div>

          {/* Alcance */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">¿A qué meses aplica?</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setScopeAllMonths(true)}
                className={`py-3 px-2 rounded-xl text-sm font-bold transition-all ${scopeAllMonths ? 'bg-accent text-white ring-2 ring-accent' : 'bg-surface-elevated text-muted border border-border'}`}>
                Todos los meses
              </button>
              <button type="button" onClick={() => setScopeAllMonths(false)}
                className={`py-3 px-2 rounded-xl text-sm font-bold transition-all ${!scopeAllMonths ? 'bg-accent text-white ring-2 ring-accent' : 'bg-surface-elevated text-muted border border-border'}`}>
                Solo {cMes?.nombre.split(' ')[0].toLowerCase()}
              </button>
            </div>
          </div>

          <Button onClick={handleSaveBudget} disabled={!editingCatId || amountVal === ''} className="w-full h-14 text-lg font-bold">Guardar límite</Button>
          {editingCatId && isBudgeted(editingCatId) && (
            <Button variant="danger" onClick={handleRemoveBudget} className="w-full h-12 text-base font-bold bg-transparent border border-border">Quitar del presupuesto</Button>
          )}
        </div>
      </Sheet>

      {/* Savings meta editor */}
      <Sheet isOpen={metaEditorOpen} onClose={() => setMetaEditorOpen(false)} title={editingMetaId ? 'Editar objetivo' : 'Nueva meta de ahorro'}>
        <div className="space-y-6 pb-6 mt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Nombre</label>
            <input type="text" placeholder="Ej: Vacaciones en Italia" value={metaNombre} onChange={e => setMetaNombre(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Icono</label>
            <div className="grid grid-cols-8 gap-2">
              {SAVING_ICONS.map(icon => (
                <button key={icon} onClick={() => setMetaIcono(icon)}
                  className={`h-10 rounded-xl text-xl flex items-center justify-center transition-all ${metaIcono === icon ? 'bg-accent/20 border-2 border-accent scale-110' : 'bg-surface border border-border'}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Meta total (€)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-mono text-muted">€</span>
              <input type="number" inputMode="decimal" step="50" placeholder="0" value={metaTotal} onChange={e => setMetaTotal(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-4 text-3xl font-black font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-text" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Ya ahorrado (€)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-mono text-muted">€</span>
              <input type="number" inputMode="decimal" step="10" placeholder="0" value={metaAcumulado} onChange={e => setMetaAcumulado(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-4 text-3xl font-black font-mono focus:outline-none focus:border-success focus:ring-1 focus:ring-success text-success" />
            </div>
          </div>
          {/* Aportación rápida: solo para metas ya creadas */}
          {editingMetaId && (
            <div className="space-y-2 bg-surface-elevated rounded-2xl p-4 border border-accent/25">
              <label className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <PiggyBank size={14} /> Aportar ahora
              </label>
              <p className="text-[11px] text-muted">Suma dinero a esta meta y quedará apuntado en tus movimientos (no cuenta para el presupuesto).</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-mono text-muted">€</span>
                  <input type="number" inputMode="decimal" step="10" placeholder="0" value={aporteVal} onChange={e => setAporteVal(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-3 text-xl font-bold font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-text" />
                </div>
                <Button onClick={handleAportar} disabled={aporteVal === ''} className="h-auto px-5 font-bold">Aportar</Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={handleSaveMeta} disabled={!metaNombre.trim() || metaTotal === ''} className="w-full h-14 text-lg font-bold">
              {editingMetaId ? 'Guardar cambios' : 'Crear meta'}
            </Button>
            {editingMetaId && (
              <Button variant="danger" onClick={handleDeleteMeta} className="w-full h-12 text-base font-bold bg-transparent border border-border">Eliminar meta</Button>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
