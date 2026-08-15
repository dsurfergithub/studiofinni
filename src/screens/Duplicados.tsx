import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/storage/store';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { ChevronLeft, Check, CopyCheck, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { buscarDuplicados, idsSobrantes, ETIQUETA_MOTIVO, GrupoDuplicado } from '../lib/duplicados/duplicados';
import { Movimiento } from '../lib/storage/types';
import { playSuccess } from '../lib/audio/sounds';

const ORIGEN: Record<Movimiento['fuente'], string> = {
  'manual': 'a mano',
  'import:plantilla': 'plantilla',
  'import:caixabank': 'extracto',
  'suscripcion': 'suscripción',
};

export function Duplicados({ onBack }: { onBack?: () => void }) {
  const { state, deleteMovimientos } = useStore();
  const { toast } = useToast();
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const grupos = useMemo(() => buscarDuplicados(state.movimientos), [state.movimientos]);
  const totalSobrante = grupos.reduce((s, g) => s + g.importeSobrante, 0);

  const toggle = (id: string) => {
    setMarcados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const marcarSobrantes = (g: GrupoDuplicado) => {
    setMarcados(prev => new Set([...prev, ...idsSobrantes(g)]));
  };

  const importeMarcado = useMemo(() => {
    const ids = marcados;
    return state.movimientos
      .filter(m => ids.has(m.id))
      .reduce((s, m) => s + Math.abs(m.importe), 0);
  }, [marcados, state.movimientos]);

  const borrar = () => {
    const n = marcados.size;
    if (n === 0) return;
    if (!window.confirm(`Se borrarán ${n} movimiento${n === 1 ? '' : 's'} (${formatCurrency(importeMarcado)}). No se puede deshacer. ¿Seguir?`)) return;
    deleteMovimientos([...marcados]);
    setMarcados(new Set());
    playSuccess();
    toast(`${n} movimiento${n === 1 ? '' : 's'} borrado${n === 1 ? '' : 's'}.`, 'ok');
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border flex items-center gap-1">
        {onBack && (
          <button onClick={onBack} className="text-muted hover:text-text p-1 -ml-1 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
        )}
        <h2 className="text-xl font-bold font-display tracking-tight text-text">Duplicados</h2>
      </div>

      {grupos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <ShieldCheck size={40} className="text-success" />
          <p className="font-bold text-text">Ningún repetido a la vista</p>
          <p className="text-sm text-muted">
            No hay dos apuntes del mismo importe con pocos días de diferencia que vengan de sitios distintos.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
            <p className="text-sm font-bold text-text">
              {grupos.length} posible{grupos.length === 1 ? '' : 's'} repetido{grupos.length === 1 ? '' : 's'} · sobran{' '}
              <span className="font-mono text-warning">{formatCurrency(totalSobrante)}</span>
            </p>
            <p className="text-xs text-muted leading-relaxed">
              Mismo importe y pocos días de diferencia, pero apuntados por dos vías: a mano y luego importados.
              El anti-duplicados de los imports no los ve porque el banco no llama al gasto como tú.
              Marca los que sobren y bórralos.
            </p>
            {state.cuenta.fechaSaldo && (
              <p className="text-[11px] text-dim leading-relaxed">
                Borrar apuntes anteriores al último cuadre ({new Date(`${state.cuenta.fechaSaldo}T12:00:00`).toLocaleDateString('es-ES')}) no
                mueve el saldo —ya está cuadrado con el banco—, pero sí corrige los gastos del mes.
              </p>
            )}
          </div>

          {grupos.map(g => {
            const sobrantes = new Set(idsSobrantes(g));
            return (
              <div key={g.id} className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-border">
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-text">
                      {g.importe > 0 ? '+' : ''}{formatCurrency(g.importe)} <span className="text-muted font-sans text-xs">×{g.movimientos.length}</span>
                    </p>
                    <p className="text-[11px] text-muted truncate">{ETIQUETA_MOTIVO[g.motivo]}</p>
                  </div>
                  <button
                    onClick={() => marcarSobrantes(g)}
                    className="text-[11px] font-bold text-accent hover:underline flex-shrink-0 py-1"
                  >
                    Dejar solo uno
                  </button>
                </div>

                <div className="divide-y divide-border">
                  {g.movimientos.map(m => {
                    const activo = marcados.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggle(m.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activo ? 'bg-danger/10' : 'hover:bg-surface-elevated'}`}
                      >
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${activo ? 'bg-danger border-danger text-white' : 'border-border'}`}>
                          {activo && <Check size={14} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm truncate ${activo ? 'text-danger line-through' : 'text-text'}`}>{m.concepto}</span>
                          <span className="block text-[11px] font-mono text-muted">
                            {m.fecha} · {ORIGEN[m.fuente] || m.fuente}
                            {sobrantes.has(m.id) ? '' : ' · manda'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {marcados.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-20 max-w-md mx-auto">
          <Button variant="danger" className="w-full py-6 rounded-2xl shadow-card border border-danger/30" onClick={borrar}>
            <CopyCheck className="mr-2" size={18} />
            Borrar {marcados.size} · {formatCurrency(importeMarcado)}
          </Button>
        </div>
      )}
    </div>
  );
}
