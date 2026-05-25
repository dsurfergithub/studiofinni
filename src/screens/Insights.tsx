import React, { useMemo } from 'react';
import { useStore } from '../lib/storage/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Sector } from 'recharts';
import { formatCurrency } from '../lib/utils';
import { FinMesSelector } from '../components/ui/FinMesSelector';

interface InsightsProps {
  selectedMesId: string;
  onChangeMes: (id: string) => void;
}

export function Insights({ selectedMesId, onChangeMes }: InsightsProps) {
  const { state, getMesesActivos } = useStore();
  const activeMeses = getMesesActivos();
  const cMes = activeMeses.find(m => m.id === selectedMesId) || activeMeses[0];

  // 1. Gastos vs Ingresos Data
  const incomeVsExpenses = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;

    if (cMes) {
      state.movimientos.forEach(m => {
        if (m.fecha >= cMes.inicio && m.fecha <= cMes.fin) {
          if (m.importe > 0) ingresos += m.importe;
          else gastos += Math.abs(m.importe);
        }
      });
    }

    return [
      { name: 'Ingresos', value: ingresos, fill: '#34d399' },
      { name: 'Gastos', value: gastos, fill: '#f87171' }
    ];
  }, [state.movimientos, cMes]);

  // 2. Gastos por categoría
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    if (cMes) {
      state.movimientos.forEach(m => {
        if (m.fecha >= cMes.inicio && m.fecha <= cMes.fin && m.importe < 0) {
          map[m.categoria] = (map[m.categoria] || 0) + Math.abs(m.importe);
        }
      });
    }

    return Object.entries(map)
      .map(([catId, value]) => ({
        name: state.categorias.find(c => c.id === catId)?.nombre || 'Desconocido',
        value,
        fill: state.categorias.find(c => c.id === catId)?.color || '#333'
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5
  }, [state.movimientos, state.categorias, cMes]);

  // 3. Historical net balance (Last 6 months)
  const historicalData = useMemo(() => {
    const pastMonths = [...activeMeses].reverse().slice(0, 6).reverse(); // Oldest to newest
    return pastMonths.map(mes => {
      let ingresos = 0;
      let gastos = 0;
      state.movimientos.forEach(m => {
        if (m.fecha >= mes.inicio && m.fecha <= mes.fin) {
          if (m.importe > 0) ingresos += m.importe;
          else gastos += Math.abs(m.importe);
        }
      });
      return {
        name: mes.nombre.substring(0, 3).toUpperCase(),
        net: ingresos - gastos,
        ingresos,
        gastos
      };
    });
  }, [activeMeses, state.movimientos]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-elevated border border-border p-3 rounded-xl shadow-xl">
          <p className="text-xs uppercase font-bold text-muted mb-1">{label}</p>
          {payload.map((p: any, idx: number) => (
            <p key={idx} className="text-sm font-mono font-bold" style={{ color: p.color || p.payload.fill }}>
              {p.name}: {formatCurrency(p.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <FinMesSelector selectedMesId={selectedMesId} onChange={onChangeMes} />
      </div>

      <div className="p-4 space-y-6 mt-4">
        
        {/* Cashflow */}
        <section className="bg-surface border border-border p-5 rounded-3xl">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Cashflow del mes</p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpenses} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={(val) => `€${val}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {incomeVsExpenses.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Expenses by category */}
        {expensesByCategory.length > 0 && (
          <section className="bg-surface border border-border p-5 rounded-3xl">
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Top 5 Gastos</p>
            <div className="flex items-center">
              <div className="h-40 w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {expensesByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-3 pl-4">
                {expensesByCategory.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.fill }} />
                      <span className="text-xs font-bold text-text truncate">{cat.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Histórico Net */}
        <section className="bg-surface border border-border p-5 rounded-3xl">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Tendencia Neta (6 Meses)</p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historicalData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={(val) => `€${val}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                  {historicalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#34d399' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

      </div>
    </div>
  );
}
