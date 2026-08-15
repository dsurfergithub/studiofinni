import React, { useState } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { Analisis, Campo, Mapeo, ETIQUETA_CAMPO, camposQueFaltan } from '../../lib/excel/columnas';

/** Campos que se piden. Los tres primeros son obligatorios. */
const CAMPOS: { campo: Campo; ayuda: string; obligatorio: boolean }[] = [
  { campo: 'fecha', ayuda: 'El día del movimiento', obligatorio: true },
  { campo: 'concepto', ayuda: 'La descripción que da el banco', obligatorio: true },
  { campo: 'importe', ayuda: 'Positivo si entra, negativo si sale', obligatorio: true },
  { campo: 'categoria', ayuda: 'Opcional, si tu banco las trae', obligatorio: false },
];

/**
 * Cuando el archivo no se reconoce solo, aquí se dice qué columna es cada cosa. Se
 * enseñan los primeros valores de cada columna para que se identifiquen de un vistazo,
 * sin tener que abrir el Excel al lado.
 */
export function MapeoColumnas({
  isOpen,
  analisis,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  analisis: Analisis | null;
  onCancel: () => void;
  onConfirm: (mapeo: Mapeo) => void;
}) {
  const [elegidas, setElegidas] = useState<Partial<Record<Campo, number>>>({});

  // Al abrir con un análisis nuevo, partimos de lo que sí se haya detectado.
  const [ultimo, setUltimo] = useState<Analisis | null>(null);
  if (analisis !== ultimo) {
    setUltimo(analisis);
    setElegidas(analisis ? { ...analisis.mapeo.columnas } : {});
  }

  if (!analisis) return null;

  const faltan = camposQueFaltan(elegidas);
  const listo = faltan.length === 0;

  const elegir = (campo: Campo, valor: string) => {
    setElegidas(prev => {
      const next = { ...prev };
      if (valor === '') delete next[campo];
      else next[campo] = Number(valor);
      return next;
    });
  };

  const confirmar = () => {
    if (!listo) return;
    onConfirm({ ...analisis.mapeo, columnas: elegidas });
  };

  return (
    <Sheet isOpen={isOpen} onClose={onCancel} title="¿Qué hay en cada columna?">
      <div className="space-y-5 pb-6 mt-2">
        <p className="text-xs text-muted leading-relaxed">
          No he reconocido las columnas de este archivo —cada banco las nombra a su manera—.
          Dime qué es cada una y lo leo igual. Debajo de cada columna van sus primeros valores.
        </p>

        {analisis.mapeo.filaCabecera < 0 && (
          <p className="text-[11px] text-warning">
            El archivo no parece traer una fila de títulos, así que los datos se leen desde la primera fila con contenido.
          </p>
        )}

        {CAMPOS.map(({ campo, ayuda, obligatorio }) => (
          <label key={campo} className="block space-y-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">
              {ETIQUETA_CAMPO[campo]}{obligatorio ? '' : ' (opcional)'}
            </span>
            <span className="block text-[11px] text-dim -mt-1">{ayuda}</span>
            {/* text-base = 16px: por debajo, iOS Safari hace zoom al enfocar. */}
            <select
              value={elegidas[campo] ?? ''}
              onChange={e => elegir(campo, e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-base text-text focus:outline-none focus:border-accent"
            >
              <option value="">— ninguna —</option>
              {analisis.columnas.map(c => (
                <option key={c.indice} value={c.indice}>
                  {c.cabecera} · {c.muestra.join(' / ')}
                </option>
              ))}
            </select>
          </label>
        ))}

        {!listo && (
          <p className="text-xs text-danger font-bold">
            Falta por decir cuál es: {faltan.map(f => ETIQUETA_CAMPO[f].toLowerCase()).join(', ')}.
          </p>
        )}

        <div className="flex flex-col gap-3 pt-1">
          <Button onClick={confirmar} disabled={!listo} className="w-full h-14 text-lg font-bold">
            Leer el archivo así
          </Button>
          <Button variant="ghost" onClick={onCancel} className="w-full h-12 text-base">
            Cancelar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
