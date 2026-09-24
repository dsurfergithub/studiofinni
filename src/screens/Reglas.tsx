import React, { useMemo, useState } from 'react';
import { ChevronLeft, Trash2, Wand2 } from 'lucide-react';
import { useStore } from '../lib/storage/store';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { playSuccess } from '../lib/audio/sounds';
import { crearRegla, fusionarReglas, normalizarTextoRegla, pendientesDeRegla, aplicaRegla } from '../lib/categorias/reglas';
import { ReglaCategoria } from '../lib/storage/types';

/**
 * Reglas «si el concepto contiene X → categoría Y». Se aplican al importar extractos,
 * por encima de lo que diga el banco. Aquí se crean, se borran y se pueden aplicar
 * también a los movimientos que ya tienes.
 */
export function Reglas({ onBack }: { onBack?: () => void }) {
  const { state, updateState } = useStore();
  const { toast } = useToast();
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState(state.categorias[0]?.id || '');

  const reglas = useMemo(
    () => [...(state.reglas || [])].sort((a, b) => a.texto.localeCompare(b.texto, 'es')),
    [state.reglas]
  );
  const nombreCat = (id: string) => state.categorias.find(c => c.id === id);

  const textoNormalizado = normalizarTextoRegla(texto);
  const coincidencias = useMemo(
    () => (textoNormalizado.length >= 2
      ? state.movimientos.filter(m => aplicaRegla({ id: '', texto: textoNormalizado, categoria: '', creada: 0 }, m.concepto)).length
      : 0),
    [textoNormalizado, state.movimientos]
  );

  const anadir = () => {
    if (textoNormalizado.length < 2 || !categoria) return;
    updateState({ reglas: fusionarReglas(state.reglas || [], [crearRegla(texto, categoria)]) });
    setTexto('');
    playSuccess();
    toast('Regla guardada. Se aplicará en tus próximas importaciones.', 'ok');
  };

  const borrar = (r: ReglaCategoria) => {
    if (!window.confirm(`¿Borrar la regla «${r.texto}»? Los movimientos ya categorizados no cambian.`)) return;
    updateState({ reglas: (state.reglas || []).filter(x => x.id !== r.id) });
  };

  const aplicar = (r: ReglaCategoria) => {
    const ids = new Set(pendientesDeRegla(r, state.movimientos).map(m => m.id));
    if (ids.size === 0) return;
    updateState({ movimientos: state.movimientos.map(m => (ids.has(m.id) ? { ...m, categoria: r.categoria } : m)) });
    playSuccess();
    toast(`${ids.size} movimientos pasados a ${nombreCat(r.categoria)?.nombre || 'la categoría'}.`, 'ok');
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border flex items-center gap-1">
        {onBack && (
          <button onClick={onBack} className="text-muted hover:text-text p-1 -ml-1 rounded-full transition-colors" aria-label="Volver">
            <ChevronLeft size={24} />
          </button>
        )}
        <h2 className="text-xl font-bold font-display tracking-tight text-text">Reglas</h2>
      </div>

      <div className="p-4 space-y-6">
        <p className="text-xs text-muted leading-relaxed">
          Cuando importes un extracto, lo que contenga el texto irá siempre a esa categoría, diga lo
          que diga el banco. También puedes crearlas al importar con «Recordar siempre».
        </p>

        <section className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Si el concepto contiene</span>
            {/* text-base = 16px: por debajo, iOS Safari hace zoom al enfocar. */}
            <input
              type="text"
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Ej. galp, netflix, bizum a pedro"
              className="w-full h-11 bg-surface-elevated border border-border rounded-xl px-3 text-base text-text placeholder:text-dim focus:outline-none focus:border-accent"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Va a</span>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="w-full h-11 bg-surface-elevated border border-border rounded-xl px-3 text-base text-text focus:outline-none focus:border-accent"
            >
              {state.categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          {textoNormalizado.length >= 2 && (
            <p className="text-[11px] text-dim">Coincide con {coincidencias} de tus movimientos.</p>
          )}
          <Button onClick={anadir} disabled={textoNormalizado.length < 2 || !categoria} className="w-full">
            Guardar regla
          </Button>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider pl-1">
            Tus reglas {reglas.length > 0 && `· ${reglas.length}`}
          </h3>
          {reglas.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Aún no tienes reglas.</p>
          ) : reglas.map(r => {
            const cat = nombreCat(r.categoria);
            const pendientes = pendientesDeRegla(r, state.movimientos).length;
            return (
              <div key={r.id} className="bg-surface border border-border rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text truncate">«{r.texto}»</p>
                    <p className="text-[11px] text-muted flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color || '#7a7a92' }} />
                      {cat?.nombre || 'Categoría borrada'}
                    </p>
                  </div>
                  <button
                    onClick={() => borrar(r)}
                    className="p-2 rounded-full text-muted hover:text-danger transition-colors"
                    aria-label={`Borrar regla ${r.texto}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                {pendientes > 0 && cat && (
                  <button
                    onClick={() => aplicar(r)}
                    className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl bg-accent-soft text-accent text-xs font-bold"
                  >
                    <Wand2 size={14} />
                    Aplicar a {pendientes} {pendientes === 1 ? 'movimiento que ya tienes' : 'movimientos que ya tienes'}
                  </button>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
