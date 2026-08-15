// Historial de versiones de la app. Añade una entrada nueva al principio en cada
// actualización: es lo que ve el usuario en el aviso de novedades y en Ajustes.

export const APP_VERSION = '2.7.0';

export type TipoCambio = 'nuevo' | 'mejora' | 'arreglo';

export interface ChangelogEntry {
  version: string;
  fecha: string; // YYYY-MM-DD
  titulo: string;
  cambios: { tipo: TipoCambio; texto: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.7.0',
    fecha: '2026-08-15',
    titulo: 'La plantilla de gastos, también flexible',
    cambios: [
      { tipo: 'mejora', texto: 'La plantilla de gastos ya no exige que las columnas se llamen FECHA, CONCEPTO e IMPORTE ni que vayan en ese orden: vale DESCRIPCIÓN, CANTIDAD, Date, Amount… y si no las reconozco, te pregunto cuál es cada una, igual que con los extractos.' },
      { tipo: 'mejora', texto: 'Sigue funcionando igual que siempre con la plantilla que descargas de Ajustes: TIPO manda sobre el signo, las notas cuentan para no duplicar y se prefiere la hoja "Gastos".' },
      { tipo: 'arreglo', texto: 'Una fila de títulos repetida a media hoja ya no se cuenta como fila con error.' },
    ],
  },
  {
    version: '2.6.0',
    fecha: '2026-08-15',
    titulo: 'El extracto de cualquier banco',
    cambios: [
      { tipo: 'nuevo', texto: 'Importar y comparar extractos ya no depende de un banco concreto: la app reconoce las columnas por su nombre (en español o en inglés) y, si no hay títulos, las deduce mirando el contenido.' },
      { tipo: 'nuevo', texto: 'Si aun así no las reconoce, te enseña las columnas con sus primeros valores y le dices tú cuál es cada una. Antes se rendía con un "formato no reconocido".' },
      { tipo: 'nuevo', texto: 'Si acierta pero se equivoca de columna, "He leído mal las columnas" te deja corregirlo sin volver a subir el archivo.' },
      { tipo: 'mejora', texto: 'Entiende más formatos de fecha (14/08/2026, 2026-08-14, 2026/08/14, 14-08-2026, 14.08.2026) y bancos que separan cargos y abonos en dos columnas.' },
    ],
  },
  {
    version: '2.5.1',
    fecha: '2026-08-15',
    titulo: 'El aviso de "puede ser el mismo" aguanta un céntimo',
    cambios: [
      { tipo: 'mejora', texto: 'Al comparar con el banco, si un apunte que falta y otro que sobra se parecen —mismo importe o a un céntimo, y fechas cercanas— la app avisa de que puede ser el mismo mal apuntado, en vez de dejarte añadirlo duplicado. Antes solo lo veía si el importe coincidía al céntimo exacto.' },
    ],
  },
  {
    version: '2.5.0',
    fecha: '2026-08-15',
    titulo: 'Cerrar mes',
    cambios: [
      { tipo: 'nuevo', texto: 'Cuando un periodo termina, el Dashboard te ofrece cerrarlo: escribes el saldo que tenías su último día y ese pasa a ser su saldo final de verdad.' },
      { tipo: 'nuevo', texto: 'El periodo siguiente arranca mostrando «empezaste el periodo con…». Ya no se arrastran los errores de un mes al otro: cada uno parte de una cifra confirmada con el banco.' },
      { tipo: 'nuevo', texto: 'Un mes cerrado se puede reabrir cuando quieras; el saldo confirmado no se pierde.' },
      { tipo: 'arreglo', texto: 'Los ajustes de saldo ya nunca suman al saldo. Antes, al cerrar un mes anterior, un ajuste viejo podía quedar por delante del ancla y aplicar su corrección por segunda vez.' },
    ],
  },
  {
    version: '2.4.0',
    fecha: '2026-08-15',
    titulo: 'Comparar con el banco',
    cambios: [
      { tipo: 'nuevo', texto: 'Ajustes → Comparar con el banco: sube el extracto y te dice, línea a línea, qué cuadra, qué tienes apuntado de más y —lo importante— qué hay en el banco que no has apuntado. Una nómina que se te olvidó no la detectaba nada hasta ahora.' },
      { tipo: 'nuevo', texto: 'Lo que falta se añade de un toque, con su categoría. Lo que sobra se borra solo si lo marcas tú.' },
      { tipo: 'mejora', texto: 'Compara por importe y fecha, nunca por el texto: el banco no llama a las cosas como tú. Si un mismo importe sale en las dos listas, te avisa de que puede ser el mismo apunte con la fecha cambiada en vez de duplicarlo.' },
      { tipo: 'mejora', texto: 'Vale tanto el extracto de CaixaBank como la plantilla de gastos rellenada.' },
    ],
  },
  {
    version: '2.3.0',
    fecha: '2026-08-15',
    titulo: 'Buscar duplicados',
    cambios: [
      { tipo: 'nuevo', texto: 'Ajustes → Buscar duplicados: encuentra el mismo gasto apuntado dos veces, una a mano y otra al importar. El anti-duplicados de los imports no los veía porque el banco no llama al gasto como tú ("Alquiler" contra "Transferencias").' },
      { tipo: 'nuevo', texto: '"Dejar solo uno" marca los sobrantes de un grupo y conserva el del banco, que es el que manda. Nada se borra sin que lo confirmes.' },
      { tipo: 'mejora', texto: 'No marca falsos positivos: varios cobros del mismo importe y día venidos del mismo import son cobros distintos, no repeticiones.' },
    ],
  },
  {
    version: '2.2.0',
    fecha: '2026-08-15',
    titulo: 'Cuadrar con el banco',
    cambios: [
      { tipo: 'nuevo', texto: 'Ajustes → Cuadrar con el banco: escribe el saldo real de tu cuenta y la app vuelve a la verdad. Antes el saldo arrastraba para siempre cualquier error (un movimiento contado dos veces, un ingreso sin apuntar) desde el último extracto importado.' },
      { tipo: 'nuevo', texto: 'Cada cuadre deja un movimiento "Ajuste de saldo" con la diferencia, para que puedas ver cuándo y por cuánto se corrigió.' },
      { tipo: 'mejora', texto: 'Los ajustes de saldo no cuentan como ingreso ni como gasto del mes: no ensucian el Dashboard, los Insights ni el presupuesto.' },
    ],
  },
  {
    version: '2.1.0',
    fecha: '2026-07-03',
    titulo: 'Plan con datos reales, escenario y app 100% offline',
    cambios: [
      { tipo: 'nuevo', texto: 'El Plan anual ahora compara tu plan con el gasto real de cada mes, agrupado en Fijos, Variables e Inversión.' },
      { tipo: 'nuevo', texto: 'Escenario "¿y si…?": una copia editable del plan para probar cambios sin tocar el plan base.' },
      { tipo: 'nuevo', texto: 'Cada categoría tiene ahora un macro-grupo (fijo, variable o inversión) que alimenta el plan automáticamente.' },
      { tipo: 'nuevo', texto: 'Ingresos recurrentes: la pantalla de suscripciones también sirve para nóminas o alquileres que cobras cada mes.' },
      { tipo: 'nuevo', texto: 'Aporta dinero a tus metas de ahorro y queda registrado como movimiento.' },
      { tipo: 'nuevo', texto: 'Exporta todos tus movimientos a CSV (Excel) desde Ajustes.' },
      { tipo: 'nuevo', texto: 'Este aviso de novedades: tras cada actualización verás qué ha cambiado. El historial completo está en Ajustes.' },
      { tipo: 'mejora', texto: 'La app funciona sin conexión: puedes abrirla y usarla sin internet una vez instalada.' },
      { tipo: 'mejora', texto: 'Al escribir el concepto de un gasto, la categoría se rellena sola si ya la usaste antes.' },
      { tipo: 'mejora', texto: 'La búsqueda de movimientos puede abarcar todos los meses, no solo el actual.' },
      { tipo: 'mejora', texto: 'Avisos integrados en la app en lugar de las ventanas del navegador.' },
      { tipo: 'arreglo', texto: 'Al añadir un movimiento, la fecha propuesta es siempre hoy (antes podía saltar al final del periodo, p. ej. al 14 de agosto).' },
      { tipo: 'arreglo', texto: 'El mes actual ya no aparece duplicado en el selector tras empezar desde cero.' },
      { tipo: 'arreglo', texto: 'Al editar o reactivar una suscripción, sus cargos pendientes se generan al momento (antes había que reabrir la app).' },
    ],
  },
  {
    version: '2.0.0',
    fecha: '2026-06-15',
    titulo: 'Rediseño con temas, suscripciones y presupuesto independiente',
    cambios: [
      { tipo: 'nuevo', texto: 'Suscripciones con vista anualizada y cargo automático cada periodo.' },
      { tipo: 'nuevo', texto: 'Modo claro y oscuro.' },
      { tipo: 'nuevo', texto: 'Presupuesto independiente del catálogo de categorías, con gastos puntuales que no lo consumen.' },
      { tipo: 'nuevo', texto: 'Insights con gráfico interactivo por categoría y gasto mensual del año.' },
      { tipo: 'nuevo', texto: 'Plan anual editable y traspaso de movimientos entre meses financieros.' },
      { tipo: 'mejora', texto: 'Auto-backup semanal y restauración desde JSON.' },
    ],
  },
];

const LAST_SEEN_KEY = 'finni_last_seen_version';

export function versionVista(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return APP_VERSION;
  }
}

export function marcarVersionVista(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
  } catch {
    // sin almacenamiento no hay aviso que controlar
  }
}

/** true si el usuario aún no ha visto las novedades de la versión instalada. */
export function hayNovedadesSinVer(): boolean {
  return versionVista() !== APP_VERSION;
}
