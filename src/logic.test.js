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

// contas fixas: internet dia 31 desde out/2026, até dez/2026; nov já existe; dez pulado
const fx = [{ id: 'f1', valor: 120, dia: 31, inicio: '2026-10', pulados: ['2026-12'] }, { id: 'f2', valor: 50, dia: 5, inicio: '2026-11', ativa: false }];
const ger = F.fixasAGerar(fx, new Set([F.idFixa('f1', '2026-11')]), '2027-01', '2026-11');
assert.deepStrictEqual(ger.map((g) => g.id), ['fx_f1_2026-10', 'fx_f1_2027-01']);
assert.strictEqual(ger[0].data, '2026-10-31');
assert.strictEqual(ger[0].status, 'pago');
assert.strictEqual(ger[1].data, '2027-01-31');
assert.strictEqual(ger[1].status, 'pendente');
assert.deepStrictEqual(F.fixasAGerar([{ id: 'f3', valor: 10, dia: 30, inicio: '2027-02' }], new Set(), '2027-02', '2026-11').map((g) => g.data), ['2027-02-28']);

// orçamento
const orc = F.orcamento([['mercado', 1250], ['lazer', 170], ['saude', 90]], { mercado: 1200, lazer: 200, transporte: 300 });
assert.deepStrictEqual(orc.linhas.map((l) => [l.cat, l.status]), [['mercado', 'estourou'], ['lazer', 'perto'], ['transporte', 'ok'], ['saude', 'sem']]);
assert.strictEqual(orc.linhas[0].sobra, -50);
assert.deepStrictEqual(orc.total, { gasto: 1420, limite: 1700, sobra: 280 });
assert.strictEqual(orc.alertas.length, 2);
assert.strictEqual(F.orcamento([['mercado', 10]], {}).total, null);

// evolução: nov/2026 do exemplo acima
const ev = F.evolucao(['2026-10', '2026-11'], [E, C], resumos, conj, movs, {}, 'casal');
assert.deepStrictEqual(ev[1], { mes: '2026-11', renda: 10000, gastos: 1800 + 800 + 1500, guardado: 1000, sobra: 10000 - 4100 - 1000 });
assert.strictEqual(ev[0].gastos, 999);
const evE = F.evolucao(['2026-11'], [E, C], resumos, conj, movs, {}, 'e');
assert.deepStrictEqual(evE[0], { mes: '2026-11', renda: 6000, gastos: 1800 + 900, guardado: 700, sobra: 6000 - 2700 - 700 });
console.log('OK — todos os testes passaram');

// divisão por lançamento: Eduardo pagou 300 "só Camila" e 100 meio a meio; Camila pagou 200 padrão (60/40)
const cj2 = F.conjuntoMes([
  { autor: 'e', valor: 300, mes: '2026-12', divisao: 'so_outro' },
  { autor: 'e', valor: 100, mes: '2026-12', divisao: 'igual' },
  { autor: 'c', valor: 200, mes: '2026-12' },
  { autor: 'c', valor: 50, mes: '2026-12', divisao: 'so_autor' },
], '2026-12', ['e', 'c'], { e: 0.6, c: 0.4 });
assert.strictEqual(cj2.parte.e, 0 + 50 + 120 + 0);
assert.strictEqual(cj2.parte.c, 650 - 170);
assert.deepStrictEqual(cj2.acerto, { de: 'c', para: 'e', valor: 400 - 170 });

// cartões
assert.strictEqual(F.mesFatura('2026-11-02', 3, 10), '2026-11');
assert.strictEqual(F.mesFatura('2026-11-03', 3, 10), '2026-12');
assert.strictEqual(F.mesFatura('2026-11-10', 28, 5), '2026-12');
assert.strictEqual(F.mesFatura('2026-11-29', 28, 5), '2027-01');
assert.strictEqual(F.mesFatura('2026-12-20', 15, 22), '2027-01');
assert.strictEqual(F.vencFatura('2027-02', 30), '2027-02-28');
assert.strictEqual(F.normalizar('  Ágüa Énergia '), 'agua energia');
console.log('OK — testes da entrega 1');

