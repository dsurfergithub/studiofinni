import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '../../lib/storage/store';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { playClick } from '../../lib/audio/sounds';
import { calcularNombreMes } from '../../lib/finmes/finmes';
import type { MesFinanciero } from '../../lib/storage/types';

interface FinMesSelectorProps {
  selectedMesId: string;
  onChange: (id: string) => void;
}

export function FinMesSelector({ selectedMesId, onChange }: FinMesSelectorProps) {
  const { getMesesActivos, getMesesDerivados, setMesPersonalizado, removeMesPersonalizado } = useStore();
  const meses = getMesesActivos();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Editor de mes
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editInicio, setEditInicio] = useState('');
  const [editFin, setEditFin] = useState('');

  // If no meses, we will show "Cargando" or default month
  if (meses.length === 0) return null;

  const currentIndex = meses.findIndex(m => m.id === selectedMesId);
  // Default to 0 (newest) if not found, since list is newest first
  const current = meses[currentIndex] || meses[0];

  const handlePrev = () => {
    // List is newest first, so "previous calendar month" is inherently +i in the array index
    if (currentIndex < meses.length - 1) {
      playClick();
      onChange(meses[currentIndex + 1].id);
    }
  };

  const handleNext = () => {
    // "next calendar month" is -1 in the array index
    if (currentIndex > 0) {
      playClick();
      onChange(meses[currentIndex - 1].id);
    }
  };

  const openEditor = (m: MesFinanciero) => {
    playClick();
    setEditId(m.id);
    setEditNombre(m.nombre);
    setEditInicio(m.inicio);
    setEditFin(m.fin);
    setSheetOpen(false);
    setEditOpen(true);
  };

  // ¿Este mes proviene de una nómina (derivado)? Sirve para ofrecer "volver a automático".
  const esDerivado = (id: string) => getMesesDerivados().some(m => m.id === id);

  const handleSugerirNombre = () => {
    if (editInicio && editFin && editInicio <= editFin) {
      setEditNombre(calcularNombreMes(editInicio, editFin).nombre);
    }
  };

  const handleSaveEdit = () => {
    if (!editInicio || !editFin || editInicio > editFin || !editNombre.trim()) return;
    const { clave } = calcularNombreMes(editInicio, editFin);
    setMesPersonalizado({
      id: editId,
      nombre: editNombre.trim(),
      clave,
      inicio: editInicio,
      fin: editFin,
    });
    setEditOpen(false);
    onChange(editId);
  };

  const handleResetEdit = () => {
    removeMesPersonalizado(editId);
    setEditOpen(false);
  };

  const editEsDerivado = esDerivado(editId);

  return (
    <>
      <div className="flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-6 bg-surface px-4 py-2 rounded-full border border-border">
          <button onClick={handlePrev} disabled={currentIndex >= meses.length - 1} className="text-muted hover:text-text disabled:opacity-30 p-1">
            <ChevronLeft size={20} strokeWidth={2} />
          </button>

          <button onClick={() => { playClick(); setSheetOpen(true); }} className="flex flex-col items-center">
            <span className="text-sm font-bold uppercase tracking-widest text-text">
              {current.nombre.toLowerCase()}
              {current.esEstimado && <span className="text-[10px] ml-1 text-accent align-top leading-none">EST</span>}
            </span>
          </button>

          <button onClick={handleNext} disabled={currentIndex <= 0} className="text-muted hover:text-text disabled:opacity-30 p-1">
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      <Sheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Seleccionar mes">
        <div className="space-y-2">
          {meses.map((m) => (
            <div
              key={m.id}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                m.id === current.id ? 'bg-accent/10 border-accent/30 text-text' : 'bg-surface border-border hover:bg-surface-elevated text-muted'
              }`}
            >
              <button
                onClick={() => { onChange(m.id); setSheetOpen(false); }}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <Calendar size={20} className={m.id === current.id ? 'text-accent' : ''} />
                <div className="min-w-0">
                  <div className={`font-semibold capitalize truncate ${m.id === current.id ? 'text-text' : ''}`}>{m.nombre.toLowerCase()}</div>
                  <div className="text-xs font-mono opacity-80">{m.inicio} — {m.fin}</div>
                </div>
              </button>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {m.esEstimado && <span className="text-[10px] px-2 py-1 bg-surface-elevated rounded-md font-medium">Estimado</span>}
                <button onClick={() => openEditor(m)} className="p-2 rounded-lg text-muted hover:text-accent hover:bg-surface-elevated transition-colors" aria-label="Editar mes">
                  <Pencil size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Sheet>

      {/* Editor de mes financiero */}
      <Sheet isOpen={editOpen} onClose={() => setEditOpen(false)} title="Editar mes">
        <div className="space-y-5 pb-6 mt-4">
          <p className="text-xs text-muted -mt-1">
            Ajusta el nombre y las fechas de inicio/fin de este periodo. Útil si cobras a final de mes y prefieres que la nómina cuente para el mes siguiente.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Nombre del mes</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              />
              <button onClick={handleSugerirNombre} className="px-3 rounded-xl border border-border text-xs font-bold text-muted hover:text-text whitespace-nowrap">
                Auto
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Inicio</label>
              <input
                type="date"
                value={editInicio}
                onChange={(e) => setEditInicio(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-text font-mono text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Fin</label>
              <input
                type="date"
                value={editFin}
                onChange={(e) => setEditFin(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-text font-mono text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
          </div>
          {editInicio && editFin && editInicio > editFin && (
            <p className="text-xs text-danger font-bold">La fecha de inicio no puede ser posterior a la de fin.</p>
          )}

          <div className="flex flex-col gap-3 pt-1">
            <Button onClick={handleSaveEdit} disabled={!editInicio || !editFin || editInicio > editFin || !editNombre.trim()} className="w-full h-14 text-lg font-bold">
              Guardar cambios
            </Button>
            <Button variant="danger" onClick={handleResetEdit} className="w-full h-12 text-base font-bold bg-transparent border border-border">
              {editEsDerivado ? (
                <><RotateCcw size={16} className="mr-2" /> Volver a automático</>
              ) : (
                <><Trash2 size={16} className="mr-2" /> Eliminar mes</>
              )}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
