import React, { useState } from 'react';
import { useStore, PlanAmbito } from '../lib/storage/store';
import { formatCurrency } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { PLAN_COLUMNAS, realDelAnio } from '../lib/plan/plan';
import { PlanFila } from '../lib/storage/types';
import { ChevronLeft, ChevronRight, Percent, Euro, Copy, ClipboardList, FlaskConical, Activity, Tag } from 'lucide-react';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const SUELDO_COLOR = '#3b82f6';
const REMANENTE_COLOR = '#8b5cf6';

type Vista = PlanAmbito | 'real';

interface CellInputProps {
  value: number;
  onCommit: (n: number) => void;
  accent?: string;
}

function CellInput({ value, onCommit, accent }: CellInputProps) {
  const [raw, setRaw] = useState(value ? String(value) : '');
  return (
    <input
      type="number"
      inputMode="decimal"
      value={raw}
      placeholder="0"
      onChange={(e) => {
        setRaw(e.target.value);
        const n = parseFloat(e.target.value.replace(',', '.'));
        onCommit(isNaN(n) ? 0 : n);
      }}
      onFocus={(e) => e.target.select()}
      className="w-[68px] bg-transparent text-right font-mono text-sm text-text px-1.5 py-2 rounded-lg border border-transparent focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
      style={accent ? { caretColor: accent } : undefined}
    />
  );
}

/** Diferencia del real/escenario respecto al plan, con color según sea buena o mala. */
function Delta({ valor, plan, invertir }: { valor: number; plan: number; invertir?: boolean }) {
  const delta = valor - plan;
  if (plan === 0 && valor === 0) return null;
  if (Math.abs(delta) < 0.005) return <span className="block text-[9px] font-mono text-muted">= plan</span>;
  // Para gastos (invertir=true), gastar MENOS que el plan es bueno.
  const bueno = invertir ? delta < 0 : delta > 0;
  return (
    <span className={`block text-[9px] font-mono ${bueno ? 'text-success' : 'text-danger'}`}>
      {delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(delta)).replace(/\s/g, '')}
    </span>
  );
}

interface PlanAnualProps {
  onNavigate?: (tab: string) => void;
}

