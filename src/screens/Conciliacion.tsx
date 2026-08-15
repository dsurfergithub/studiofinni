import React, { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/storage/store';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { ChevronLeft, Upload, Check, ShieldCheck, Plus, Trash2, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { conciliar, puedeSerElMismo, Conciliacion as Resultado } from '../lib/conciliacion/conciliacion';
import { parseExcelData } from '../lib/excel/parser';
import { parsePlantillaGastos } from '../lib/excel/plantilla';
import { Movimiento, Categoria } from '../lib/storage/types';
import { getDeterministaColor } from '../lib/colors';
import { playSuccess, playError } from '../lib/audio/sounds';

/** Lee un extracto de CaixaBank; si no lo es, lo intenta como plantilla de gastos. */
async function leerExtracto(bs: any, categorias: Categoria[]): Promise<{ movimientos: Movimiento[]; nombres: Map<string, string> }> {
  const nombres = new Map<string, string>();
  try {
    const r = await parseExcelData(bs);
    for (const n of r.categoriasEncontradas) {
      nombres.set(n.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'), n);
    }
    if (r.movimientos.length > 0) return { movimientos: r.movimientos, nombres };
  } catch {
    // No es un extracto de CaixaBank: probamos con la plantilla de gastos.
  }
  // Sin hashes existentes: aquí queremos TODAS las filas, no solo las nuevas.
  const p = await parsePlantillaGastos(bs, categorias, new Set<string>());
  for (const c of p.nuevasCategorias) nombres.set(c.id, c.nombre);
  if (p.movimientos.length === 0) {
    throw new Error('No he encontrado movimientos. Sube el extracto del banco (.xlsx) o la plantilla de gastos rellenada.');
  }
  return { movimientos: p.movimientos, nombres };
}

export function Conciliacion({ onBack }: { onBack?: () => void }) {
  const { state, addMovimiento, addCategoria, deleteMovimientos } = useStore();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [banco, setBanco] = useState<Movimiento[] | null>(null);
  const [nombresCat, setNombresCat] = useState<Map<string, string>>(new Map());
  const [cargando, setCargando] = useState(false);
  const [aBorrar, setABorrar] = useState<Set<string>>(new Set());
  const [aAnadir, setAAnadir] = useState<Set<string>>(new Set());
  const [verCasados, setVerCasados] = useState(false);

  const res: Resultado | null = useMemo(
    () => (banco ? conciliar(state.movimientos, banco) : null),
    [state.movimientos, banco]
  );

  const subir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const { movimientos, nombres } = await leerExtracto(evt.target?.result, state.categorias);
        const r = conciliar(state.movimientos, movimientos);
        setBanco(movimientos);
        setNombresCat(nombres);
        // Lo que falta se marca solo: añadirlo es seguro y es el motivo de estar aquí.
        // Salvo lo que también sobra por el mismo importe: eso huele a la misma operación
        // con otra fecha, y añadirla la duplicaría de verdad. Esa la decides tú.
        // Lo que sobra tampoco se marca: borrar es irreversible.
        setAAnadir(new Set(r.faltanEnApp.filter(m => !puedeSerElMismo(r, m)).map(m => m.id)));
        setABorrar(new Set());
        playSuccess();
        toast(`${movimientos.length} líneas leídas del extracto.`, 'ok');
      } catch (err) {
        playError();
        toast((err as Error).message || 'No se pudo leer el archivo.', 'error');
      } finally {
        setCargando(false);
      }
    };
    reader.readAsBinaryString(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const anadirFaltantes = () => {
    if (!res) return;
    const movs = res.faltanEnApp.filter(m => aAnadir.has(m.id));
    if (movs.length === 0) return;
    const existentes = new Set(state.categorias.map(c => c.id));
    for (const m of movs) {
      if (m.categoria && !existentes.has(m.categoria)) {
        const nombre = nombresCat.get(m.categoria) || m.categoria;
        addCategoria({ id: m.categoria, nombre, color: getDeterministaColor(nombre), tipo: 'ambos' });
        existentes.add(m.categoria);
      }
      addMovimiento(m);
    }
    setBanco(null);
    setAAnadir(new Set());
    playSuccess();
    toast(`${movs.length} movimientos añadidos desde el extracto. Vuelve a subirlo para comprobar.`, 'ok');
  };

  const borrarSobrantes = () => {
    if (!res) return;
    const ids = res.sobranEnApp.filter(m => aBorrar.has(m.id)).map(m => m.id);
    if (ids.length === 0) return;
    const frase = ids.length === 1 ? 'Se borrará 1 movimiento' : `Se borrarán ${ids.length} movimientos`;
    if (!window.confirm(`${frase} que el banco no tiene. No se puede deshacer. ¿Seguir?`)) return;
    deleteMovimientos(ids);
    setABorrar(new Set());
    playSuccess();
    toast(`${ids.length} movimiento${ids.length === 1 ? '' : 's'} borrado${ids.length === 1 ? '' : 's'}.`, 'ok');
  };

  const fila = (m: Movimiento, marcado: boolean, onToggle: () => void, tono: 'ok' | 'mal', dudoso = false) => (
    <button
      key={m.id}
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${marcado ? (tono === 'ok' ? 'bg-success/10' : 'bg-danger/10') : 'hover:bg-surface-elevated'}`}
    >
      <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${marcado ? (tono === 'ok' ? 'bg-success border-success text-white' : 'bg-danger border-danger text-white') : 'border-border'}`}>
        {marcado && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm truncate text-text">{m.concepto}</span>
        <span className="block text-[11px] font-mono text-muted">{m.fecha}</span>
        {dudoso && (
          <span className="block text-[11px] text-warning mt-0.5">
            Este importe está en las dos listas: puede ser el mismo con la fecha cambiada
          </span>
        )}
      </span>
      <span className={`font-mono text-sm font-bold flex-shrink-0 ${m.importe > 0 ? 'text-success' : 'text-text'}`}>
        {m.importe > 0 ? '+' : ''}{formatCurrency(m.importe)}
      </span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border flex items-center gap-1">
        {onBack && (
          <button onClick={onBack} className="text-muted hover:text-text p-1 -ml-1 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
        )}
        <h2 className="text-xl font-bold font-display tracking-tight text-text">Comparar con el banco</h2>
      </div>

      <div className="p-4 space-y-4">
        <input type="file" accept=".xls,.xlsx" className="hidden" ref={inputRef} onChange={subir} />

        {!res && (
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-4">
            <p className="text-xs text-muted leading-relaxed">
              Sube el extracto del banco y te digo, línea a línea, qué cuadra, qué tienes apuntado que el banco
              no tiene y —lo importante— <span className="text-text font-bold">qué hay en el banco que no has apuntado</span>.
              Nada se toca sin que lo confirmes.
            </p>
            <p className="text-[11px] text-dim leading-relaxed">
              Comparo por importe y fecha, nunca por el texto: el banco no llama a las cosas como tú.
              Vale el extracto de CaixaBank (.xlsx) o la plantilla de gastos rellenada.
            </p>
            <Button className="w-full py-6 rounded-2xl" onClick={() => inputRef.current?.click()} disabled={cargando}>
              <Upload className="mr-2" size={18} /> {cargando ? 'Leyendo…' : 'Subir extracto'}
            </Button>
          </div>
        )}

        {res && (
          <>
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-muted">Extracto</span>
                <span className="font-mono text-text">{res.desde} → {res.hasta}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-surface-elevated rounded-xl py-3">
                  <p className="text-lg font-mono font-bold text-success">{res.casados.length}</p>
                  <p className="text-[10px] text-muted uppercase font-bold">Cuadran</p>
                </div>
                <div className="bg-surface-elevated rounded-xl py-3">
                  <p className="text-lg font-mono font-bold text-warning">{res.faltanEnApp.length}</p>
                  <p className="text-[10px] text-muted uppercase font-bold">Faltan</p>
                </div>
                <div className="bg-surface-elevated rounded-xl py-3">
                  <p className="text-lg font-mono font-bold text-danger">{res.sobranEnApp.length}</p>
                  <p className="text-[10px] text-muted uppercase font-bold">Sobran</p>
                </div>
              </div>
              {res.descuadre !== 0 && (
                <p className="text-xs text-muted leading-relaxed">
                  Si lo arreglas todo, el saldo se moverá{' '}
                  <span className={`font-mono font-bold ${res.descuadre > 0 ? 'text-success' : 'text-danger'}`}>
                    {res.descuadre > 0 ? '+' : ''}{formatCurrency(res.descuadre)}
                  </span>.
                </p>
              )}
              <button onClick={() => { setBanco(null); setAAnadir(new Set()); setABorrar(new Set()); }} className="text-[11px] font-bold text-accent">
                Subir otro extracto
              </button>
            </div>

            {res.faltanEnApp.length === 0 && res.sobranEnApp.length === 0 && (
              <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
                <ShieldCheck size={32} className="text-success" />
                <p className="font-bold text-text text-sm">Todo cuadra con el banco</p>
                <p className="text-xs text-muted">Las {res.casados.length} líneas del extracto están apuntadas, ni una de más.</p>
              </div>
            )}

            {res.faltanEnApp.length > 0 && (
              <div className="bg-surface border border-warning/30 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-bold text-text">Está en el banco y no lo tienes apuntado</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {res.faltanEnApp.length} línea{res.faltanEnApp.length === 1 ? '' : 's'} ·{' '}
                    <span className="font-mono">{res.totalFalta > 0 ? '+' : ''}{formatCurrency(res.totalFalta)}</span>
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {res.faltanEnApp.map(m => fila(m, aAnadir.has(m.id), () => toggle(aAnadir, setAAnadir, m.id), 'ok', puedeSerElMismo(res, m)))}
                </div>
                <div className="p-3 border-t border-border">
                  <Button className="w-full py-5 rounded-xl" onClick={anadirFaltantes} disabled={aAnadir.size === 0}>
                    <Plus className="mr-2" size={16} /> Añadir {aAnadir.size}
                  </Button>
                </div>
              </div>
            )}

            {res.sobranEnApp.length > 0 && (
              <div className="bg-surface border border-danger/30 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-bold text-text">Lo tienes apuntado y el banco no lo tiene</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {res.sobranEnApp.length} apunte{res.sobranEnApp.length === 1 ? '' : 's'} ·{' '}
                    <span className="font-mono">{res.totalSobra > 0 ? '+' : ''}{formatCurrency(res.totalSobra)}</span> · repetidos, o gastos en efectivo que el banco no ve
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {res.sobranEnApp.map(m => fila(m, aBorrar.has(m.id), () => toggle(aBorrar, setABorrar, m.id), 'mal', puedeSerElMismo(res, m)))}
                </div>
                <div className="p-3 border-t border-border">
                  <Button variant="danger" className="w-full py-5 rounded-xl" onClick={borrarSobrantes} disabled={aBorrar.size === 0}>
                    <Trash2 className="mr-2" size={16} /> Borrar {aBorrar.size}
                  </Button>
                </div>
              </div>
            )}

            {res.casados.length > 0 && (
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <button onClick={() => setVerCasados(v => !v)} className="w-full px-4 py-3 flex justify-between items-center hover:bg-surface-elevated transition-colors">
                  <span className="text-sm font-bold text-text">{res.casados.length} cuadran</span>
                  <ChevronDown size={18} className={`text-muted transition-transform ${verCasados ? 'rotate-180' : ''}`} />
                </button>
                {verCasados && (
                  <div className="divide-y divide-border border-t border-border">
                    {res.casados.map(p => (
                      <div key={p.banco.id} className="px-4 py-3 flex items-center gap-3">
                        <Check size={16} className="text-success flex-shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm truncate text-text">{p.app.concepto}</span>
                          <span className="block text-[11px] font-mono text-muted truncate">
                            {p.app.fecha} · banco: {p.banco.concepto}
                            {p.desfase > 0 ? ` (${p.desfase}d)` : ''}
                          </span>
                        </span>
                        <span className="font-mono text-sm text-muted flex-shrink-0">{formatCurrency(p.banco.importe)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
