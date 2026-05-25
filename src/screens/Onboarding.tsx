import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { parseExcelData } from '../lib/excel/parser';
import { useStore } from '../lib/storage/store';
import { playSuccess, playError } from '../lib/audio/sounds';
import { getDeterministaColor } from '../lib/colors';
import { v4 as uuidv4 } from 'uuid';

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateState, updateMovimiento, getMesesActivos } = useStore();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bs = evt.target?.result;
          const parsed = await parseExcelData(bs);
          
          // Crear categorías encontradas que no existan (asumimos array vacío aqui en Onboarding)
          const nuevasCats = Array.from(parsed.categoriasEncontradas).map(n => ({
            id: n.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
            nombre: n,
            color: getDeterministaColor(n),
            tipo: 'ambos' as const
          }));

          // Buscar ingresos recurrentes para nóminas ancla
          const ingresos = parsed.movimientos.filter(m => m.importe > 0);
          
          // Simplified logic: the highest repeated income is assumed to be salary.
          // Or we just take the first largest income for recent months.
          // In real app we might show Wizard Step 2. For simplicity here, we create anclas from largest income each month.
          const nominasMapeo = new Map<string, typeof ingresos[0]>();
          ingresos.forEach(ing => {
            const m = ing.fecha.substring(0, 7); // YYYY-MM
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
          }));

          updateState({
            movimientos: parsed.movimientos.sort((a,b) => b.fecha.localeCompare(a.fecha)),
            categorias: nuevasCats,
            nominasAncla: nominasAncla.sort((a,b) => a.fecha.localeCompare(b.fecha)),
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
          alert((err as Error).message || 'Error parseando Excel');
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
        {/* Placeholder logo */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent"></div>
        <span className="text-4xl">🚀</span>
      </div>
      
      <div className="space-y-3">
        <h1 className="text-3xl font-display font-bold">Bienvenido a Finni</h1>
        <p className="text-muted max-w-sm mx-auto font-body">
          Sube tu extracto de CaixaBank o ING en Excel para comenzar. Finni categorizará todo localmente en tu dispositivo.
        </p>
      </div>

      <input 
        type="file" 
        accept=".xls,.xlsx" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
      />
      
      <Button size="lg" className="w-full max-w-sm group" onClick={() => fileInputRef.current?.click()}>
        <Upload className="mr-2 group-hover:-translate-y-1 transition-transform" />
        Subir mi primer Excel
      </Button>

      <p className="text-xs text-dim max-w-xs">
        Tus datos nunca salen de tu dispositivo. Todo se procesa y guarda localmente.
      </p>
    </div>
  );
}
