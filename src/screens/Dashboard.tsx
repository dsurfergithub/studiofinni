import React from 'react';
import { useStore } from '../lib/storage/store';
import { FinMesSelector } from '../components/ui/FinMesSelector';
import { formatCurrency } from '../lib/utils';
import { PieChart as PieChartIcon } from 'lucide-react';

interface DashboardProps {
  selectedMesId: string;
  onChangeMes: (id: string) => void;
}

export function Dashboard({ selectedMesId, onChangeMes }: DashboardProps) {
  const { state, getSaldoCalculado, getMesesActivos } = useStore();
  const meses = getMesesActivos();
  const currentMes = meses.find(m => m.id === selectedMesId) || meses[0];

  const saldo = getSaldoCalculado();

  let ingresos = 0;
  let gastos = 0;
  const gastosPorCategoria: Record<string, number> = {};

  if (currentMes) {
    const movsMes = state.movimientos.filter(m => m.fecha >= currentMes.inicio && m.fecha <= currentMes.fin);
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
    .map(([catId, amount]) => {
      const c = state.categorias.find(x => x.id === catId);
      return { id: catId, name: c?.nombre || 'Sin clasificar', color: c?.color || '#7a7a92', amount };
    });

  const getPercentage = (amount: number) => {
    if (gastos === 0) return 0;
    return (amount / gastos) * 100;
  };

  const formatCurrencyBig = (amount: number) => {
    const formatted = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    const parts = formatted.split(',');
    if (parts.length === 2) {
      return (
        <>
          {parts[0]}<span className="text-3xl text-muted font-medium">,{parts[1]}€</span>
        </>
      );
    }
    return <>{formatted}</>;
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 scroll-area">
      <div className="sticky top-0 bg-bg/80 backdrop-blur-lg z-10">
        <FinMesSelector selectedMesId={selectedMesId} onChange={onChangeMes} />
      </div>

      <div className="px-4 space-y-6 mt-2">
        {/* Saldo Grid */}
        <section className="py-2">
          <p className="text-muted uppercase text-xs tracking-widest mb-1 font-bold">Saldo Real Calculado</p>
          <h1 className="text-5xl sm:text-6xl font-black font-mono tracking-tighter text-text truncate">
            {formatCurrencyBig(saldo)}
          </h1>
        </section>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border p-6 rounded-3xl">
            <p className="text-muted text-xs font-bold uppercase mb-2">Ingresos</p>
            <p className="text-2xl font-mono text-success truncate">+{formatCurrency(ingresos)}</p>
          </div>
          <div className="bg-surface border border-border p-6 rounded-3xl">
            <p className="text-muted text-xs font-bold uppercase mb-2">Gastos</p>
            <p className="text-2xl font-mono text-danger truncate">-{formatCurrency(gastos)}</p>
          </div>
        </div>

        {/* Gastos breakdown */}
        <div className="flex-1 bg-surface border border-border rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Top Categorías</h3>
            <button className="text-muted hover:text-text p-1 bg-surface-elevated rounded-full transition-colors"><PieChartIcon size={16} /></button>
          </div>
          
          <div className="flex flex-col gap-5">
            {sortedCats.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">No hay gastos este mes</p>
            ) : (
              sortedCats.map(sc => (
                <div key={sc.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} /> 
                      <span className="font-medium text-text truncate max-w-[150px] sm:max-w-[200px]">{sc.name}</span>
                    </span>
                    <span className="font-mono font-medium">{formatCurrency(sc.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                    <div className="h-full transition-all duration-500 ease-out" style={{ backgroundColor: sc.color, width: `${Math.max(getPercentage(sc.amount), 2)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
