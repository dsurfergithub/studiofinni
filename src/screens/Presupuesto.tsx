import React, { useState } from 'react';
import { useStore } from '../lib/storage/store';
import { FinMesSelector } from '../components/ui/FinMesSelector';
import { formatCurrency } from '../lib/utils';
import { Sheet } from '../components/ui/Sheet';
import { Button } from '../components/ui/Button';

interface PresupuestoProps {
  selectedMesId: string;
  onChangeMes: (id: string) => void;
}

export function Presupuesto({ selectedMesId, onChangeMes }: PresupuestoProps) {
  const { state, getMesesActivos, updateState } = useStore();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [amountVal, setAmountVal] = useState('');

  const [savingsEditorOpen, setSavingsEditorOpen] = useState(false);
  const [savingsGoalVal, setSavingsGoalVal] = useState('');
  const [savingsAcumuladoVal, setSavingsAcumuladoVal] = useState('');

  const activeMeses = getMesesActivos();
  const cMes = activeMeses.find(m => m.id === selectedMesId) || activeMeses[0];

  const getPresupuestoCat = (catId: string) => {
    return state.budgetOverrides?.[selectedMesId]?.[catId] || 0;
  };

  // Get total spent per category in this month (only gastos)
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

  const activeCategorias = state.categorias.filter(c => c.tipo !== 'ingreso' && (getPresupuestoCat(c.id) > 0 || (spentPerCat[c.id] || 0) > 0));
  
  const totalPresupuestado = activeCategorias.reduce((acc, cat) => acc + getPresupuestoCat(cat.id), 0);
  const ppc = totalPresupuestado > 0 ? (totalGastos / totalPresupuestado) * 100 : 0;
  const isHealthy = ppc <= 100;
  
  const ahorroActual = state.savingsAcumulado || 0;
  const metaAhorro = state.savingsGoal || 0;
  const ahorroPerc = metaAhorro > 0 ? (ahorroActual / metaAhorro) * 100 : (ahorroActual > 0 ? 100 : 0);

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
    const newMonthOverrides = { ...currentMonthOverrides, [editingCatId]: val };
    const allOverrides = {
      ...(state.budgetOverrides || {}),
      [selectedMesId]: newMonthOverrides
    };

    updateState({ budgetOverrides: allOverrides });
    setEditorOpen(false);
  };
  
  const handleSaveSavings = () => {
    const goal = parseFloat(savingsGoalVal.replace(',', '.'));
    const acumulado = parseFloat(savingsAcumuladoVal.replace(',', '.'));
    if (isNaN(goal) || goal < 0) return;
    updateState({
      savingsGoal: goal,
      savingsAcumulado: isNaN(acumulado) ? (state.savingsAcumulado || 0) : acumulado,
    });
    setSavingsEditorOpen(false);
  };

  const handleEditSavings = () => {
    setSavingsGoalVal((state.savingsGoal || 0).toString());
    setSavingsAcumuladoVal((state.savingsAcumulado || 0).toString());
    setSavingsEditorOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <FinMesSelector selectedMesId={selectedMesId} onChange={onChangeMes} />
      </div>

      <div className="p-4 space-y-6 mt-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xl font-bold font-mono tracking-tight text-text">Presupuesto</h2>
          <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${isHealthy ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
            {isHealthy ? 'SALUDABLE' : 'EXCEDIDO'}
          </span>
        </div>

        <div className="bg-gradient-to-br from-surface border border-border rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className="text-sm uppercase tracking-wider font-bold text-muted">Ahorro Objetivo</h3>
            <button onClick={handleEditSavings} className="text-xs uppercase font-bold text-accent hover:text-accent-hover tracking-wider">
              {metaAhorro > 0 ? 'Editar Meta' : 'Configurar'}
            </button>
          </div>
          {metaAhorro > 0 ? (
            <div className="relative z-10 space-y-3 mt-4">
              <div className="flex justify-between items-end">
                <div>
                   <span className={`text-4xl font-black font-mono tracking-tighter ${ahorroActual >= metaAhorro ? 'text-success' : (ahorroActual > 0 ? 'text-text' : 'text-danger')}`}>
                     {formatCurrency(ahorroActual)}
                   </span>
                </div>
                <div className="text-right pb-1">
                   <span className="text-xs font-bold text-muted uppercase tracking-wider">Meta</span>
                   <p className="font-mono font-bold text-text">{formatCurrency(metaAhorro)}</p>
                </div>
              </div>
              <div className="h-3 bg-surface-elevated rounded-full overflow-hidden mt-1">
                <div className={`h-full transition-all duration-1000 ease-out ${ahorroActual >= metaAhorro ? 'bg-success' : 'bg-accent'}`} style={{ width: `${Math.min(ahorroPerc, 100)}%` }} />
              </div>
            </div>
          ) : (
            <div className="text-center py-4 relative z-10">
              <p className="text-sm text-muted font-bold mb-4">Aún no has definido un objetivo de ahorro.</p>
              <Button onClick={handleEditSavings} className="w-full text-xs font-bold uppercase tracking-wider h-12">Crear objetivo de ahorro</Button>
            </div>
          )}
        </div>

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

        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-wider font-bold text-muted pl-1">Presupuestos por Categoría</h3>
          
          <div className="grid gap-3">
            {activeCategorias.map(c => {
              const spent = spentPerCat[c.id] || 0;
              const budget = getPresupuestoCat(c.id);
              const perc = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);
              const over = perc > 100;

              return (
                <button key={c.id} onClick={() => handleEditCat(c.id)} className="w-full bg-surface border border-border p-4 rounded-2xl text-left hover:border-accent/40 hover:bg-surface-elevated transition-all">
                  <div className="flex justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="font-bold text-text truncate">{c.nombre}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className={`font-mono font-bold ${over ? 'text-danger' : 'text-text'}`}>{formatCurrency(spent)}</span>
                      <span className="font-mono text-xs text-muted ml-1">/ {formatCurrency(budget)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ease-out ${over ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(perc, 100)}%` }} />
                  </div>
                </button>
              );
            })}

            {activeCategorias.length === 0 && (
              <p className="text-center text-muted font-mono text-sm py-8">No hay presupuestos activos y no se han registrado gastos en este mes.</p>
            )}

            <Button variant="secondary" className="w-full mt-2" onClick={handleNewBudget}>
              + Añadir Presupuesto a Categoría
            </Button>
          </div>
        </div>
      </div>

      <Sheet isOpen={editorOpen} onClose={() => setEditorOpen(false)} title={editingCatId ? "Editar Presupuesto" : "Nuevo Presupuesto"}>
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
            <p className="text-sm text-muted">Asigna el límite presupuestario mensual para <span className="font-bold text-text">{state.categorias.find(c => c.id === editingCatId)?.nombre}</span>.</p>
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
      
      <Sheet isOpen={savingsEditorOpen} onClose={() => setSavingsEditorOpen(false)} title="Objetivo de Ahorro">
        <div className="space-y-6 pb-6 mt-4">
          <p className="text-sm text-muted">Define tu meta y registra cuánto llevas ahorrado. Esta información es independiente de tus movimientos y presupuestos.</p>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Meta total (€)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-mono text-muted">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="50"
                placeholder="0"
                value={savingsGoalVal}
                onChange={e => setSavingsGoalVal(e.target.value)}
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
                value={savingsAcumuladoVal}
                onChange={e => setSavingsAcumuladoVal(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-4 text-3xl font-black font-mono focus:outline-none focus:border-success focus:ring-1 focus:ring-success text-success transition-all"
              />
            </div>
          </div>
          <Button onClick={handleSaveSavings} disabled={savingsGoalVal === ''} className="w-full h-14 text-lg font-bold mt-4">Guardar Objetivo</Button>
        </div>
      </Sheet>
    </div>
  );
}
