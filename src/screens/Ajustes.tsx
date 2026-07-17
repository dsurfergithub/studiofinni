import React, { useRef, useState } from 'react';
import { useStore } from '../lib/storage/store';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { Novedades } from '../components/ui/Novedades';
import { APP_VERSION } from '../lib/changelog';
import { Upload, Trash2, Download, Volume2, VolumeX, CalendarPlus, Moon, Sun, Tag, Repeat, RotateCcw, ChevronRight, Clock, FileSpreadsheet, FileUp, Megaphone } from 'lucide-react';
import { parseExcelData } from '../lib/excel/parser';
import { descargarPlantillaGastos, parsePlantillaGastos } from '../lib/excel/plantilla';
import { playSuccess, playError, soundsEnabled, setSoundsEnabled } from '../lib/audio/sounds';
import { getDeterministaColor } from '../lib/colors';
import { sugerirCategoria } from '../lib/categorias/sugerencias';
import { movimientosACsv } from '../lib/export/csv';
import { v4 as uuidv4 } from 'uuid';
import { derivarMeses, generarMesesFuturos, mesesRestantesDelAnio, mesesParaCubrir, mesIdDeMovimiento } from '../lib/finmes/finmes';
import { getBackups, createManualBackup, migrate } from '../lib/storage/storage';

