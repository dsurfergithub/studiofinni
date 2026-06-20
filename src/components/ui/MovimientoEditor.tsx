import React, { useState, useEffect } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { Movimiento } from '../../lib/storage/types';
import { useStore } from '../../lib/storage/store';
import { getLocalFechaIso } from '../../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import * as LucideIcons from 'lucide-react';
import { playIngreso, playGasto, playDelete } from '../../lib/audio/sounds';

interface MovimientoEditorProps {
  isOpen: boolean;
  onClose: () => void;
  movimiento?: Movimiento | null;
  defaultDate?: string;
}

export function MovimientoEditor({ isOpen, onClose, movimiento, defaultDate }: MovimientoEditorProps) {
  const { state, addMovimiento, updateMovimiento, deleteMovimientos } = useStore();

  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [importe, setImporte] = useState('');
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState('');
  const [categoria, setCategoria] = useState('');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (movimiento) {
      setTipo(movimiento.importe >= 0 ? 'ingreso' : 'gasto');
      setImporte(Math.abs(movimiento.importe).toString());
      setConcepto(movimiento.concepto);
      setFecha(movimiento.fecha);
      setCategoria(movimiento.categoria);
      setNotas(movimiento.notas || '');
    } else {
      setTipo('gasto');
      setImporte('');
      setConcepto('');
      setFecha(defaultDate || getLocalFechaIso());
      setCategoria('');
      setNotas('');
    }
  }, [movimiento, isOpen, defaultDate]);

  const handleSave = () => {
    const val = parseFloat(importe.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert("Por favor, introduce un importe válido.");
      return;
    }
    if (!concepto.trim()) {
      alert("Por favor, introduce un concepto.");
      return;
    }
    
    const finalImporte = tipo === 'gasto' ? -val : val;
    const resolvedCat = categoria || 'sin-clasificar';

    if (movimiento) {
      updateMovimiento(movimiento.id, {
        importe: finalImporte,
        concepto,
        fecha,
        categoria: resolvedCat,
        notas
      });
      finalImporte > 0 ? playIngreso() : playGasto();
    } else {
      addMovimiento({
        id: uuidv4(),
        importe: finalImporte,
        concepto,
        fecha,
        categoria: resolvedCat,
        fuente: 'manual',
        hash: uuidv4(), // Manual uses random hash
        notas
      });
      finalImporte > 0 ? playIngreso() : playGasto();
    }
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
    <Sheet isOpen={isOpen} onClose={onClose} title={movimiento ? "Editar Movimiento" : "Nuevo Movimiento"}>
      <div className="space-y-6 pb-6 mt-4">
        {/* Tipo */}
        <div className="flex gap-3">
          <button
            onClick={() => setTipo('gasto')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${tipo === 'gasto' ? 'bg-danger border-danger text-white shadow-[0_0_16px_rgba(255,84,120,0.35)]' : 'border-danger/40 text-danger bg-transparent hover:border-danger hover:bg-danger/10'}`}
          >
            Gasto
          </button>
          <button
            onClick={() => setTipo('ingreso')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${tipo === 'ingreso' ? 'bg-success border-success text-black shadow-[0_0_16px_rgba(74,222,128,0.35)]' : 'border-success/40 text-success bg-transparent hover:border-success hover:bg-success/10'}`}
          >
            Ingreso
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
              className={`w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-4 text-3xl font-black font-mono focus:outline-none transition-all ${tipo === 'ingreso' ? 'focus:border-success focus:ring-1 focus:ring-success/50 text-success' : 'focus:border-danger focus:ring-1 focus:ring-danger/50 text-text'}`}
            />
          </div>
        </div>

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
                <option key={c.id} value={c.id}>{c.nombre}</option>
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
            placeholder="¿En qué te lo has gastado?"
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

        <div className="pt-4 flex flex-col gap-3">
          <Button onClick={handleSave} className="w-full h-14 text-lg font-bold">Guardar Movimiento</Button>
          {movimiento && (
            <Button variant="danger" onClick={handleDelete} className="w-full h-12 text-base font-bold bg-transparent border border-border">Borrar</Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
