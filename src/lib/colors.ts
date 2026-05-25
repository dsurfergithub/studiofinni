export const PALETA_COLORES = [
  '#4ade80', '#fbbf24', '#ff5478', '#b794ff', '#60a5fa', 
  '#34d399', '#f87171', '#a78bfa', '#38bdf8', '#818cf8',
  '#fb923c', '#e879f9', '#2dd4bf', '#f472b6', '#a3e635',
  '#22d3ee', '#fb7185'
];

export function getDeterministaColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PALETA_COLORES.length;
  return PALETA_COLORES[idx];
}
