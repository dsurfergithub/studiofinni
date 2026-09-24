import React, { useRef, useState } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { parseExcelData, ParsedResultado } from '../lib/excel/parser';
import { RevisionImportacion } from '../components/ui/RevisionImportacion';
import { proponerCategorias, Propuesta } from '../lib/importacion/agrupar';
import { volcarExtracto } from '../lib/importacion/aplicar';
import { useStore } from '../lib/storage/store';
import { useToast } from '../components/ui/Toast';
import { playSuccess, playError } from '../lib/audio/sounds';
import { calcularNombreMes, generarMesesFuturos, mesesRestantesDelAnio } from '../lib/finmes/finmes';
import { MesFinanciero, Categoria, Movimiento, ReglaCategoria } from '../lib/storage/types';

const idDeCategoria = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

const CATEGORIAS_SUGERIDAS: Categoria[] = [
  { id: 'alimentacion', nombre: 'Alimentación', color: '#4ade80', icono: 'shopping-cart', tipo: 'gasto', macro: 'variable' },
  { id: 'hogar', nombre: 'Hogar', color: '#60a5fa', icono: 'home', tipo: 'gasto', macro: 'fijo' },
  { id: 'transporte', nombre: 'Transporte', color: '#fb923c', icono: 'car', tipo: 'gasto', macro: 'variable' },
  { id: 'restaurantes', nombre: 'Restaurantes', color: '#fbbf24', icono: 'coffee', tipo: 'gasto', macro: 'variable' },
  { id: 'ocio', nombre: 'Ocio', color: '#e879f9', icono: 'music', tipo: 'gasto', macro: 'variable' },
  { id: 'salud', nombre: 'Salud', color: '#ff5478', icono: 'heart', tipo: 'gasto', macro: 'fijo' },
  { id: 'compras', nombre: 'Compras', color: '#a78bfa', icono: 'tag', tipo: 'gasto', macro: 'variable' },
  { id: 'inversion', nombre: 'Inversión', color: '#22c55e', icono: 'trending-up', tipo: 'gasto', macro: 'inversion' },
  { id: 'nomina', nombre: 'Nómina', color: '#34d399', icono: 'briefcase', tipo: 'ingreso' },
];

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateState, state, setSelectedMesId } = useStore();
  const { toast } = useToast();
  const [porCategorizar, setPorCategorizar] = useState<{ propuesta: Propuesta; parsed: ParsedResultado } | null>(null);

  const confirmarCategorias = (movimientos: Movimiento[], nuevasCategorias: Categoria[], nuevasReglas: ReglaCategoria[]) => {
    if (!porCategorizar) return;
    const { parsed } = porCategorizar;
    setPorCategorizar(null);
    // Se parte de un estado sin categorías: las del extracto (revisadas) son las que valen.
    const base = { ...state, categorias: [], movimientos: [] };
    const { cambios, mesDestino } = volcarExtracto(base, movimientos, nuevasCategorias, parsed);
    updateState({ ...cambios, reglas: nuevasReglas, hasOnboarded: true, cuenta: { ...(cambios.cuenta || state.cuenta), banco: parsed.banco } });
    if (mesDestino) setSelectedMesId(mesDestino);
    playSuccess();
    onFinish();
  };

  const handleStartFresh = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayDate = new Date(year, month, 0);
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
    const { nombre, clave } = calcularNombreMes(firstDay, lastDay);

    const mesActual: MesFinanciero = {
      id: `mes-${clave}`,
      nombre,
      clave,
      inicio: firstDay,
      fin: lastDay,
      esEstimado: false,
    };

    // Planifica por defecto el resto del año (meses naturales hasta diciembre).
    const futuros = generarMesesFuturos(mesActual, mesesRestantesDelAnio(mesActual));

    updateState({
      hasOnboarded: true,
      categorias: CATEGORIAS_SUGERIDAS,
      mesesPersonalizados: [...futuros, mesActual].sort((a, b) => b.inicio.localeCompare(a.inicio)),
    });

    playSuccess();
    onFinish();
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
          if (parsed.movimientos.length === 0) throw new Error('El archivo no tiene ningún movimiento.');

          // Antes de entrar, se revisan las categorías agrupadas por comercio.
          const nombresBanco = new Map(Array.from(parsed.categoriasEncontradas).map(n => [idDeCategoria(n), n]));
          setPorCategorizar({
            propuesta: proponerCategorias({ movimientos: parsed.movimientos, nombresBanco, categorias: [], historial: [] }),
            parsed,
          });
        } catch (err) {
          playError();
          toast((err as Error).message || 'No se pudo leer el archivo. ¿Es un extracto compatible?', 'error');
        }
      };
      reader.readAsBinaryString(file);
      // Para poder volver a elegir el mismo archivo si se cancela la revisión.
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 bg-bg">
      <div className="w-24 h-24 rounded-3xl bg-surface-elevated border border-border flex items-center justify-center shadow-[0_0_40px_rgba(183,148,255,0.15)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent"></div>
        <span className="text-4xl">🚀</span>
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-display font-bold">Bienvenido a Finni</h1>
        <p className="text-muted max-w-sm mx-auto font-body">
          Controla tus finanzas personales de forma simple. Puedes empezar desde cero o importar tu historial bancario.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Button size="lg" className="w-full group bg-success text-black hover:opacity-90 shadow-[0_0_20px_rgba(74,222,128,0.3)]" onClick={handleStartFresh}>
          <Sparkles className="mr-2" size={20} />
          Empezar desde cero
        </Button>

        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-dim font-bold uppercase tracking-wider">o</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <input
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />

        <Button variant="secondary" size="lg" className="w-full group" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 group-hover:-translate-y-1 transition-transform" size={20} />
          Importar extracto bancario
        </Button>
      </div>

      <p className="text-xs text-dim max-w-xs">
        Tus datos nunca salen de tu dispositivo. Todo se procesa y guarda localmente.
      </p>

      <RevisionImportacion
        isOpen={!!porCategorizar}
        propuesta={porCategorizar?.propuesta || null}
        yaEstaban={0}
        onCancel={() => setPorCategorizar(null)}
        onConfirm={confirmarCategorias}
      />
    </div>
  );
}