export function Ajustes({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const plantillaInputRef = useRef<HTMLInputElement>(null);
  const { resetState, updateState, importState, state, getMesesActivos, setSelectedMesId, theme, toggleTheme } = useStore();
  const [audioEnabled, setAudioEnabled] = useState(soundsEnabled());
  const [backups, setBackups] = useState(getBackups());
  const [novedadesOpen, setNovedadesOpen] = useState(false);
  const { toast } = useToast();

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = await parseExcelData(evt.target?.result);
          const nuevasCats = Array.from(parsed.categoriasEncontradas).map(n => ({
            id: n.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
            nombre: n, color: getDeterministaColor(n), tipo: 'ambos' as const,
          }));
          const dictIds = new Set(state.categorias.map(c => c.id));
          const finalCats = [...state.categorias, ...nuevasCats.filter(c => !dictIds.has(c.id))];
          const dictMovs = new Set(state.movimientos.map(m => m.hash));
          const nuevosMovs = parsed.movimientos
            .filter(m => !dictMovs.has(m.hash))
            .map(m => {
              // Las filas que llegan sin clasificar heredan la categoría de conceptos
              // parecidos ya registrados (el usuario siempre puede corregirla).
              if (m.categoria !== 'sin-clasificar') return m;
              const sugerida = sugerirCategoria(m.concepto, state.movimientos);
              return sugerida ? { ...m, categoria: sugerida } : m;
            });
          const todoMovas = [...state.movimientos, ...nuevosMovs];

          const ingresosRecurrentes = todoMovas.filter(m => m.importe > 0);
          const nominasMapeo = new Map<string, typeof ingresosRecurrentes[0]>();
          ingresosRecurrentes.forEach(ing => {
            const m = ing.fecha.substring(0, 7);
            if (!nominasMapeo.has(m) || nominasMapeo.get(m)!.importe < ing.importe) nominasMapeo.set(m, ing);
          });
          const nominasAncla = Array.from(nominasMapeo.values()).map(m => ({
            id: m.id || uuidv4(), fecha: m.fecha, importe: m.importe, concepto: m.concepto, movimientoId: m.id,
          })).sort((a, b) => a.fecha.localeCompare(b.fecha));

          const derivedMonths = derivarMeses(nominasAncla);
          const baseMes = derivedMonths[0];
          const nuevosFuturos = baseMes ? generarMesesFuturos(baseMes, mesesRestantesDelAnio(baseMes) || 12) : [];

          const mapa = new Map();
          (state.mesesPersonalizados || []).forEach(m => mapa.set(m.id, m));
          nuevosFuturos.forEach(m => mapa.set(m.id, m));

          updateState({
            movimientos: todoMovas.sort((a, b) => b.fecha.localeCompare(a.fecha)),
            categorias: finalCats,
            nominasAncla,
            mesesPersonalizados: Array.from(mapa.values()).sort((a, b) => b.inicio.localeCompare(a.inicio)),
            cuenta: { ...state.cuenta, saldoActual: parsed.saldoActual || state.cuenta.saldoActual, fechaSaldo: parsed.fechaSaldo || state.cuenta.fechaSaldo },
          });

          if (derivedMonths.length > 0) setSelectedMesId(derivedMonths[0].id);
          playSuccess();
          toast(`Importados ${nuevosMovs.length} movimientos nuevos. Meses del resto del año planificados.`, 'ok');
        } catch (err) {
          playError();
          toast((err as Error).message || 'No se pudo leer el Excel. ¿Es un extracto compatible?', 'error');
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      playError(); console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  const handlePlantillaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bs = evt.target?.result;
          const hashesExistentes = new Set<string>(state.movimientos.map(m => m.hash));
          const resultado = await parsePlantillaGastos(bs, state.categorias, hashesExistentes);

          if (resultado.movimientos.length === 0 && resultado.errores.length === 0 && resultado.duplicadosEnArchivo === 0) {
            playError();
            toast('La plantilla no contiene ninguna fila con datos.', 'error');
            return;
          }

          // Solo se AÑADEN movimientos y categorías nuevas. No se toca saldo ni nóminas.
          // Sí se planifican los periodos necesarios para que los movimientos importados
          // caigan dentro de un mes visible (si no, cambiarían el saldo pero no aparecerían
          // en la lista de Movimientos por estar fuera de todo periodo activo).
          let mesDestino = '';
          if (resultado.movimientos.length > 0) {
            const idsExistentes = new Set(state.categorias.map(c => c.id));

            const activeMeses = getMesesActivos();
            const fechas = resultado.movimientos.map(m => m.fecha);
            const minFecha = fechas.reduce((a, b) => (a < b ? a : b));
            const maxFecha = fechas.reduce((a, b) => (a > b ? a : b));
            const nuevosMeses = mesesParaCubrir(activeMeses, minFecha, maxFecha);

            const mapaMeses = new Map<string, typeof nuevosMeses[number]>();
            (state.mesesPersonalizados || []).forEach(m => mapaMeses.set(m.id, m));
            nuevosMeses.forEach(m => mapaMeses.set(m.id, m));

            updateState({
              movimientos: [...state.movimientos, ...resultado.movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
              categorias: [...state.categorias, ...resultado.nuevasCategorias.filter(c => !idsExistentes.has(c.id))],
              ...(nuevosMeses.length > 0
                ? { mesesPersonalizados: Array.from(mapaMeses.values()).sort((a, b) => b.inicio.localeCompare(a.inicio)) }
                : {}),
            });

            // Saltar al mes del movimiento importado más reciente para que se vea al instante.
            const masReciente = resultado.movimientos.reduce((a, b) => (a.fecha > b.fecha ? a : b));
            mesDestino = mesIdDeMovimiento(masReciente, [...activeMeses, ...nuevosMeses]) || '';
          }

          let resumen = `${resultado.movimientos.length} movimientos añadidos.`;
          if (resultado.duplicadosEnArchivo > 0) resumen += ` ${resultado.duplicadosEnArchivo} duplicados omitidos.`;
          if (resultado.nuevasCategorias.length > 0) resumen += ` Categorías nuevas: ${resultado.nuevasCategorias.map(c => c.nombre).join(', ')}.`;

          if (resultado.movimientos.length > 0) {
            if (mesDestino) setSelectedMesId(mesDestino);
            playSuccess();
            toast(resumen, 'ok');
          } else {
            playError();
          }
          if (resultado.errores.length > 0) {
            // Detalle por fila para que el usuario pueda corregir el archivo.
            const muestra = resultado.errores.slice(0, 8).join('\n');
            alert(`${resultado.errores.length} filas con error (no importadas):\n\n${muestra}${resultado.errores.length > 8 ? '\n…' : ''}`);
          }
        } catch (err) {
          playError();
          toast((err as Error).message || 'No se pudo leer la plantilla.', 'error');
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      playError();
      console.error(err);
    } finally {
      if (plantillaInputRef.current) {
        plantillaInputRef.current.value = '';
      }
    }
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
            Hecho con <span className="text-danger">♥</span> por <span className="font-bold text-accent">@dsurfer</span>
          </p>
          <p className="text-[10px] font-mono text-dim">Finni v{APP_VERSION} · tus datos nunca salen de tu dispositivo</p>
        </footer>
      </div>

      <Novedades isOpen={novedadesOpen} onClose={() => setNovedadesOpen(false)} />
    </div>
  );
}
