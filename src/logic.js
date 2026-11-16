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
        guardado = ids.reduce((s, id) => s + (gm[id] || 0) + (rm(id).metas || 0), 0);
      } else {
        renda = rm(quem).renda || 0;
        gastos = (rm(quem).despesas || 0) + (cj.parte[quem] || 0);
        guardado = (gm[quem] || 0) + (rm(quem).metas || 0);
      }
      renda = r2(renda); gastos = r2(gastos); guardado = r2(guardado);
      return { mes: m, renda, gastos, guardado, sobra: r2(renda - gastos - guardado) };
    });
  }

  /* ---------- previsão ---------- */
  /* Média dos gastos do dia a dia (sem contas fixas e sem parcelas) nos 3 meses anteriores */
  function mediaVariavel(lancs, mesHoje) {
    const meses = [1, 2, 3].map((i) => addMeses(mesHoje, -i));
    const soma = {};
    meses.forEach((m) => { soma[m] = 0; });
    for (const l of lancs || []) {
      if (!l || !(l.mes in soma) || l.tipo === 'receita' || l.fixaId || l.grupo || !(l.valor > 0)) continue;
      soma[l.mes] += l.valor;
    }
    const comDados = meses.filter((m) => soma[m] > 0);
    return comDados.length ? r2(comDados.reduce((t, m) => t + soma[m], 0) / comDados.length) : 0;
  }

  /* Gastos do dia a dia já lançados num mês (sem contas fixas e sem parcelas) */
  function gastoVariavel(lancs, mes) {
    return r2((lancs || []).filter((l) => l && l.mes === mes && l.tipo !== 'receita' && !l.fixaId && !l.grupo && l.valor > 0).reduce((t, l) => t + l.valor, 0));
  }

  /* Projeção de uma pessoa: lançamentos já existentes + contas fixas que ainda vão ser lançadas.
     cartoes: {id: {fechamento, vencimento}}; rendaManual: {AAAA-MM: valor} substitui a renda do mês. */
  function projecao(lancs, fixas, meses, mesHoje, cartoes, rendaManual) {
    const set = new Set(meses);
    const r = {};
    meses.forEach((m) => { r[m] = { renda: 0, despesas: 0 }; });
    for (const l of lancs || []) {
      if (!l || !set.has(l.mes) || !(l.valor > 0)) continue;
      if (l.tipo === 'receita') r[l.mes].renda += l.valor; else r[l.mes].despesas += l.valor;
    }
    const exist = new Set((lancs || []).map((l) => l.id));
    for (const g of fixasAGerar(fixas, exist, meses[meses.length - 1], mesHoje)) {
      const f = g.fixa;
      let m = g.mes;
      const c = f.pag === 'cartao' && cartoes ? cartoes[f.cartaoId] : null;
      if (c) m = mesFatura(g.data, c.fechamento, c.vencimento);
      if (!set.has(m)) continue;
      if (f.tipo === 'receita') r[m].renda += f.valor; else r[m].despesas += f.valor;
    }
    return meses.map((m) => {
      const manual = rendaManual && rendaManual[m] > 0 ? rendaManual[m] : null;
      return { mes: m, renda: r2(manual != null ? manual : r[m].renda), despesas: r2(r[m].despesas), rendaManual: manual != null };
    });
  }

  /* Previsão do casal ou de uma pessoa (quem = 'casal' ou id), a partir das projeções que cada um publica */
  function previsao(o) {
    const { meses, ids, prevs, varMedias, resumos, conj, fixasCasal, mesHoje, cfg, metasPorMes, incluirVar, quem } = o;
    const varAtuais = o.varAtuais || {};
    const virt = fixasAGerar(fixasCasal || [], new Set((conj || []).map((l) => l.id)), meses[meses.length - 1], mesHoje)
      .map((g) => ({ autor: g.fixa.autor, valor: g.fixa.valor, mes: g.mes, divisao: g.fixa.divisao }));
    const conjAll = (conj || []).concat(virt);
    const varCasal = incluirVar ? mediaVariavel(conj, mesHoje) : 0;
    const varCasalAtual = gastoVariavel(conj, mesHoje);
    const res = {};
    ids.forEach((id) => {
      const meses2 = Object.assign({}, (resumos[id] && resumos[id].meses) || {});
      for (const m in (prevs[id] || {})) meses2[m] = Object.assign({}, meses2[m] || {}, { renda: prevs[id][m].renda });
      res[id] = { meses: meses2 };
    });
    return meses.map((m) => {
      const div = divisao(m, ids, res, cfg);
      const cj = conjuntoMes(conjAll, m, ids, div.pct);
      const quemIds = quem === 'casal' ? ids : [quem];
      let renda = 0, comp = 0, vari = 0, metas = 0;
      for (const id of quemIds) {
        const p = (prevs[id] || {})[m] || {};
        renda += p.renda || 0;
        comp += (p.despesas || 0) + (cj.parte[id] || 0);
        metas += p.metas || 0;
        if (incluirVar) {
          /* no mês atual, só o que ainda falta gastar em relação à média (o que já foi gasto já está nas despesas) */
          const pess = m === mesHoje ? Math.max(0, (varMedias[id] || 0) - (varAtuais[id] || 0)) : (varMedias[id] || 0);
          const cas = m === mesHoje ? Math.max(0, varCasal - varCasalAtual) : varCasal;
          vari += pess + cas * (div.pct[id] || 0);
        }
        if (quem !== 'casal') metas += ((metasPorMes || {})[m] || 0) * (div.pct[id] || 0);
      }
      if (quem === 'casal') metas += (metasPorMes || {})[m] || 0;
      renda = r2(renda); comp = r2(comp); vari = r2(vari); metas = r2(metas);
      const sobra = r2(renda - comp - vari - metas);
      return { mes: m, renda, compromissos: comp, variaveis: vari, metas, sobra, pct: renda > 0 ? (comp + vari) / renda : null };
    });
  }


  /* ---------- lançamento rápido por texto ---------- */
  const KW = [
    ['mercado', ['mercado', 'supermercado', 'feira', 'atacadao', 'assai', 'hortifruti', 'acougue', 'sacolao']],
    ['alimentacao', ['ifood', 'restaurante', 'lanche', 'lanchonete', 'pizza', 'hamburguer', 'burguer', 'almoco', 'jantar', 'delivery', 'cafe', 'padaria', 'sorvete', 'acai', 'churrasco', 'marmita']],
    ['transporte', ['uber', 'gasolina', 'combustivel', 'posto', 'estacionamento', 'pedagio', 'onibus', 'etanol', 'diesel', 'taxi', 'abasteci']],
    ['energia', ['luz', 'energia', 'energisa']],
    ['agua', ['agua', 'caerd', 'saneamento']],
    ['internet', ['internet', 'wifi', 'celular', 'telefone', 'vivo', 'claro', 'tim']],
    ['moradia', ['aluguel', 'financiamento', 'condominio']],
    ['diarista', ['diarista', 'faxina', 'faxineira']],
    ['gas', ['gas', 'botijao']],
    ['iptu', ['iptu']],
    ['saude', ['farmacia', 'remedio', 'medico', 'consulta', 'exame', 'dentista', 'plano de saude', 'hospital', 'drogaria']],
    ['academia', ['academia', 'suplemento', 'whey']],
    ['esportes', ['muay thai', 'muay', 'jiu', 'luta', 'futebol', 'crossfit', 'natacao']],
    ['cuidados', ['cabelo', 'barbearia', 'barbeiro', 'salao', 'unha', 'manicure', 'perfume', 'estetica']],
    ['lazer', ['cinema', 'show', 'bar', 'balada', 'festa', 'lazer', 'passeio', 'ingresso', 'cerveja']],
    ['compras', ['roupa', 'tenis', 'loja', 'shopping', 'amazon', 'shopee', 'mercado livre', 'magalu', 'calcado', 'camisa']],
    ['presentes', ['presente', 'aniversario']],
    ['viagem', ['viagem', 'hotel', 'passagem', 'airbnb', 'pousada']],
    ['pets', ['pet', 'racao', 'veterinario', 'petshop']],
    ['assinaturas', ['netflix', 'spotify', 'prime video', 'amazon prime', 'disney', 'youtube', 'assinatura', 'streaming', 'icloud', 'chatgpt', 'hbo', 'globoplay', 'deezer']],
    ['educacao', ['curso', 'faculdade', 'livro', 'escola', 'mensalidade']],
    ['seguro_carro', ['seguro']],
    ['ipva', ['ipva', 'licenciamento', 'detran']],
    ['manutencao', ['mecanico', 'oficina', 'pneu', 'revisao', 'oleo', 'lavagem', 'lava jato']],
  ];
  const KW_REC = [['salario', ['salario']], ['prolabore', ['pro labore', 'prolabore', 'pro-labore']], ['comissao', ['comissao']], ['rendimentos', ['rendimento', 'juros', 'dividendo']]];
  const temPalavra = (t, w) => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(t);

  function dataRelativa(hoje, n) {
    const [y, m, d] = hoje.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }

  /* Divide "mercado 230 e uber 25; salário 5000" em partes; partes sem número juntam com a próxima */
  function dividirTexto(texto) {
    const out = [];
    for (const linha of String(texto || '').split(/[;\n]+/)) {
      const brutas = linha.split(/\s+e\s+|,\s+(?=[^\d\s])/i).map((x) => x.trim()).filter(Boolean);
      const daLinha = [];
      let pend = '';
      for (const b of brutas) {
        const juntar = (pend ? pend + ' e ' : '') + b;
        if (/\d/.test(b)) { daLinha.push(juntar); pend = ''; } else pend = juntar;
      }
      if (pend) { if (daLinha.length) daLinha[daLinha.length - 1] += ' e ' + pend; else daLinha.push(pend); }
      out.push(...daLinha);
    }
    return out;
  }

  /* ctx: { hoje: 'AAAA-MM-DD', cats: [{id, nome, grupo, oculta}], cartoes: [{id, nome}] } */
  function interpretarUm(seg, ctx) {
    const original = seg;
    let t = normalizar(seg);
    const r = { texto: original, tipo: 'despesa', destino: 'pessoal', status: 'pago', pag: null, cartaoId: null, parcelas: 1, data: ctx.hoje, valor: null, cat: null };
    // data
    let m;
    if (temPalavra(t, 'anteontem')) { r.data = dataRelativa(ctx.hoje, -2); t = t.replace(/anteontem/g, ' '); }
    else if (temPalavra(t, 'ontem')) { r.data = dataRelativa(ctx.hoje, -1); t = t.replace(/\bontem\b/g, ' '); }
    else if (temPalavra(t, 'amanha')) { r.data = dataRelativa(ctx.hoje, 1); t = t.replace(/\bamanha\b/g, ' '); }
    if (temPalavra(t, 'hoje')) t = t.replace(/\bhoje\b/g, ' ');
    if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : ctx.hoje.slice(0, 4);
      const d = Math.min(+m[1], diasNoMes(+y, +m[2]));
      if (+m[2] >= 1 && +m[2] <= 12 && d >= 1) r.data = y + '-' + pad(+m[2]) + '-' + pad(d);
      t = t.replace(m[0], ' ');
    } else if ((m = t.match(/\bdia (\d{1,2})\b/))) {
      const [y, mm] = ctx.hoje.split('-').map(Number);
      const d = Math.min(+m[1], diasNoMes(y, mm));
      if (d >= 1) r.data = ctx.hoje.slice(0, 7) + '-' + pad(d);
      t = t.replace(m[0], ' ');
    }
    // parcelas
    if ((m = t.match(/\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas)\b/))) { const n = +m[1]; if (n >= 2 && n <= 60) r.parcelas = n; t = t.replace(m[0], ' '); }
    // valor ("5 mil", "R$ 1.234,56", "45,90", "55.90", "230")
    if ((m = t.match(/(\d+(?:[.,]\d+)?)\s*mil\b/))) { r.valor = r2(parseValor(m[1]) * 1000); t = t.replace(m[0], ' '); }
    else if ((m = t.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d\/])/))) { r.valor = parseValor(m[1]); t = t.replace(m[0], ' '); }
    t = t.replace(/\b(reais|real|conto|contos|pila|r\$)\b/g, ' ');
    // casal / receita / pendente
    if (/\b(casal|nosso|nossa|nossos|nossas|juntos|dividir|dividido|compartilhado)\b/.test(t)) { r.destino = 'casal'; t = t.replace(/\b(do casal|no casal|casal|nosso|nossa|nossos|nossas|juntos|dividir|dividido|compartilhado)\b/g, ' '); }
    if (/\b(recebi|receita|ganhei|entrou|reembolso|salario|pro labore|prolabore|comissao|rendimento|dividendo)\b/.test(t)) r.tipo = 'receita';
    if (r.destino === 'casal') r.tipo = 'despesa';
    if (/\b(a pagar|vence|vencimento|pendente|pagar dia|vou pagar)\b/.test(t)) { r.status = 'pendente'; t = t.replace(/\b(a pagar|vence|vencimento|pendente|pagar dia|vou pagar)\b/g, ' '); }
    // pagamento
    if (r.tipo !== 'receita') {
      const cards = (ctx.cartoes || []).map((c) => ({ c, n: normalizar(c.nome) })).filter((x) => x.n);
      const achado = cards.filter((x) => t.includes(x.n)).sort((a, b) => b.n.length - a.n.length)[0];
      const falaCartao = /\b(cartao|credito)\b/.test(t);
      if (achado) { r.pag = 'cartao'; r.cartaoId = achado.c.id; t = t.replace(achado.n, ' '); }
      else if (falaCartao && cards.length) { r.pag = 'cartao'; r.cartaoId = cards[0].c.id; r.cartaoIncerto = cards.length > 1; }
      t = t.replace(/\b(no|na|pelo|pela)?\s*(cartao de credito|cartao|credito)\b/g, ' ');
      if (!r.pag) {
        if (/\bpix\b/.test(t)) r.pag = 'pix';
        else if (/\bdebito\b/.test(t)) r.pag = 'debito';
        else if (/\b(dinheiro|especie)\b/.test(t)) r.pag = 'dinheiro';
        else if (/\bboleto\b/.test(t)) r.pag = 'boleto';
      }
      t = t.replace(/\b(no|na|pelo|pela|via|em|de)?\s*(pix|debito|dinheiro|especie|boleto)\b/g, ' ');
    }
    // categoria: primeiro os nomes do catálogo (inclui categorias criadas), depois palavras-chave
    const tipoCat = r.tipo === 'receita' ? 'receitas' : null;
    const cats = (ctx.cats || []).filter((c) => !c.oculta && (tipoCat ? c.grupo === 'receitas' : c.grupo !== 'receitas'));
    const porNome = cats.map((c) => ({ c, n: normalizar(c.nome) })).filter((x) => x.n.length >= 3 && temPalavra(t, x.n)).sort((a, b) => b.n.length - a.n.length)[0];
    if (porNome) r.cat = porNome.c.id;
    else {
      for (const [id, ws] of (r.tipo === 'receita' ? KW_REC : KW)) { if (ws.some((w) => temPalavra(t, w))) { r.cat = id; break; } }
    }
    if (!r.cat) r.cat = r.tipo === 'receita' ? 'extra' : 'outros';
    // descrição: o que sobrou do texto original, sem números e palavras de comando
    let desc = original
      .replace(/r\$\s*/gi, '')
      .replace(/(\d+(?:[.,]\d+)?)\s*mil\b/gi, ' ')
      .replace(/\b(?:em\s+)?\d{1,2}\s*(?:x|vezes|parcelas)\b/gi, ' ')
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
      .replace(/\bdia \d{1,2}\b/gi, ' ')
      .replace(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/g, ' ');
    const tirar = ['anteontem', 'ontem', 'hoje', 'amanhã', 'amanha', 'reais', 'real', 'conto', 'contos', 'pila', 'do casal', 'no casal', 'casal', 'juntos', 'dividir', 'dividido', 'compartilhado', 'a pagar', 'vence', 'pendente', 'vou pagar', 'cartão de crédito', 'cartao de credito', 'cartão', 'cartao', 'crédito', 'credito', 'pix', 'débito', 'debito', 'dinheiro', 'espécie', 'boleto', 'paguei', 'gastei', 'comprei', 'recebi', 'ganhei', 'entrou'];
    (ctx.cartoes || []).forEach((c) => { if (r.cartaoId === c.id) tirar.push(c.nome); });
    tirar.sort((a, b) => b.length - a.length).forEach((w) => { desc = desc.replace(new RegExp('(^|[^\\p{L}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[^\\p{L}]|$)', 'giu'), '$1 '); });
    desc = desc.replace(/\s+/g, ' ').trim().replace(/^(no|na|de|do|da|com|em|pra|para|pelo|pela|o|a)\s+/i, '').replace(/\s+(no|na|de|do|da|com|em|pra|para|pelo|pela|via)$/i, '').trim();
    r.desc = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : '';
    if (!(r.valor > 0)) r.erro = 'Não achei o valor';
    return r;
  }
  function interpretar(texto, ctx) { return dividirTexto(texto).map((s) => interpretarUm(s, ctx)); }

  /* ---------- visão do ano ---------- */
  function anoCategorias(lancs, ano, filtro) {
    const linhas = {};
    for (const l of lancs || []) {
      if (!l || !l.mes || l.mes.slice(0, 4) !== String(ano) || !(l.valor > 0) || (filtro && !filtro(l))) continue;
      const i = +l.mes.slice(5) - 1;
      (linhas[l.cat] = linhas[l.cat] || new Array(12).fill(0))[i] += l.valor;
    }
    for (const c in linhas) linhas[c] = linhas[c].map(r2);
    return linhas;
  }
  /* Total e média (média só dos meses com valor, como a planilha) */
  function totalMedia(vals) {
    const t = r2(vals.reduce((a, b) => a + b, 0));
    const n = vals.filter((v) => v).length;
    return { total: t, media: n ? r2(t / n) : 0 };
  }

  const api = { r2, pad, mesDe, addMeses, difMeses, diasNoMes, addMesesData, parseValor, gerarSerie, resumoPessoal, stable, divisao, pctItem, conjuntoMes, cofrinho, cartaoPessoa, porCategoria, idFixa, fixasAGerar, orcamento, evolucao, mesFatura, vencFatura, normalizar, mediaVariavel, gastoVariavel, projecao, previsao, anoCategorias, totalMedia, interpretar, dividirTexto };
  root.FL = api;
})(typeof window !== 'undefined' ? window : globalThis);
