import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useStore } from '../../lib/storage/store';
import { Sheet } from './Sheet';
import { playClick } from '../../lib/audio/sounds';

interface FinMesSelectorProps {
  selectedMesId: string;
  onChange: (id: string) => void;
}

export function FinMesSelector({ selectedMesId, onChange }: FinMesSelectorProps) {
  const { getMesesActivos } = useStore();
  const meses = getMesesActivos();
  const [sheetOpen, setSheetOpen] = useState(false);

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
            <button
              key={m.id}
              onClick={() => {
                onChange(m.id);
                setSheetOpen(false);
              }}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                m.id === current.id ? 'bg-accent/10 border-accent/30 text-text' : 'bg-surface border-border hover:bg-surface-elevated text-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar size={20} className={m.id === current.id ? 'text-accent' : ''} />
                <div className="text-left">
                  <div className={`font-semibold capitalize ${m.id === current.id ? 'text-text' : ''}`}>{m.nombre.toLowerCase()}</div>
                  <div className="text-xs font-mono opacity-80">{m.inicio} — {m.fin}</div>
                </div>
              </div>
              {m.esEstimado && <span className="text-xs px-2 py-1 bg-surface-elevated rounded-md font-medium">Estimado</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
