import React from 'react';
import { TrendingUp, ChevronRight } from 'lucide-react';
import { Categoria } from '../../lib/storage/types';
import { GastoRaro } from '../../lib/insights/raros';
import { formatCurrency } from '../../lib/utils';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** «+73% sobre tu media (1.070 €)» o, si antes no gastabas ahí, «nuevo: antes no gastabas aquí». */
export function describirRaro(r: GastoRaro): string {
  return r.variacion === null
    ? 'Antes no gastabas aquí'
    : `+${pct(r.variacion)} sobre tu media de ${formatCurrency(r.media)}`;
}

/**
 * Tarjeta de Insights: categorías que este periodo van claramente por encima de lo
 * habitual. Tocar una abre su detalle.
 */
export function GastosRaros({
  raros, categorias, onSelect,
}: {
  raros: GastoRaro[];
  categorias: Categoria[];
  onSelect?: (catId: string) => void;
}) {
  if (raros.length === 0) return null;
  const base = raros[0].periodosBase;
  return (
    <section className="bg-surface border border-warning/40 rounded-3xl p-5 shadow-card space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-warning" />
        <p className="text-xs font-bold text-warning uppercase tracking-wider">Fuera de lo habitual</p>
      </div>
      <p className="text-[11px] text-muted -mt-1">Comparado con la media de tus {base} periodos anteriores.</p>
      <div className="space-y-1">
        {raros.slice(0, 4).map(r => {
          const c = categorias.find(x => x.id === r.categoria);
          return (
            <button
              key={r.categoria}
              onClick={() => onSelect?.(r.categoria)}
              className="w-full flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-surface-elevated transition-colors text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c?.color || '#7a7a92' }} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text truncate">{c?.nombre || 'Sin clasificar'}</span>
                <span className="block text-[11px] text-muted">{describirRaro(r)}</span>
              </span>
              <span className="text-sm font-mono font-bold text-text flex-shrink-0">{formatCurrency(r.actual)}</span>
            </button>
          );
        })}
      </div>
      {raros.length > 4 && <p className="text-[11px] text-dim">Y {raros.length - 4} más.</p>}
    </section>
  );
}

/** Aviso de una línea para Inicio: la categoría más desviada y cuántas más hay. */
export function AvisoGastoRaro({ raros, categorias, onClick }: { raros: GastoRaro[]; categorias: Categoria[]; onClick?: () => void }) {
  if (raros.length === 0) return null;
  const r = raros[0];
  const nombre = categorias.find(x => x.id === r.categoria)?.nombre || 'Sin clasificar';
  const texto = r.variacion === null
    ? `${nombre}: ${formatCurrency(r.actual)}, gasto nuevo`
    : `${nombre}: +${pct(r.variacion)} sobre lo habitual`;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-surface border border-warning/40 rounded-2xl p-3 text-left hover:bg-surface-elevated transition-colors"
    >
      <TrendingUp size={18} className="text-warning flex-shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-text truncate">{texto}</span>
        {raros.length > 1 && <span className="block text-[11px] text-muted">Y {raros.length - 1} categoría{raros.length > 2 ? 's' : ''} más fuera de lo normal</span>}
      </span>
      <ChevronRight size={18} className="text-muted flex-shrink-0" />
    </button>
  );
}