// previsão
const fxP = [{ id: 'p1', valor: 1000, dia: 10, inicio: '2026-11', tipo: 'despesa' }, { id: 'p2', valor: 5000, dia: 5, inicio: '2026-11', tipo: 'receita' },
  { id: 'p3', valor: 60, dia: 20, inicio: '2026-11', tipo: 'despesa', pag: 'cartao', cartaoId: 'k', fim: '2027-01' }];
const lancP = [
  { id: F.idFixa('p1', '2026-11'), mes: '2026-11', valor: 1000, tipo: 'despesa', fixaId: 'p1' },
  { id: 'x1', mes: '2027-01', valor: 40, tipo: 'despesa', grupo: 'g1' },
  { id: 'v1', mes: '2026-10', valor: 600, tipo: 'despesa' }, { id: 'v2', mes: '2026-09', valor: 300, tipo: 'despesa' },
];
const proj = F.projecao(lancP, fxP, ['2026-11', '2026-12', '2027-01', '2027-02'], '2026-11', { k: { fechamento: 3, vencimento: 10 } }, { '2027-02': 7500 });
assert.deepStrictEqual(proj.map((p) => [p.mes, p.renda, p.despesas]), [['2026-11', 5000, 1000], ['2026-12', 5000, 1060], ['2027-01', 5000, 1100], ['2027-02', 7500, 1060]]);
assert.strictEqual(F.mediaVariavel(lancP, '2026-11'), 450);
const prevs = { e: {}, c: {} };
proj.forEach((p) => { prevs.e[p.mes] = p; prevs.c[p.mes] = { renda: 2500, despesas: 500 }; });
const pv = F.previsao({ meses: ['2026-12'], ids: ['e', 'c'], prevs, varMedias: { e: 450, c: 100 }, resumos: {}, conj: [],
  fixasCasal: [{ id: 'q1', autor: 'e', valor: 1500, dia: 10, inicio: '2026-11' }], mesHoje: '2026-11', cfg: {}, metasPorMes: { '2026-12': 2000 }, incluirVar: true, quem: 'casal' });
assert.deepStrictEqual(pv[0], { mes: '2026-12', renda: 7500, compromissos: 1060 + 500 + 1500, variaveis: 550, metas: 2000, sobra: 7500 - 3060 - 550 - 2000, pct: (3060 + 550) / 7500 });
const pvE = F.previsao({ meses: ['2026-12'], ids: ['e', 'c'], prevs, varMedias: { e: 450, c: 100 }, resumos: {}, conj: [],
  fixasCasal: [{ id: 'q1', autor: 'e', valor: 1500, dia: 10, inicio: '2026-11' }], mesHoje: '2026-11', cfg: {}, metasPorMes: { '2026-12': 2000 }, incluirVar: false, quem: 'e' });
assert.strictEqual(pvE[0].compromissos, 1060 + 1000);
assert.strictEqual(pvE[0].metas, 1333.33);

// visão do ano
const anoC = F.anoCategorias([{ mes: '2026-08', cat: 'agua', valor: 70 }, { mes: '2026-09', cat: 'agua', valor: 70 }, { mes: '2027-01', cat: 'agua', valor: 99 }, { mes: '2026-09', cat: 'salario', valor: 5000, tipo: 'receita' }], 2026, (l) => l.tipo !== 'receita');
assert.deepStrictEqual(anoC.agua.slice(7, 9), [70, 70]);
assert.deepStrictEqual(F.totalMedia(anoC.agua), { total: 140, media: 70 });
console.log('OK — testes da entrega 2');

// no mês atual, a média do dia a dia desconta o que já foi gasto
const pvAt = F.previsao({ meses: ['2026-11'], ids: ['e', 'c'], prevs: { e: { '2026-11': { renda: 5000, despesas: 1300 } }, c: { '2026-11': { renda: 2500, despesas: 500 } } },
  varMedias: { e: 450, c: 100 }, varAtuais: { e: 300, c: 150 }, resumos: {}, conj: [], fixasCasal: [], mesHoje: '2026-11', cfg: {}, metasPorMes: {}, incluirVar: true, quem: 'casal' });
assert.strictEqual(pvAt[0].variaveis, 150);
assert.strictEqual(F.gastoVariavel(lancP, '2026-10'), 600);
console.log('OK — previsão sem contar duas vezes o mês atual');
