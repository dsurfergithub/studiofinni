import React, { useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { cn, formatCurrency } from '../../lib/utils';
import { Decision, Reparto } from '../../lib/finmes/reparto';

const ETIQUETA: Record<Decision, string> = {
  dejar: 'Dejar',
  mover: 'Mover',
  excluir: 'Quitar',
};

/** Los tres botones de decisión de una fila. Compactos: son 3 por movimiento. */
function Selector({ valor, onChange }: { valor: Decision; onChange: (d: Decision) => void }) {
  return (
    <div className="flex gap-1 flex-shrink-0">
      {(['dejar', 'mover', 'excluir'] as Decision[]).map(d => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={cn(
            'px-2 h-7 rounded-lg text-[11px] font-bold transition-colors border',
            valor === d
              ? d === 'excluir'
                ? 'bg-danger-soft text-danger border-danger-soft'
                : 'bg-accent-soft text-accent border-accent-soft'
              : 'bg-transparent text-dim border-border hover:text-text'
          )}
        >
          {ETIQUETA[d]}
        </button>
      ))}
    </div>
  );
}

/**
 * Aviso previo a importar: los periodos de Finni van de nómina a nómina, así que un
 * archivo de un mes natural casi siempre se parte en dos. En vez de repartirlos sin
 * avisar, aquí se ven los que se salen y se decide uno a uno (o en bloque) si se
 * mueven al periodo principal, se dejan donde caen o no se importan.
 */
export function RevisionPeriodos({
  isOpen,
  reparto,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  reparto: Reparto | null;
  onCancel: () => void;
  onConfirm: (decisiones: Map<string, Decision>, mesDestinoId: string) => void;
}) {
  const [decisiones, setDecisiones] = useState<Map<string, Decision>>(new Map());

  // Al abrir con un reparto nuevo se parte de cero: por defecto no se toca nada.
  const [ultimo, setUltimo] = useState<Reparto | null>(null);
  if (reparto !== ultimo) {
    setUltimo(reparto);
    setDecisiones(new Map());
  }

  const fuera = useMemo(() => (reparto ? reparto.fuera.flatMap(g => g.movimientos) : []), [reparto]);

  if (!reparto) return null;

  const decisionDe = (id: string): Decision => decisiones.get(id) || 'dejar';

  const decidir = (id: string, d: Decision) =>
    setDecisiones(prev => new Map(prev).set(id, d));

  const decidirTodos = (d: Decision) =>
    setDecisiones(new Map(fuera.map(m => [m.id, d])));

  const nMover = fuera.filter(m => decisionDe(m.id) === 'mover').length;
  const nExcluir = fuera.filter(m => decisionDe(m.id) === 'excluir').length;
  const nImportados = reparto.principal.movimientos.length + fuera.length - nExcluir;

  return (
    <Sheet isOpen={isOpen} onClose={onCancel} title="Movimientos fuera del periodo">
      <div className="space-y-5 pb-6 mt-2">
        <p className="text-xs text-muted leading-relaxed">
          Tus periodos van de nómina a nómina, no del 1 al 31, así que{' '}
          <strong className="text-text">{reparto.nFuera}</strong> de estos movimientos caen fuera de{' '}
          <strong className="text-text">«{reparto.principal.nombre}»</strong>, que es donde va el resto
          ({reparto.principal.movimientos.length}). Decide qué hacer con ellos antes de importar.
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => decidirTodos('mover')} className="flex-1 text-xs">
            Mover todos
          </Button>
          <Button variant="secondary" size="sm" onClick={() => decidirTodos('dejar')} className="flex-1 text-xs">
            Dejar todos
          </Button>
          <Button variant="secondary" size="sm" onClick={() => decidirTodos('excluir')} className="flex-1 text-xs">
            Quitar todos
          </Button>
        </div>

        {reparto.fuera.map(grupo => (
          <div key={grupo.mesId || 'sin-periodo'} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider truncate">{grupo.nombre}</span>
              {grupo.inicio && (
                <span className="text-[11px] text-dim flex-shrink-0">
                  {grupo.inicio.slice(8, 10)}/{grupo.inicio.slice(5, 7)} — {grupo.fin.slice(8, 10)}/{grupo.fin.slice(5, 7)}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {grupo.movimientos.map(mov => (
                <div
                  key={mov.id}
                  className={cn(
                    'flex items-center gap-2 bg-surface-elevated border border-border rounded-xl px-3 py-2 transition-opacity',
                    decisionDe(mov.id) === 'excluir' && 'opacity-50'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text truncate">{mov.concepto}</p>
                    <p className="text-[11px] text-dim">
                      {mov.fecha.slice(8, 10)}/{mov.fecha.slice(5, 7)} · {formatCurrency(mov.importe)}
                    </p>
                  </div>
                  <Selector valor={decisionDe(mov.id)} onChange={d => decidir(mov.id, d)} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-[11px] text-dim leading-relaxed">
          «Mover» los pasa a «{reparto.principal.nombre}» sin cambiarles la fecha. «Dejar» los deja en su
          periodo. «Quitar» no los importa.
        </p>

        <div className="flex flex-col gap-3 pt-1">
          <Button onClick={() => onConfirm(decisiones, reparto.principal.mesId)} disabled={nImportados === 0} className="w-full h-14 text-lg font-bold">
            Importar {nImportados}
          </Button>
          <p className="text-[11px] text-dim text-center -mt-1">
            {nMover > 0 && `${nMover} a «${reparto.principal.nombre}». `}
            {nExcluir > 0 && `${nExcluir} sin importar.`}
            {nMover === 0 && nExcluir === 0 && 'Cada uno en su periodo.'}
          </p>
          <Button variant="ghost" onClick={onCancel} className="w-full h-12 text-base">
            Cancelar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
