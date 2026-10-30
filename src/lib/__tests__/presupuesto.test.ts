import { describe, it, expect } from 'vitest';
import {
  Presupuestos, limiteDe, categoriasConPresupuesto, ponerLimiteGeneral, ponerLimiteDelMes,
  quitarPresupuesto, alcancesPosibles, pendientePorCategoria,
} from '../presupuesto/presupuesto';
import { MesFinanciero } from '../storage/types';

const mes = (id: string, inicio: string): MesFinanciero =>
  ({ id, nombre: id, clave: inicio.slice(0, 7), inicio, fin: inicio });

const ENE = mes('mes-2026-01', '2026-01-01');
const FEB = mes('mes-2026-02', '2026-02-01');
const MAR = mes('mes-2026-03', '2026-03-01');
const ABR = mes('mes-2026-04', '2026-04-01');
const MESES = [ABR, MAR, FEB, ENE];

describe('limiteDe y categoriasConPresupuesto', () => {
  it('la excepción del mes manda sobre el general; null es «sin presupuesto»', () => {
    const p: Presupuestos = {
      budgetTemplate: { comida: 300 },
      budgetOverrides: { [FEB.id]: { comida: 250 }, [MAR.id]: { comida: null } },
    };
    expect(limiteDe(p, 'comida', ENE.id)).toBe(300);
    expect(limiteDe(p, 'comida', FEB.id)).toBe(250);
    expect(limiteDe(p, 'comida', MAR.id)).toBeNull();
    expect(categoriasConPresupuesto(p, MAR.id).has('comida')).toBe(false);
  });

  it('0 € es un presupuesto, no la ausencia de uno', () => {
    const p: Presupuestos = { budgetTemplate: {}, budgetOverrides: { [FEB.id]: { ocio: 0 } } };
    expect(limiteDe(p, 'ocio', FEB.id)).toBe(0);
    expect(categoriasConPresupuesto(p, FEB.id).has('ocio')).toBe(true);
    expect(limiteDe(p, 'ocio', ENE.id)).toBeNull();
  });
});

describe('poner límites', () => {
  it('el general quita la excepción del mes desde el que se pone', () => {
    const p: Presupuestos = { budgetTemplate: {}, budgetOverrides: { [FEB.id]: { comida: null }, [ENE.id]: { comida: 100 } } };
    const r = ponerLimiteGeneral(p, 'comida', 300, FEB.id);
    expect(limiteDe(r, 'comida', FEB.id)).toBe(300);
    expect(limiteDe(r, 'comida', ENE.id)).toBe(100);
  });

  it('el del mes no toca el general', () => {
    const r = ponerLimiteDelMes({ budgetTemplate: { comida: 300 }, budgetOverrides: {} }, 'comida', 200, MAR.id);
    expect(limiteDe(r, 'comida', MAR.id)).toBe(200);
    expect(limiteDe(r, 'comida', ABR.id)).toBe(300);
  });
});

describe('quitarPresupuesto', () => {
  it('un presupuesto solo de este mes se puede quitar (antes se quedaba fijo)', () => {
    const p: Presupuestos = { budgetTemplate: {}, budgetOverrides: { [MAR.id]: { regalos: 80 } } };
    expect(alcancesPosibles(p, 'regalos', MAR, MESES)).toEqual(['mes']);
    const r = quitarPresupuesto(p, 'regalos', 'mes', MAR, MESES);
    expect(limiteDe(r, 'regalos', MAR.id)).toBeNull();
  });

  it("'mes' con límite general: solo ese mes queda sin presupuesto", () => {
    const p: Presupuestos = { budgetTemplate: { comida: 300 }, budgetOverrides: { [MAR.id]: { comida: 350 } } };
    const r = quitarPresupuesto(p, 'comida', 'mes', MAR, MESES);
    expect(limiteDe(r, 'comida', MAR.id)).toBeNull();
    expect(limiteDe(r, 'comida', FEB.id)).toBe(300);
    expect(limiteDe(r, 'comida', ABR.id)).toBe(300);
  });

  it("'desde' conserva el histórico, incluidas sus excepciones", () => {
    const p: Presupuestos = {
      budgetTemplate: { comida: 300 },
      budgetOverrides: { [ENE.id]: { comida: 280 }, [MAR.id]: { comida: 350 }, [ABR.id]: { comida: 400 } },
    };
    const r = quitarPresupuesto(p, 'comida', 'desde', MAR, MESES);
    expect(limiteDe(r, 'comida', ENE.id)).toBe(280);
    expect(limiteDe(r, 'comida', FEB.id)).toBe(300);
    expect(limiteDe(r, 'comida', MAR.id)).toBeNull();
    expect(limiteDe(r, 'comida', ABR.id)).toBeNull();
    // Un mes que aparezca después tampoco lo hereda.
    expect(limiteDe(r, 'comida', 'mes-2026-05')).toBeNull();
  });

  it("'todos' lo quita también del histórico y no toca otras categorías", () => {
    const p: Presupuestos = {
      budgetTemplate: { comida: 300, ocio: 100 },
      budgetOverrides: { [ENE.id]: { comida: 280, ocio: 50 } },
    };
    const r = quitarPresupuesto(p, 'comida', 'todos', MAR, MESES);
    for (const m of MESES) expect(limiteDe(r, 'comida', m.id)).toBeNull();
    expect(limiteDe(r, 'ocio', ENE.id)).toBe(50);
    expect(limiteDe(r, 'ocio', MAR.id)).toBe(100);
  });

  it('volver al estado anterior deshace el borrado', () => {
    const p: Presupuestos = { budgetTemplate: { comida: 300 }, budgetOverrides: { [ENE.id]: { comida: 280 } } };
    const copia = JSON.parse(JSON.stringify(p));
    quitarPresupuesto(p, 'comida', 'todos', MAR, MESES);
    expect(p).toEqual(copia);
  });
});

describe('alcancesPosibles', () => {
  it('con límite general se ofrecen los tres', () => {
    const p: Presupuestos = { budgetTemplate: { comida: 300 }, budgetOverrides: {} };
    expect(alcancesPosibles(p, 'comida', MAR, MESES)).toEqual(['mes', 'desde', 'todos']);
  });

  it('solo excepciones anteriores: este mes o todos', () => {
    const p: Presupuestos = { budgetTemplate: {}, budgetOverrides: { [ENE.id]: { x: 10 }, [MAR.id]: { x: 20 } } };
    expect(alcancesPosibles(p, 'x', MAR, MESES)).toEqual(['mes', 'todos']);
  });
});

describe('pendientePorCategoria', () => {
  it('un exceso en una categoría no se come lo pendiente de otra', () => {
    const filas = [{ budget: 300, spent: 400 }, { budget: 100, spent: 0 }];
    expect(pendientePorCategoria(filas)).toBe(100);
  });
});
