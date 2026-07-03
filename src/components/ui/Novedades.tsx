import React from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { CHANGELOG, TipoCambio } from '../../lib/changelog';
import { Sparkles, Wrench, Bug } from 'lucide-react';

interface NovedadesProps {
  isOpen: boolean;
  onClose: () => void;
  // true = solo la última versión (aviso tras actualizar); false = historial completo.
  soloUltima?: boolean;
}

const TIPO_META: Record<TipoCambio, { icono: typeof Sparkles; clase: string; label: string }> = {
  nuevo: { icono: Sparkles, clase: 'text-accent', label: 'Nuevo' },
  mejora: { icono: Wrench, clase: 'text-success', label: 'Mejora' },
  arreglo: { icono: Bug, clase: 'text-warning', label: 'Arreglo' },
};

export function Novedades({ isOpen, onClose, soloUltima = false }: NovedadesProps) {
  const entradas = soloUltima ? CHANGELOG.slice(0, 1) : CHANGELOG;

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={soloUltima ? '✨ La app se ha actualizado' : 'Historial de novedades'}>
      <div className="space-y-6 pb-6 mt-2">
        {entradas.map(entry => (
          <div key={entry.version} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold text-text">{entry.titulo}</h3>
            </div>
            <p className="text-xs text-muted font-mono -mt-2">
              Versión {entry.version} · {new Date(entry.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <ul className="space-y-2.5">
              {entry.cambios.map((c, i) => {
                const meta = TIPO_META[c.tipo];
                const Icon = meta.icono;
                return (
                  <li key={i} className="flex items-start gap-3 bg-surface border border-border rounded-xl p-3">
                    <Icon size={16} className={`${meta.clase} flex-shrink-0 mt-0.5`} />
                    <span className="text-sm text-text leading-snug">{c.texto}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {soloUltima && (
          <Button onClick={onClose} className="w-full h-12 font-bold">¡Entendido!</Button>
        )}
      </div>
    </Sheet>
  );
}
