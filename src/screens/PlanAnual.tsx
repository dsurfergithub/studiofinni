import React, { useState } from 'react';
import { useStore } from '../lib/storage/store';
import { formatCurrency } from '../lib/utils';
import { Sheet } from '../components/ui/Sheet';
import { Button } from '../components/ui/Button';
import { ColorPicker } from '../components/ui/ColorPicker';
import { ChevronLeft, ChevronRight, Plus, Percent, Euro, Copy } from 'lucide-react';
import type { PlanGrupo } from '../lib/storage/types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const SUELDO_COLOR = '#3b82f6';
const REMANENTE_COLOR = '#8b5cf6';

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

interface PlanAnualProps {
  onNavigate?: (tab: string) => void;
}

export function PlanAnual({ onNavigate }: PlanAnualProps) {
  const { state, getPlanFilas, setPlanCell, copiarFilaPlan, addPlanGrupo, renamePlanGrupo, removePlanGrupo } = useStore();

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [showPercent, setShowPercent] = useState(false);
  // Se incrementa para forzar el remonte de los inputs cuando cambian sus valores
  // por una acción externa (p. ej. "Copiar enero"), no por tecleo del usuario.
  const [refreshKey, setRefreshKey] = useState(0);

  // Editor de grupo
  const [grupoSheetOpen, setGrupoSheetOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<PlanGrupo | null>(null);
  const [grupoNombre, setGrupoNombre] = useState('');
  const [grupoColor, setGrupoColor] = useState('#f59e0b');

  const grupos = state.planAnual?.grupos || [];
  const filas = getPlanFilas(year);

  // Totales por columna
  const totalSueldo = filas.reduce((a, f) => a + (f.sueldo || 0), 0);
  const totalPorGrupo: Record<string, number> = {};
  grupos.forEach((g) => {
    totalPorGrupo[g.id] = filas.reduce((a, f) => a + (f.grupos?.[g.id] || 0), 0);
  });
  const remanenteFila = (idx: number) => {
    const f = filas[idx];
    const gastos = grupos.reduce((a, g) => a + (f.grupos?.[g.id] || 0), 0);
    return (f.sueldo || 0) - gastos;
  };
  const totalRemanente = filas.reduce((a, _f, i) => a + remanenteFila(i), 0);
  const tasaAhorro = totalSueldo > 0 ? (totalRemanente / totalSueldo) * 100 : 0;

  const pct = (val: number, base: number) => (base > 0 ? `${Math.round((val / base) * 100)}%` : '—');

  // ---- Handlers grupo ----
  const handleNewGrupo = () => {
    setEditingGrupo(null);
    setGrupoNombre('');
    setGrupoColor('#f59e0b');
    setGrupoSheetOpen(true);
  };
  const handleEditGrupo = (g: PlanGrupo) => {
    setEditingGrupo(g);
    setGrupoNombre(g.nombre);
    setGrupoColor(g.color);
    setGrupoSheetOpen(true);
  };
  const handleSaveGrupo = () => {
    const nombre = grupoNombre.trim();
    if (!nombre) return;
    if (editingGrupo) renamePlanGrupo(editingGrupo.id, nombre, grupoColor);
    else addPlanGrupo(nombre, grupoColor);
    setGrupoSheetOpen(false);
  };
  const handleDeleteGrupo = () => {
    if (!editingGrupo) return;
    if (window.confirm(`¿Eliminar el grupo "${editingGrupo.nombre}"? Se borran sus cifras en todos los años.`)) {
      removePlanGrupo(editingGrupo.id);
      setGrupoSheetOpen(false);
    }
  };

  const handleCopiar = () => {
    if (window.confirm('¿Copiar las cifras de enero a todos los meses del año? Sobrescribe el resto de meses.')) {
      copiarFilaPlan(year, 0);
      setRefreshKey((k) => k + 1);
    }
  };

  const thBase = 'px-2 py-2 text-[10px] uppercase font-bold tracking-wider whitespace-nowrap';
  const cellBase = 'px-2 py-1.5 text-right font-mono text-sm whitespace-nowrap';
  const stickyCol = 'sticky left-0 z-10 bg-surface';

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      {/* Cabecera: selector de año + toggle € / % */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-20 px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 bg-surface px-3 py-1.5 rounded-full border border-border">
            <button onClick={() => setYear(String(Number(year) - 1))} className="text-muted hover:text-text p-1">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold tracking-widest text-text tabular-nums">{year}</span>
            <button onClick={() => setYear(String(Number(year) + 1))} className="text-muted hover:text-text p-1">
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
      </div>

      <div className="p-4 space-y-5 mt-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-xl font-bold font-display tracking-tight text-text">Plan anual</h2>
          <span className="text-xs text-muted">Planificación manual</span>
        </div>

        {/* Resumen del año */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted tracking-wide mb-1">Ingresos</p>
            <p className="text-sm font-mono font-bold text-success truncate">{formatCurrency(totalSueldo)}</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted tracking-wide mb-1">Remanente</p>
            <p className={`text-sm font-mono font-bold truncate ${totalRemanente >= 0 ? 'text-text' : 'text-danger'}`}>{formatCurrency(totalRemanente)}</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted tracking-wide mb-1">Tasa ahorro</p>
            <p className={`text-sm font-mono font-bold truncate ${tasaAhorro >= 0 ? 'text-accent' : 'text-danger'}`}>{Math.round(tasaAhorro)}%</p>
          </div>
        </div>

        {/* Tabla editable */}
        <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thBase} ${stickyCol} text-left text-muted`}>Mes</th>
                  <th className={`${thBase} text-right`} style={{ color: SUELDO_COLOR }}>Sueldo</th>
                  {grupos.map((g) => (
                    <th key={g.id} className={`${thBase} text-right`}>
                      <button onClick={() => handleEditGrupo(g)} className="inline-flex items-center gap-1 hover:opacity-80" style={{ color: g.color }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.nombre}
                      </button>
                    </th>
                  ))}
                  <th className={`${thBase} text-right`} style={{ color: REMANENTE_COLOR }}>Remanente</th>
                </tr>
              </thead>
              <tbody>
                {MESES.map((mes, i) => {
                  const f = filas[i];
                  const rem = remanenteFila(i);
                  return (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface-elevated/40">
                      <td className={`${stickyCol} px-2 py-1.5 text-xs font-bold text-text whitespace-nowrap`}>
                        <span className="hidden sm:inline">{mes}</span>
                        <span className="sm:hidden">{MES_CORTO[i]}</span>
                      </td>
                      <td key={`sueldo-${year}-${refreshKey}`} className={cellBase}>
                        {showPercent ? (
                          <span className="text-muted pr-1.5">100%</span>
                        ) : (
                          <CellInput value={f.sueldo} accent={SUELDO_COLOR} onCommit={(n) => setPlanCell(year, i, 'sueldo', n)} />
                        )}
                      </td>
                      {grupos.map((g) => (
                        <td key={`${g.id}-${year}-${refreshKey}`} className={cellBase}>
                          {showPercent ? (
                            <span className="text-muted pr-1.5">{pct(f.grupos?.[g.id] || 0, f.sueldo || 0)}</span>
                          ) : (
                            <CellInput value={f.grupos?.[g.id] || 0} accent={g.color} onCommit={(n) => setPlanCell(year, i, g.id, n)} />
                          )}
                        </td>
                      ))}
                      <td className={`${cellBase} font-bold ${rem >= 0 ? 'text-text' : 'text-danger'}`}>
                        <span className="pr-1.5">{showPercent ? pct(rem, f.sueldo || 0) : formatCurrency(rem)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-elevated/60">
                  <td className={`${stickyCol} bg-surface-elevated px-2 py-2 text-[11px] font-black uppercase tracking-wider text-text`}>Total</td>
                  <td className={`${cellBase} font-black`} style={{ color: SUELDO_COLOR }}>
                    <span className="pr-1.5">{showPercent ? '100%' : formatCurrency(totalSueldo)}</span>
                  </td>
                  {grupos.map((g) => (
                    <td key={g.id} className={`${cellBase} font-black`} style={{ color: g.color }}>
                      <span className="pr-1.5">{showPercent ? pct(totalPorGrupo[g.id], totalSueldo) : formatCurrency(totalPorGrupo[g.id])}</span>
                    </td>
                  ))}
                  <td className={`${cellBase} font-black`} style={{ color: REMANENTE_COLOR }}>
                    <span className="pr-1.5">{showPercent ? pct(totalRemanente, totalSueldo) : formatCurrency(totalRemanente)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={handleNewGrupo}>
              <Plus size={16} className="mr-1" /> Añadir grupo
            </Button>
            <Button variant="secondary" className="flex-1" onClick={handleCopiar}>
              <Copy size={16} className="mr-1" /> Copiar enero
            </Button>
          </div>
          <p className="text-[11px] text-muted text-center px-2">
            Toca el nombre de un grupo para renombrarlo, cambiar color o eliminarlo. El remanente se calcula solo (sueldo − grupos).
          </p>
        </div>
      </div>

      {/* Editor de grupo */}
      <Sheet isOpen={grupoSheetOpen} onClose={() => setGrupoSheetOpen(false)} title={editingGrupo ? 'Editar grupo' : 'Nuevo grupo'}>
        <div className="space-y-6 pb-6 mt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Nombre</label>
            <input
              type="text"
              placeholder="Ej: Alquiler, Ocio, Inversión…"
              value={grupoNombre}
              onChange={(e) => setGrupoNombre(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Color</label>
            <ColorPicker value={grupoColor} onChange={setGrupoColor} />
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={handleSaveGrupo} disabled={!grupoNombre.trim()} className="w-full h-14 text-lg font-bold">
              {editingGrupo ? 'Guardar cambios' : 'Crear grupo'}
            </Button>
            {editingGrupo && (
              <Button variant="danger" onClick={handleDeleteGrupo} className="w-full h-12 text-base font-bold bg-transparent border border-border">
                Eliminar grupo
              </Button>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
