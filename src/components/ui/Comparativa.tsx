import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowDown, ArrowUp, ArrowLeftRight, Minus } from 'lucide-react';
import { Categoria, Movimiento } from '../../lib/storage/types';
import { cn, formatCurrency } from '../../lib/utils';
import {
  mesesConDatos, mismoMesAnioAnterior, totalesDe, compararCategorias, variacion, serieAnual, acumuladoHasta,
  aniosConDatos, nombreMes, Metrica, MES_CORTO, Totales,
} from '../../lib/insights/comparar';

type Modo = 'meses' | 'anios';

/** Color fijo por posición: A / año actual, B / año anterior, el de antes. */
const SERIE = ['var(--color-serie-1)', 'var(--color-serie-2)', 'var(--color-serie-3)'];
const TOP_CATEGORIAS = 6;

const compacto = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k` : `${Math.round(v)}`;

/**
 * Cambio de B a A, con flecha y signo: nunca solo el color. `subirEsBueno` decide el
 * color (gastar más es malo; ingresar o ahorrar más, bueno).
 */
function Variacion({ a, b, subirEsBueno, enEuros }: { a: number; b: number; subirEsBueno: boolean; enEuros?: boolean }) {
  if (enEuros && Math.abs(a - b) >= 0.005) {
    // Un % sobre un ahorro negativo o cercano a cero no dice nada: mejor la diferencia.
    const sube = a > b;
    return (
      <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-bold font-mono', sube === subirEsBueno ? 'text-success' : 'text-danger')}>
        {sube ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        {sube ? '+' : '−'}{compacto(Math.abs(a - b))}€
      </span>
    );
  }
  const v = variacion(a, b);
  if (v === null || Math.abs(a - b) < 0.005) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-muted">
        <Minus size={12} /> {v === null && a !== 0 ? 'nuevo' : 'igual'}
      </span>
    );
  }
  const sube = a > b;
  const bueno = sube === subirEsBueno;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-bold font-mono', bueno ? 'text-success' : 'text-danger')}>
      {sube ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {sube ? '+' : '−'}{Math.abs(v * 100).toLocaleString('es-ES', { maximumFractionDigits: Math.abs(v) < 0.1 ? 1 : 0 })}%
    </span>
  );
}

function Leyenda({ items }: { items: { color: string; texto: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map(i => (
        <span key={i.texto} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: i.color }} />
          {i.texto}
        </span>
      ))}
    </div>
  );
}

/** Selector de mes con el punto de color de su serie delante. */
function SelectorMes({ valor, meses, color, onChange }: { valor: string; meses: string[]; color: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex-1 min-w-0">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none" style={{ backgroundColor: color }} />
      <select
        value={valor}
        onChange={e => onChange(e.target.value)}
        className="w-full h-11 appearance-none bg-surface-elevated border border-border rounded-xl pl-8 pr-2 text-base text-text focus:outline-none focus:border-accent"
      >
        {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
      </select>
    </div>
  );
}

function FilaTotal({ etiqueta, a, b, subirEsBueno, enEuros }: { etiqueta: string; a: number; b: number; subirEsBueno: boolean; enEuros?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_3.5rem] items-baseline gap-x-3 py-2 border-b border-border/60 last:border-0">
      <span className="text-xs font-bold text-muted uppercase tracking-wider">{etiqueta}</span>
      <span className="text-sm font-mono font-bold text-text text-right">{formatCurrency(a)}</span>
      <span className="text-xs font-mono text-muted text-right">{formatCurrency(b)}</span>
      <span className="text-right"><Variacion a={a} b={b} subirEsBueno={subirEsBueno} enEuros={enEuros} /></span>
    </div>
  );
}

/**
 * Comparativa de Insights: un mes contra otro (enero 2026 contra enero 2025) o los años
 * enteros mes a mes. Siempre por mes natural, para que el mismo mes signifique lo mismo
 * todos los años.
 */
export function Comparativa({ movimientos, categorias, mesInicial }: {
  movimientos: Movimiento[];
  categorias: Categoria[];
  /** Mes natural (YYYY-MM) del periodo que se está mirando, para proponerlo como A. */
  mesInicial?: string;
}) {
  const meses = useMemo(() => mesesConDatos(movimientos), [movimientos]);
  const anios = useMemo(() => aniosConDatos(movimientos).slice(0, 3), [movimientos]);

  const propuestaA = mesInicial && meses.includes(mesInicial) ? mesInicial : meses[0];
  /** Con quién se compara un mes si no se elige: el mismo mes del año anterior, o el previo. */
  const pareja = (mes?: string) => {
    if (!mes) return undefined;
    const anterior = mismoMesAnioAnterior(mes);
    if (meses.includes(anterior)) return anterior;
    return meses[meses.indexOf(mes) + 1] || mes;
  };
  const propuestaB = pareja(propuestaA);

  const [modo, setModo] = useState<Modo>(() => (propuestaB && propuestaB === mismoMesAnioAnterior(propuestaA || '') ? 'meses' : anios.length > 1 ? 'anios' : 'meses'));
  const [elegidoA, setA] = useState<string | undefined>();
  const [elegidoB, setB] = useState<string | undefined>();
  const [metrica, setMetrica] = useState<Metrica>('gastos');
  const [todas, setTodas] = useState(false);

  // Mientras el usuario no elija, A y B siguen al periodo que está mirando.
  const a = elegidoA && meses.includes(elegidoA) ? elegidoA : propuestaA;
  // B sigue a A (mismo mes del año anterior) hasta que se elige a mano.
  const b = elegidoB && meses.includes(elegidoB) ? elegidoB : pareja(a);

  const totA = useMemo(() => (a ? totalesDe(movimientos, a) : null), [movimientos, a]);
  const totB = useMemo(() => (b ? totalesDe(movimientos, b) : null), [movimientos, b]);
  const filas = useMemo(() => (a && b ? compararCategorias(movimientos, a, b) : []), [movimientos, a, b]);
  const serie = useMemo(() => serieAnual(movimientos, anios, metrica), [movimientos, anios, metrica]);

  if (meses.length < 2) {
    return (
      <section className="bg-surface border border-border rounded-3xl p-5 shadow-card">
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Comparar</p>
        <p className="text-sm text-muted">Cuando tengas movimientos de al menos dos meses podrás compararlos aquí, por ejemplo enero de este año contra enero del anterior.</p>
      </section>
    );
  }

  const hoy = new Date();
  const mesEnCurso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const nombreCat = (id: string) => categorias.find(c => c.id === id);
  const visibles = todas ? filas : filas.slice(0, TOP_CATEGORIAS);
  const maxCat = Math.max(1, ...visibles.flatMap(f => [f.a, f.b]));

  // Año contra año "en igualdad": hasta el último mes con datos del año más reciente.
  const anioActual = anios[0];
  const hastaMes = Math.max(0, ...meses.filter(m => m.startsWith(String(anioActual))).map(m => Number(m.slice(5, 7))));
  // Solo los años con datos en ese tramo: un año que empieza en noviembre no tiene
  // enero-septiembre con el que comparar, y saldría como 0 €.
  const acumulados: { anio: number; t: Totales; i: number }[] = anios
    .map((an, i) => ({ anio: an, t: acumuladoHasta(movimientos, an, hastaMes), i }))
    .filter(x => x.t.movimientos > 0);
  const tramo = hastaMes === 12 ? 'el año entero' : hastaMes === 1 ? 'enero' : `${MES_CORTO[0]}–${MES_CORTO[hastaMes - 1]}`;

  const TooltipAnual = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-surface-elevated border border-border p-3 rounded-xl shadow-xl">
        <p className="text-xs uppercase font-bold text-muted mb-1">{label}</p>
        {payload.filter((p: any) => p.value !== null && p.value !== undefined).map((p: any) => (
          <p key={p.dataKey} className="text-sm font-mono font-bold text-text flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.dataKey}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <section className="bg-surface border border-border rounded-3xl p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-muted uppercase tracking-wider">Comparar</p>
        <div className="flex gap-1 bg-surface-elevated rounded-xl p-1">
          {([['meses', 'Mes a mes'], ['anios', 'Año a año']] as [Modo, string][]).map(([m, t]) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={cn('px-3 h-7 rounded-lg text-[11px] font-bold transition-colors', modo === m ? 'bg-surface text-text shadow-card' : 'text-muted hover:text-text')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {modo === 'meses' && a && b && totA && totB && (
        <>
          <div className="flex items-center gap-2">
            <SelectorMes valor={a} meses={meses} color={SERIE[0]} onChange={setA} />
            <button
              type="button"
              aria-label="Intercambiar meses"
              onClick={() => { setA(b); setB(a); }}
              className="w-9 h-9 flex-shrink-0 rounded-xl border border-border text-muted hover:text-text flex items-center justify-center"
            >
              <ArrowLeftRight size={16} />
            </button>
            <SelectorMes valor={b} meses={meses} color={SERIE[1]} onChange={setB} />
          </div>
          {(a === mesEnCurso || b === mesEnCurso) && (
            <p className="text-[11px] text-warning -mt-2">
              {nombreMes(mesEnCurso)} aún no ha terminado: compara con cuidado.
            </p>
          )}
          {b !== mismoMesAnioAnterior(a) && meses.includes(mismoMesAnioAnterior(a)) && (
            <button type="button" onClick={() => setB(mismoMesAnioAnterior(a))} className="text-[11px] font-bold text-accent -mt-2">
              Comparar con {nombreMes(mismoMesAnioAnterior(a))}
            </button>
          )}

          <div>
            <div className="grid grid-cols-[1fr_auto_auto_3.5rem] gap-x-3 text-[10px] uppercase font-bold text-dim tracking-wider pb-1">
              <span />
              <span className="text-right">{MES_CORTO[Number(a.slice(5, 7)) - 1]} {a.slice(2, 4)}</span>
              <span className="text-right">{MES_CORTO[Number(b.slice(5, 7)) - 1]} {b.slice(2, 4)}</span>
              <span className="text-right">Cambio</span>
            </div>
            <FilaTotal etiqueta="Gastos" a={totA.gastos} b={totB.gastos} subirEsBueno={false} />
            <FilaTotal etiqueta="Ingresos" a={totA.ingresos} b={totB.ingresos} subirEsBueno />
            <FilaTotal etiqueta="Ahorro" a={totA.ahorro} b={totB.ahorro} subirEsBueno enEuros />
          </div>

          {filas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-muted uppercase tracking-wider">Gasto por categoría</p>
                <Leyenda items={[{ color: SERIE[0], texto: nombreMes(a) }, { color: SERIE[1], texto: nombreMes(b) }]} />
              </div>
              <p className="text-[11px] text-dim -mt-2">De la que más cambia a la que menos.</p>
              {visibles.map(f => {
                const cat = nombreCat(f.id);
                return (
                  <div key={f.id} className="space-y-1" title={`${cat?.nombre || 'Sin clasificar'}: ${formatCurrency(f.a)} contra ${formatCurrency(f.b)}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-text truncate">{cat?.nombre || 'Sin clasificar'}</span>
                      <span className="flex items-baseline gap-2 flex-shrink-0">
                        <span className="text-xs font-mono text-muted">
                          {f.diff > 0 ? '+' : f.diff < 0 ? '−' : ''}{formatCurrency(Math.abs(f.diff))}
                        </span>
                        <Variacion a={f.a} b={f.b} subirEsBueno={false} />
                      </span>
                    </div>
                    {[f.a, f.b].map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex-1 h-1.5">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(v / maxCat) * 100}%`, minWidth: v > 0 ? 4 : 0, backgroundColor: SERIE[i] }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-muted w-20 text-right flex-shrink-0">{formatCurrency(v)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {filas.length > TOP_CATEGORIAS && (
                <button type="button" onClick={() => setTodas(t => !t)} className="text-xs font-bold text-accent">
                  {todas ? 'Ver menos' : `Ver todas (${filas.length})`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {modo === 'anios' && (
        <>
          <div className="flex gap-2">
            {(['gastos', 'ingresos'] as Metrica[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMetrica(m)}
                className={cn(
                  'flex-1 h-9 rounded-xl text-xs font-bold border transition-colors',
                  metrica === m ? 'bg-accent-soft text-accent border-accent-soft' : 'text-muted border-border hover:text-text'
                )}
              >
                {m === 'gastos' ? 'Gastos' : 'Ingresos'}
              </button>
            ))}
          </div>

          <Leyenda items={anios.map((an, i) => ({ color: SERIE[i], texto: String(an) }))} />

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${compacto(v)}€`} width={44} />
                <Tooltip content={<TooltipAnual />} cursor={{ stroke: 'var(--color-dim)', strokeWidth: 1 }} />
                {/* Del más viejo al más nuevo: el año actual se pinta encima. */}
                {[...anios].reverse().map(an => {
                  const i = anios.indexOf(an);
                  return (
                    <Line
                      key={an}
                      type="monotone"
                      dataKey={String(an)}
                      stroke={SERIE[i]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {acumulados.length > 1 && hastaMes > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] text-dim">
                {metrica === 'gastos' ? 'Gasto' : 'Ingreso'} de {tramo}, cada año, para comparar en igualdad:
              </p>
              {acumulados.map(({ anio, t, i }, pos) => {
                const siguiente = acumulados[pos + 1];
                return (
                  <div key={anio} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/60 last:border-0">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-text">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SERIE[i] }} />
                      {anio}
                    </span>
                    <span className="flex items-baseline gap-3">
                      <span className="text-sm font-mono font-bold text-text">{formatCurrency(t[metrica])}</span>
                      <span className="w-14 text-right">
                        {siguiente && <Variacion a={t[metrica]} b={siguiente.t[metrica]} subirEsBueno={metrica === 'ingresos'} />}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-dim">Por mes natural, del 1 al último día. Sin ajustes de cuadre ni categorías fuera del análisis (traspasos).</p>
    </section>
  );
}