export function PlanAnual({ onNavigate }: PlanAnualProps) {
  const { state, getPlanFilas, setPlanCell, copiarFilaPlan, copiarPlanAEscenario } = useStore();
  const { toast } = useToast();

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [vista, setVista] = useState<Vista>('plan');
  const [showPercent, setShowPercent] = useState(false);
  // Se incrementa para forzar el remonte de los inputs cuando cambian sus valores
  // por una acción externa (p. ej. "Copiar enero"), no por tecleo del usuario.
  const [refreshKey, setRefreshKey] = useState(0);

  const filasPlan = getPlanFilas(year, 'plan');
  const filasEscenario = getPlanFilas(year, 'escenario');
  const filasReal = realDelAnio(state.movimientos, state.categorias, year);

  const filas: PlanFila[] = vista === 'plan' ? filasPlan : vista === 'escenario' ? filasEscenario : filasReal;
  const esEditable = vista !== 'real';
  // En Real y Escenario, las diferencias se comparan contra el plan base.
  const comparaConPlan = vista !== 'plan' && filasPlan.some(f => f.sueldo > 0 || Object.values(f.grupos).some((v: number) => v > 0));

  const totales = (fs: PlanFila[]) => {
    const sueldo = fs.reduce((a, f) => a + (f.sueldo || 0), 0);
    const porCol: Record<string, number> = {};
    PLAN_COLUMNAS.forEach(c => { porCol[c.id] = fs.reduce((a, f) => a + (f.grupos?.[c.id] || 0), 0); });
    const gastos = Object.values(porCol).reduce((a, v) => a + v, 0);
    return { sueldo, porCol, gastos, remanente: sueldo - gastos };
  };

  const tot = totales(filas);
  const totPlan = totales(filasPlan);
  const tasaAhorro = tot.sueldo > 0 ? (tot.remanente / tot.sueldo) * 100 : 0;

  const remanenteFila = (f: PlanFila) =>
    (f.sueldo || 0) - PLAN_COLUMNAS.reduce((a, c) => a + (f.grupos?.[c.id] || 0), 0);

  const pct = (val: number, base: number) => (base > 0 ? `${Math.round((val / base) * 100)}%` : '—');

  const handleCopiar = () => {
    if (window.confirm('¿Copiar las cifras de enero a todos los meses del año? Sobrescribe el resto de meses.')) {
      copiarFilaPlan(year, 0, vista as PlanAmbito);
      setRefreshKey((k) => k + 1);
      toast('Enero copiado a todos los meses del año.', 'ok');
    }
  };

  const handleEmpezarEscenarioDesdePlan = () => {
    copiarPlanAEscenario(year);
    setRefreshKey((k) => k + 1);
    toast('Escenario creado a partir de tu plan. Cambia lo que quieras probar.', 'ok');
  };

  const escenarioVacio = !filasEscenario.some(f => f.sueldo > 0 || Object.values(f.grupos).some((v: number) => v > 0));

  const thBase = 'px-2 py-2 text-[10px] uppercase font-bold tracking-wider whitespace-nowrap';
  const cellBase = 'px-2 py-1.5 text-right font-mono text-sm whitespace-nowrap';
  const stickyCol = 'sticky left-0 z-10 bg-surface';

  const VISTAS: { id: Vista; nombre: string; icono: typeof ClipboardList }[] = [
    { id: 'plan', nombre: 'Plan', icono: ClipboardList },
    { id: 'escenario', nombre: '¿Y si…?', icono: FlaskConical },
    { id: 'real', nombre: 'Real', icono: Activity },
  ];

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      {/* Cabecera: selector de año + toggle € / % */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-20 px-4 py-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 bg-surface px-3 py-1.5 rounded-full border border-border">
            <button onClick={() => setYear(String(Number(year) - 1))} className="text-muted hover:text-text p-1" aria-label="Año anterior">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold tracking-widest text-text tabular-nums">{year}</span>
            <button onClick={() => setYear(String(Number(year) + 1))} className="text-muted hover:text-text p-1" aria-label="Año siguiente">
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            onClick={() => setShowPercent((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border transition-colors ${showPercent ? 'bg-accent/15 text-accent border-accent/40' : 'bg-surface text-muted border-border'}`}
          >
            {showPercent ? <Percent size={14} /> : <Euro size={14} />}
            {showPercent ? '% sueldo' : 'Importes'}
          </button>
        </div>

        {/* Selector de vista */}
        <div className="grid grid-cols-3 gap-2">
          {VISTAS.map(v => {
            const Icon = v.icono;
            const activa = vista === v.id;
            return (
              <button
                key={v.id}
                onClick={() => { setVista(v.id); setRefreshKey(k => k + 1); }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${activa ? 'bg-accent text-white ring-2 ring-accent' : 'bg-surface text-muted border border-border'}`}
              >
                <Icon size={14} /> {v.nombre}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-5 mt-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-xl font-bold font-display tracking-tight text-text">
            {vista === 'plan' ? 'Plan anual' : vista === 'escenario' ? 'Escenario: ¿y si…?' : 'Así va de verdad'}
          </h2>
          <span className="text-xs text-muted">
            {vista === 'plan' ? 'Lo que planeas' : vista === 'escenario' ? 'Prueba sin miedo' : 'Tus movimientos'}
          </span>
        </div>

        {/* Resumen del año */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted tracking-wide mb-1">Ingresos</p>
            <p className="text-sm font-mono font-bold text-success truncate">{formatCurrency(tot.sueldo)}</p>
            {comparaConPlan && <Delta valor={tot.sueldo} plan={totPlan.sueldo} />}
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted tracking-wide mb-1">Remanente</p>
            <p className={`text-sm font-mono font-bold truncate ${tot.remanente >= 0 ? 'text-text' : 'text-danger'}`}>{formatCurrency(tot.remanente)}</p>
            {comparaConPlan && <Delta valor={tot.remanente} plan={totPlan.remanente} />}
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted tracking-wide mb-1">Tasa ahorro</p>
            <p className={`text-sm font-mono font-bold truncate ${tasaAhorro >= 0 ? 'text-accent' : 'text-danger'}`}>{Math.round(tasaAhorro)}%</p>
          </div>
        </div>

        {/* Escenario vacío: arrancar desde el plan */}
        {vista === 'escenario' && escenarioVacio && (
          <div className="bg-surface border border-accent/30 rounded-2xl p-4 space-y-3">
            <p className="text-sm text-text font-bold">Tu escenario está vacío.</p>
            <p className="text-xs text-muted">
              Un escenario es una copia de tu plan para probar cambios ("¿y si pago menos alquiler?", "¿y si invierto 100 € más?") sin tocar el plan de verdad.
            </p>
            <Button onClick={handleEmpezarEscenarioDesdePlan} className="w-full h-11 text-sm font-bold">
              <Copy size={15} className="mr-1.5" /> Empezar desde mi plan
            </Button>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thBase} ${stickyCol} text-left text-muted`}>Mes</th>
                  <th className={`${thBase} text-right`} style={{ color: SUELDO_COLOR }}>{vista === 'real' ? 'Ingresos' : 'Sueldo'}</th>
                  {PLAN_COLUMNAS.map((c) => (
                    <th key={c.id} className={`${thBase} text-right`} style={{ color: c.color }}>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.nombre}
                      </span>
                    </th>
                  ))}
                  <th className={`${thBase} text-right`} style={{ color: REMANENTE_COLOR }}>Remanente</th>
                </tr>
              </thead>
              <tbody>
                {MESES.map((mes, i) => {
                  const f = filas[i];
                  const fPlan = filasPlan[i];
                  const rem = remanenteFila(f);
                  return (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface-elevated/40">
                      <td className={`${stickyCol} px-2 py-1.5 text-xs font-bold text-text whitespace-nowrap`}>
                        <span className="hidden sm:inline">{mes}</span>
                        <span className="sm:hidden">{MES_CORTO[i]}</span>
                      </td>
                      <td key={`sueldo-${year}-${vista}-${refreshKey}`} className={cellBase}>
                        {showPercent ? (
                          <span className="text-muted pr-1.5">100%</span>
                        ) : esEditable ? (
                          <CellInput value={f.sueldo} accent={SUELDO_COLOR} onCommit={(n) => setPlanCell(year, i, 'sueldo', n, vista as PlanAmbito)} />
                        ) : (
                          <span className="pr-1.5">
                            {formatCurrency(f.sueldo)}
                            {comparaConPlan && <Delta valor={f.sueldo} plan={fPlan.sueldo} />}
                          </span>
                        )}
                      </td>
                      {PLAN_COLUMNAS.map((c) => (
                        <td key={`${c.id}-${year}-${vista}-${refreshKey}`} className={cellBase}>
                          {showPercent ? (
                            <span className="text-muted pr-1.5">{pct(f.grupos?.[c.id] || 0, f.sueldo || 0)}</span>
                          ) : esEditable ? (
                            <CellInput value={f.grupos?.[c.id] || 0} accent={c.color} onCommit={(n) => setPlanCell(year, i, c.id, n, vista as PlanAmbito)} />
                          ) : (
                            <span className="pr-1.5">
                              {formatCurrency(f.grupos?.[c.id] || 0)}
                              {comparaConPlan && <Delta valor={f.grupos?.[c.id] || 0} plan={fPlan.grupos?.[c.id] || 0} invertir />}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className={`${cellBase} font-bold ${rem >= 0 ? 'text-text' : 'text-danger'}`}>
                        <span className="pr-1.5">
                          {showPercent ? pct(rem, f.sueldo || 0) : formatCurrency(rem)}
                          {!showPercent && comparaConPlan && <Delta valor={rem} plan={remanenteFila(fPlan)} />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-elevated/60">
                  <td className={`${stickyCol} bg-surface-elevated px-2 py-2 text-[11px] font-black uppercase tracking-wider text-text`}>Total</td>
                  <td className={`${cellBase} font-black`} style={{ color: SUELDO_COLOR }}>
                    <span className="pr-1.5">{showPercent ? '100%' : formatCurrency(tot.sueldo)}</span>
                  </td>
                  {PLAN_COLUMNAS.map((c) => (
                    <td key={c.id} className={`${cellBase} font-black`} style={{ color: c.color }}>
                      <span className="pr-1.5">{showPercent ? pct(tot.porCol[c.id], tot.sueldo) : formatCurrency(tot.porCol[c.id])}</span>
                    </td>
                  ))}
                  <td className={`${cellBase} font-black`} style={{ color: REMANENTE_COLOR }}>
                    <span className="pr-1.5">{showPercent ? pct(tot.remanente, tot.sueldo) : formatCurrency(tot.remanente)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Acciones y ayuda */}
        {esEditable ? (
          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="w-full" onClick={handleCopiar}>
              <Copy size={16} className="mr-1" /> Copiar enero a todo el año
            </Button>
            <p className="text-[11px] text-muted text-center px-2">
              Fijos, Variables e Inversión se rellenan con lo que planeas gastar. El remanente se calcula solo (sueldo − gastos).
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-muted text-center px-2">
              Estos números salen de tus movimientos: los ingresos van a "Ingresos" y cada gasto a la columna de su categoría (fijo, variable o inversión).
              {comparaConPlan && ' En verde, mejor que el plan; en rojo, peor.'}
            </p>
            <button onClick={() => onNavigate?.('categorias')} className="w-full flex items-center justify-center gap-2 text-sm text-muted hover:text-text transition-colors py-1.5">
              <Tag size={15} /> Asignar macro-grupo a mis categorías
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
