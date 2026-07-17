import { describe, it, expect } from 'vitest';
import {
  derivarMeses, calcularNombreMes, generarMesesFuturos, mesesRestantesDelAnio,
  mesIdDeMovimiento, movimientoEnMes, fechaDentroDeMes,
  generarMesAnterior, mesesParaCubrir,
} from '../finmes/finmes';
import type { MesFinanciero, Movimiento } from '../storage/types';

const nominas = [
  { id: 'n1', fecha: '2026-04-27', importe: 1800, concepto: 'Nómina abril' },
  { id: 'n2', fecha: '2026-05-26', importe: 1800, concepto: 'Nómina mayo' },
  { id: 'n3', fecha: '2026-06-25', importe: 1800, concepto: 'Nómina junio' },
];

describe('derivarMeses', () => {
  it('genera un periodo por nómina, el más reciente primero', () => {
    const meses = derivarMeses(nominas);
    expect(meses).toHaveLength(3);
    expect(meses[0].inicio).toBe('2026-06-25');
  });

  it('cada periodo termina el día antes de la siguiente nómina', () => {
    const meses = derivarMeses(nominas);
    expect(meses[1].inicio).toBe('2026-05-26');
    expect(meses[1].fin).toBe('2026-06-24');
  });

  it('el último periodo es estimado (+29 días)', () => {
    const meses = derivarMeses(nominas);
    expect(meses[0].esEstimado).toBe(true);
    expect(meses[0].fin).toBe('2026-07-24');
  });

  it('sin nóminas devuelve el mes natural actual con id mes-YYYY-MM (mismo formato que el onboarding)', () => {
    const meses = derivarMeses([]);
    expect(meses).toHaveLength(1);
    expect(meses[0].id).toMatch(/^mes-\d{4}-\d{2}$/);
  });
});

describe('calcularNombreMes', () => {
  it('usa el mes natural con más días del rango', () => {
    // 25 jun → 24 jul: julio tiene más días (24 vs 6)
    expect(calcularNombreMes('2026-06-25', '2026-07-24').nombre).toBe('Julio 2026');
  });
});

describe('generarMesesFuturos', () => {
  const base: MesFinanciero = { id: 'mes-2026-07', nombre: 'Julio 2026', clave: '2026-07', inicio: '2026-07-01', fin: '2026-07-31' };

  it('genera los meses que quedan hasta diciembre', () => {
    const fut = generarMesesFuturos(base, mesesRestantesDelAnio(base));
    expect(fut).toHaveLength(5);
    expect(fut[0].inicio).toBe('2026-08-01');
    expect(fut[0].fin).toBe('2026-08-31');
  });

  it('los periodos son contiguos, sin huecos ni solapes', () => {
    const fut = generarMesesFuturos(base, 5);
    let prevFin = base.fin;
    for (const m of fut) {
      const d = new Date(prevFin);
      d.setDate(d.getDate() + 1);
      expect(m.inicio).toBe(d.toISOString().slice(0, 10));
      prevFin = m.fin;
    }
  });

  it('también es contiguo con periodos de mitad de mes', () => {
    const meses = derivarMeses(nominas);
    const fut = generarMesesFuturos(meses[0], 3);
    expect(fut[0].inicio).toBe('2026-07-25');
  });
});

describe('generarMesAnterior', () => {
  const base: MesFinanciero = { id: 'mes-2026-07', nombre: 'Julio 2026', clave: '2026-07', inicio: '2026-07-01', fin: '2026-07-31' };

  it('termina el día antes del inicio de base (contiguo, sin solape)', () => {
    const prev = generarMesAnterior(base);
    expect(prev.fin).toBe('2026-06-30'); // justo antes del 2026-07-01
    expect(prev.inicio < prev.fin).toBe(true);
    expect(prev.clave).toBe('2026-06'); // el mes natural con más días del rango
  });

  it('es contiguo también con periodos de mitad de mes', () => {
    const meses = derivarMeses(nominas); // meses[meses.length-1] = abril, inicio 2026-04-27
    const abril = meses[meses.length - 1];
    const prev = generarMesAnterior(abril);
    expect(prev.fin).toBe('2026-04-26');
  });
});

describe('mesesParaCubrir', () => {
  const meses = derivarMeses(nominas); // cubre 2026-04-27 .. 2026-07-24

  it('no añade nada si el rango ya está cubierto', () => {
    expect(mesesParaCubrir(meses, '2026-05-10', '2026-07-01')).toHaveLength(0);
  });

  it('extiende al futuro para cubrir una fecha posterior (contiguo, sin solapes)', () => {
    const nuevos = mesesParaCubrir(meses, '2026-07-10', '2026-09-15');
    expect(nuevos.length).toBeGreaterThan(0);
    // El primero arranca justo tras el fin del periodo más nuevo (2026-07-24)
    const cronologicos = [...nuevos].sort((a, b) => a.inicio.localeCompare(b.inicio));
    expect(cronologicos[0].inicio).toBe('2026-07-25');
    // Alguno cubre la fecha máxima
    expect(nuevos.some(m => '2026-09-15' >= m.inicio && '2026-09-15' <= m.fin)).toBe(true);
  });

  it('extiende al pasado para cubrir una fecha anterior', () => {
    const nuevos = mesesParaCubrir(meses, '2026-03-10', '2026-07-01');
    expect(nuevos.some(m => '2026-03-10' >= m.inicio && '2026-03-10' <= m.fin)).toBe(true);
  });

  it('devuelve [] si no hay meses de los que partir', () => {
    expect(mesesParaCubrir([], '2026-01-01', '2026-12-31')).toHaveLength(0);
  });
});

describe('movimientoEnMes / mesIdDeMovimiento (traspasos)', () => {
  const meses = derivarMeses(nominas);
  const mov: Movimiento = { id: 'm1', fecha: '2026-06-26', importe: -10, concepto: 'x', categoria: 'c', fuente: 'manual', hash: 'h1' };

  it('sin pin, pertenece al mes de su fecha', () => {
    expect(movimientoEnMes(mov, meses[0], meses)).toBe(true);
  });

  it('con pin, cuenta SOLO en el mes pineado', () => {
    const pineado = { ...mov, mesId: meses[1].id };
    expect(movimientoEnMes(pineado, meses[1], meses)).toBe(true);
    expect(movimientoEnMes(pineado, meses[0], meses)).toBe(false);
  });

  it('un pin a un mes inexistente cae al mes por fecha', () => {
    const huerfano = { ...mov, mesId: 'mes-inexistente' };
    expect(mesIdDeMovimiento(huerfano, meses)).toBe(meses[0].id);
  });
});

describe('fechaDentroDeMes', () => {
  it('nunca devuelve una fecha inválida (31 en mes de 30)', () => {
    const mes: MesFinanciero = { id: 'x', nombre: '', clave: '2026-06', inicio: '2026-06-01', fin: '2026-06-30' };
    const r = fechaDentroDeMes(mes, '2026-05-31');
    expect(r).not.toBe('2026-06-31');
    expect(r >= mes.inicio && r <= mes.fin).toBe(true);
  });
});
