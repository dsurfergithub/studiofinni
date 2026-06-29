import React, { useState } from 'react';
import { useStore } from '../lib/storage/store';
import { FinMesSelector } from '../components/ui/FinMesSelector';
import { formatCurrency, getLocalFechaIso } from '../lib/utils';
import { MovimientoEditor } from '../components/ui/MovimientoEditor';
import { totalMensual } from '../lib/suscripciones/suscripciones';
import { movimientoEnMes } from '../lib/finmes/finmes';
import { ArrowDownLeft, ArrowUpRight, Repeat, ChevronRight } from 'lucide-react';

interface DashboardProps {
  selectedMesId: string;
  onChangeMes: (id: string) => void;
  onNavigate?: (tab: string) => void;
}

export function Dashboard({ selectedMesId, onChangeMes, onNavigate }: DashboardProps) {
  const { state, getSaldoCalculado, getMesesActivos } = useStore();
  const meses = getMesesActivos();
  const currentMes = meses.find(m => m.id === selectedMesId) || meses[0];

  const [editorOpen, setEditorOpen] = useState(false);
  const [defaultTipo, setDefaultTipo] = useState<'gasto' | 'ingreso'>('gasto');

  const saldo = getSaldoCalculado();
  const subsMensual = totalMensual(state.suscripciones || []);

  let ingresos = 0;
  let gastos = 0;
  const gastosPorCategoria: Record<string, number> = {};

  if (currentMes) {
    const movsMes = state.movimientos.filter(m => movimientoEnMes(m, currentMes, meses));
    movsMes.forEach(m => {
      if (m.importe > 0) ingresos += m.importe;
      else {
        gastos += Math.abs(m.importe);
        gastosPorCategoria[m.categoria] = (gastosPorCategoria[m.categoria] || 0) + Math.abs(m.importe);
      }
    });
  }

  const sortedCats = Object.entries(gastosPorCategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([catId, amount]) => {
      const c = state.categorias.find(x => x.id === catId);
      return { id: catId, name: c?.nombre || 'Sin clasificar', color: c?.color || '#7a7a92', amount };
    });

  const getPercentage = (amount: number) => (gastos === 0 ? 0 : (amount / gastos) * 100);

  const openEditor = (tipo: 'gasto' | 'ingreso') => {
    setDefaultTipo(tipo);
    setEditorOpen(true);
  };

  const defaultDate = currentMes && getLocalFechaIso() >= currentMes.inicio && getLocalFechaIso() <= currentMes.fin
    ? getLocalFechaIso()
    : currentMes?.fin || getLocalFechaIso();

  const formatCurrencyBig = (amount: number) => {
    const formatted = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    const parts = formatted.split(',');
    if (parts.length === 2) {
      return <>{parts[0]}<span className="text-3xl text-muted font-medium">,{parts[1]}€</span></>;
    }
    return <>{formatted}</>;
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 scroll-area">
      <div className="sticky top-0 bg-bg/80 backdrop-blur-lg z-10">
        <FinMesSelector selectedMesId={selectedMesId} onChange={onChangeMes} />
      </div>

      <div className="px-4 space-y-5 mt-2">
        {/* Saldo */}
        <section className="py-2">
          <p className="text-muted uppercase text-xs tracking-widest mb-1 font-bold">Saldo real calculado</p>
          <h1 className="text-5xl sm:text-6xl font-black font-mono tracking-tighter text-text truncate">
            {formatCurrencyBig(saldo)}
          </h1>
        </section>

        {/* Accesos rápidos +Gasto / +Ingreso */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => openEditor('gasto')}
            className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger font-bold active:scale-[0.97] transition-all hover:bg-danger/15"
          >
            <ArrowDownLeft size={20} strokeWidth={2.5} /> Gasto
          </button>
          <button
            onClick={() => openEditor('ingreso')}
            className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-success/10 border border-success/30 text-success font-bold active:scale-[0.97] transition-all hover:bg-success/15"
          >
            <ArrowUpRight size={20} strokeWidth={2.5} /> Ingreso
          </button>
        </div>

        {/* Ingresos / Gastos del mes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border p-5 rounded-3xl shadow-card">
            <p className="text-muted text-xs font-bold uppercase mb-2">Ingresos</p>
            <p className="text-2xl font-mono text-success truncate">+{formatCurrency(ingresos)}</p>
          </div>
          <div className="bg-surface border border-border p-5 rounded-3xl shadow-card">
            <p className="text-muted text-xs font-bold uppercase mb-2">Gastos</p>
            <p className="text-2xl font-mono text-danger truncate">-{formatCurrency(gastos)}</p>
          </div>
        </div>

        {/* Suscripciones */}
        {(state.suscripciones?.length || 0) > 0 && (
          <button
            onClick={() => onNavigate?.('suscripciones')}
            className="w-full bg-surface border border-border rounded-3xl p-5 flex items-center gap-4 shadow-card active:scale-[0.98] transition-all hover:border-accent/40"
          >
            <div className="w-11 h-11 rounded-2xl bg-accent/15 flex items-center justify-center flex-shrink-0">
              <Repeat size={20} className="text-accent" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-bold text-text">Suscripciones</p>
              <p className="text-xs text-muted">{state.suscripciones.filter(s => s.activa).length} activas</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-mono font-bold text-text">{formatCurrency(subsMensual)}<span className="text-muted text-xs">/mes</span></p>
            </div>
            <ChevronRight size={18} className="text-muted flex-shrink-0" />
          </button>
        )}

        {/* Top categorías */}
        <div className="bg-surface border border-border rounded-3xl p-5 shadow-card">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Top categorías</h3>
            <button onClick={() => onNavigate?.('insights')} className="text-xs font-bold text-accent">Ver más</button>
          </div>

          <div className="flex flex-col gap-4">
            {sortedCats.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">No hay gastos este mes</p>
            ) : (
              sortedCats.map(sc => (
                <div key={sc.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.color }} />
                      <span className="font-medium text-text truncate">{sc.name}</span>
                    </span>
                    <span className="font-mono font-medium text-text flex-shrink-0 ml-2">{formatCurrency(sc.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                    <div className="h-full transition-all duration-500" style={{ backgroundColor: sc.color, width: `${Math.max(getPercentage(sc.amount), 2)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <MovimientoEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        movimiento={null}
        defaultDate={defaultDate}
        defaultTipo={defaultTipo}
      />
    </div>
  );
}
