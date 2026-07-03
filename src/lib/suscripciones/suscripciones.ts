import { Suscripcion, Movimiento } from '../storage/types';
import { v4 as uuidv4 } from 'uuid';

/** Coste mensual equivalente (las anuales se prorratean entre 12). */
export function costeMensual(s: Suscripcion): number {
  return s.frecuencia === 'anual' ? s.importe / 12 : s.importe;
}

/** Coste anual equivalente (las mensuales se multiplican por 12). */
export function costeAnual(s: Suscripcion): number {
  return s.frecuencia === 'anual' ? s.importe : s.importe * 12;
}

/** Suma del coste mensual de las suscripciones activas (solo gastos, no ingresos). */
export function totalMensual(subs: Suscripcion[]): number {
  return subs.filter(s => s.activa && !s.esIngreso).reduce((acc, s) => acc + costeMensual(s), 0);
}

/** Suma del coste anual de las suscripciones activas (solo gastos, no ingresos). */
export function totalAnual(subs: Suscripcion[]): number {
  return subs.filter(s => s.activa && !s.esIngreso).reduce((acc, s) => acc + costeAnual(s), 0);
}

/** Suma de ingresos recurrentes mensuales equivalentes activos. */
export function totalIngresosMensual(subs: Suscripcion[]): number {
  return subs.filter(s => s.activa && s.esIngreso).reduce((acc, s) => acc + costeMensual(s), 0);
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function diasEnMes(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

interface ResultadoCargos {
  nuevosMovimientos: Movimiento[];
  suscripcionesActualizadas: Suscripcion[];
  generados: number;
}

/**
 * Genera los movimientos pendientes de las suscripciones hasta la fecha `hoy`.
 * Idempotente: usa `ultimoCargo` para no duplicar.
 * Backfill máximo de 12 meses para evitar avalanchas si la fecha de inicio es muy antigua.
 */
export function generarCargosSuscripciones(
  subs: Suscripcion[],
  hoyIso: string,
): ResultadoCargos {
  const nuevosMovimientos: Movimiento[] = [];
  const [hoyY, hoyM, hoyD] = hoyIso.split('-').map(Number);

  const suscripcionesActualizadas = subs.map(s => {
    if (!s.activa) return s;

    if (s.frecuencia === 'anual') {
      // Un cargo al año, en el mes/día de `inicio`.
      const [iy, im, idd] = s.inicio.split('-').map(Number);
      const ultimoAnio = s.ultimoCargo ? parseInt(s.ultimoCargo, 10) : iy - 1;
      let nuevoUltimo = s.ultimoCargo;
      for (let year = Math.max(iy, ultimoAnio + 1); year <= hoyY; year++) {
        const dia = Math.min(idd, diasEnMes(year, im));
        const fecha = ymd(year, im, dia);
        if (fecha > hoyIso) break;
        nuevosMovimientos.push(crearMov(s, fecha));
        nuevoUltimo = String(year);
      }
      return nuevoUltimo !== s.ultimoCargo ? { ...s, ultimoCargo: nuevoUltimo } : s;
    }

    // Mensual: un cargo por mes en `diaCobro`.
    const [iy, im] = s.inicio.split('-').map(Number);
    // Punto de partida: el último cargo registrado o el mes de inicio.
    let startY = iy;
    let startM = im;
    if (s.ultimoCargo) {
      const [ly, lm] = s.ultimoCargo.split('-').map(Number);
      startY = ly;
      startM = lm + 1;
      if (startM > 12) { startM = 1; startY += 1; }
    }
    // Cap de backfill a 12 meses hacia atrás desde hoy.
    const capDate = new Date(hoyY, hoyM - 1 - 12, 1);
    let curY = startY;
    let curM = startM;
    if (new Date(curY, curM - 1, 1) < capDate) {
      curY = capDate.getFullYear();
      curM = capDate.getMonth() + 1;
    }

    let nuevoUltimo = s.ultimoCargo;
    // Avanza mes a mes hasta el mes actual.
    while (curY < hoyY || (curY === hoyY && curM <= hoyM)) {
      const dia = Math.min(s.diaCobro, diasEnMes(curY, curM));
      // En el mes en curso solo si ya pasó el día de cobro.
      const esMesActual = curY === hoyY && curM === hoyM;
      if (!esMesActual || dia <= hoyD) {
        const fecha = ymd(curY, curM, dia);
        if (fecha >= s.inicio) {
          nuevosMovimientos.push(crearMov(s, fecha));
          nuevoUltimo = `${curY}-${String(curM).padStart(2, '0')}`;
        }
      }
      curM += 1;
      if (curM > 12) { curM = 1; curY += 1; }
    }

    return nuevoUltimo !== s.ultimoCargo ? { ...s, ultimoCargo: nuevoUltimo } : s;
  });

  return {
    nuevosMovimientos,
    suscripcionesActualizadas,
    generados: nuevosMovimientos.length,
  };
}

function crearMov(s: Suscripcion, fecha: string): Movimiento {
  return {
    id: uuidv4(),
    fecha,
    importe: s.esIngreso ? Math.abs(s.importe) : -Math.abs(s.importe),
    concepto: s.nombre,
    categoria: s.categoria,
    fuente: 'suscripcion',
    hash: `sub-${s.id}-${fecha}`,
    enPresupuesto: true,
    suscripcionId: s.id,
  };
}
