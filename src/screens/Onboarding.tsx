import React, { useRef } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { parseExcelData } from '../lib/excel/parser';
import { useStore } from '../lib/storage/store';
import { playSuccess, playError } from '../lib/audio/sounds';
import { getDeterministaColor } from '../lib/colors';
import { calcularNombreMes, generarMesesFuturos, mesesRestantesDelAnio, derivarMeses } from '../lib/finmes/finmes';
import { MesFinanciero, Categoria } from '../lib/storage/types';
import { v4 as uuidv4 } from 'uuid';

const CATEGORIAS_SUGERIDAS: Categoria[] = [
  { id: 'alimentacion', nombre: 'Alimentación', color: '#4ade80', icono: 'shopping-cart', tipo: 'gasto' },
  { id: 'hogar', nombre: 'Hogar', color: '#60a5fa', icono: 'home', tipo: 'gasto' },
  { id: 'transporte', nombre: 'Transporte', color: '#fb923c', icono: 'car', tipo: 'gasto' },
  { id: 'restaurantes', nombre: 'Restaurantes', color: '#fbbf24', icono: 'coffee', tipo: 'gasto' },
  { id: 'ocio', nombre: 'Ocio', color: '#e879f9', icono: 'music', tipo: 'gasto' },
  { id: 'salud', nombre: 'Salud', color: '#ff5478', icono: 'heart', tipo: 'gasto' },
  { id: 'compras', nombre: 'Compras', color: '#a78bfa', icono: 'tag', tipo: 'gasto' },
  { id: 'nomina', nombre: 'Nómina', color: '#34d399', icono: 'briefcase', tipo: 'ingreso' },
];

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateState, getMesesActivos } = useStore();

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

          const nuevasCats = Array.from(parsed.categoriasEncontradas).map(n => ({
            id: n.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
            nombre: n,
            color: getDeterministaColor(n),
            tipo: 'ambos' as const
          }));

          const ingresos = parsed.movimientos.filter(m => m.importe > 0);
          const nominasMapeo = new Map<string, typeof ingresos[0]>();
          ingresos.forEach(ing => {
            const m = ing.fecha.substring(0, 7);
            if (!nominasMapeo.has(m) || nominasMapeo.get(m)!.importe < ing.importe) {
              nominasMapeo.set(m, ing);
            }
          });

          const nominasAncla = Array.from(nominasMapeo.values()).map(m => ({
            id: uuidv4(),
            fecha: m.fecha,
            importe: m.importe,
            concepto: m.concepto,
            movimientoId: m.id
          })).sort((a,b) => a.fecha.localeCompare(b.fecha));

          // Planifica el resto del año a partir del periodo más reciente detectado.
          const derived = derivarMeses(nominasAncla);
          const futuros = derived.length > 0
            ? generarMesesFuturos(derived[0], mesesRestantesDelAnio(derived[0]) || 12)
            : [];

          updateState({
            hasOnboarded: true,
            movimientos: parsed.movimientos.sort((a,b) => b.fecha.localeCompare(a.fecha)),
            categorias: nuevasCats,
            nominasAncla,
            mesesPersonalizados: futuros,
            cuenta: {
              banco: parsed.banco,
              saldoActual: parsed.saldoActual,
              fechaSaldo: parsed.fechaSaldo
            }
          });

          playSuccess();
          onFinish();
        } catch (err) {
          playError();
          alert((err as Error).message || 'Error parseando el archivo');
        }
      };
      reader.readAsBinaryString(file);
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
    </div>
  );
}
