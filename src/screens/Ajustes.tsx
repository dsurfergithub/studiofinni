import React, { useRef, useState } from 'react';
import { useStore } from '../lib/storage/store';
import { Button } from '../components/ui/Button';
import { Upload, Trash2, Download, Volume2, VolumeX, CalendarPlus } from 'lucide-react';
import { parseExcelData } from '../lib/excel/parser';
import { playSuccess, playError, soundsEnabled, setSoundsEnabled } from '../lib/audio/sounds';
import { getDeterministaColor } from '../lib/colors';
import { v4 as uuidv4 } from 'uuid';

export function Ajustes() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resetState, updateState, state, getMesesActivos } = useStore();
  const [audioEnabled, setAudioEnabled] = useState(soundsEnabled());

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setSoundsEnabled(next);
    setAudioEnabled(next);
  };

  const handleCreateNextMonth = () => {
    const activeMeses = getMesesActivos();
    if (activeMeses.length === 0) {
      alert("No hay meses activos para basarse.");
      return;
    }
    const lastMes = activeMeses[0]; // Activemeses is sorted newest first usually.
    const lastDate = new Date(lastMes.fin);
    if (isNaN(lastDate.getTime())) return;
    
    lastDate.setDate(lastDate.getDate() + 1); // Next day is the start
    const startStr = lastDate.toISOString().slice(0, 10);
    
    lastDate.setMonth(lastDate.getMonth() + 1); // Approx end
    lastDate.setDate(lastDate.getDate() - 1);
    const endStr = lastDate.toISOString().slice(0, 10);

    const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(lastDate);

    const newMes = {
      id: `mes-${uuidv4().slice(0,6)}`,
      nombre: monthName,
      inicio: startStr,
      fin: endStr,
      gastosFijos: lastMes.gastosFijos,
      esEstimado: true,
    };

    updateState({
      mesesPersonalizados: [newMes, ...state.mesesPersonalizados].sort((a,b) => b.inicio.localeCompare(a.inicio))
    });

    playSuccess();
    alert(`Nuevo mes creado: ${startStr} a ${endStr}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bs = evt.target?.result;
          const parsed = await parseExcelData(bs);
          
          const nuevasCats = Array.from(parsed.categoriasEncontradas).map(n => ({
            id: n.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
            nombre: n,
            color: getDeterministaColor(n),
            tipo: 'ambos' as const
          }));

          const dictIds = new Set(state.categorias.map(c => c.id));
          const finalCats = [...state.categorias, ...nuevasCats.filter(c => !dictIds.has(c.id))];

          const dictMovs = new Set(state.movimientos.map(m => m.hash));
          const nuevosMovs = parsed.movimientos.filter(m => !dictMovs.has(m.hash));

          updateState({
            movimientos: [...state.movimientos, ...nuevosMovs].sort((a,b) => b.fecha.localeCompare(a.fecha)),
            categorias: finalCats,
            cuenta: {
              ...state.cuenta,
              saldoActual: parsed.saldoActual || state.cuenta.saldoActual,
              fechaSaldo: parsed.fechaSaldo || state.cuenta.fechaSaldo
            }
          });

          playSuccess();
          alert(`Importados ${nuevosMovs.length} movimientos nuevos.`);
        } catch (err) {
          playError();
          alert((err as Error).message || 'Error parseando Excel');
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      playError();
      console.error(err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finni_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col pt-safe pb-24 h-screen overflow-y-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <h2 className="text-xl font-bold font-mono tracking-tight text-text">Ajustes</h2>
      </div>

      <div className="p-4 space-y-8 mt-2">
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider pl-1">Preferencias</h3>
          
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <button onClick={handleToggleAudio} className="w-full flex justify-between items-center p-4 hover:bg-surface-elevated transition-colors">
              <div className="flex items-center gap-3 text-sm font-bold">
                {audioEnabled ? <Volume2 size={20} className="text-accent" /> : <VolumeX size={20} className="text-muted" />}
                <span>Efectos de sonido</span>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors relative ${audioEnabled ? 'bg-accent' : 'bg-surface-elevated'}`}>
                 <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${audioEnabled ? 'left-7' : 'left-1'}`} />
              </div>
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider pl-1">Periodos</h3>
          <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={handleCreateNextMonth}>
            <CalendarPlus className="mr-3 text-accent" size={20} />
            Crear próximo periodo (Mes)
          </Button>
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider pl-1">Datos locales</h3>
          
          <input type="file" accept=".xls,.xlsx" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          
          <div className="grid gap-3">
            <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-3 text-accent" size={20} />
              Importar Excel (CaixaBank / ING)
            </Button>

            <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl border-border bg-surface hover:bg-surface-elevated" onClick={handleDownloadBackup}>
              <Download className="mr-3 text-success" size={20} />
              Exportar Backup JSON
            </Button>
            
            <Button variant="danger" className="w-full justify-start py-6 rounded-2xl bg-surface hover:bg-danger-soft border border-transparent hover:border-danger/30" onClick={() => {
              if(window.confirm('¿Seguro que quieres borrar todos los datos locales? Esta acción es irreversible.')) {
                resetState();
              }
            }}>
              <Trash2 className="mr-3" size={20} />
              Borrar todos los datos
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
