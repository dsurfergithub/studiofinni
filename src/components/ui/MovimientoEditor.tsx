import React, { useState, useEffect } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { Movimiento } from '../../lib/storage/types';
import { useStore } from '../../lib/storage/store';
import { getLocalFechaIso } from '../../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { ArrowDownLeft, ArrowUpRight, Check, PieChart, Sparkle } from 'lucide-react';
import { playIngreso, playGasto, playDelete, playClick } from '../../lib/audio/sounds';

interface MovimientoEditorProps {
  isOpen: boolean;
  onClose: () => void;
  movimiento?: Movimiento | null;
  defaultDate?: string;
  defaultTipo?: 'gasto' | 'ingreso';
}

export function MovimientoEditor({ isOpen, onClose, movimiento, defaultDate, defaultTipo }: MovimientoEditorProps) {
  const { state, addMovimiento, updateMovimiento, deleteMovimientos } = useStore();

  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [importe, setImporte] = useState('');
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState('');
  const [categoria, setCategoria] = useState('');
  const [notas, setNotas] = useState('');
  const [enPresupuesto, setEnPresupuesto] = useState(true);

  useEffect(() => {
    if (movimiento) {
      setTipo(movimiento.importe >= 0 ? 'ingreso' : 'gasto');
      setImporte(Math.abs(movimiento.importe).toString());
      setConcepto(movimiento.concepto);
      setFecha(movimiento.fecha);
      setCategoria(movimiento.categoria);
      setNotas(movimiento.notas || '');
      setEnPresupuesto(movimiento.enPresupuesto !== false);
    } else {
      setTipo(defaultTipo || 'gasto');
      setImporte('');
      setConcepto('');
      setFecha(defaultDate || getLocalFechaIso());
      setCategoria('');
      setNotas('');
      setEnPresupuesto(true);
    }
  }, [movimiento, isOpen, defaultDate, defaultTipo]);

  const seleccionarTipo = (t: 'gasto' | 'ingreso') => {
    setTipo(t);
    t === 'gasto' ? playGasto() : playIngreso();
  };

  const handleSave = () => {
    const val = parseFloat(importe.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Por favor, introduce un importe válido.');
      return;
    }
    if (!concepto.trim()) {
      alert('Por favor, introduce un concepto.');
      return;
    }

    const finalImporte = tipo === 'gasto' ? -val : val;
    const resolvedCat = categoria || 'sin-clasificar';
    // Los ingresos no consumen presupuesto; el flag solo aplica a gastos.
    const cuentaPresupuesto = tipo === 'gasto' ? enPresupuesto : true;

    if (movimiento) {
      updateMovimiento(movimiento.id, {
        importe: finalImporte,
        concepto,
        fecha,
        categoria: resolvedCat,
        notas,
        enPresupuesto: cuentaPresupuesto,
      });
    } else {
      addMovimiento({
        id: uuidv4(),
        importe: finalImporte,
        concepto,
        fecha,
        categoria: resolvedCat,
        fuente: 'manual',
        hash: uuidv4(),
        notas,
        enPresupuesto: cuentaPresupuesto,
      });
    }
    finalImporte > 0 ? playIngreso() : playGasto();
    onClose();
  };

  const handleDelete = () => {
    if (movimiento && window.confirm('¿Eliminar movimiento?')) {
      deleteMovimientos([movimiento.id]);
      playDelete();
      onClose();
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={movimiento ? 'Editar movimiento' : 'Nuevo movimiento'}>
      <div className="space-y-6 pb-6 mt-4">
        {/* Tipo: segmented control con estado activo muy claro */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => seleccionarTipo('gasto')}
            aria-pressed={tipo === 'gasto'}
            className={`relative flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-[0.97] ${
              tipo === 'gasto'
                ? 'bg-danger text-white shadow-lg ring-2 ring-danger'
                : 'bg-surface-elevated text-muted border border-border'
            }`}
          >
            <ArrowDownLeft size={20} strokeWidth={2.5} />
            Gasto
            {tipo === 'gasto' && (
              <span className="absolute top-2 right-2 bg-white/25 rounded-full p-0.5">
                <Check size={12} strokeWidth={3} className="text-white" />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => seleccionarTipo('ingreso')}
            aria-pressed={tipo === 'ingreso'}
            className={`relative flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-[0.97] ${
              tipo === 'ingreso'
                ? 'bg-success text-white shadow-lg ring-2 ring-success'
                : 'bg-surface-elevated text-muted border border-border'
            }`}
          >
            <ArrowUpRight size={20} strokeWidth={2.5} />
            Ingreso
            {tipo === 'ingreso' && (
              <span className="absolute top-2 right-2 bg-white/25 rounded-full p-0.5">
                <Check size={12} strokeWidth={3} className="text-white" />
              </span>
            )}
          </button>
        </div>

        {/* Importe */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Importe</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-mono text-muted">€</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={importe}
              onChange={e => setImporte(e.target.value)}
              placeholder="0.00"
              className={`w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-4 text-3xl font-black font-mono focus:outline-none transition-all ${
                tipo === 'ingreso'
                  ? 'focus:border-success focus:ring-1 focus:ring-success text-success'
                  : 'focus:border-danger focus:ring-1 focus:ring-danger text-text'
              }`}
            />
          </div>
        </div>

        {/* ¿Cuenta para el presupuesto? (solo gastos) */}
        {tipo === 'gasto' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">¿Cómo lo cuento?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setEnPresupuesto(true); playClick(); }}
                aria-pressed={enPresupuesto}
                className={`flex flex-col items-start gap-1 p-3 rounded-2xl text-left transition-all active:scale-[0.97] ${
                  enPresupuesto ? 'bg-accent/15 border-2 border-accent' : 'bg-surface-elevated border border-border'
                }`}
              >
                <PieChart size={18} className={enPresupuesto ? 'text-accent' : 'text-muted'} />
                <span className={`text-sm font-bold ${enPresupuesto ? 'text-text' : 'text-muted'}`}>En presupuesto</span>
                <span className="text-[11px] text-muted leading-tight">Consume el límite de su categoría</span>
              </button>
              <button
                type="button"
                onClick={() => { setEnPresupuesto(false); playClick(); }}
                aria-pressed={!enPresupuesto}
                className={`flex flex-col items-start gap-1 p-3 rounded-2xl text-left transition-all active:scale-[0.97] ${
                  !enPresupuesto ? 'bg-warning/15 border-2 border-warning' : 'bg-surface-elevated border border-border'
                }`}
              >
                <Sparkle size={18} className={!enPresupuesto ? 'text-warning' : 'text-muted'} />
                <span className={`text-sm font-bold ${!enPresupuesto ? 'text-text' : 'text-muted'}`}>Gasto puntual</span>
                <span className="text-[11px] text-muted leading-tight">No afecta a tu presupuesto</span>
              </button>
            </div>
          </div>
        )}

        {/* Fecha & Categoría */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-mono text-sm text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Categoría</label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none appearance-none"
            >
              <option value="">Selecciona...</option>
              {state.categorias.map(c => (
                <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Concepto */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Concepto</label>
          <input
            type="text"
            value={concepto}
            onChange={e => setConcepto(e.target.value)}
            placeholder={tipo === 'gasto' ? '¿En qué te lo has gastado?' : '¿De dónde viene el ingreso?'}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          />
        </div>

        {/* Notas */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Añade algún detalle extra..."
            rows={2}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none"
          />
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <Button onClick={handleSave} className="w-full h-14 text-lg font-bold">Guardar movimiento</Button>
          {movimiento && (
            <Button variant="danger" onClick={handleDelete} className="w-full h-12 text-base font-bold bg-transparent border border-border">Borrar</Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
