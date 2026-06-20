import React, { useState } from 'react';
import { useStore } from '../lib/storage/store';
import { FinMesSelector } from '../components/ui/FinMesSelector';
import { formatCurrency, getLocalFechaIso } from '../lib/utils';
import { Plus, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { playClick } from '../lib/audio/sounds';
import { MovimientoEditor } from '../components/ui/MovimientoEditor';
import { Movimiento } from '../lib/storage/types';

interface MovimientosProps {
  selectedMesId: string;
  onChangeMes: (id: string) => void;
}

export function Movimientos({ selectedMesId, onChangeMes }: MovimientosProps) {
  const { state, getMesesActivos } = useStore();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMov, setEditingMov] = useState<Movimiento | null>(null);
  
  const activeMeses = getMesesActivos();
  const cMes = activeMeses.find(m => m.id === selectedMesId) || activeMeses[0];

  const getDefaultDate = () => {
    const today = getLocalFechaIso();
    if (cMes && today >= cMes.inicio && today <= cMes.fin) {
      return today;
    }
    return cMes?.fin || today;
  };

  const handleAdd = () => {
    setEditingMov(null);
    setEditorOpen(true);
  };

  const handleEdit = (m: Movimiento) => {
    setEditingMov(m);
    setEditorOpen(true);
  };

  const filtered = state.movimientos.filter(m => {
    if (cMes) {
      if (m.fecha < cMes.inicio || m.fecha > cMes.fin) return false;
    }
    if (catFilter && m.categoria !== catFilter) {
      return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return m.concepto.toLowerCase().includes(s) || 
             (m.tags && m.tags.some(t => t.toLowerCase().includes(s))) ||
             state.categorias.find(c => c.id === m.categoria)?.nombre.toLowerCase().includes(s);
    }
    return true;
  });

  const activeCategoriasInMonth = Array.from(new Set(
    state.movimientos
      .filter(m => !cMes || (m.fecha >= cMes.inicio && m.fecha <= cMes.fin))
      .map(m => m.categoria)
  )).map(catId => state.categorias.find(c => c.id === catId)).filter(Boolean) as any[];

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 scroll-area h-screen overflow-y-auto w-full relative">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <FinMesSelector selectedMesId={selectedMesId} onChange={onChangeMes} />
        <div className="relative mt-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input 
            type="text"
            placeholder="Buscar movimientos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-full pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-text placeholder-muted transition-all"
          />
        </div>
        
        {activeCategoriasInMonth.length > 0 && (
          <div className="flex gap-2 overflow-x-auto mt-4 pb-2 no-scrollbar px-1">
            <button
              onClick={() => setCatFilter(null)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${catFilter === null ? 'bg-text text-bg' : 'bg-surface border border-border text-text hover:bg-surface-elevated'}`}
            >
              Todos
            </button>
            {activeCategoriasInMonth.map(c => (
              <button
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${catFilter === c.id ? 'bg-text text-bg' : 'bg-surface border border-border text-text hover:bg-surface-elevated'}`}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center text-muted font-mono py-10 text-sm">0 movimientos encontrados.</p>
        ) : (
          filtered.map(m => {
            const cat = state.categorias.find(c => c.id === m.categoria);
            return (
              <button 
                key={m.id} 
                onClick={() => handleEdit(m)}
                className="w-full text-left bg-surface rounded-2xl p-4 flex justify-between items-center border border-border hover:border-accent/40 hover:bg-surface-elevated transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color || '#333' }} />
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-text truncate mb-1">{m.concepto}</p>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted">
                      <span>{m.fecha}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span className="truncate">{cat?.nombre || 'Sin clasificar'}</span>
                    </div>
                  </div>
                </div>
                <div className={`font-mono text-lg font-bold ${m.importe > 0 ? 'text-success' : 'text-text'}`}>
                  {m.importe > 0 ? '+' : ''}{formatCurrency(m.importe)}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="fixed bottom-20 right-4 z-30">
        <button
          onClick={() => { playClick(); handleAdd(); }}
          aria-label="Añadir movimiento"
          className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center animate-neon-pulse hover:scale-110 active:scale-95 transition-transform duration-200"
        >
          <Plus size={30} strokeWidth={2.5} />
        </button>
      </div>

      <MovimientoEditor 
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        movimiento={editingMov}
        defaultDate={getDefaultDate()}
      />
    </div>
  );
}
