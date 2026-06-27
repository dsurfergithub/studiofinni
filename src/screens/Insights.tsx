import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/storage/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { formatCurrency } from '../lib/utils';
import { FinMesSelector } from '../components/ui/FinMesSelector';
import { ChevronLeft } from 'lucide-react';

interface InsightsProps {
  selectedMesId: string;
  onChangeMes: (id: string) => void;
}

const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const OTROS_COLOR = '#7a7a92';

export function Insights({ selectedMesId, onChangeMes }: InsightsProps) {
  const { state, getMesesActivos } = useStore();
  const activeMeses = getMesesActivos();
  const cMes = activeMeses.find(m => m.id === selectedMesId) || activeMeses[0];

  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const movsMes = useMemo(() => {
    if (!cMes) return [];
    return state.movimientos.filter(m => m.fecha >= cMes.inicio && m.fecha <= cMes.fin);
  }, [state.movimientos, cMes]);

  // Cashflow
  const { ingresos, gastos } = useMemo(() => {
    let ingresos = 0, gastos = 0;
    movsMes.forEach(m => { if (m.importe > 0) ingresos += m.importe; else gastos += Math.abs(m.importe); });
    return { ingresos, gastos };
  }, [movsMes]);
  const balance = ingresos - gastos;

  // Gasto por categoría (todas), con detalle.
  const categoriasGasto = useMemo(() => {
    const map: Record<string, number> = {};
    movsMes.forEach(m => {
      if (m.importe < 0) map[m.categoria] = (map[m.categoria] || 0) + Math.abs(m.importe);
    });
    return Object.entries(map)
      .map(([catId, value]) => {
        const c = state.categorias.find(x => x.id === catId);
        return { id: catId, name: c?.nombre || 'Sin clasificar', value, fill: c?.color || OTROS_COLOR };
      })
      .sort((a, b) => b.value - a.value);
  }, [movsMes, state.categorias]);

  // Para el donut: top 7 + "Otros".
  const donutData = useMemo(() => {
    if (categoriasGasto.length <= 8) return categoriasGasto;
    const top = categoriasGasto.slice(0, 7);
    const restoVal = categoriasGasto.slice(7).reduce((acc, c) => acc + c.value, 0);
    return [...top, { id: '__otros__', name: 'Otros', value: restoVal, fill: OTROS_COLOR }];
  }, [categoriasGasto]);

  // Movimientos de la categoría seleccionada.
  const detalleCat = useMemo(() => {
    if (!selectedCat || selectedCat === '__otros__') return [];
    return movsMes
      .filter(m => m.importe < 0 && m.categoria === selectedCat)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [selectedCat, movsMes]);

  // Gasto por mes del año en curso (calendario).
  const gastoMensualAnual = useMemo(() => {
    const year = new Date().getFullYear();
    const mesActual = new Date().getMonth(); // 0-based
    const totales = new Array(12).fill(0);
    state.movimientos.forEach(m => {
      if (m.importe < 0 && m.fecha.startsWith(String(year))) {
        const mesIdx = parseInt(m.fecha.slice(5, 7), 10) - 1;
        totales[mesIdx] += Math.abs(m.importe);
      }
    });
    let acumulado = 0;
    return totales.slice(0, mesActual + 1).map((val, i) => {
      acumulado += val;
      return { name: MES_CORTO[i], gasto: val, acumulado };
    });
  }, [state.movimientos]);

  const totalAnual = gastoMensualAnual.reduce((acc, m) => acc + m.gasto, 0);
  const mediaMensual = gastoMensualAnual.length > 0 ? totalAnual / gastoMensualAnual.length : 0;
  const gastoTotalMes = categoriasGasto.reduce((acc, c) => acc + c.value, 0);

  const CashflowTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-elevated border border-border p-3 rounded-xl shadow-xl">
          <p className="text-xs uppercase font-bold text-muted mb-1">{label}</p>
          {payload.map((p: any, idx: number) => (
            <p key={idx} className="text-sm font-mono font-bold" style={{ color: p.color || p.payload.fill }}>
              {p.name === 'gasto' ? 'Gasto' : p.name === 'acumulado' ? 'Acumulado' : p.name}: {formatCurrency(p.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const selectedCatInfo = categoriasGasto.find(c => c.id === selectedCat);

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <FinMesSelector selectedMesId={selectedMesId} onChange={onChangeMes} />
      </div>

      <div className="p-4 space-y-6 mt-4">

        {/* Resumen del mes */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted tracking-wide mb-1">Ingresos</p>
            <p className="text-sm font-mono font-bold text-success truncate">{formatCurrency(ingresos)}</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted tracking-wide mb-1">Gastos</p>
            <p className="text-sm font-mono font-bold text-danger truncate">{formatCurrency(gastos)}</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted tracking-wide mb-1">Balance</p>
            <p className={`text-sm font-mono font-bold truncate ${balance >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(balance)}</p>
          </div>
        </div>

        {/* ¿En qué se va tu dinero? con drill-down */}
        <section className="bg-surface border border-border rounded-3xl p-5 shadow-card">
          {selectedCat ? (
            <>
              <button onClick={() => setSelectedCat(null)} className="flex items-center gap-1 text-xs font-bold text-accent mb-3">
                <ChevronLeft size={16} /> Volver al desglose
              </button>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedCatInfo?.fill }} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-text truncate">{selectedCatInfo?.name}</p>
                  <p className="text-xs text-muted font-mono">
                    {formatCurrency(selectedCatInfo?.value || 0)} · {gastoTotalMes > 0 ? Math.round(((selectedCatInfo?.value || 0) / gastoTotalMes) * 100) : 0}% del gasto
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {detalleCat.length === 0 ? (
                  <p className="text-center text-muted text-sm py-6">Sin movimientos detallados.</p>
                ) : detalleCat.map(m => (
                  <div key={m.id} className="flex justify-between items-center py-2 border-b border-border/60 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{m.concepto}</p>
                      <p className="text-[11px] font-mono text-muted">{m.fecha}{m.enPresupuesto === false ? ' · puntual' : ''}</p>
                    </div>
                    <span className="font-mono font-bold text-text flex-shrink-0 ml-2">{formatCurrency(Math.abs(m.importe))}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-baseline mb-2">
                <p className="text-xs font-bold text-muted uppercase tracking-wider">¿En qué se va tu dinero?</p>
                <p className="text-xs font-mono text-muted">{formatCurrency(gastoTotalMes)}</p>
              </div>
              {categoriasGasto.length === 0 ? (
                <p className="text-center text-muted text-sm py-8">No hay gastos este mes.</p>
              ) : (
                <>
                  <div className="h-44 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={72} paddingAngle={2} dataKey="value" stroke="none"
                          onClick={(d: any) => d?.id && d.id !== '__otros__' && setSelectedCat(d.id)}>
                          {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} className="cursor-pointer" />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase text-muted font-bold tracking-wide">Total</span>
                      <span className="text-lg font-black font-mono text-text">{formatCurrency(gastoTotalMes)}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-center text-muted mb-3">Toca una categoría para ver el detalle</p>
                  <div className="space-y-1.5">
                    {categoriasGasto.map(c => {
                      const perc = gastoTotalMes > 0 ? (c.value / gastoTotalMes) * 100 : 0;
                      return (
                        <button key={c.id} onClick={() => setSelectedCat(c.id)}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-elevated transition-colors text-left">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.fill }} />
                          <span className="text-sm font-medium text-text truncate flex-1">{c.name}</span>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-mono font-bold text-text">{formatCurrency(c.value)}</span>
                            <span className="text-[11px] font-mono text-muted ml-2">{Math.round(perc)}%</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* Gasto por mes del año */}
        <section className="bg-surface border border-border rounded-3xl p-5 shadow-card">
          <div className="flex justify-between items-baseline mb-1">
            <p className="text-xs font-bold text-muted uppercase tracking-wider">Gasto por mes ({new Date().getFullYear()})</p>
          </div>
          <p className="text-2xl font-black font-mono text-text mb-1">{formatCurrency(totalAnual)}</p>
          <p className="text-[11px] text-muted mb-4">Total del año · media {formatCurrency(mediaMensual)}/mes</p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gastoMensualAnual} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}€`} width={48} />
                <Tooltip content={<CashflowTooltip />} cursor={{ fill: 'var(--color-surface-elevated)' }} />
                <Bar dataKey="gasto" radius={[6, 6, 0, 0]} maxBarSize={42}>
                  {gastoMensualAnual.map((entry, i) => {
                    const esActual = i === gastoMensualAnual.length - 1;
                    return <Cell key={i} fill={esActual ? 'var(--color-accent)' : 'var(--color-danger)'} fillOpacity={esActual ? 1 : 0.55} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

      </div>
    </div>
  );
}
