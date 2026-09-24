import { v4 as uuidv4 } from 'uuid';
import { Movimiento, ReglaCategoria } from '../storage/types';
import { normalizarConcepto } from './sugerencias';
import { claveComercio } from '../importacion/agrupar';

/** Texto de regla tal y como se guarda: sin tildes, minúsculas, espacios simples. */
export const normalizarTextoRegla = (texto: string) => normalizarConcepto(texto);

/**
 * ¿Aplica la regla a este concepto? Vale que el concepto contenga el texto
 * («mercadona» ⊂ «Pago en MERCADONA TORDERA») o que su comercio sea exactamente ese
 * (las reglas creadas desde un grupo guardan la clave del grupo, p. ej. «bizum a · demba mballo»).
 */
export function aplicaRegla(regla: ReglaCategoria, concepto: string): boolean {
  if (regla.texto.length < 2) return false;
  if (claveComercio(concepto).clave === regla.texto) return true;
  return normalizarConcepto(concepto).includes(regla.texto);
}

/** Categoría que dicta la regla más específica (la de texto más largo) que aplique. */
export function categoriaPorReglas(concepto: string, reglas: ReglaCategoria[]): string | null {
  let mejor: ReglaCategoria | null = null;
  for (const r of reglas) {
    if (aplicaRegla(r, concepto) && (!mejor || r.texto.length > mejor.texto.length)) mejor = r;
  }
  return mejor?.categoria || null;
}

export function crearRegla(texto: string, categoria: string): ReglaCategoria {
  return { id: uuidv4(), texto: normalizarTextoRegla(texto), categoria, creada: Date.now() };
}

/**
 * Añade reglas sin repetir: si ya hay una con el mismo texto, la nueva la sustituye
 * (el usuario ha cambiado de idea sobre ese comercio).
 */
export function fusionarReglas(actuales: ReglaCategoria[], nuevas: ReglaCategoria[]): ReglaCategoria[] {
  const porTexto = new Map(actuales.map(r => [r.texto, r]));
  nuevas.forEach(r => porTexto.set(r.texto, r));
  return Array.from(porTexto.values());
}

/** Movimientos a los que aplica una regla y que aún no tienen su categoría. */
export function pendientesDeRegla(regla: ReglaCategoria, movimientos: Movimiento[]): Movimiento[] {
  return movimientos.filter(m => m.categoria !== regla.categoria && aplicaRegla(regla, m.concepto));
}
