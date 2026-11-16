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

  /* Despesas do casal no mês: quem pagou, parte de cada um e acerto */
  function conjuntoMes(lancs, mes, ids, pct) {
    const r = { total: 0, aPagar: 0, pago: {}, parte: {}, saldo: {}, itens: [], acerto: null };
    ids.forEach((id) => { r.pago[id] = 0; });
    for (const l of lancs || []) {
      if (!l || l.mes !== mes || !(l.valor > 0)) continue;
      r.itens.push(l);
      r.total += l.valor;
      if (l.status === 'pendente') r.aPagar += l.valor;
      if (l.autor in r.pago) r.pago[l.autor] += l.valor;
    }
    r.total = r2(r.total);
    r.aPagar = r2(r.aPagar);
    ids.forEach((id) => { r.pago[id] = r2(r.pago[id]); });
    if (ids.length === 2) {
      const [a, b] = ids;
      r.parte[a] = r2(r.total * (pct[a] || 0));
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

  const api = { r2, mesDe, addMeses, difMeses, addMesesData, parseValor, gerarSerie, resumoPessoal, stable, divisao, conjuntoMes, cofrinho, cartaoPessoa, porCategoria };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FL = api;
})(typeof window !== 'undefined' ? window : globalThis);
