import React, { useState } from 'react';
import { useStore } from '../../lib/storage/store';
import { useToast } from './Toast';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Lock, LockOpen, CalendarCheck } from 'lucide-react';
import { formatCurrency, getLocalFechaIso } from '../../lib/utils';
import { mesesPendientesDeCierre, saldoAFecha, saldoInicialDeMes } from '../../lib/cierre/cierre';
import { MesFinanciero } from '../../lib/storage/types';
import { playError, playSuccess } from '../../lib/audio/sounds';

/** Acepta lo que teclee el usuario: «614», «614,30», «1.234,56», «-382.45». */
function parseImporte(texto: string): number | null {
  const limpio = texto.trim().replace(/[€\s]/g, '');
  if (!limpio) return null;
  const normalizado = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Avisa de que hay periodos terminados sin cerrar y deja cerrarlos. También muestra el
 * saldo con el que arrancó el periodo que se está viendo, si el anterior está cerrado.
 */
export function CierreMesCard({ mesActual }: { mesActual?: MesFinanciero }) {
  const { state, getMesesActivos, cerrarMes, reabrirMes } = useStore();
  const { toast } = useToast();
  const meses = getMesesActivos();
  const hoy = getLocalFechaIso();

  const [abierto, setAbierto] = useState(false);
  const [saldo, setSaldo] = useState('');

  const pendientes = mesesPendientesDeCierre(meses, hoy, state.cierres);
  // Se cierran en orden: el saldo final de uno es el inicial del siguiente.
  const aCerrar = pendientes[0];

  const cierreActual = mesActual ? state.cierres[mesActual.id] : undefined;
  const saldoInicial = mesActual ? saldoInicialDeMes(mesActual, meses, state.cierres) : null;

  const saldoTecleado = parseImporte(saldo);
  const calculado = aCerrar ? saldoAFecha(state.cuenta, state.movimientos, aCerrar.fin) : 0;
  const diferencia = saldoTecleado === null ? null : Number((saldoTecleado - calculado).toFixed(2)) + 0;

  const confirmar = () => {
    if (!aCerrar || saldoTecleado === null) {
      playError();
      toast('Escribe el saldo que tenías el último día del periodo.', 'error');
      return;
    }
    const r = cerrarMes(aCerrar, saldoTecleado);
    setAbierto(false);
    setSaldo('');
    playSuccess();
    toast(
      r.diferencia === 0
        ? `${aCerrar.nombre} cerrado en ${formatCurrency(r.saldoFinal)}. Cuadraba.`
        : `${aCerrar.nombre} cerrado en ${formatCurrency(r.saldoFinal)} con un ajuste de ${r.diferencia > 0 ? '+' : ''}${formatCurrency(r.diferencia)}.`,
      'ok'
    );
  };

  const reabrir = () => {
    if (!mesActual || !cierreActual) return;
    if (!window.confirm(`¿Reabrir ${mesActual.nombre}? El saldo confirmado con el banco no se toca; solo deja de estar cerrado.`)) return;
    reabrirMes(mesActual.id);
    toast(`${mesActual.nombre} reabierto.`, 'ok');
  };

  if (!aCerrar && !cierreActual && saldoInicial === null) return null;

  return (
    <>
      {saldoInicial !== null && !aCerrar && (
        <div className="flex justify-between items-baseline text-xs px-1 -mt-3">
          <span className="text-muted">Empezaste el periodo con</span>
          <span className="font-mono text-muted">{formatCurrency(saldoInicial)}</span>
        </div>
      )}

      {aCerrar && (
        <button
          onClick={() => setAbierto(true)}
          className="w-full bg-surface border border-accent/30 rounded-3xl p-5 flex items-center gap-4 shadow-card active:scale-[0.98] transition-all text-left"
        >
          <div className="w-11 h-11 rounded-2xl bg-accent/15 flex items-center justify-center flex-shrink-0">
            <CalendarCheck size={20} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text">Cierra {aCerrar.nombre}</p>
            <p className="text-xs text-muted">
              Terminó el {fechaLarga(aCerrar.fin)}
              {pendientes.length > 1 ? ` · ${pendientes.length} periodos sin cerrar` : ''}
            </p>
          </div>
          <Lock size={18} className="text-muted flex-shrink-0" />
        </button>
      )}

      {cierreActual && (
        <div className="w-full bg-surface border border-border rounded-3xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-success/15 flex items-center justify-center flex-shrink-0">
            <Lock size={18} className="text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text">Periodo cerrado</p>
            <p className="text-xs text-muted">
              Acabó con <span className="font-mono">{formatCurrency(cierreActual.saldoFinal)}</span> el {fechaLarga(cierreActual.fecha)}
            </p>
          </div>
          <button onClick={reabrir} className="text-muted hover:text-accent p-2 flex-shrink-0" aria-label="Reabrir mes">
            <LockOpen size={18} />
          </button>
        </div>
      )}

      <Sheet isOpen={abierto} onClose={() => setAbierto(false)} title={aCerrar ? `Cerrar ${aCerrar.nombre}` : 'Cerrar mes'}>
        {aCerrar && (
          <div className="space-y-5 pb-6 mt-2">
            <p className="text-xs text-muted leading-relaxed">
              Cerrar un periodo fija su saldo final de verdad, para que el siguiente arranque desde ahí
              y los errores dejen de arrastrarse de mes en mes.
            </p>
            <p className="text-xs text-muted leading-relaxed">
              Necesito el saldo que tenías el <span className="text-text font-bold">{fechaLarga(aCerrar.fin)}</span>,
              no el de hoy. Búscalo en el histórico de tu banco.
            </p>

            <div className="flex justify-between items-baseline text-xs px-1">
              <span className="text-muted">Lo que calcula la app a esa fecha</span>
              <span className="font-mono font-bold text-text">{formatCurrency(calculado)}</span>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Saldo al acabar el periodo</span>
              {/* text-base = 16px: por debajo, iOS Safari hace zoom al enfocar. */}
              <input
                type="text"
                inputMode="decimal"
                value={saldo}
                onChange={e => setSaldo(e.target.value)}
                placeholder="1.234,56"
                className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-base font-mono text-text placeholder:text-dim focus:outline-none focus:border-accent"
              />
            </label>

            {diferencia !== null && (
              <div className={`rounded-xl px-4 py-3 text-xs ${diferencia === 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {diferencia === 0
                  ? <span className="font-bold">Cuadra. Se cierra sin ajuste.</span>
                  : <span className="font-bold">Se apuntará un ajuste de {diferencia > 0 ? '+' : '−'}{formatCurrency(Math.abs(diferencia))} en {aCerrar.nombre}</span>}
              </div>
            )}

            <Button onClick={confirmar} disabled={saldoTecleado === null} className="w-full h-14 text-lg font-bold">
              <Lock className="mr-2" size={18} /> Cerrar {aCerrar.nombre}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
