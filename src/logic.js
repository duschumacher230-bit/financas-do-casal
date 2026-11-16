/* Lógica pura do app Finanças do Casal (sem DOM, testável em Node) */
(function (root) {
  const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const pad = (n) => String(n).padStart(2, '0');

  function mesDe(data) { return String(data || '').slice(0, 7); }

  function addMeses(mes, n) {
    const [y, m] = mes.split('-').map(Number);
    const t = y * 12 + (m - 1) + n;
    const ny = Math.floor(t / 12);
    return ny + '-' + pad(t - ny * 12 + 1);
  }

  function difMeses(a, b) {
    const [ya, ma] = a.split('-').map(Number);
    const [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  }

  function diasNoMes(y, m) { return new Date(y, m, 0).getDate(); }

  function addMesesData(dataISO, n) {
    const [y, m, d] = dataISO.split('-').map(Number);
    const mes = addMeses(y + '-' + pad(m), n);
    const [ny, nm] = mes.split('-').map(Number);
    return mes + '-' + pad(Math.min(d, diasNoMes(ny, nm)));
  }

  /* Aceita "1.234,56", "1234,5", "1.234", "12.5", "R$ 80" */
  function parseValor(txt) {
    let s = String(txt == null ? '' : txt).trim().replace(/[R$\s ]/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    if (!/^\d*\.?\d+$/.test(s)) return NaN;
    return r2(Number(s));
  }

  /* Gera a série de lançamentos: única, parcelada (divide o total) ou fixa (repete o valor) */
  function gerarSerie(valor, n, modo, data) {
    n = Math.max(1, Math.min(60, Math.floor(Number(n) || 1)));
    if (modo === 'unica' || n === 1) return [{ valor: r2(valor), data, parcela: null }];
    const out = [];
    if (modo === 'parcelada') {
      const cents = Math.round(valor * 100);
      const base = Math.floor(cents / n);
      const resto = cents - base * n;
      for (let i = 0; i < n; i++) {
        out.push({ valor: (base + (i < resto ? 1 : 0)) / 100, data: addMesesData(data, i), parcela: (i + 1) + '/' + n });
      }
    } else {
      for (let i = 0; i < n; i++) out.push({ valor: r2(valor), data: addMesesData(data, i), parcela: (i + 1) + '/' + n });
    }
    return out;
  }

  /* Totais por mês dos lançamentos individuais — é só isso que o outro enxerga */
  function resumoPessoal(lancs) {
    const meses = {};
    for (const l of lancs || []) {
      if (!l || !l.mes || !(l.valor > 0)) continue;
      const m = meses[l.mes] || (meses[l.mes] = { renda: 0, despesas: 0, aPagar: 0, aReceber: 0 });
      if (l.tipo === 'receita') {
        m.renda += l.valor;
        if (l.status === 'pendente') m.aReceber += l.valor;
      } else {
        m.despesas += l.valor;
        if (l.status === 'pendente') m.aPagar += l.valor;
      }
    }
    for (const k in meses) for (const f in meses[k]) meses[k][f] = r2(meses[k][f]);
    return meses;
  }

  function stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }

  /* Percentual de cada um nas despesas do casal */
  function divisao(mes, ids, resumos, cfg) {
    const [a, b] = ids;
    if (!a) return { pct: {}, base: 'vazio' };
    if (!b) return { pct: { [a]: 1 }, base: 'sozinho' };
    const modo = (cfg && cfg.modo) || 'renda';
    if (modo === 'igual') return { pct: { [a]: 0.5, [b]: 0.5 }, base: 'igual' };
    if (modo === 'fixo' && cfg.fixo) {
      let pa = null;
      if (typeof cfg.fixo[a] === 'number') pa = cfg.fixo[a] / 100;
      else if (typeof cfg.fixo[b] === 'number') pa = 1 - cfg.fixo[b] / 100;
      if (pa !== null) {
        pa = Math.min(1, Math.max(0, pa));
        return { pct: { [a]: pa, [b]: 1 - pa }, base: 'fixo' };
      }
    }
    const ra = (resumos[a] && resumos[a].meses) || {};
    const rb = (resumos[b] && resumos[b].meses) || {};
    for (let i = 0; i <= 12; i++) {
      const m = addMeses(mes, -i);
      const x = (ra[m] && ra[m].renda) || 0;
      const y = (rb[m] && rb[m].renda) || 0;
      if (x > 0 && y > 0) return { pct: { [a]: x / (x + y), [b]: y / (x + y) }, base: 'renda', mesBase: m };
    }
    return { pct: { [a]: 0.5, [b]: 0.5 }, base: 'semRenda' };
  }

  /* Divisão de um lançamento do casal: padrão (proporcional/config), meio a meio, só quem pagou ou só o outro */
  function pctItem(l, ids, pct) {
    if (ids.length !== 2 || !l) return pct;
    const [a, b] = ids;
    const modo = l.divisao || 'padrao';
    if (modo === 'igual') return { [a]: 0.5, [b]: 0.5 };
    if ((modo === 'so_autor' || modo === 'so_outro') && (l.autor === a || l.autor === b)) {
      const outro = l.autor === a ? b : a;
      return modo === 'so_autor' ? { [l.autor]: 1, [outro]: 0 } : { [l.autor]: 0, [outro]: 1 };
    }
    return pct;
  }

  /* Despesas do casal no mês: quem pagou, parte de cada um e acerto */
  function conjuntoMes(lancs, mes, ids, pct) {
    const r = { total: 0, aPagar: 0, pago: {}, parte: {}, saldo: {}, itens: [], acerto: null };
    ids.forEach((id) => { r.pago[id] = 0; });
    const bruto = {};
    ids.forEach((id) => { bruto[id] = 0; });
    for (const l of lancs || []) {
      if (!l || l.mes !== mes || !(l.valor > 0)) continue;
      r.itens.push(l);
      r.total += l.valor;
      if (l.status === 'pendente') r.aPagar += l.valor;
      if (l.autor in r.pago) r.pago[l.autor] += l.valor;
      const p = pctItem(l, ids, pct);
      ids.forEach((id) => { bruto[id] += l.valor * (p[id] || 0); });
    }
    r.total = r2(r.total);
    r.aPagar = r2(r.aPagar);
    ids.forEach((id) => { r.pago[id] = r2(r.pago[id]); });
    if (ids.length === 2) {
      const [a, b] = ids;
      r.parte[a] = r2(bruto[a]);
      r.parte[b] = r2(r.total - r.parte[a]);
      r.saldo[a] = r2(r.pago[a] - r.parte[a]);
      r.saldo[b] = r2(r.pago[b] - r.parte[b]);
      const s = r.saldo[a];
      if (Math.abs(s) >= 0.01) r.acerto = s > 0 ? { de: b, para: a, valor: r2(s) } : { de: a, para: b, valor: r2(-s) };
    } else if (ids.length === 1) {
      r.parte[ids[0]] = r.total;
      r.saldo[ids[0]] = r2(r.pago[ids[0]] - r.total);
    }
    return r;
  }

  /* Cofrinho da viagem */
  function cofrinho(movs, viagem, mesHoje, ids, pct) {
    const meta = (viagem && Number(viagem.meta)) || 0;
    const mesAlvo = (viagem && viagem.mes) || null;
    const porPessoa = {};
    const noMes = {};
    ids.forEach((id) => { porPessoa[id] = 0; });
    let guardado = 0;
    for (const m of movs || []) {
      if (!m || !(m.valor > 0)) continue;
      const v = (m.tipo === 'retirada' ? -1 : 1) * m.valor;
      guardado += v;
      if (m.autor in porPessoa) porPessoa[m.autor] += v;
      const k = m.mes;
      noMes[k] = noMes[k] || {};
      noMes[k][m.autor] = (noMes[k][m.autor] || 0) + v;
    }
    guardado = r2(guardado);
    for (const id in porPessoa) porPessoa[id] = r2(porPessoa[id]);
    for (const k in noMes) for (const id in noMes[k]) noMes[k][id] = r2(noMes[k][id]);
    const falta = r2(Math.max(0, meta - guardado));
    let mesesRestantes = null;
    let porMes = null;
    if (mesAlvo) {
      mesesRestantes = Math.max(0, difMeses(mesHoje, mesAlvo));
      porMes = mesesRestantes > 0 ? r2(falta / mesesRestantes) : falta;
    }
    const sugestao = {};
    if (porMes !== null && ids.length === 2) {
      const [a, b] = ids;
      sugestao[a] = r2(porMes * (pct[a] || 0));
      sugestao[b] = r2(porMes - sugestao[a]);
    } else if (porMes !== null && ids.length === 1) {
      sugestao[ids[0]] = porMes;
    }
    return { meta, mesAlvo, guardado, porPessoa, noMes, falta, progresso: meta > 0 ? Math.min(1, Math.max(0, guardado / meta)) : 0, mesesRestantes, porMes, sugestao };
  }

  /* Cartão de cada pessoa no painel */
  function cartaoPessoa(resumoMes, parteCasal, guardadoMes) {
    const renda = (resumoMes && resumoMes.renda) || 0;
    const gastos = (resumoMes && resumoMes.despesas) || 0;
    const aPagar = (resumoMes && resumoMes.aPagar) || 0;
    const parte = parteCasal || 0;
    const guardado = guardadoMes || 0;
    const comprometido = r2(gastos + parte);
    return {
      renda, gastos, parte, guardado, aPagar, comprometido,
      saldo: r2(renda - gastos - parte - guardado),
      pctComprometido: renda > 0 ? comprometido / renda : null,
    };
  }

  function porCategoria(lancs, filtro) {
    const out = {};
    for (const l of lancs || []) {
      if (filtro && !filtro(l)) continue;
      const c = l.cat || 'outros';
      out[c] = r2((out[c] || 0) + (l.valor || 0));
    }
    return Object.entries(out).sort((x, y) => y[1] - x[1]);
  }

  /* ---------- cartões de crédito ---------- */
  /* Mês da fatura em que cai uma compra: comprou no dia do fechamento ou depois, vai para a próxima;
     se o vencimento é antes (ou no mesmo dia) do fechamento, a fatura vence no mês seguinte ao fechamento. */
  function mesFatura(dataISO, fechamento, vencimento) {
    const dia = +String(dataISO).slice(8, 10);
    let m = String(dataISO).slice(0, 7);
    if (dia >= fechamento) m = addMeses(m, 1);
    if (!(vencimento > fechamento)) m = addMeses(m, 1);
    return m;
  }
  function vencFatura(mes, vencimento) {
    const [y, mm] = mes.split('-').map(Number);
    return mes + '-' + pad(Math.min(Math.max(1, vencimento || 1), diasNoMes(y, mm)));
  }

  /* Texto sem acento e minúsculo, para busca */
  function normalizar(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  /* ---------- contas fixas ---------- */
  const idFixa = (fixaId, mes) => 'fx_' + fixaId + '_' + mes;

  /* Quais lançamentos das contas fixas ainda faltam criar, de "inicio" até "mesAte".
     existentes: Set com os ids já criados. Meses em "pulados" (excluídos pelo usuário) não voltam. */
  function fixasAGerar(fixas, existentes, mesAte, mesHoje) {
    const out = [];
    for (const f of fixas || []) {
      if (!f || !f.id || f.ativa === false || !f.inicio || !(f.valor > 0)) continue;
      const fim = f.fim && f.fim < mesAte ? f.fim : mesAte;
      const pulados = f.pulados || [];
      let m = f.inicio;
      for (let guarda = 0; m <= fim && guarda < 120; guarda++, m = addMeses(m, 1)) {
        const id = idFixa(f.id, m);
        if (existentes.has(id) || pulados.includes(m)) continue;
        const [y, mm] = m.split('-').map(Number);
        const dia = Math.min(Math.max(1, Math.floor(f.dia || 1)), diasNoMes(y, mm));
        out.push({ id, fixa: f, mes: m, data: m + '-' + pad(dia), status: mesHoje && m < mesHoje ? 'pago' : 'pendente' });
      }
    }
    return out;
  }

  /* ---------- limites por categoria ---------- */
  function orcamento(gastos, limites) {
    const g = {};
    for (const [c, v] of gastos || []) g[c] = v;
    const lim = {};
    for (const c in limites || {}) if (limites[c] > 0) lim[c] = limites[c];
    const cats = Array.from(new Set(Object.keys(g).concat(Object.keys(lim))));
    const linhas = cats.map((c) => {
      const gasto = r2(g[c] || 0);
      const limite = lim[c] || null;
      if (!limite) return { cat: c, gasto, limite: null, pct: null, status: 'sem', sobra: null };
      const pct = gasto / limite;
      const status = pct > 1 ? 'estourou' : pct >= 0.8 ? 'perto' : 'ok';
      return { cat: c, gasto, limite, pct, status, sobra: r2(limite - gasto) };
    });
    const ordem = { estourou: 0, perto: 1, ok: 2, sem: 3 };
    linhas.sort((a, b) => ordem[a.status] - ordem[b.status] || b.gasto - a.gasto);
    const comLimite = linhas.filter((l) => l.limite);
    const total = comLimite.length ? {
      gasto: r2(comLimite.reduce((s, l) => s + l.gasto, 0)),
      limite: r2(comLimite.reduce((s, l) => s + l.limite, 0)),
    } : null;
    if (total) total.sobra = r2(total.limite - total.gasto);
    return { linhas, total, alertas: linhas.filter((l) => l.status === 'estourou' || l.status === 'perto') };
  }

  /* ---------- evolução mês a mês ---------- */
  /* quem: 'casal' ou o id de uma pessoa. Usa só totais (resumos), então serve também para o parceiro. */
  function evolucao(meses, ids, resumos, conj, cofre, cfg, quem) {
    const cof = cofrinho(cofre, null, meses[meses.length - 1], ids, {});
    return meses.map((m) => {
      const div = divisao(m, ids, resumos, cfg);
      const cj = conjuntoMes(conj, m, ids, div.pct);
      const gm = cof.noMes[m] || {};
      const rm = (id) => (resumos[id] && resumos[id].meses && resumos[id].meses[m]) || {};
      let renda, gastos, guardado;
      if (quem === 'casal') {
        renda = ids.reduce((s, id) => s + (rm(id).renda || 0), 0);
        gastos = ids.reduce((s, id) => s + (rm(id).despesas || 0), 0) + cj.total;
        guardado = ids.reduce((s, id) => s + (gm[id] || 0), 0);
      } else {
        renda = rm(quem).renda || 0;
        gastos = (rm(quem).despesas || 0) + (cj.parte[quem] || 0);
        guardado = gm[quem] || 0;
      }
      renda = r2(renda); gastos = r2(gastos); guardado = r2(guardado);
      return { mes: m, renda, gastos, guardado, sobra: r2(renda - gastos - guardado) };
    });
  }

  const api = { r2, pad, mesDe, addMeses, difMeses, diasNoMes, addMesesData, parseValor, gerarSerie, resumoPessoal, stable, divisao, pctItem, conjuntoMes, cofrinho, cartaoPessoa, porCategoria, idFixa, fixasAGerar, orcamento, evolucao, mesFatura, vencFatura, normalizar };
  root.FL = api;
})(typeof window !== 'undefined' ? window : globalThis);
