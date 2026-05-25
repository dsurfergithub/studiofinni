import React, { useState } from 'react';
import { useStore } from '../lib/storage/store';
import { Plus } from 'lucide-react';
import { CategoryEditor } from '../components/ui/CategoryEditor';
import { Categoria } from '../lib/storage/types';
import * as LucideIcons from 'lucide-react';

export function Categorias() {
  const { state } = useStore();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);

  const handleEdit = (c: Categoria) => {
    setEditingCat(c);
    setEditorOpen(true);
  };

  const handleAdd = () => {
    setEditingCat(null);
    setEditorOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border flex justify-between items-center">
        <h2 className="text-xl font-bold font-mono tracking-tight text-text">Categorías</h2>
        <button onClick={handleAdd} className="text-accent hover:bg-accent-soft p-2 rounded-full transition-colors flex items-center justify-center">
          <Plus size={24} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {state.categorias.map(c => {
          const pascalName = (c.icono || 'tag').split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
          const Icon = (LucideIcons as any)[pascalName] || LucideIcons.Tag;

          return (
            <button
              key={c.id}
              onClick={() => handleEdit(c)}
              className="w-full bg-surface rounded-2xl p-4 flex items-center justify-between border border-border hover:border-accent/40 hover:bg-surface-elevated transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                  <Icon size={20} />
                </div>
                <span className="font-bold text-text truncate max-w-[200px]">{c.nombre}</span>
              </div>
              <span className="text-xs text-muted uppercase tracking-wider font-bold">{c.tipo}</span>
            </button>
          );
        })}
      </div>

      <CategoryEditor 
        isOpen={editorOpen} 
        onClose={() => setEditorOpen(false)} 
        category={editingCat}
      />
    </div>
  );
}
