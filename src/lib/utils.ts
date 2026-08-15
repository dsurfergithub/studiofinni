import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Movimiento } from './storage/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to get local YYYY-MM-DD string
export function getLocalFechaIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

/** De dónde salió un movimiento, en cristiano. */
export const ETIQUETA_FUENTE: Record<Movimiento['fuente'], string> = {
  'manual': 'a mano',
  'import:extracto': 'extracto',
  // Histórico: todos los extractos se etiquetaban así antes del lector genérico.
  'import:caixabank': 'extracto',
  'import:plantilla': 'plantilla',
  'suscripcion': 'suscripción',
};
