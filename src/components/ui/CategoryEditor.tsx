import React, { useState, useEffect } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { ColorPicker } from './ColorPicker';
import { IconPicker } from './IconPicker';
import { Categoria, MacroTipo } from '../../lib/storage/types';
import { MACRO_OPCIONES } from '../../lib/plan/plan';
import { PALETA_COLORES } from '../../lib/colors';
import { useStore } from '../../lib/storage/store';
import { v4 as uuidv4 } from 'uuid';

interface CategoryEditorProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Categoria | null;
}

export function CategoryEditor({ isOpen, onClose, category }: CategoryEditorProps) {
  const { addCategoria, updateCategoria, deleteCategoria } = useStore();

  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(PALETA_COLORES[0]);
  const [icono, setIcono] = useState('tag');
  const [tipo, setTipo] = useState<'gasto' | 'ingreso' | 'ambos'>('gasto');
  const [macro, setMacro] = useState<MacroTipo>('variable');
  const [excluir, setExcluir] = useState(false);

  useEffect(() => {
    if (category) {
      setNombre(category.nombre);
      setColor(category.color);
      setIcono(category.icono || 'tag');
      setTipo(category.tipo);
      setMacro(category.macro || 'variable');
      setExcluir(!!category.excluirDeAnalisis);
    } else {
      setNombre('');
      setColor(PALETA_COLORES[0]);
      setIcono('tag');
      setTipo('gasto');
      setMacro('variable');
      setExcluir(false);
    }
  }, [category, isOpen]);

  const handleSave = () => {
    if (!nombre.trim()) return;

    if (category) {
      updateCategoria(category.id, {
        nombre, color, icono, tipo, macro, excluirDeAnalisis: excluir
      });
    } else {
      addCategoria({
        id: uuidv4(),
        nombre,
        color,
        icono,
        tipo,
        macro,
        excluirDeAnalisis: excluir
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (category && window.confirm(`¿Seguro que quieres borrar ${category.nombre}? Los movimientos pasarán a "Sin clasificar".`)) {
      deleteCategoria(category.id);
      onClose();
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={category ? "Editar Categoría" : "Nueva Categoría"}>
      <div className="space-y-6 pb-6 mt-4">
        {/* Nombre */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Nombre</label>
          <input 
            type="text" 
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej. Alimentación"
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
          />
        </div>

        {/* Tipo */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Tipo</label>
          <div className="flex gap-2">
            {(['gasto', 'ingreso', 'ambos'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${tipo === t ? 'bg-surface-elevated text-text border border-border' : 'bg-surface text-muted border border-transparent hover:text-text'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Macro-grupo (solo tiene sentido para categorías con gastos) */}
        {tipo !== 'ingreso' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">¿Qué tipo de gasto es?</label>
            <div className="grid gap-2">
              {MACRO_OPCIONES.map(op => (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => setMacro(op.valor)}
                  className={`flex flex-col items-start p-3 rounded-xl text-left transition-all ${macro === op.valor ? 'bg-accent/15 border-2 border-accent' : 'bg-surface border border-border'}`}
                >
                  <span className={`text-sm font-bold ${macro === op.valor ? 'text-text' : 'text-muted'}`}>{op.nombre}</span>
                  <span className="text-[11px] text-muted leading-tight">{op.ayuda}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted px-1">Sirve para que el Plan anual agrupe tus gastos reales automáticamente.</p>
          </div>
        )}

        {/* Fuera del análisis: traspasos entre tus cuentas y similares */}
        <button
          type="button"
          role="switch"
          aria-checked={!excluir}
          onClick={() => setExcluir(e => !e)}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-text">Cuenta en ingresos y gastos</span>
            <span className="block text-[11px] text-muted leading-tight">
              {excluir
                ? 'No cuenta: solo mueve el saldo. Para traspasos entre tus cuentas, que no son dinero que ganas ni gastas.'
                : 'Sale en Inicio, Presupuesto, Plan e Insights. Desactívalo para traspasos entre tus cuentas.'}
            </span>
          </span>
          <span className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${excluir ? 'bg-border' : 'bg-accent'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${excluir ? 'left-0.5' : 'left-[22px]'}`} />
          </span>
        </button>

        {/* Color */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Color</label>
          <div className="bg-surface-elevated p-4 rounded-xl">
             <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        {/* Icon */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Icono</label>
          <div className="bg-surface-elevated p-4 rounded-xl">
             <IconPicker value={icono} onChange={setIcono} />
          </div>
        </div>

        <div className="pt-4 flex flex-col gap-3">
          <Button onClick={handleSave} className="w-full h-12 text-base font-bold">Guardar</Button>
          {category && (
            <Button variant="danger" onClick={handleDelete} className="w-full h-12 text-base font-bold bg-transparent border-border">Eliminar Categoría</Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
