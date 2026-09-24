import React, { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/storage/store';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { Novedades } from '../components/ui/Novedades';
import { APP_VERSION } from '../lib/changelog';
import { Upload, Trash2, Download, Volume2, VolumeX, CalendarPlus, Moon, Sun, Tag, Repeat, RotateCcw, ChevronRight, Clock, FileSpreadsheet, FileUp, Megaphone, Scale, CopyCheck, GitCompare } from 'lucide-react';
import { parseExcelData, ErrorColumnas, adaptar, ParsedResultado } from '../lib/excel/parser';
import { leerConMapeo, Analisis, Mapeo } from '../lib/excel/columnas';
import { MapeoColumnas } from '../components/ui/MapeoColumnas';
import { RevisionPeriodos } from '../components/ui/RevisionPeriodos';
import { RevisionImportacion } from '../components/ui/RevisionImportacion';
import { proponerCategorias, Propuesta } from '../lib/importacion/agrupar';
import { volcarExtracto, SaldoExtracto } from '../lib/importacion/aplicar';
import { descargarPlantillaGastos, parsePlantillaGastos, ResultadoPlantilla } from '../lib/excel/plantilla';
import { playSuccess, playError, soundsEnabled, setSoundsEnabled } from '../lib/audio/sounds';
import { movimientosACsv } from '../lib/export/csv';
import { generarMesesFuturos, mesesRestantesDelAnio, mesesParaCubrir, mesIdDeMovimiento } from '../lib/finmes/finmes';
import { repartirPorPeriodo, aplicarDecisiones, Decision, Reparto } from '../lib/finmes/reparto';
import { getBackups, createManualBackup, migrate } from '../lib/storage/storage';
import { formatCurrency, getLocalFechaIso } from '../lib/utils';
import { buscarDuplicados } from '../lib/duplicados/duplicados';
import { Categoria, Movimiento } from '../lib/storage/types';

const idDeCategoria = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

/** Acepta lo que teclee el usuario: «614», «614,30», «1.234,56», «-382.45». */
function parseImporte(texto: string): number | null {
  const limpio = texto.trim().replace(/[€\s]/g, '');
  if (!limpio) return null;
  // Si hay coma, manda como decimal y los puntos son separador de miles.
  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

export function Ajustes({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const plantillaInputRef = useRef<HTMLInputElement>(null);
  const { resetState, updateState, importState, state, getMesesActivos, setSelectedMesId, theme, toggleTheme, getSaldoCalculado, cuadrarConBanco } = useStore();
  const [audioEnabled, setAudioEnabled] = useState(soundsEnabled());
  const [backups, setBackups] = useState(getBackups());
  const [novedadesOpen, setNovedadesOpen] = useState(false);
  const [saldoBanco, setSaldoBanco] = useState('');
  // Archivo leído cuyas columnas no se han reconocido: se guarda para mapearlas a mano.
  // `destino` dice a qué flujo hay que devolverlo, porque el botón de extracto y el de
  // plantilla comparten la misma pantalla de mapeo.
  const [porMapear, setPorMapear] = useState<
    | { destino: 'extracto'; analisis: Analisis; filas: any[][] }
    | { destino: 'plantilla'; analisis: Analisis; filas: any[][]; datos: any }
    | null
  >(null);
  // Importación de plantilla en pausa: sus movimientos caen en más de un periodo y
  // esperamos a que el usuario diga qué hacer con los que se salen.
  const [porRevisar, setPorRevisar] = useState<{ resultado: ResultadoPlantilla; reparto: Reparto } | null>(null);
  // Extracto leído a la espera de que se revisen sus categorías.
  const [porCategorizar, setPorCategorizar] = useState<{ propuesta: Propuesta; yaEstaban: number; saldo: SaldoExtracto } | null>(null);
  const { toast } = useToast();

  const nDuplicados = useMemo(() => buscarDuplicados(state.movimientos).length, [state.movimientos]);

  const saldoApp = getSaldoCalculado();
  const saldoRealTecleado = parseImporte(saldoBanco);
  const diferencia = saldoRealTecleado === null ? null : Number((saldoRealTecleado - saldoApp).toFixed(2));

  const handleCuadrar = () => {
    if (saldoRealTecleado === null) {
      playError();
      toast('Escribe el saldo que te da el banco (p. ej. 614,30).', 'error');
      return;
    }
    const cuadre = cuadrarConBanco(saldoRealTecleado);
    setSaldoBanco('');
    playSuccess();
    if (cuadre.diferencia === 0) {
      toast('Ya cuadraba. Saldo confirmado a día de hoy.', 'ok');
    } else {
      const signo = cuadre.diferencia > 0 ? 'faltaban' : 'sobraban';
      toast(`Saldo cuadrado en ${formatCurrency(cuadre.saldoReal)}. Se ha apuntado un ajuste: ${signo} ${formatCurrency(Math.abs(cuadre.diferencia))}.`, 'ok');
    }
  };

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setSoundsEnabled(next);
    setAudioEnabled(next);
  };

  const handleCreateNextMonths = () => {
    const activeMeses = getMesesActivos();
    if (activeMeses.length === 0) { toast('Todavía no hay ningún mes del que partir.', 'error'); return; }
    const lastMes = activeMeses[0];
    const restantes = mesesRestantesDelAnio(lastMes);
    const nuevos = generarMesesFuturos(lastMes, restantes > 0 ? restantes : 12);

    const existentes = state.mesesPersonalizados || [];
    const mapa = new Map();
    existentes.forEach(m => mapa.set(m.id, m));
    nuevos.forEach(m => mapa.set(m.id, m));
    updateState({ mesesPersonalizados: Array.from(mapa.values()).sort((a, b) => b.inicio.localeCompare(a.inicio)) });

    if (nuevos.length > 0) setSelectedMesId(nuevos[0].id);
    playSuccess();
    toast(`Listo: ${nuevos.length} meses planificados hasta final de año.`, 'ok');
  };

  /**
   * Un extracto ya leído no se vuelca de golpe: se quitan los que ya estaban y el resto
   * pasa por la revisión de categorías, agrupado por comercio.
   */
  const aplicarExtracto = (parsed: ParsedResultado) => {
    const hashes = new Set(state.movimientos.map(m => m.hash));
    const nuevos = parsed.movimientos.filter(m => !hashes.has(m.hash));
    const yaEstaban = parsed.movimientos.length - nuevos.length;
    if (nuevos.length === 0) {
      toast(`Nada nuevo: los ${parsed.movimientos.length} movimientos de este archivo ya estaban en la app.`, 'info');
      return;
    }
    const nombresBanco = new Map(Array.from(parsed.categoriasEncontradas).map(n => [idDeCategoria(n), n]));
    setPorCategorizar({
      propuesta: proponerCategorias({ movimientos: nuevos, nombresBanco, categorias: state.categorias, historial: state.movimientos }),
      yaEstaban,
      saldo: { saldoActual: parsed.saldoActual, fechaSaldo: parsed.fechaSaldo },
    });
  };

  /** Fin de la revisión: movimientos, categorías, nóminas, periodos y saldo. */
  const confirmarCategorias = (movimientos: Movimiento[], nuevasCategorias: Categoria[]) => {
    if (!porCategorizar) return;
    const { saldo } = porCategorizar;
    setPorCategorizar(null);
    const { cambios, mesDestino } = volcarExtracto(state, movimientos, nuevasCategorias, saldo);
    updateState(cambios);
    if (mesDestino) setSelectedMesId(mesDestino);
    playSuccess();
    const cats = nuevasCategorias.length > 0 ? ` y ${nuevasCategorias.length} categorías nuevas` : '';
    toast(`Importados ${movimientos.length} movimientos${cats}. Periodos recalculados desde tus nóminas.`, 'ok');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        aplicarExtracto(await parseExcelData(evt.target?.result));
      } catch (err) {
        if (err instanceof ErrorColumnas) {
          // Columnas no reconocidas: que las diga el usuario en vez de rendirse.
          setPorMapear({ destino: 'extracto', analisis: err.analisis, filas: err.filas });
        } else {
          playError();
          toast((err as Error).message || 'No se pudo leer el Excel.', 'error');
        }
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmarMapeo = async (mapeo: Mapeo) => {
    if (!porMapear) return;
    const pendiente = porMapear;
    setPorMapear(null);

    if (pendiente.destino === 'plantilla') {
      const hashes = new Set<string>(state.movimientos.map(m => m.hash));
      const r = await parsePlantillaGastos(pendiente.datos, state.categorias, hashes, mapeo);
      if (r.movimientos.length === 0 && r.errores.length === 0) {
        playError();
        toast('Con esas columnas no sale ningún movimiento. Revisa cuál es la fecha.', 'error');
        return;
      }
      aplicarPlantilla(r);
      return;
    }

    const parsed = adaptar(leerConMapeo(pendiente.filas, mapeo));
    if (parsed.movimientos.length === 0) {
      playError();
      toast('Con esas columnas no sale ningún movimiento. Revisa cuál es la fecha.', 'error');
      return;
    }
    aplicarExtracto(parsed);
  };

  const handleDownloadPlantilla = async () => {
    try {
      await descargarPlantillaGastos(state.categorias);
      playSuccess();
      toast('Plantilla descargada. Rellénala y súbela con "Importar plantilla de gastos".', 'ok');
    } catch (err) {
      playError();
      toast((err as Error).message || 'No se pudo generar la plantilla.', 'error');
    }
  };

  /**
   * Los periodos que harían falta para que ningún movimiento importado quede huérfano
   * (fuera de todo periodo activo: contaría en el saldo pero no se vería en la lista).
   */
  const planificarPeriodos = (movimientos: Movimiento[]) => {
    const activeMeses = getMesesActivos();
    if (movimientos.length === 0) return { activeMeses, nuevosMeses: [], todos: activeMeses };
    const fechas = movimientos.map(m => m.fecha);
    const minFecha = fechas.reduce((a, b) => (a < b ? a : b));
    const maxFecha = fechas.reduce((a, b) => (a > b ? a : b));
    const nuevosMeses = mesesParaCubrir(activeMeses, minFecha, maxFecha);
    return { activeMeses, nuevosMeses, todos: [...activeMeses, ...nuevosMeses] };
  };

  /**
   * Punto de entrada de una plantilla ya leída. Si sus movimientos caen en más de un
   * periodo —lo normal, porque los meses de Finni van de nómina a nómina y no del 1 al
   * 31— se para aquí y se pregunta qué hacer con los que se salen, en vez de repartirlos
   * sin avisar. Con un solo periodo implicado se importa directamente.
   */
  const aplicarPlantilla = (resultado: ResultadoPlantilla) => {
    if (resultado.movimientos.length === 0 && resultado.errores.length === 0 && resultado.duplicadosEnArchivo === 0) {
      playError();
      toast('La plantilla no contiene ninguna fila con datos.', 'error');
      return;
    }

    const reparto = repartirPorPeriodo(resultado.movimientos, planificarPeriodos(resultado.movimientos).todos);
    if (reparto) {
      setPorRevisar({ resultado, reparto });
      return;
    }
    volcarPlantilla(resultado, resultado.movimientos);
  };

  /** Vuelca la plantilla con los movimientos ya decididos: solo añade, nunca borra. */
  const volcarPlantilla = (resultado: ResultadoPlantilla, movimientos: Movimiento[]) => {
    // Solo se AÑADEN movimientos y categorías nuevas. No se toca saldo ni nóminas.
    let mesDestino = '';
    let periodosConNuevos = 0;
    // Las categorías nuevas se filtran por lo que de verdad entra: si el usuario ha
    // quitado los únicos movimientos de una categoría, esa categoría no se crea.
    const catsUsadas = new Set(movimientos.map(m => m.categoria));
    const nuevasCategorias = resultado.nuevasCategorias.filter(c => catsUsadas.has(c.id));

    if (movimientos.length > 0) {
      const idsExistentes = new Set(state.categorias.map(c => c.id));
      const { activeMeses, nuevosMeses } = planificarPeriodos(movimientos);

      const mapaMeses = new Map<string, typeof nuevosMeses[number]>();
      (state.mesesPersonalizados || []).forEach(m => mapaMeses.set(m.id, m));
      nuevosMeses.forEach(m => mapaMeses.set(m.id, m));

      updateState({
        movimientos: [...state.movimientos, ...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
        categorias: [...state.categorias, ...nuevasCategorias.filter(c => !idsExistentes.has(c.id))],
        ...(nuevosMeses.length > 0
          ? { mesesPersonalizados: Array.from(mapaMeses.values()).sort((a, b) => b.inicio.localeCompare(a.inicio)) }
          : {}),
      });

      // Saltamos al periodo que recibe MÁS (no al del movimiento más reciente): así el
      // usuario aterriza donde está el grueso y no cree que "no se importó nada" al ver
      // solo un par en el periodo del último movimiento.
      const allMeses = [...activeMeses, ...nuevosMeses];
      const conteoPorMes = new Map<string, number>();
      for (const m of movimientos) {
        const id = mesIdDeMovimiento(m, allMeses);
        if (id) conteoPorMes.set(id, (conteoPorMes.get(id) || 0) + 1);
      }
      const ranking = Array.from(conteoPorMes.entries())
        .map(([id, count]) => ({ id, count, inicio: allMeses.find(mm => mm.id === id)?.inicio || '' }))
        .sort((a, b) => b.count - a.count || b.inicio.localeCompare(a.inicio));
      mesDestino = ranking[0]?.id || '';
      periodosConNuevos = ranking.length;
    }

    const descartados = resultado.movimientos.length - movimientos.length;
    let resumen = `${movimientos.length} movimientos añadidos.`;
    if (descartados > 0) resumen += ` ${descartados} descartados por ti.`;
    if (periodosConNuevos > 1) resumen += ` Se reparten en ${periodosConNuevos} periodos (cámbialos con el selector de mes).`;
    if (resultado.duplicadosEnArchivo > 0) resumen += ` ${resultado.duplicadosEnArchivo} duplicados omitidos.`;
    if (nuevasCategorias.length > 0) resumen += ` Categorías nuevas: ${nuevasCategorias.map(c => c.nombre).join(', ')}.`;

    if (movimientos.length > 0) {
      if (mesDestino) setSelectedMesId(mesDestino);
      playSuccess();
      toast(resumen, 'ok');
    } else {
      playError();
      toast(resumen, 'error');
    }
    if (resultado.errores.length > 0) {
      // Detalle por fila para que el usuario pueda corregir el archivo.
      const muestra = resultado.errores.slice(0, 8).join('\n');
      alert(`${resultado.errores.length} filas con error (no importadas):\n\n${muestra}${resultado.errores.length > 8 ? '\n…' : ''}`);
    }
  };

  /** Confirmación del repaso de periodos: se importa con lo que haya decidido el usuario. */
  const confirmarRevision = (decisiones: Map<string, Decision>, mesDestinoId: string) => {
    if (!porRevisar) return;
    const { resultado } = porRevisar;
    setPorRevisar(null);
    volcarPlantilla(resultado, aplicarDecisiones(resultado.movimientos, decisiones, mesDestinoId));
  };

  const handlePlantillaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bs = evt.target?.result;
      const hashes = new Set<string>(state.movimientos.map(m => m.hash));
      try {
        aplicarPlantilla(await parsePlantillaGastos(bs, state.categorias, hashes));
      } catch (err) {
        if (err instanceof ErrorColumnas) {
          // La plantilla ya no exige que las columnas se llamen como en la descargable.
          setPorMapear({ analisis: err.analisis, filas: err.filas, destino: 'plantilla', datos: bs });
        } else {
          playError();
          toast((err as Error).message || 'No se pudo leer la plantilla.', 'error');
        }
      }
    };
    reader.readAsBinaryString(file);
    if (plantillaInputRef.current) plantillaInputRef.current.value = '';
  };

  const handleDownloadBackup = () => {
    createManualBackup(state);
    setBackups(getBackups());
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finni_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    playSuccess();
    toast('Backup descargado. Guárdalo en un lugar seguro.', 'ok');
  };

  const handleExportCsv = () => {
    if (state.movimientos.length === 0) {
      toast('Aún no hay movimientos que exportar.', 'info');
      return;
    }
    const csv = movimientosACsv(state.movimientos, state.categorias);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finni_movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    playSuccess();
    toast(`${state.movimientos.length} movimientos exportados a CSV (se abre con Excel).`, 'ok');
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(String(evt.target?.result));
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.movimientos)) {
          throw new Error('El archivo no parece un backup válido de Finni.');
        }
        if (!window.confirm('Esto reemplazará todos tus datos actuales por los del backup. ¿Continuar?')) return;
        importState(migrate(parsed));
        playSuccess();
        toast('Backup restaurado correctamente.', 'ok');
      } catch (err) {
        playError();
        toast((err as Error).message || 'No se pudo leer el backup.', 'error');
      }
    };
    reader.readAsText(file);
    if (restoreInputRef.current) restoreInputRef.current.value = '';
  };

  const handleRestoreSnapshot = (ts: number) => {
    const snap = getBackups().find(b => b.fecha === ts);
    if (!snap) return;
    if (!window.confirm(`¿Restaurar la copia del ${new Date(ts).toLocaleString('es-ES')}? Se reemplazarán tus datos actuales.`)) return;
    importState(migrate(snap.data));
    playSuccess();
  };

  const lastBackup = state.meta.ultimoAutoBackup;

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <h2 className="text-xl font-bold font-display tracking-tight text-text">Ajustes</h2>
      </div>

      <div className="p-4 space-y-8 mt-2">
        {/* Cuadrar con el banco */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider pl-1">Saldo</h3>
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-4">
            <div className="flex items-start gap-3">
              <Scale size={20} className="text-accent flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-text text-sm">Cuadrar con el banco</p>
                <p className="text-muted mt-1 leading-relaxed">
                  El saldo de la app arranca del último extracto y va sumando todo lo que apuntas:
                  si algo se cuela dos veces o falta un ingreso, el error se queda para siempre.
                  Escribe aquí el saldo real y vuelve a cero.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-baseline text-xs px-1">
              <span className="text-muted">Saldo que calcula la app</span>
              <span className="font-mono font-bold text-text">{formatCurrency(saldoApp)}</span>
            </div>
            <div className="flex justify-between items-baseline text-xs px-1 -mt-2">
              <span className="text-muted">Anclado al</span>
              <span className="font-mono text-muted">
                {state.cuenta.fechaSaldo
                  ? new Date(`${state.cuenta.fechaSaldo}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'sin ancla'}
              </span>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Saldo real del banco hoy</span>
              {/* text-base = 16px: por debajo, iOS Safari hace zoom al enfocar el input. */}
              <input
                type="text"
                inputMode="decimal"
                value={saldoBanco}
                onChange={e => setSaldoBanco(e.target.value)}
                placeholder="614,30"
                className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-base font-mono text-text placeholder:text-dim focus:outline-none focus:border-accent"
              />
            </label>

            {diferencia !== null && (
              <div className={`rounded-xl px-4 py-3 text-xs ${diferencia === 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {diferencia === 0 ? (
                  <span className="font-bold">Ya cuadra. No hace falta ajuste.</span>
                ) : (
                  <>
                    <span className="font-bold">
                      Se apuntará un ajuste de {diferencia > 0 ? '+' : '−'}{formatCurrency(Math.abs(diferencia))}
                    </span>
                    <span className="block mt-1 opacity-80">
                      {diferencia > 0
                        ? 'A la app le faltaba dinero: ingresos sin apuntar o gastos contados de más.'
                        : 'La app tenía dinero de más: gastos sin apuntar o ingresos duplicados.'}
                    </span>
                  </>
                )}
              </div>
            )}

            {state.movimientos.some(m => m.fecha > getLocalFechaIso()) && (
              <p className="text-[11px] text-muted px-1">
                Ojo: tienes movimientos con fecha futura. Seguirán sumando al saldo por encima de esta cifra.
              </p>
            )}

            <Button className="w-full py-6 rounded-2xl" onClick={handleCuadrar} disabled={saldoRealTecleado === null}>
              <Scale className="mr-2" size={18} /> Cuadrar saldo
            </Button>
          </div>
        </section>

        {/* Preferencias */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider pl-1">Preferencias</h3>
          <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {/* Tema */}
            <button onClick={toggleTheme} className="w-full flex justify-between items-center p-4 hover:bg-surface-elevated transition-colors">
              <div className="flex items-center gap-3 text-sm font-bold">
                {theme === 'dark' ? <Moon size={20} className="text-accent" /> : <Sun size={20} className="text-warning" />}
                <span>Tema</span>
              </div>
              <span className="text-sm font-bold text-muted capitalize flex items-center gap-2">
                {theme === 'dark' ? 'Oscuro' : 'Claro'}
                <span className={`w-12 h-6 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-surface-elevated' : 'bg-warning'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${theme === 'dark' ? 'left-1' : 'left-7'}`} />
                </span>
              </span>
            </button>
            {/* Sonido */}
            <button onClick={handleToggleAudio} className="w-full flex justify-between items-center p-4 hover:bg-surface-elevated transition-colors">
              <div className="flex items-center gap-3 text-sm font-bold">
                {audioEnabled ? <Volume2 size={20} className="text-accent" /> : <VolumeX size={20} className="text-muted" />}
                <span>Efectos de sonido</span>
              </div>
              <span className={`w-12 h-6 rounded-full transition-colors relative ${audioEnabled ? 'bg-accent' : 'bg-surface-elevated'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${audioEnabled ? 'left-7' : 'left-1'}`} />
              </span>
            </button>
          </div>
        </section>

        {/* Gestión */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider pl-1">Gestión</h3>
          <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
            <button onClick={() => onNavigate?.('suscripciones')} className="w-full flex justify-between items-center p-4 hover:bg-surface-elevated transition-colors">
              <div className="flex items-center gap-3 text-sm font-bold"><Repeat size={20} className="text-accent" /><span>Suscripciones</span></div>
              <ChevronRight size={18} className="text-muted" />
            </button>
            <button onClick={() => onNavigate?.('categorias')} className="w-full flex justify-between items-center p-4 hover:bg-surface-elevated transition-colors">
              <div className="flex items-center gap-3 text-sm font-bold"><Tag size={20} className="text-accent" /><span>Categorías</span></div>
              <ChevronRight size={18} className="text-muted" />
            </button>
            <button onClick={() => onNavigate?.('conciliacion')} className="w-full flex justify-between items-center p-4 hover:bg-surface-elevated transition-colors">
              <div className="flex items-center gap-3 text-sm font-bold"><GitCompare size={20} className="text-accent" /><span>Comparar con el banco</span></div>
              <ChevronRight size={18} className="text-muted" />
            </button>
            <button onClick={() => onNavigate?.('duplicados')} className="w-full flex justify-between items-center p-4 hover:bg-surface-elevated transition-colors">
              <div className="flex items-center gap-3 text-sm font-bold"><CopyCheck size={20} className="text-accent" /><span>Buscar duplicados</span></div>
              <span className="flex items-center gap-2">
                {nDuplicados > 0 && (
                  <span className="text-[11px] font-bold text-warning bg-warning/15 px-2 py-0.5 rounded-full">{nDuplicados}</span>
                )}
                <ChevronRight size={18} className="text-muted" />
              </span>
            </button>
            <button onClick={() => setNovedadesOpen(true)} className="w-full flex justify-between items-center p-4 hover:bg-surface-elevated transition-colors">
              <div className="flex items-center gap-3 text-sm font-bold"><Megaphone size={20} className="text-accent" /><span>Novedades de la app</span></div>
              <span className="text-xs font-mono text-muted flex items-center gap-2">v{APP_VERSION} <ChevronRight size={18} /></span>
            </button>
          </div>
        </section>

        {/* Periodos */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider pl-1">Periodos</h3>
          <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={handleCreateNextMonths}>
            <CalendarPlus className="mr-3 text-accent" size={20} />
            Planificar resto del año
          </Button>
        </section>

        {/* Datos */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider pl-1">Copias de seguridad y datos</h3>

          <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
            <Clock size={18} className="text-success flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-text">Auto-backup semanal activo</p>
              <p className="text-muted">{lastBackup ? `Última copia automática: ${new Date(lastBackup).toLocaleDateString('es-ES')}` : 'Se creará una copia al usar la app durante una semana.'}</p>
            </div>
          </div>

          {backups.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {backups.map(b => (
                <button key={b.fecha} onClick={() => handleRestoreSnapshot(b.fecha)} className="w-full flex justify-between items-center p-3 px-4 hover:bg-surface-elevated transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <RotateCcw size={16} className="text-muted" />
                    <span className="text-xs font-mono text-text">{new Date(b.fecha).toLocaleString('es-ES')}</span>
                  </div>
                  <span className="text-[11px] font-bold text-accent">Restaurar</span>
                </button>
              ))}
            </div>
          )}

          <input type="file" accept=".xls,.xlsx" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <input type="file" accept=".json,application/json" className="hidden" ref={restoreInputRef} onChange={handleRestoreFile} />
          <input type="file" accept=".xls,.xlsx" className="hidden" ref={plantillaInputRef} onChange={handlePlantillaUpload} />

          <div className="grid gap-3">
            <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-3 text-accent" size={20} /> Importar extracto bancario
            </Button>
            <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={handleDownloadPlantilla}>
              <FileSpreadsheet className="mr-3 text-accent" size={20} /> Descargar plantilla de gastos
            </Button>
            <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={() => plantillaInputRef.current?.click()}>
              <FileUp className="mr-3 text-accent" size={20} /> Importar plantilla de gastos
            </Button>
            <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={handleDownloadBackup}>
              <Download className="mr-3 text-success" size={20} /> Exportar backup (JSON)
            </Button>
            <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={handleExportCsv}>
              <FileSpreadsheet className="mr-3 text-success" size={20} /> Exportar movimientos (CSV / Excel)
            </Button>
            <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={() => restoreInputRef.current?.click()}>
              <RotateCcw className="mr-3 text-accent" size={20} /> Restaurar backup (JSON)
            </Button>
            <Button variant="danger" className="w-full justify-start py-6 rounded-2xl bg-surface hover:bg-danger-soft border border-transparent hover:border-danger/30" onClick={() => {
              if (window.confirm('¿Seguro que quieres borrar todos los datos locales? Esta acción es irreversible.')) resetState();
            }}>
              <Trash2 className="mr-3" size={20} /> Borrar todos los datos
            </Button>
          </div>
        </section>

        {/* Créditos */}
        <footer className="text-center space-y-1 pb-2">
          <p className="text-xs text-muted">
            Hecho con <span className="text-danger">♥</span> por{' '}
            <a
              href="https://github.com/dsurfergithub"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-accent hover:underline"
            >
              @dsurfergithub
            </a>
          </p>
          <p className="text-[10px] font-mono text-dim">Finni v{APP_VERSION} · tus datos nunca salen de tu dispositivo</p>
        </footer>
      </div>

      <Novedades isOpen={novedadesOpen} onClose={() => setNovedadesOpen(false)} />

      <MapeoColumnas
        isOpen={!!porMapear}
        analisis={porMapear?.analisis || null}
        onCancel={() => setPorMapear(null)}
        onConfirm={confirmarMapeo}
      />

      <RevisionPeriodos
        isOpen={!!porRevisar}
        reparto={porRevisar?.reparto || null}
        onCancel={() => setPorRevisar(null)}
        onConfirm={confirmarRevision}
      />

      <RevisionImportacion
        isOpen={!!porCategorizar}
        propuesta={porCategorizar?.propuesta || null}
        yaEstaban={porCategorizar?.yaEstaban || 0}
        onCancel={() => setPorCategorizar(null)}
        onConfirm={confirmarCategorias}
      />
    </div>
  );
}
