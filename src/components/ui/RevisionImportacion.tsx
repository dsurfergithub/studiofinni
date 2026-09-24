import React, { useMemo, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { cn, formatCurrency } from '../../lib/utils';
import { getDeterministaColor } from '../../lib/colors';
import { normalizarConcepto } from '../../lib/categorias/sugerencias';
import { Categoria, Movimiento, ReglaCategoria } from '../../lib/storage/types';
import { crearRegla } from '../../lib/categorias/reglas';
import {
  Propuesta, OpcionCategoria, GrupoImport, Origen, ETIQUETA_ORIGEN, SIN_CLASIFICAR, construirImportacion,
} from '../../lib/importacion/agrupar';

const NUEVA = '__nueva__';
const VARIAS = '__varias__';
const POR_PAGINA = 30;
/** Categorías cajón de sastre: estar ahí es casi como no tener categoría. */
const RE_GENERICA = /^(otr[oa]s|varios|varias|sin clasificar)\b|\(otros\)/;

type Filtro = 'revisar' | 'todos';

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(2, 4)}`;

/** Selector de categoría: las tuyas, las que se crearán y la opción de crear otra. */
function SelectorCategoria({
  valor, opciones, onChange, compacto, varias,
}: {
  valor: string;
  opciones: OpcionCategoria[];
  onChange: (id: string) => void;
  compacto?: boolean;
  varias?: boolean;
}) {
  const tuyas = opciones.filter(o => !o.nueva);
  const nuevas = opciones.filter(o => o.nueva);
  const color = opciones.find(o => o.id === valor)?.color;
  return (
    <div className="relative flex-1 min-w-0">
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none"
        style={{ backgroundColor: varias ? 'transparent' : color, border: varias ? '1px dashed var(--color-muted)' : undefined }}
      />
      {/* text-base = 16px: por debajo, iOS Safari hace zoom al enfocar. */}
      <select
        value={varias ? VARIAS : valor}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'w-full appearance-none bg-surface-elevated border border-border rounded-xl pl-8 pr-3 text-text focus:outline-none focus:border-accent truncate',
          compacto ? 'h-9 text-sm' : 'h-11 text-base',
          valor === SIN_CLASIFICAR && !varias && 'border-warning/60'
        )}
      >
        {varias && <option value={VARIAS} disabled>Varias categorías</option>}
        {tuyas.length > 0 && (
          <optgroup label="Tus categorías">
            {tuyas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </optgroup>
        )}
        {nuevas.length > 0 && (
          <optgroup label="Se crean al importar">
            {nuevas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </optgroup>
        )}
        <option value={NUEVA}>＋ Crear otra categoría…</option>
      </select>
    </div>
  );
}

/**
 * Revisión previa a importar un extracto. En vez de volcarlo todo de golpe, los
 * movimientos se agrupan por comercio o persona con una categoría ya propuesta
 * (la de otras veces, la del banco o la que delata el nombre). Se corrige un grupo
 * entero de un toque y, si hace falta, cada movimiento suelto dentro del grupo.
 */
export function RevisionImportacion({
  isOpen,
  propuesta,
  yaEstaban,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  propuesta: Propuesta | null;
  /** Movimientos del archivo que ya estaban en la app y no se vuelven a importar. */
  yaEstaban: number;
  onCancel: () => void;
  onConfirm: (movimientos: Movimiento[], nuevasCategorias: Categoria[], nuevasReglas: ReglaCategoria[]) => void;
}) {
  const [asignacion, setAsignacion] = useState<Record<string, string>>({});
  const [opciones, setOpciones] = useState<OpcionCategoria[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  // Los grupos del filtro "por revisar" se fijan al elegirlo: si desaparecieran al
  // clasificarlos, la lista saltaría bajo el dedo a cada cambio.
  const [fijados, setFijados] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [limite, setLimite] = useState(POR_PAGINA);
  // Grupos cuya categoría se guardará como regla para las próximas importaciones.
  const [recordar, setRecordar] = useState<Set<string>>(new Set());

  const porId = useMemo(() => new Map((propuesta?.movimientos || []).map(m => [m.id, m])), [propuesta]);

  /**
   * Grupos que merecen un vistazo: los que tienen algo sin clasificar, los que el banco
   * reparte en varias categorías y los que caen en un cajón de sastre («Otros gastos»).
   */
  const pendientesDe = (asig: Record<string, string>, grupos: GrupoImport[], ops: OpcionCategoria[]) => {
    const generica = new Set(ops.filter(o => o.id === SIN_CLASIFICAR || RE_GENERICA.test(normalizarConcepto(o.nombre))).map(o => o.id));
    return new Set(grupos.filter(g => {
      const cats = new Set(g.ids.map(id => asig[id]));
      return cats.size > 1 || Array.from(cats).some(c => generica.has(c));
    }).map(g => g.clave));
  };

  // Al abrir con una propuesta nueva se parte de lo propuesto.
  const [ultima, setUltima] = useState<Propuesta | null>(null);
  if (propuesta !== ultima) {
    setUltima(propuesta);
    if (propuesta) {
      const pendientes = pendientesDe(propuesta.asignacion, propuesta.grupos, propuesta.opciones);
      setAsignacion(propuesta.asignacion);
      setRecordar(new Set());
      setOpciones(propuesta.opciones);
      setFiltro(pendientes.size > 0 ? 'revisar' : 'todos');
      setFijados(pendientes);
      setBusqueda('');
      setAbiertos(new Set());
      setLimite(POR_PAGINA);
    }
  }

  if (!propuesta) return null;

  const total = propuesta.movimientos.length;
  const sinCategoria = propuesta.movimientos.filter(m => asignacion[m.id] === SIN_CLASIFICAR).length;
  const pendientesAhora = pendientesDe(asignacion, propuesta.grupos, opciones);
  const nPorRevisar = pendientesAhora.size;
  const fechas = propuesta.movimientos.map(m => m.fecha).sort();

  const q = normalizarConcepto(busqueda);
  const visibles = propuesta.grupos.filter(g => {
    if (filtro === 'revisar' && !fijados.has(g.clave)) return false;
    if (!q) return true;
    return normalizarConcepto(`${g.etiqueta} ${g.ejemplo}`).includes(q);
  });

  const elegirFiltro = (f: Filtro) => {
    setFiltro(f);
    setLimite(POR_PAGINA);
    if (f === 'revisar') setFijados(pendientesAhora);
  };

  /** Resuelve el valor del selector: una categoría, o crear una nueva preguntando el nombre. */
  const resolverEleccion = (valor: string): string | null => {
    if (valor === VARIAS) return null;
    if (valor !== NUEVA) return valor;
    const nombre = window.prompt('Nombre de la nueva categoría')?.trim();
    if (!nombre) return null;
    const existente = opciones.find(o => normalizarConcepto(o.nombre) === normalizarConcepto(nombre));
    if (existente) return existente.id;
    let id = nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') || 'categoria';
    while (opciones.some(o => o.id === id)) id += '-2';
    setOpciones(prev => [...prev, { id, nombre, color: getDeterministaColor(nombre), nueva: true }]);
    return id;
  };

  const asignar = (ids: string[], valor: string) => {
    const id = resolverEleccion(valor);
    if (!id) return;
    setAsignacion(prev => {
      const next = { ...prev };
      ids.forEach(i => { next[i] = id; });
      return next;
    });
  };

  const alternar = (clave: string) =>
    setAbiertos(prev => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });

  const confirmar = () => {
    const r = construirImportacion(propuesta.movimientos, asignacion, opciones);
    // Una regla por grupo marcado, con la categoría que tenga al final (si es una sola).
    const reglas: ReglaCategoria[] = [];
    for (const g of propuesta.grupos) {
      if (!recordar.has(g.clave)) continue;
      const cats = new Set(g.ids.map(id => asignacion[id]));
      const [cat] = Array.from(cats);
      if (cats.size === 1 && cat !== SIN_CLASIFICAR) reglas.push(crearRegla(g.clave, cat));
    }
    onConfirm(r.movimientos, r.nuevasCategorias, reglas);
  };

  /** El origen que más pesa en el grupo, para la etiqueta de "de dónde sale". */
  const origenDe = (g: GrupoImport): Origen => {
    const cuenta = new Map<Origen, number>();
    g.ids.forEach(id => {
      const o = propuesta.origen[id];
      cuenta.set(o, (cuenta.get(o) || 0) + 1);
    });
    return Array.from(cuenta.entries()).sort((a, b) => b[1] - a[1])[0][0];
  };

  return (
    <Sheet isOpen={isOpen} onClose={onCancel} title="Revisa las categorías">
      <div className="space-y-4 pb-6 mt-1 text-left">
        <p className="text-xs text-muted leading-relaxed">
          <strong className="text-text">{total}</strong> movimientos nuevos
          {fechas.length > 0 && <> del {fechaCorta(fechas[0])} al {fechaCorta(fechas[fechas.length - 1])}</>}.
          Los he juntado en <strong className="text-text">{propuesta.grupos.length}</strong> grupos por comercio
          o persona, cada uno con una categoría propuesta. Cámbiala en un grupo y se aplica a todos sus
          movimientos; ábrelo para cambiar uno suelto.
          {yaEstaban > 0 && <> {yaEstaban} ya estaban en la app y no se repiten.</>}
        </p>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-muted uppercase tracking-wider">Con categoría</span>
            <span className={sinCategoria === 0 ? 'text-success' : 'text-text'}>
              {total - sinCategoria} de {total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${total > 0 ? ((total - sinCategoria) / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {([['revisar', `Por revisar · ${nPorRevisar}`], ['todos', `Todos · ${propuesta.grupos.length}`]] as [Filtro, string][]).map(([f, texto]) => (
            <button
              key={f}
              type="button"
              onClick={() => elegirFiltro(f)}
              className={cn(
                'flex-1 h-9 rounded-xl text-xs font-bold border transition-colors',
                filtro === f ? 'bg-accent-soft text-accent border-accent-soft' : 'bg-transparent text-muted border-border hover:text-text'
              )}
            >
              {texto}
            </button>
          ))}
        </div>

        {filtro === 'revisar' && (
          <p className="text-[11px] text-dim -mt-2">
            Grupos sin categoría, con movimientos en varias o que han caído en un «Otros…».
          </p>
        )}

        <label className="relative block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
          <input
            type="search"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setLimite(POR_PAGINA); }}
            placeholder="Buscar comercio o persona"
            className="w-full h-11 bg-surface-elevated border border-border rounded-xl pl-9 pr-3 text-base text-text placeholder:text-dim focus:outline-none focus:border-accent"
          />
        </label>

        {visibles.length === 0 && (
          <p className="text-center text-sm text-muted py-6">
            {filtro === 'revisar' && !q ? 'Nada pendiente: cada grupo tiene una categoría clara.' : 'Ningún grupo coincide.'}
          </p>
        )}

        <div className="space-y-2">
          {visibles.slice(0, limite).map(g => {
            const cats = new Set(g.ids.map(id => asignacion[id]));
            const varias = cats.size > 1;
            const valor = varias ? '' : Array.from(cats)[0];
            const abierto = abiertos.has(g.clave);
            const resuelto = !pendientesAhora.has(g.clave);
            const origen = origenDe(g);
            const cambiado = g.ids.some(id => asignacion[id] !== propuesta.asignacion[id]);
            return (
              <div key={g.clave} className="bg-surface-elevated/60 border border-border rounded-2xl p-3 space-y-2">
                <button type="button" onClick={() => alternar(g.clave)} className="w-full flex items-start gap-2 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text truncate flex items-center gap-1.5">
                      {resuelto && fijados.has(g.clave) && <Check size={14} className="text-success flex-shrink-0" />}
                      {g.etiqueta}
                    </p>
                    <p className="text-[11px] text-dim truncate">{g.ejemplo}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn('text-sm font-mono font-bold', g.total >= 0 ? 'text-success' : 'text-text')}>
                      {formatCurrency(g.total)}
                    </p>
                    <p className="text-[11px] text-muted flex items-center justify-end gap-0.5">
                      {g.ids.length} mov.
                      <ChevronDown size={14} className={cn('transition-transform', abierto && 'rotate-180')} />
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <SelectorCategoria valor={valor} varias={varias} opciones={opciones} onChange={v => asignar(g.ids, v)} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-dim">
                    {cambiado ? 'elegido por ti' : ETIQUETA_ORIGEN[origen]}
                    {opciones.find(o => o.id === valor)?.excluirDeAnalisis && ' · no cuenta en gastos'}
                  </p>
                  {!varias && valor !== SIN_CLASIFICAR && origen !== 'regla' && (
                    <button
                      type="button"
                      aria-pressed={recordar.has(g.clave)}
                      onClick={() => setRecordar(prev => {
                        const next = new Set(prev);
                        if (next.has(g.clave)) next.delete(g.clave);
                        else next.add(g.clave);
                        return next;
                      })}
                      className={cn(
                        'flex items-center gap-1 px-2 h-7 rounded-lg text-[11px] font-bold border transition-colors flex-shrink-0',
                        recordar.has(g.clave) ? 'bg-accent-soft text-accent border-accent-soft' : 'text-muted border-border hover:text-text'
                      )}
                    >
                      {recordar.has(g.clave) && <Check size={12} />}
                      Recordar siempre
                    </button>
                  )}
                </div>

                {abierto && (
                  <div className="space-y-1.5 pt-1 border-t border-border">
                    {g.ids.map(id => {
                      const m = porId.get(id)!;
                      return (
                        <div key={id} className="pt-1.5 space-y-1">
                          <div className="flex justify-between gap-2 text-xs">
                            <span className="text-text truncate">{m.concepto}</span>
                            <span className="font-mono text-muted flex-shrink-0">{formatCurrency(m.importe)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-dim w-14 flex-shrink-0">{fechaCorta(m.fecha)}</span>
                            <SelectorCategoria compacto valor={asignacion[id]} opciones={opciones} onChange={v => asignar([id], v)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {visibles.length > limite && (
          <Button variant="secondary" onClick={() => setLimite(l => l + POR_PAGINA)} className="w-full">
            Ver más grupos ({visibles.length - limite})
          </Button>
        )}

        <div className="flex flex-col gap-3 pt-2 sticky bottom-0 bg-surface pb-1">
          <Button onClick={confirmar} disabled={total === 0} className="w-full h-14 text-lg font-bold">
            Importar {total}
          </Button>
          {recordar.size > 0 && (
            <p className="text-[11px] text-accent text-center -mt-1">
              {recordar.size === 1 ? 'Se guarda 1 regla' : `Se guardan ${recordar.size} reglas`} para la próxima vez (Ajustes → Reglas).
            </p>
          )}
          <p className="text-[11px] text-dim text-center -mt-1">
            {sinCategoria > 0
              ? `${sinCategoria} entrarán como «Sin clasificar»: podrás cambiarlos luego desde Movimientos.`
              : 'Todo clasificado. Siempre puedes cambiar una categoría desde Movimientos.'}
          </p>
          <Button variant="ghost" onClick={onCancel} className="w-full h-12 text-base">
            Cancelar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
