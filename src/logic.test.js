import assert from 'node:assert';
import './logic.js';
const F = globalThis.FL;

// valores
assert.strictEqual(F.parseValor('1.234,56'), 1234.56);
assert.strictEqual(F.parseValor('1234,5'), 1234.5);
assert.strictEqual(F.parseValor('1.234'), 1234);
assert.strictEqual(F.parseValor('12.5'), 12.5);
assert.strictEqual(F.parseValor('R$ 80'), 80);
assert.ok(Number.isNaN(F.parseValor('abc')));

// datas
assert.strictEqual(F.addMeses('2026-11', 2), '2027-01');
assert.strictEqual(F.addMeses('2027-01', -1), '2026-12');
assert.strictEqual(F.difMeses('2026-11', '2027-05'), 6);
assert.strictEqual(F.addMesesData('2026-01-31', 1), '2026-02-28');

// parcelas
const p = F.gerarSerie(100, 3, 'parcelada', '2026-11-16');
assert.deepStrictEqual(p.map((x) => x.valor), [33.34, 33.33, 33.33]);
assert.deepStrictEqual(p.map((x) => x.data), ['2026-11-16', '2026-12-16', '2027-01-16']);
assert.strictEqual(F.gerarSerie(150, 4, 'fixa', '2026-11-05').every((x) => x.valor === 150), true);

// resumo e divisão
const E = 'e', C = 'c';
const lancE = [
  { tipo: 'receita', valor: 6000, mes: '2026-11', status: 'pago' },
  { tipo: 'despesa', valor: 1500, mes: '2026-11', status: 'pago' },
  { tipo: 'despesa', valor: 300, mes: '2026-11', status: 'pendente' },
];
const lancC = [{ tipo: 'receita', valor: 4000, mes: '2026-11', status: 'pago' }, { tipo: 'despesa', valor: 800, mes: '2026-11', status: 'pago' }];
const resumos = { e: { meses: F.resumoPessoal(lancE) }, c: { meses: F.resumoPessoal(lancC) } };
assert.deepStrictEqual(resumos.e.meses['2026-11'], { renda: 6000, despesas: 1800, aPagar: 300, aReceber: 0 });
const d = F.divisao('2026-11', [E, C], resumos, {});
assert.strictEqual(d.base, 'renda');
assert.ok(Math.abs(d.pct.e - 0.6) < 1e-9);
// mês sem renda dos dois usa o anterior
const d2 = F.divisao('2026-12', [E, C], resumos, {});
assert.strictEqual(d2.mesBase, '2026-11');
// fixo
assert.ok(Math.abs(F.divisao('2026-11', [E, C], resumos, { modo: 'fixo', fixo: { e: 70, c: 30 } }).pct.c - 0.3) < 1e-9);

// conjunto: Eduardo pagou 1000, Camila pagou 500 → total 1500, parte E 900, C 600 → Camila deve 100
const conj = [
  { autor: E, valor: 1000, mes: '2026-11', status: 'pago' },
  { autor: C, valor: 500, mes: '2026-11', status: 'pendente' },
  { autor: C, valor: 999, mes: '2026-10', status: 'pago' },
];
const cm = F.conjuntoMes(conj, '2026-11', [E, C], d.pct);
assert.strictEqual(cm.total, 1500);
assert.strictEqual(cm.parte.e, 900);
assert.strictEqual(cm.parte.c, 600);
assert.deepStrictEqual(cm.acerto, { de: C, para: E, valor: 100 });
assert.strictEqual(cm.aPagar, 500);

// cofrinho: meta 12000, maio/2027, guardado 1000 (E 700, C 400, retirada C 100)
const movs = [
  { autor: E, tipo: 'deposito', valor: 700, mes: '2026-11' },
  { autor: C, tipo: 'deposito', valor: 400, mes: '2026-11' },
  { autor: C, tipo: 'retirada', valor: 100, mes: '2026-11' },
];
const cf = F.cofrinho(movs, { meta: 12000, mes: '2027-05' }, '2026-11', [E, C], d.pct);
assert.strictEqual(cf.guardado, 1000);
assert.strictEqual(cf.falta, 11000);
assert.strictEqual(cf.mesesRestantes, 6);
assert.strictEqual(cf.porMes, 1833.33);
assert.strictEqual(cf.sugestao.e + cf.sugestao.c, 1833.33);
assert.strictEqual(cf.noMes['2026-11'].c, 300);

// cartão
const ce = F.cartaoPessoa(resumos.e.meses['2026-11'], cm.parte.e, cf.noMes['2026-11'].e);
assert.strictEqual(ce.saldo, 6000 - 1800 - 900 - 700);
assert.strictEqual(ce.comprometido, 2700);

assert.strictEqual(F.stable({ b: 1, a: { d: 2, c: 3 } }), F.stable({ a: { c: 3, d: 2 }, b: 1 }));
console.log('OK — todos os testes passaram');
