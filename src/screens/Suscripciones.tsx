import React, { useState } from 'react';
import { useStore } from '../lib/storage/store';
import { formatCurrency, getLocalFechaIso } from '../lib/utils';
import { Sheet } from '../components/ui/Sheet';
import { Button } from '../components/ui/Button';
import { Suscripcion } from '../lib/storage/types';
import { costeMensual, costeAnual, totalMensual, totalAnual } from '../lib/suscripciones/suscripciones';
import { v4 as uuidv4 } from 'uuid';
import { Repeat, CalendarClock, TrendingUp } from 'lucide-react';

const SUB_ICONS = ['📺','🎵','🎮','☁️','📱','💪','📰','🍿','🛒','🚗','🏠','💡','🌐','📦','🐱','💼','🎧','📚','🍔','✈️'];

interface Props {
  onBack?: () => void;
}

export function Suscripciones(_props: Props) {
  const { state, addSuscripcion, updateSuscripcion, deleteSuscripcion } = useStore();
  const subs = state.suscripciones || [];

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [importe, setImporte] = useState('');
  const [frecuencia, setFrecuencia] = useState<'mensual' | 'anual'>('mensual');
  const [diaCobro, setDiaCobro] = useState('1');
  const [categoria, setCategoria] = useState('');
  const [icono, setIcono] = useState('📺');
  const [activa, setActiva] = useState(true);

  const mensualTotal = totalMensual(subs);
  const anualTotal = totalAnual(subs);

  const openNew = () => {
    setEditingId(null);
    setNombre(''); setImporte(''); setFrecuencia('mensual');
    setDiaCobro('1'); setCategoria(''); setIcono('📺'); setActiva(true);
    setEditorOpen(true);
  };

  const openEdit = (s: Suscripcion) => {
    setEditingId(s.id);
    setNombre(s.nombre);
    setImporte(s.importe.toString());
    setFrecuencia(s.frecuencia);
    setDiaCobro(String(s.diaCobro));
    setCategoria(s.categoria);
    setIcono(s.icono || '📺');
    setActiva(s.activa);
    setEditorOpen(true);
  };

  const handleSave = () => {
    const val = parseFloat(importe.replace(',', '.'));
    if (!nombre.trim() || isNaN(val) || val <= 0) return;
    const dia = Math.min(28, Math.max(1, parseInt(diaCobro, 10) || 1));

    if (editingId) {
      updateSuscripcion(editingId, {
        nombre, importe: val, frecuencia, diaCobro: dia,
        categoria: categoria || 'sin-clasificar', icono, activa,
      });
    } else {
      const nueva: Suscripcion = {
        id: uuidv4(),
        nombre,
        importe: val,
        frecuencia,
        diaCobro: dia,
        categoria: categoria || 'sin-clasificar',
        icono,
        activa,
        inicio: getLocalFechaIso(),
      };
      addSuscripcion(nueva);
    }
    setEditorOpen(false);
  };

  const handleDelete = () => {
    if (editingId && window.confirm('¿Eliminar esta suscripción? Los cargos ya creados se mantienen en tus movimientos.')) {
      deleteSuscripcion(editingId);
      setEditorOpen(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border flex items-center gap-2">
        <Repeat size={20} className="text-accent" />
        <h2 className="text-xl font-bold font-display tracking-tight text-text">Suscripciones</h2>
      </div>

      <div className="p-4 space-y-6 mt-2">
        {/* Resumen de impacto */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-3xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2 text-muted">
              <CalendarClock size={14} />
              <p className="text-[10px] uppercase font-bold tracking-widest">Al mes</p>
            </div>
            <p className="text-2xl font-black font-mono text-text truncate">{formatCurrency(mensualTotal)}</p>
          </div>
          <div className="bg-accent/10 border border-accent/30 rounded-3xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2 text-accent">
              <TrendingUp size={14} />
              <p className="text-[10px] uppercase font-bold tracking-widest">Al año</p>
            </div>
            <p className="text-2xl font-black font-mono text-accent truncate">{formatCurrency(anualTotal)}</p>
          </div>
        </div>

        {anualTotal > 0 && (
          <p className="text-xs text-muted text-center px-4 -mt-2">
            Tus suscripciones suponen <span className="font-bold text-text">{formatCurrency(anualTotal)}</span> al año.
            Se cargan solas cada periodo en tus movimientos.
          </p>
        )}

        {/* Lista */}
        <div className="space-y-3">
          {subs.length === 0 ? (
            <div className="bg-surface border border-border rounded-3xl p-8 text-center">
              <div className="text-4xl mb-3">📺</div>
              <p className="text-sm text-muted font-bold mb-1">Aún no tienes suscripciones</p>
              <p className="text-xs text-muted mb-5">Añade Netflix, Spotify, el gimnasio... y verás cuánto te cuestan al año.</p>
              <Button onClick={openNew} className="w-full h-12 font-bold">Añadir mi primera suscripción</Button>
            </div>
          ) : (
            <>
              {subs.map(s => {
                const cat = state.categorias.find(c => c.id === s.categoria);
                return (
                  <button
                    key={s.id}
                    onClick={() => openEdit(s)}
                    className={`w-full bg-surface border rounded-2xl p-4 text-left transition-all active:scale-[0.98] flex items-center gap-4 ${
                      s.activa ? 'border-border hover:border-accent/40' : 'border-border opacity-55'
                    }`}
                  >
                    <span className="text-2xl leading-none flex-shrink-0">{s.icono || '📺'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-text truncate">{s.nombre}</p>
                        {!s.activa && <span className="text-[9px] uppercase font-bold text-muted border border-border rounded px-1.5 py-0.5">Pausada</span>}
                      </div>
                      <p className="text-xs text-muted font-mono mt-0.5">
                        {s.frecuencia === 'mensual' ? `día ${s.diaCobro} de cada mes` : `1 vez al año`}
                        {cat ? ` · ${cat.nombre}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold text-text">{formatCurrency(s.importe)}<span className="text-muted text-xs">/{s.frecuencia === 'mensual' ? 'mes' : 'año'}</span></p>
                      <p className="text-[11px] text-muted font-mono">
                        {s.frecuencia === 'mensual' ? `${formatCurrency(costeAnual(s))}/año` : `${formatCurrency(costeMensual(s))}/mes`}
                      </p>
                    </div>
                  </button>
                );
              })}
              <Button variant="secondary" className="w-full mt-1" onClick={openNew}>+ Nueva suscripción</Button>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <Sheet isOpen={editorOpen} onClose={() => setEditorOpen(false)} title={editingId ? 'Editar suscripción' : 'Nueva suscripción'}>
        <div className="space-y-6 pb-6 mt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Nombre</label>
            <input
              type="text"
              placeholder="Ej: Netflix, Spotify, Gimnasio..."
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Icono</label>
            <div className="grid grid-cols-10 gap-2">
              {SUB_ICONS.map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcono(ic)}
                  className={`h-9 rounded-lg text-lg flex items-center justify-center transition-all ${icono === ic ? 'bg-accent/20 border-2 border-accent scale-110' : 'bg-surface border border-border'}`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Frecuencia */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Frecuencia</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFrecuencia('mensual')}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${frecuencia === 'mensual' ? 'bg-accent text-white ring-2 ring-accent' : 'bg-surface-elevated text-muted border border-border'}`}
              >Mensual</button>
              <button
                type="button"
                onClick={() => setFrecuencia('anual')}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${frecuencia === 'anual' ? 'bg-accent text-white ring-2 ring-accent' : 'bg-surface-elevated text-muted border border-border'}`}
              >Anual</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Importe</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-mono text-muted">€</span>
                <input
                  type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                  value={importe}
                  onChange={e => setImporte(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-3 text-xl font-bold font-mono focus:border-accent focus:ring-1 focus:ring-accent outline-none text-text"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">{frecuencia === 'mensual' ? 'Día de cobro' : 'Día (del mes)'}</label>
              <input
                type="number" inputMode="numeric" min="1" max="28"
                value={diaCobro}
                onChange={e => setDiaCobro(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-xl font-bold font-mono focus:border-accent focus:ring-1 focus:ring-accent outline-none text-text"
              />
            </div>
          </div>

          {/* Equivalencia */}
          {importe && !isNaN(parseFloat(importe.replace(',', '.'))) && (
            <div className="bg-surface-elevated rounded-xl p-3 text-center">
              <p className="text-xs text-muted">
                {frecuencia === 'mensual'
                  ? <>Son <span className="font-bold text-accent">{formatCurrency(parseFloat(importe.replace(',', '.')) * 12)}</span> al año</>
                  : <>Equivale a <span className="font-bold text-accent">{formatCurrency(parseFloat(importe.replace(',', '.')) / 12)}</span> al mes</>}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Categoría</label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none appearance-none"
            >
              <option value="">Sin clasificar</option>
              {state.categorias.filter(c => c.tipo !== 'ingreso').map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Activa */}
          <button
            type="button"
            onClick={() => setActiva(a => !a)}
            className="w-full flex justify-between items-center bg-surface border border-border rounded-xl p-4"
          >
            <div className="text-left">
              <p className="text-sm font-bold text-text">Suscripción activa</p>
              <p className="text-xs text-muted">Si la pausas, deja de generar cargos.</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${activa ? 'bg-success' : 'bg-surface-elevated'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${activa ? 'left-7' : 'left-1'}`} />
            </div>
          </button>

          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={handleSave} disabled={!nombre.trim() || importe === ''} className="w-full h-14 text-lg font-bold">
              {editingId ? 'Guardar cambios' : 'Crear suscripción'}
            </Button>
            {editingId && (
              <Button variant="danger" onClick={handleDelete} className="w-full h-12 text-base font-bold bg-transparent border border-border">
                Eliminar suscripción
              </Button>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
