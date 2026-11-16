import './logic.js';
import { DB, Conta } from './firebase-shim.js';

(function () {
  'use strict';
  const FL = window.FL;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmt = (n) => BRL.format(n || 0);
  const pct = (x) => Math.round((x || 0) * 100) + '%';
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_C = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const pad = (n) => String(n).padStart(2, '0');
  function hojeISO() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  const mesHoje = () => hojeISO().slice(0, 7);
  function nomeMes(mes) { const [y, m] = mes.split('-'); const n = MESES[+m - 1]; return n.charAt(0).toUpperCase() + n.slice(1) + ' de ' + y; }
  function mesCurto(mes) { const [y, m] = mes.split('-'); return MESES_C[+m - 1] + '/' + y; }
  function mesLongo(mes) { const [y, m] = mes.split('-'); return MESES[+m - 1] + ' de ' + y; }
  function rotuloDia(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  }
  function dataCurta(iso) { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; }

  const CAT_DESP = [
    ['mercado', '🛒', 'Mercado'], ['moradia', '🏠', 'Moradia'], ['contas', '💡', 'Contas da casa'],
    ['alimentacao', '🍽️', 'Restaurante e delivery'], ['transporte', '⛽', 'Transporte'], ['saude', '💊', 'Saúde'],
    ['lazer', '🎉', 'Lazer'], ['compras', '🛍️', 'Compras'], ['assinaturas', '📺', 'Assinaturas'],
    ['educacao', '📚', 'Educação'], ['cuidados', '💇', 'Cuidados pessoais'], ['pets', '🐾', 'Pets'],
    ['presentes', '🎁', 'Presentes'], ['viagem', '✈️', 'Viagem'], ['cartao', '💳', 'Cartão e parcelas'], ['outros', '📦', 'Outros'],
  ];
  const CAT_REC = [
    ['salario', '💼', 'Salário'], ['prolabore', '🏢', 'Pró-labore'], ['comissao', '📈', 'Comissão'],
    ['extra', '✨', 'Renda extra'], ['rendimentos', '🏦', 'Rendimentos'], ['outros_r', '📦', 'Outras receitas'],
  ];
  const CATS = {}; CAT_DESP.concat(CAT_REC).forEach(([k, i, n]) => { CATS[k] = { ico: i, nome: n }; });
  const cat = (k) => CATS[k] || CATS.outros;
  const CORES = ['#2563eb', '#db2777', '#7c3aed', '#0d9488', '#ea580c', '#16a34a', '#0891b2', '#b45309'];

  const ICON = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    left: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    painel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
    meus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    casal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3.2"/><circle cx="16.5" cy="9" r="2.8"/><path d="M2.5 20c1-3.5 3-5 5.5-5s4.5 1.5 5.5 5M13 15.6c1-.4 2-.6 3.5-.6 2.4 0 4.2 1.4 5 5"/></svg>',
    viagem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
  };

  const S = {
    db: null, user: null, uid: null, email: '', authPronto: false, canWrite: true, fatal: null, timeout: false, err: null,
    mes: mesHoje(), aba: 'painel', filtro: 'tudo',
    meus: [], conj: [], cofre: [], membros: {}, resumos: {}, cfgCasal: {}, viagem: null, acertos: {},
    got: {}, firm: {},
  };
  const meusCol = () => S.db.collection('usuarios/' + S.uid + '/lancamentos');
  const ABAS = ['painel', 'meus', 'casal', 'viagem'];
  const lerHash = () => { const h = (location.hash || '').slice(1); return ABAS.includes(h) ? h : 'painel'; };
  S.aba = lerHash();

  /* ---------- pessoas ---------- */
  function casal() {
    return Object.entries(S.membros).map(([id, m]) => Object.assign({ id }, m))
      .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0)).slice(0, 2);
  }
  const ids = () => casal().map((m) => m.id);
  const souMembro = () => ids().includes(S.uid);
  function pessoa(id) { const m = S.membros[id]; return { id, nome: (m && m.nome) || 'Alguém', cor: (m && m.cor) || '#64748b' }; }
  const parceiro = () => { const p = casal().find((m) => m.id !== S.uid); return p ? pessoa(p.id) : null; };
  const inicial = (n) => esc((n || '?').trim().charAt(0).toUpperCase());
  const avatar = (p, size) => '<span class="avatar" style="background:' + esc(p.cor) + (size ? ';width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.44) + 'px' : '') + '">' + inicial(p.nome) + '</span>';

  /* ---------- modelo do mês ---------- */
  function modelo() {
    const mes = S.mes;
    const I = ids();
    const resumos = Object.assign({}, S.resumos);
    if (S.uid) resumos[S.uid] = { meses: FL.resumoPessoal(S.meus) };
    const div = FL.divisao(mes, I, resumos, S.cfgCasal);
    const divHoje = FL.divisao(mesHoje(), I, resumos, S.cfgCasal);
    const conj = FL.conjuntoMes(S.conj, mes, I, div.pct);
    const cof = FL.cofrinho(S.cofre, S.viagem, mesHoje(), I, divHoje.pct);
    const guardMes = cof.noMes[mes] || {};
    const cartoes = {};
    I.forEach((id) => { cartoes[id] = FL.cartaoPessoa(resumos[id] && resumos[id].meses && resumos[id].meses[mes], conj.parte[id], guardMes[id]); });
    const soma = (f) => FL.r2(I.reduce((s, id) => s + (cartoes[id][f] || 0), 0));
    const renda = soma('renda');
    const gastosPess = soma('gastos');
    const despesas = FL.r2(gastosPess + conj.total);
    const guardado = soma('guardado');
    const tot = {
      renda, gastosPess, despesas, guardado,
      saldo: FL.r2(renda - despesas - guardado),
      aPagar: FL.r2(soma('aPagar') + conj.aPagar),
      pctComprometido: renda > 0 ? despesas / renda : null,
    };
    const temResumo = {};
    I.forEach((id) => { temResumo[id] = !!(resumos[id] && resumos[id].meses && resumos[id].meses[mes]); });
    return { mes, I, div, divHoje, conj, cof, cartoes, tot, temResumo, meusMes: S.meus.filter((l) => l.mes === mes) };
  }

  /* ---------- render ---------- */
  let raf = 0;
  function render() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; desenhar(); }); }

  function desenhar() {
    const main = $('#main');
    const top = $('#top');
    const tabs = $('#tabs');
    const fab = $('#fab');
    if (S.fatal) {
      top.innerHTML = cabecalhoSimples();
      main.innerHTML = '<div class="card"><h2>Não deu para abrir o app</h2><p class="sub">' + esc(S.fatal) + '</p></div>';
      tabs.hidden = true; fab.hidden = true; return;
    }
    if (!S.authPronto) {
      top.innerHTML = cabecalhoSimples();
      main.innerHTML = '<div class="card"><div class="empty">Abrindo…</div></div>';
      tabs.hidden = true; fab.hidden = true; return;
    }
    if (!S.uid) {
      tabs.hidden = true; fab.hidden = true;
      if ($('#f-login')) return;
      top.innerHTML = cabecalhoSimples();
      main.innerHTML = telaLogin();
      montarLogin(); return;
    }
    const carregado = S.got.membros && S.got.meus;
    if (!carregado) {
      top.innerHTML = cabecalhoSimples();
      main.innerHTML = '<div class="card"><div class="empty">' + (S.timeout ? 'Não consegui conectar ao banco de dados ainda. Confira a internet — o app continua tentando.' : 'Carregando suas finanças…') + '</div></div>';
      tabs.hidden = true; fab.hidden = true; return;
    }
    if (!souMembro()) {
      const chave = 'bv' + casal().map((x) => x.id + (S.membros[x.id].cor || '')).join('|');
      if ($('#f-bv') && main.dataset.bv === chave) return;
      main.dataset.bv = chave;
      top.innerHTML = cabecalhoSimples();
      main.innerHTML = telaBoasVindas();
      tabs.hidden = true; fab.hidden = true; montarBoasVindas(); return;
    }
    main.dataset.bv = '';
    const m = modelo();
    top.innerHTML = cabecalho();
    let html = '';
    if (S.canWrite === false) html += '<div class="banner">Seu acesso a este app é só de leitura. Para lançar, peça para ser convidado(a) por e-mail com acesso de Editor.</div>';
    if (S.timeout && !S.firm.membros) html += '<div class="banner">Sem conexão com o banco de dados no momento — os números podem estar desatualizados.</div>';
    if (S.aba === 'painel') html += viewPainel(m);
    else if (S.aba === 'meus') html += viewMeus(m);
    else if (S.aba === 'casal') html += viewCasal(m);
    else html += viewViagem(m);
    main.innerHTML = html;
    tabs.hidden = false;
    tabs.innerHTML = '<div class="in">' + ABAS.map((a) => '<a href="#' + a + '"' + (S.aba === a ? ' aria-current="page"' : '') + '>' + ICON[a] + '<span>' + ({ painel: 'Painel', meus: 'Meus', casal: 'Casal', viagem: 'Viagem' })[a] + '</span></a>').join('') + '</div>';
    fab.hidden = S.canWrite === false;
    fab.setAttribute('aria-label', S.aba === 'viagem' ? 'Guardar dinheiro no cofrinho' : 'Novo lançamento');
  }

  function cabecalhoSimples() {
    return '<div class="top-row"><div class="brand"><h1>Finanças do Casal</h1></div></div>';
  }
  function cabecalho() {
    const ms = casal().map((x) => pessoa(x.id));
    const pair = '<span class="pair">' + ms.map((p) => '<span style="background:' + esc(p.cor) + '">' + inicial(p.nome) + '</span>').join('') + '</span>';
    const hoje = S.mes !== mesHoje() ? '<button class="hoje" data-act="mes-hoje" type="button">Hoje</button>' : '';
    const mostraMes = S.aba !== 'viagem';
    return '<div class="top-row"><div class="brand">' + pair + '<h1>Finanças do Casal</h1></div>' +
      '<button class="icon-btn" type="button" data-act="config" aria-label="Configurações">' + ICON.gear + '</button></div>' +
      (mostraMes ? '<div class="month"><button type="button" data-act="mes-prev" aria-label="Mês anterior">' + ICON.left + '</button><div class="label">' + nomeMes(S.mes) + '</div>' + hoje + '<button type="button" data-act="mes-next" aria-label="Próximo mês">' + ICON.right + '</button></div>' : '');
  }

  function valorCls(v) { return v < 0 ? 'neg' : ''; }
  function meterCls(p) { return p == null ? '' : p > 1 ? 'neg' : p > 0.8 ? 'warn' : ''; }

  /* ---------- PAINEL ---------- */
  function viewPainel(m) {
    const t = m.tot;
    const ps = m.I.map(pessoa);
    let h = '';
    if (m.I.length < 2) h += cardConvite();

    // Casal
    const base = Math.max(t.renda, t.despesas + t.guardado, 1);
    const segs = [];
    ps.forEach((p) => { const v = m.cartoes[p.id].gastos; if (v > 0) segs.push({ cor: p.cor, v, nome: 'Gastos de ' + p.nome }); });
    if (m.conj.total > 0) segs.push({ cor: 'var(--muted)', v: m.conj.total, nome: 'Do casal' });
    if (t.guardado > 0) segs.push({ cor: 'var(--pos)', v: t.guardado, nome: 'Viagem' });
    h += '<section class="card" aria-labelledby="h-casal"><div class="card-head"><div><div class="eyebrow">Casal · ' + esc(mesLongo(m.mes)) + '</div><h2 id="h-casal" class="sr">Saldo do casal</h2></div>' +
      (t.pctComprometido != null ? '<span class="badge">' + pct(t.pctComprometido) + ' da renda comprometida</span>' : '') + '</div>' +
      '<div><div class="sub">Sobra do casal no mês</div><div class="money-big ' + valorCls(t.saldo) + '">' + fmt(t.saldo) + '</div></div>' +
      '<div class="stats"><div class="stat"><span class="k">Renda total</span><span class="v pos">' + fmt(t.renda) + '</span></div>' +
      '<div class="stat"><span class="k">Despesas totais</span><span class="v neg">' + fmt(t.despesas) + '</span></div>' +
      '<div class="stat"><span class="k">Guardado p/ viagem</span><span class="v">' + fmt(t.guardado) + '</span></div></div>' +
      (segs.length ? '<div class="stack" role="img" aria-label="Para onde foi a renda do casal">' + segs.map((s) => '<i style="width:' + (s.v / base * 100).toFixed(2) + '%;background:' + s.cor + '"></i>').join('') + '</div>' +
        '<div class="legend">' + segs.map((s) => '<span><b style="background:' + s.cor + '"></b>' + esc(s.nome) + ' ' + fmt(s.v) + '</span>').join('') + '</div>' : '') +
      (t.aPagar > 0 ? '<div class="note warn">Ainda a pagar neste mês: <strong>' + fmt(t.aPagar) + '</strong></div>' : '') +
      '</section>';

    // Pessoas
    h += '<div class="people">' + ps.map((p) => cardPessoa(p, m)).join('') + '</div>';

    // Acerto
    if (m.I.length === 2 && m.conj.total > 0) h += cardAcerto(m, true);

    // Contas a pagar (minhas)
    const meusPend = m.meusMes.filter((l) => l.tipo !== 'receita' && l.status === 'pendente');
    const conjPend = m.conj.itens.filter((l) => l.autor === S.uid && l.status === 'pendente');
    const pend = meusPend.map((l) => ({ l, src: 'meu' })).concat(conjPend.map((l) => ({ l, src: 'conj' }))).sort((a, b) => a.l.data.localeCompare(b.l.data));
    if (pend.length) {
      h += '<section class="card"><div class="card-head"><h2>Suas contas a pagar</h2><span class="sub">' + pend.length + ' em ' + esc(MESES[+m.mes.slice(5) - 1]) + '</span></div><div class="list">' +
        pend.slice(0, 6).map((x) => itemHTML(x.l, x.src, true)).join('') + '</div>' +
        (pend.length > 6 ? '<button class="link" type="button" data-act="ir" data-tab="meus">Ver todas</button>' : '') + '</section>';
    }

    // Viagem
    h += cardViagemMini(m);
    return h;
  }

  function cardPessoa(p, m) {
    const c = m.cartoes[p.id];
    const eu = p.id === S.uid;
    const tag = eu ? '<span class="badge">Você</span>' : '<span class="badge" title="Os lançamentos são privados">' + ICON.lock + 'Só totais</span>';
    let corpo;
    if (!eu && !m.temResumo[p.id] && !c.parte && !c.guardado) {
      corpo = '<div class="empty" style="padding:10px 0">' + esc(p.nome) + ' ainda não lançou nada em ' + esc(MESES[+m.mes.slice(5) - 1]) + '.</div>';
    } else {
      corpo = '<div class="rows">' +
        '<div class="rowkv"><span class="k">Renda</span><span class="v pos">' + fmt(c.renda) + '</span></div>' +
        '<div class="rowkv"><span class="k">Gastos pessoais</span><span class="v">' + fmt(c.gastos) + '</span></div>' +
        (m.I.length === 2 ? '<div class="rowkv"><span class="k">Parte no casal (' + pct(m.div.pct[p.id]) + ')</span><span class="v">' + fmt(c.parte) + '</span></div>' : '') +
        '<div class="rowkv"><span class="k">Guardado p/ viagem</span><span class="v">' + fmt(c.guardado) + '</span></div>' +
        '<div class="rowkv total"><span class="k">Sobra livre</span><span class="v ' + valorCls(c.saldo) + '">' + fmt(c.saldo) + '</span></div></div>' +
        (c.pctComprometido != null ? '<div><div class="rowkv" style="font-size:12px"><span class="k">Renda comprometida</span><span class="v">' + pct(c.pctComprometido) + '</span></div><div class="meter ' + meterCls(c.pctComprometido) + '"><i style="width:' + Math.min(100, c.pctComprometido * 100).toFixed(1) + '%;background:' + (c.pctComprometido > 0.8 ? '' : esc(p.cor)) + '"></i></div></div>' : '') +
        (c.aPagar > 0 ? '<div class="rowkv" style="font-size:13px"><span class="k">A pagar (pessoal)</span><span class="v warn">' + fmt(c.aPagar) + '</span></div>' : '');
    }
    return '<section class="card person" style="--pc:' + esc(p.cor) + '"><div class="card-head"><div class="who">' + avatar(p) + '<span class="name">' + esc(p.nome) + '</span></div>' + tag + '</div>' + corpo +
      (eu ? '<button class="link" type="button" data-act="ir" data-tab="meus">Ver meus lançamentos</button>' : '<div class="note">' + ICON.lock + '<span>Você vê só os totais de ' + esc(p.nome) + '. Os detalhes ficam privados.</span></div>') + '</section>';
  }

  function cardConvite() {
    return '<section class="card"><h2>Falta a outra pessoa entrar</h2><p class="sub" style="margin:0">Cadastre o e-mail dela no Firebase (Authentication → Usuários → Adicionar usuário). Depois ela abre este app, toca em <strong>Esqueci minha senha</strong> para criar a própria senha, entra e escolhe o nome. Os lançamentos pessoais de cada um ficam privados — o outro vê só os totais.</p></section>';
  }

  function textoBase(div) {
    if (div.base === 'renda') return 'proporcional à renda de ' + mesCurto(div.mesBase);
    if (div.base === 'igual') return 'meio a meio';
    if (div.base === 'fixo') return 'percentual fixo';
    if (div.base === 'semRenda') return 'meio a meio até os dois lançarem a renda';
    return '';
  }

  function cardAcerto(m, compacto) {
    const [a, b] = m.I;
    const pa = pessoa(a), pb = pessoa(b);
    const ac = m.conj.acerto;
    const reg = S.acertos[m.mes];
    const quitado = reg && reg.quitado && ac && Math.abs((reg.valor || 0) - ac.valor) < 0.01;
    const mudou = reg && reg.quitado && !quitado;
    let h = '<section class="card"><div class="card-head"><h2>Acerto do mês</h2>' + (quitado ? '<span class="pill pago">Acertado</span>' : '') + '</div>';
    if (!ac) {
      h += '<p class="sub" style="margin:0">Cada um já pagou exatamente a sua parte. Nada a acertar.</p>';
    } else {
      const de = pessoa(ac.de), para = pessoa(ac.para);
      h += '<div class="settle">' + avatar(de) + '<div><div class="sub">' + esc(de.nome) + ' transfere para ' + esc(para.nome) + '</div><div class="amt">' + fmt(ac.valor) + '</div></div>' + avatar(para) + '</div>';
      if (!compacto) {
        h += '<div class="rows">' + [pa, pb].map((p) => '<div class="rowkv"><span class="k">' + esc(p.nome) + ' pagou ' + fmt(m.conj.pago[p.id]) + ' · parte ' + fmt(m.conj.parte[p.id]) + '</span><span class="v ' + (m.conj.saldo[p.id] < 0 ? 'neg' : 'pos') + '">' + (m.conj.saldo[p.id] >= 0 ? '+' : '') + fmt(m.conj.saldo[p.id]) + '</span></div>').join('') + '</div>';
        if (mudou) h += '<div class="note warn">As despesas mudaram depois que o acerto foi marcado (era ' + fmt(reg.valor) + ').</div>';
        if (S.canWrite !== false) {
          h += quitado
            ? '<div class="note">Marcado em ' + esc(new Date(reg.em).toLocaleDateString('pt-BR')) + ' por ' + esc(pessoa(reg.por).nome) + '. <button class="link" type="button" data-act="acerto-desfazer">Desfazer</button></div>'
            : '<button class="btn ghost" type="button" data-act="acerto-ok">Marcar acerto como feito</button>';
        }
      } else {
        h += '<button class="link" type="button" data-act="ir" data-tab="casal">Ver detalhes do casal</button>';
      }
    }
    return h + '</section>';
  }

  function cardViagemMini(m) {
    const c = m.cof;
    if (!S.viagem) return '<section class="card"><h2>Cofrinho da viagem</h2><p class="sub" style="margin:0">Defina o destino e a meta para acompanhar quanto falta.</p><button class="btn ghost" type="button" data-act="editar-viagem">Definir meta</button></section>';
    return '<section class="card"><div class="card-head"><div><div class="eyebrow">Cofrinho da viagem</div><h2>' + esc(S.viagem.destino || 'Viagem') + '</h2></div><span class="badge">' + pct(c.progresso) + '</span></div>' +
      '<div class="meter pos"><i style="width:' + (c.progresso * 100).toFixed(1) + '%"></i></div>' +
      '<div class="rowkv"><span class="k">' + fmt(c.guardado) + ' de ' + fmt(c.meta) + '</span><span class="v">' + (c.mesesRestantes > 0 ? fmt(c.porMes) + '/mês até ' + esc(mesCurto(c.mesAlvo)) : 'Prazo chegou') + '</span></div>' +
      '<button class="link" type="button" data-act="ir" data-tab="viagem">Abrir cofrinho</button></section>';
  }

  /* ---------- itens ---------- */
  function itemHTML(l, src, mostrarData) {
    const c = cat(l.cat);
    const autor = src === 'conj' ? pessoa(l.autor) : null;
    const meu = src === 'meu' || l.autor === S.uid;
    const sub = [c.nome];
    if (l.parcela) sub.push(l.parcela);
    if (autor) sub.push('pago por ' + autor.nome);
    if (mostrarData) sub.push(dataCurta(l.data).slice(0, 5));
    const receita = l.tipo === 'receita';
    const st = l.status === 'pendente' ? (receita ? 'A receber' : 'A pagar') : (receita ? 'Recebido' : 'Pago');
    const pill = meu && S.canWrite !== false
      ? '<span class="pill ' + (l.status === 'pendente' ? 'pendente' : 'pago') + '" role="button" tabindex="0" data-act="toggle-status" data-id="' + esc(l.id) + '" data-src="' + src + '" title="Tocar para alterar">' + st + '</span>'
      : '<span class="pill ' + (l.status === 'pendente' ? 'pendente' : 'pago') + '">' + st + '</span>';
    return '<div class="item" role="button" tabindex="0" data-act="abrir-lanc" data-id="' + esc(l.id) + '" data-src="' + src + '">' +
      '<span class="ico">' + c.ico + (autor ? '<span class="dot" style="background:' + esc(autor.cor) + '"></span>' : '') + '</span>' +
      '<div style="min-width:0"><div class="t">' + esc(l.desc) + '</div><div class="s">' + esc(sub.join(' · ')) + '</div></div>' +
      '<span class="r"><span class="val ' + (receita ? 'pos' : '') + '">' + (receita ? '+' : '−') + ' ' + fmt(l.valor) + '</span>' + pill + '</span></div>';
  }

  function listaPorDia(itens, src) {
    const ord = itens.slice().sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm || 0) - (a.criadoEm || 0));
    let h = '', dia = '';
    for (const l of ord) {
      if (l.data !== dia) { dia = l.data; h += '<div class="day">' + esc(rotuloDia(dia)) + '</div>'; }
      h += itemHTML(l, src);
    }
    return '<div class="list">' + h + '</div>';
  }

  function catsHTML(pares) {
    if (!pares.length) return '';
    const max = pares[0][1] || 1;
    return '<div class="cats">' + pares.slice(0, 7).map(([k, v]) => '<div class="cat-row"><span>' + cat(k).ico + '</span><span class="nm">' + esc(cat(k).nome) + '</span><span class="bar"><i style="width:' + (v / max * 100).toFixed(1) + '%"></i></span><span class="vv">' + fmt(v) + '</span></div>').join('') + '</div>';
  }

  /* ---------- MEUS ---------- */
  function viewMeus(m) {
    const meus = m.meusMes;
    const renda = FL.r2(meus.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0));
    const gastos = FL.r2(meus.filter((l) => l.tipo !== 'receita').reduce((s, l) => s + l.valor, 0));
    const aPagar = FL.r2(meus.filter((l) => l.tipo !== 'receita' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0));
    const par = parceiro();
    let h = '<section class="card"><div class="card-head"><div class="eyebrow">Meus lançamentos · ' + esc(mesLongo(m.mes)) + '</div><span class="badge">' + ICON.lock + 'Privado</span></div>' +
      '<div class="stats"><div class="stat"><span class="k">Renda</span><span class="v pos">' + fmt(renda) + '</span></div>' +
      '<div class="stat"><span class="k">Gastos pessoais</span><span class="v neg">' + fmt(gastos) + '</span></div>' +
      '<div class="stat"><span class="k">Saldo pessoal</span><span class="v ' + valorCls(renda - gastos) + '">' + fmt(renda - gastos) + '</span></div></div>' +
      (aPagar > 0 ? '<div class="note warn">A pagar: <strong>' + fmt(aPagar) + '</strong></div>' : '') +
      '<div class="note">' + ICON.lock + '<span>Só você vê esta lista' + (par ? '. ' + esc(par.nome) + ' vê apenas os seus totais do mês.' : '.') + '</span></div></section>';

    const despCat = FL.porCategoria(meus, (l) => l.tipo !== 'receita');
    if (despCat.length) h += '<section class="card"><h2>Para onde foi</h2>' + catsHTML(despCat) + '</section>';

    const filtros = [['tudo', 'Tudo'], ['despesa', 'Despesas'], ['receita', 'Receitas'], ['pendente', 'A pagar/receber']];
    const f = S.filtro;
    const vis = meus.filter((l) => f === 'tudo' || (f === 'pendente' ? l.status === 'pendente' : (f === 'receita' ? l.tipo === 'receita' : l.tipo !== 'receita')));
    h += '<section class="card"><div class="chips" role="group" aria-label="Filtro">' + filtros.map(([k, n]) => '<button class="chip" type="button" data-act="filtro" data-f="' + k + '" aria-pressed="' + (f === k) + '">' + n + '</button>').join('') + '</div>' +
      (vis.length ? listaPorDia(vis, 'meu') : '<div class="empty">' + (meus.length ? 'Nada neste filtro.' : 'Nenhum lançamento seu em ' + esc(MESES[+m.mes.slice(5) - 1]) + '. Toque no + para lançar renda ou gastos.') + '</div>') + '</section>';
    return h;
  }

  /* ---------- CASAL ---------- */
  function viewCasal(m) {
    const ps = m.I.map(pessoa);
    let h = '<section class="card"><div class="eyebrow">Despesas do casal · ' + esc(mesLongo(m.mes)) + '</div>' +
      '<div class="money-big">' + fmt(m.conj.total) + '</div>' +
      (m.conj.aPagar > 0 ? '<div class="note warn">Ainda a pagar: <strong>' + fmt(m.conj.aPagar) + '</strong></div>' : '');
    if (ps.length === 2) {
      h += '<div><div class="rowkv" style="font-size:13px;margin-bottom:6px"><span class="k">Divisão ' + esc(textoBase(m.div)) + '</span></div>' +
        '<div class="split">' + ps.map((p) => '<i style="width:' + (m.div.pct[p.id] * 100).toFixed(1) + '%;background:' + esc(p.cor) + '"></i>').join('') + '</div>' +
        '<div class="legend" style="margin-top:6px">' + ps.map((p) => '<span><b style="background:' + esc(p.cor) + '"></b>' + esc(p.nome) + ' ' + pct(m.div.pct[p.id]) + ' · ' + fmt(m.conj.parte[p.id]) + '</span>').join('') + '</div></div>';
    }
    h += '<div class="note">Os dois veem e lançam aqui. Cada um só altera o que lançou.</div></section>';
    if (ps.length === 2 && m.conj.total > 0) h += cardAcerto(m, false);
    const pc = FL.porCategoria(m.conj.itens);
    if (pc.length) h += '<section class="card"><h2>Por categoria</h2>' + catsHTML(pc) + '</section>';
    h += '<section class="card"><h2>Lançamentos do casal</h2>' + (m.conj.itens.length ? listaPorDia(m.conj.itens, 'conj') : '<div class="empty">Nenhuma despesa do casal em ' + esc(MESES[+m.mes.slice(5) - 1]) + '. Toque no + e escolha “Do casal”.</div>') + '</section>';
    return h;
  }

  /* ---------- VIAGEM ---------- */
  function anel(p) {
    const r = 52, c = 2 * Math.PI * r;
    return '<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="' + pct(p) + ' da meta"><circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--accent-soft)" stroke-width="12"/>' +
      '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--pos)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 60 60)"/>' +
      '<text x="60" y="66" text-anchor="middle" font-size="22">' + pct(p) + '</text></svg>';
  }
  function viewViagem(m) {
    const v = S.viagem;
    const c = m.cof;
    const ps = m.I.map(pessoa);
    if (!v) {
      return '<section class="card trip-hero"><div class="eyebrow">Cofrinho da viagem</div><h2>Defina o destino e a meta</h2><p class="sub" style="margin:0">Com a meta e o mês da viagem, o app calcula quanto guardar por mês e a parte de cada um.</p><button class="btn" type="button" data-act="editar-viagem">Definir meta</button></section>';
    }
    let h = '<section class="card trip-hero"><div class="card-head"><div><div class="eyebrow">Cofrinho da viagem</div><div class="trip-dest">' + esc(v.destino || 'Viagem') + '</div><div class="sub">' + (c.mesAlvo ? esc(nomeMes(c.mesAlvo)) : '') + '</div></div>' +
      (S.canWrite !== false ? '<button class="link" type="button" data-act="editar-viagem">Editar meta</button>' : '') + '</div>' +
      '<div class="ring-wrap">' + anel(c.progresso) + '<div class="rows">' +
      '<div><div class="sub">Guardado</div><div class="money-big pos">' + fmt(c.guardado) + '</div><div class="sub">de ' + fmt(c.meta) + '</div></div>' +
      '<div class="rowkv"><span class="k">Falta</span><span class="v">' + fmt(c.falta) + '</span></div></div></div>';
    if (c.mesesRestantes != null) {
      if (c.falta <= 0) h += '<div class="note pos"><strong>Meta batida!</strong></div>';
      else if (c.mesesRestantes > 0) {
        h += '<div class="settle" style="grid-template-columns:1fr"><div><div class="sub">Para chegar em ' + esc(mesLongo(c.mesAlvo)) + ' (' + c.mesesRestantes + ' ' + (c.mesesRestantes === 1 ? 'mês' : 'meses') + ')</div><div class="amt">' + fmt(c.porMes) + ' por mês</div></div></div>';
        if (ps.length === 2) h += '<div class="rows">' + ps.map((p) => '<div class="rowkv"><span class="k">' + esc(p.nome) + ' (' + pct(m.divHoje.pct[p.id]) + ')</span><span class="v">' + fmt(c.sugestao[p.id]) + '/mês</span></div>').join('') + '<div class="hint">Sugestão pela mesma divisão das despesas do casal (' + esc(textoBase(m.divHoje)) + ').</div></div>';
      } else h += '<div class="note warn">O mês da viagem chegou. Faltaram ' + fmt(c.falta) + '.</div>';
    }
    if (S.canWrite !== false) h += '<div class="btn-row"><button class="btn" type="button" data-act="cofre-novo" data-tipo="deposito">Guardar</button><button class="btn ghost" type="button" data-act="cofre-novo" data-tipo="retirada">Retirar</button></div>';
    h += '</section>';

    if (ps.length) {
      const max = Math.max(1, ...ps.map((p) => Math.abs(c.porPessoa[p.id] || 0)));
      h += '<section class="card"><h2>Quanto cada um guardou</h2><div class="rows">' + ps.map((p) => '<div style="display:grid;gap:4px"><div class="rowkv"><span class="k" style="display:flex;align-items:center;gap:8px">' + avatar(p, 22) + esc(p.nome) + '</span><span class="v">' + fmt(c.porPessoa[p.id]) + '</span></div><div class="meter"><i style="width:' + (Math.max(0, c.porPessoa[p.id]) / max * 100).toFixed(1) + '%;background:' + esc(p.cor) + '"></i></div></div>').join('') + '</div></section>';
    }
    const movs = S.cofre.slice().sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm || 0) - (a.criadoEm || 0));
    h += '<section class="card"><h2>Movimentações</h2>' + (movs.length ? '<div class="list">' + movs.map((x) => {
      const p = pessoa(x.autor);
      const ret = x.tipo === 'retirada';
      return '<div class="item" role="button" tabindex="0" data-act="abrir-mov" data-id="' + esc(x.id) + '"><span class="ico">' + (ret ? '↩️' : '🐷') + '<span class="dot" style="background:' + esc(p.cor) + '"></span></span>' +
        '<div style="min-width:0"><div class="t">' + (ret ? 'Retirada' : 'Guardou') + ' · ' + esc(p.nome) + '</div><div class="s">' + esc(dataCurta(x.data) + (x.obs ? ' · ' + x.obs : '')) + '</div></div>' +
        '<span class="r"><span class="val ' + (ret ? 'neg' : 'pos') + '">' + (ret ? '−' : '+') + ' ' + fmt(x.valor) + '</span></span></div>';
    }).join('') + '</div>' : '<div class="empty">Nenhum valor guardado ainda. Toque em “Guardar” para começar o cofrinho.</div>') + '</section>';
    return h;
  }

  /* ---------- boas-vindas ---------- */
  let bvCor = null;
  function telaBoasVindas() {
    const ms = casal();
    if (ms.length >= 2) {
      return '<div class="center-screen"><section class="card welcome"><h2>Este app já tem um casal</h2><p class="sub" style="margin:0">' + esc(ms.map((x) => pessoa(x.id).nome).join(' e ')) + ' já usam este app. Peça para um deles conferir o compartilhamento.</p></section></div>';
    }
    const usadas = ms.map((x) => pessoa(x.id).cor);
    if (!bvCor || usadas.includes(bvCor)) bvCor = CORES.find((c) => !usadas.includes(c)) || CORES[0];
    const outro = ms[0] ? pessoa(ms[0].id) : null;
    return '<div class="center-screen"><form class="card welcome" id="f-bv">' +
      '<div class="eyebrow">Bem-vindo(a)</div><h2>' + (outro ? esc(outro.nome) + ' convidou você para as finanças do casal' : 'Vamos montar as finanças do casal') + '</h2>' +
      '<p class="sub" style="margin:0">Seus lançamentos pessoais ficam privados: ' + (outro ? esc(outro.nome) : 'a outra pessoa') + ' vê só os seus totais do mês. As despesas do casal e o cofrinho da viagem os dois veem.</p>' +
      '<div class="field"><label for="bv-nome">Como você quer aparecer?</label><input class="input" id="bv-nome" maxlength="24" autocomplete="given-name" placeholder="Seu nome" required></div>' +
      '<div class="field"><span>Sua cor</span><div class="colors" id="bv-cores">' + CORES.map((c) => '<button type="button" data-cor="' + c + '" aria-label="Cor ' + c + '" aria-pressed="' + (c === bvCor) + '" style="background:' + c + '"' + (usadas.includes(c) ? ' disabled' : '') + '></button>').join('') + '</div></div>' +
      '<div class="err" id="bv-err" hidden></div>' +
      '<button class="btn block" type="submit">Entrar no app</button></form></div>';
  }
  function montarBoasVindas() {
    const f = $('#f-bv');
    if (!f) return;
    $('#bv-cores').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cor]'); if (!b || b.disabled) return;
      bvCor = b.dataset.cor; $$('#bv-cores button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = $('#bv-nome').value.trim();
      const err = $('#bv-err');
      if (!nome) { err.hidden = false; err.textContent = 'Digite seu nome.'; return; }
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
      const ok = await escrever(() => S.db.doc('membros/' + S.uid).set({ nome, cor: bvCor, criadoEm: Date.now() }));
      if (!ok) { btn.disabled = false; btn.textContent = 'Entrar no app'; }
    });
  }

  /* ---------- escrita ---------- */
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  async function escrever(fn, okMsg) {
    for (let tent = 0; tent < 2; tent++) {
      try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e) {
        const code = e && e.code;
        console.warn('db', e);
        if (code === 'unavailable' && tent === 0) { await espera(500 + Math.random() * 700); continue; }
        if (code === 'permission-denied') toast('Sem permissão para alterar isso. Cada um só altera o que lançou.');
        else if (code === 'not-found') toast('Esse registro não existe mais.');
        else if (code === 'resource-exhausted') toast('Limite diário do plano gratuito atingido. Tente amanhã.');
        else if (code === 'unauthenticated') toast('Sua sessão expirou. Entre de novo.');
        else toast('Não consegui salvar agora. Tente de novo.');
        render();
        return false;
      }
    }
    return false;
  }

  /* resumo dos totais pessoais (o que o outro enxerga) */
  let syncT = 0, syncando = false, syncDeNovo = false;
  function agendarSync() { clearTimeout(syncT); syncT = setTimeout(syncResumo, 700); }
  async function syncResumo() {
    if (!S.firm.meus || !S.got.resumos || !souMembro() || S.canWrite === false) return;
    if (syncando) { syncDeNovo = true; return; }
    const meses = FL.resumoPessoal(S.meus);
    const atual = S.resumos[S.uid];
    if (atual && FL.stable(atual.meses || {}) === FL.stable(meses)) return;
    syncando = true;
    try { await S.db.doc('resumos/' + S.uid).set({ meses, atualizadoEm: Date.now() }); } catch (e) { console.warn('resumo', e); }
    syncando = false;
    if (syncDeNovo) { syncDeNovo = false; agendarSync(); }
  }

  /* ---------- modal ---------- */
  function abrirModal(titulo, corpo, montar) {
    const el = $('#modal');
    el.innerHTML = '<div class="scrim" data-act="fechar-fundo"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '"><div class="sheet-head"><h2>' + esc(titulo) + '</h2><button class="icon-btn" type="button" data-act="fechar" aria-label="Fechar">' + ICON.close + '</button></div>' + corpo + '</div></div>';
    if (montar) montar(el);
    const first = el.querySelector('input:not([type=radio]):not([type=hidden]), select');
    if (first && window.matchMedia('(min-width: 640px)').matches) first.focus();
  }
  function fecharModal() { $('#modal').innerHTML = ''; }

  let toastT = 0;
  function toast(msg) {
    const el = $('#toast');
    el.innerHTML = '<div class="toast" role="status">' + esc(msg) + '</div>';
    clearTimeout(toastT); toastT = setTimeout(() => { el.innerHTML = ''; }, 3200);
  }

  function seg(name, opts, val, disabled) {
    return '<div class="seg" role="radiogroup">' + opts.map(([v, l]) => '<input type="radio" name="' + name + '" id="' + name + '-' + v + '" value="' + v + '"' + (v === val ? ' checked' : '') + (disabled ? ' disabled' : '') + '><label for="' + name + '-' + v + '">' + l + '</label>').join('') + '</div>';
  }
  const radio = (el, name) => { const r = el.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; };
  const fmtInput = (n) => (n == null ? '' : String(n.toFixed(2)).replace('.', ','));
  function dataPadrao() {
    const hoje = hojeISO();
    if (S.mes === hoje.slice(0, 7)) return hoje;
    const [y, m] = S.mes.split('-').map(Number);
    return S.mes + '-' + pad(Math.min(+hoje.slice(8), new Date(y, m, 0).getDate()));
  }

  /* ---------- formulário de lançamento ---------- */
  function formLanc(src, item) {
    const editar = !!item;
    if (editar && src === 'conj' && item.autor !== S.uid) return verLancOutro(item);
    const st = {
      destino: src === 'conj' ? 'casal' : 'pessoal',
      tipo: (item && item.tipo) || 'despesa',
      cat: (item && item.cat) || 'mercado',
    };
    const corpo = '<form id="f-lanc" class="field" style="gap:14px" novalidate>' +
      (editar ? '' : '<div class="field"><span>Para quem é</span>' + seg('dest', [['pessoal', 'Só meu (privado)'], ['casal', 'Do casal']], st.destino) + '</div>') +
      '<div class="field" id="w-tipo"' + (st.destino === 'casal' ? ' hidden' : '') + '><span>Tipo</span>' + seg('tipo', [['despesa', 'Despesa'], ['receita', 'Receita']], st.tipo) + '</div>' +
      '<div class="field"><label for="f-valor" id="l-valor">Valor</label><div class="money-in"><span>R$</span><input id="f-valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + (item ? fmtInput(item.valor) : '') + '"></div></div>' +
      '<div class="field"><label for="f-desc">Descrição</label><input class="input" id="f-desc" maxlength="60" placeholder="Ex.: Mercado do mês" value="' + esc(item ? item.desc : '') + '"></div>' +
      '<div class="field"><span>Categoria</span><div class="catpick" id="f-cats"></div></div>' +
      '<div class="two"><div class="field"><label for="f-data">Data</label><input class="input" type="date" id="f-data" value="' + esc(item ? item.data : dataPadrao()) + '"></div>' +
      '<div class="field"><label for="f-status">Situação</label><select class="input" id="f-status"></select></div></div>' +
      (editar ? (item.parcela ? '<div class="hint">Parcela ' + esc(item.parcela) + '. A alteração vale só para esta.</div>' : '') :
        '<div class="field"><span>Repetir</span>' + seg('rep', [['unica', 'Uma vez'], ['parcelada', 'Parcelado'], ['fixa', 'Todo mês']], 'unica') +
        '<div class="two" id="w-n" hidden><div class="field"><label for="f-n">Quantidade de meses</label><input class="input" type="number" id="f-n" min="2" max="60" value="2" inputmode="numeric"></div><div class="hint" id="h-n" style="align-self:end;padding-bottom:6px"></div></div></div>') +
      '<div class="err" id="f-err" hidden></div>' +
      '<button class="btn block" type="submit">' + (editar ? 'Salvar alterações' : 'Lançar') + '</button>' +
      (editar ? '<div class="btn-row"><button class="btn danger" type="button" id="b-del">Excluir</button>' + (item.grupo ? '<button class="btn danger" type="button" id="b-del-g">Excluir esta e as próximas</button>' : '') + '</div>' : '') +
      '</form>';
    abrirModal(editar ? 'Editar lançamento' : 'Novo lançamento', corpo, (el) => {
      const f = $('#f-lanc', el);
      const desenharCats = () => {
        const lista = st.tipo === 'receita' && st.destino === 'pessoal' ? CAT_REC : CAT_DESP;
        if (!lista.some(([k]) => k === st.cat)) st.cat = lista[0][0];
        $('#f-cats', el).innerHTML = lista.map(([k, i, n]) => '<button type="button" data-cat="' + k + '" aria-pressed="' + (k === st.cat) + '">' + i + ' ' + esc(n) + '</button>').join('');
        const sel = $('#f-status', el);
        const atual = sel.value || (item ? item.status : 'pago');
        const rec = st.tipo === 'receita' && st.destino === 'pessoal';
        sel.innerHTML = '<option value="pago">' + (rec ? 'Recebido' : 'Pago') + '</option><option value="pendente">' + (rec ? 'A receber' : 'A pagar') + '</option>';
        sel.value = atual === 'pendente' ? 'pendente' : 'pago';
      };
      const atualizarRep = () => {
        const rep = radio(f, 'rep');
        const w = $('#w-n', el); if (!w) return;
        w.hidden = rep === 'unica';
        const n = Math.max(2, Math.floor(Number($('#f-n', el).value) || 2));
        const v = FL.parseValor($('#f-valor', el).value);
        const h = $('#h-n', el);
        if (rep === 'parcelada') { $('#l-valor', el).textContent = 'Valor total'; h.textContent = v > 0 ? n + '× de ' + fmt(v / n) : 'O total é dividido em parcelas mensais.'; }
        else if (rep === 'fixa') { $('#l-valor', el).textContent = 'Valor por mês'; h.textContent = v > 0 ? n + ' meses de ' + fmt(v) : 'Mesmo valor, todo mês.'; }
        else $('#l-valor', el).textContent = 'Valor';
      };
      desenharCats();
      f.addEventListener('change', (e) => {
        if (e.target.name === 'dest') { st.destino = e.target.value; $('#w-tipo', el).hidden = st.destino === 'casal'; desenharCats(); }
        if (e.target.name === 'tipo') { st.tipo = e.target.value; desenharCats(); }
        if (e.target.name === 'rep') atualizarRep();
      });
      f.addEventListener('input', (e) => { if (e.target.id === 'f-n' || e.target.id === 'f-valor') atualizarRep(); });
      $('#f-cats', el).addEventListener('click', (e) => {
        const b = e.target.closest('button[data-cat]'); if (!b) return;
        st.cat = b.dataset.cat; $$('#f-cats button', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#f-err', el);
        const erro = (t) => { err.hidden = false; err.textContent = t; };
        const valor = FL.parseValor($('#f-valor', el).value);
        if (!(valor > 0)) return erro('Informe um valor maior que zero (ex.: 150,90).');
        const data = $('#f-data', el).value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro('Escolha a data.');
        const tipo = st.destino === 'casal' ? 'despesa' : st.tipo;
        const desc = $('#f-desc', el).value.trim() || cat(st.cat).nome;
        const status = $('#f-status', el).value;
        const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
        if (editar) {
          const ref = src === 'conj' ? S.db.doc('conjunto/' + item.id) : meusCol().doc(item.id);
          const ok = await escrever(() => ref.update({ tipo, desc, valor, cat: st.cat, data, mes: FL.mesDe(data), status }), 'Lançamento atualizado');
          if (ok) { fecharModal(); agendarSync(); } else btn.disabled = false;
          return;
        }
        const rep = radio(f, 'rep');
        const n = rep === 'unica' ? 1 : Math.floor(Number($('#f-n', el).value) || 0);
        if (rep !== 'unica' && (n < 2 || n > 60)) { btn.disabled = false; return erro('Use de 2 a 60 meses.'); }
        const serie = FL.gerarSerie(valor, n, rep, data);
        const grupo = serie.length > 1 ? 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : null;
        const coll = st.destino === 'casal' ? S.db.collection('conjunto') : meusCol();
        btn.textContent = serie.length > 1 ? 'Lançando 0/' + serie.length + '…' : 'Lançando…';
        let ok = true;
        for (let i = 0; i < serie.length && ok; i++) {
          const it = serie[i];
          const doc = { kind: 'lanc', tipo, desc, valor: it.valor, cat: st.cat, data: it.data, mes: FL.mesDe(it.data), status: i === 0 ? status : 'pendente', parcela: it.parcela, grupo, autor: S.uid, criadoEm: Date.now() };
          ok = await escrever(() => coll.add(doc));
          if (serie.length > 1) btn.textContent = 'Lançando ' + (i + 1) + '/' + serie.length + '…';
        }
        if (ok) {
          fecharModal(); agendarSync();
          toast(serie.length > 1 ? serie.length + ' lançamentos criados' : (st.destino === 'casal' ? 'Lançado no casal' : 'Lançado'));
          const mesL = FL.mesDe(data);
          if (mesL !== S.mes) { S.mes = mesL; }
          if (st.destino === 'casal' && S.aba === 'meus') location.hash = 'casal';
          else if (st.destino === 'pessoal' && S.aba === 'casal') location.hash = 'meus';
          render();
        } else { btn.disabled = false; btn.textContent = 'Lançar'; }
      });
      if (editar) {
        const armar = (b, fn) => b && b.addEventListener('click', async () => {
          if (!b.dataset.armed) { b.dataset.armed = '1'; b.dataset.txt = b.textContent; b.textContent = 'Toque de novo para confirmar'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = b.dataset.txt; } }, 4000); return; }
          b.disabled = true; await fn();
        });
        const collRef = () => (src === 'conj' ? S.db.collection('conjunto') : meusCol());
        armar($('#b-del', el), async () => {
          const ok = await escrever(() => collRef().doc(item.id).delete(), 'Lançamento excluído');
          if (ok) { fecharModal(); agendarSync(); }
        });
        armar($('#b-del-g', el), async () => {
          const base = src === 'conj' ? S.conj : S.meus;
          const alvo = base.filter((l) => l.grupo === item.grupo && l.data >= item.data && (src !== 'conj' || l.autor === S.uid));
          let ok = true;
          for (const l of alvo) { if (!ok) break; ok = await escrever(() => collRef().doc(l.id).delete()); }
          if (ok) { toast(alvo.length + ' lançamentos excluídos'); fecharModal(); agendarSync(); }
        });
      }
    });
  }

  function verLancOutro(l) {
    const p = pessoa(l.autor);
    const c = cat(l.cat);
    abrirModal('Lançamento do casal', '<div class="who">' + avatar(p) + '<div><div class="name">' + esc(l.desc) + '</div><div class="sub">Lançado por ' + esc(p.nome) + '</div></div></div>' +
      '<div class="rows"><div class="rowkv"><span class="k">Valor</span><span class="v">' + fmt(l.valor) + '</span></div>' +
      '<div class="rowkv"><span class="k">Categoria</span><span class="v">' + c.ico + ' ' + esc(c.nome) + '</span></div>' +
      '<div class="rowkv"><span class="k">Data</span><span class="v">' + esc(dataCurta(l.data)) + '</span></div>' +
      '<div class="rowkv"><span class="k">Situação</span><span class="v">' + (l.status === 'pendente' ? 'A pagar' : 'Pago') + '</span></div>' +
      (l.parcela ? '<div class="rowkv"><span class="k">Parcela</span><span class="v">' + esc(l.parcela) + '</span></div>' : '') + '</div>' +
      '<div class="note">Só ' + esc(p.nome) + ' pode alterar ou excluir este lançamento.</div>');
  }

  /* ---------- cofrinho ---------- */
  function formMov(tipo, item) {
    const editar = !!item;
    if (editar && item.autor !== S.uid) {
      const p = pessoa(item.autor);
      return abrirModal('Movimentação do cofrinho', '<div class="who">' + avatar(p) + '<div><div class="name">' + (item.tipo === 'retirada' ? 'Retirada' : 'Guardou') + ' ' + fmt(item.valor) + '</div><div class="sub">' + esc(p.nome) + ' · ' + esc(dataCurta(item.data)) + '</div></div></div>' + (item.obs ? '<p class="sub" style="margin:0">' + esc(item.obs) + '</p>' : '') + '<div class="note">Só ' + esc(p.nome) + ' pode alterar esta movimentação.</div>');
    }
    tipo = (item && item.tipo) || tipo || 'deposito';
    const corpo = '<form id="f-mov" class="field" style="gap:14px" novalidate>' +
      '<div class="field"><span>Movimento</span>' + seg('mt', [['deposito', 'Guardar'], ['retirada', 'Retirar']], tipo) + '</div>' +
      '<div class="field"><label for="m-valor">Valor</label><div class="money-in"><span>R$</span><input id="m-valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + (item ? fmtInput(item.valor) : '') + '"></div></div>' +
      '<div class="two"><div class="field"><label for="m-data">Data</label><input class="input" type="date" id="m-data" value="' + esc(item ? item.data : hojeISO()) + '"></div>' +
      '<div class="field"><label for="m-obs">Observação</label><input class="input" id="m-obs" maxlength="60" placeholder="Opcional" value="' + esc(item ? item.obs || '' : '') + '"></div></div>' +
      '<div class="err" id="m-err" hidden></div><button class="btn block" type="submit">' + (editar ? 'Salvar' : 'Confirmar') + '</button>' +
      (editar ? '<button class="btn danger" type="button" id="m-del">Excluir</button>' : '') + '</form>';
    abrirModal(editar ? 'Editar movimentação' : 'Cofrinho da viagem', corpo, (el) => {
      const f = $('#f-mov', el);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const valor = FL.parseValor($('#m-valor', el).value);
        const data = $('#m-data', el).value;
        const err = $('#m-err', el);
        if (!(valor > 0)) { err.hidden = false; err.textContent = 'Informe um valor maior que zero.'; return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { err.hidden = false; err.textContent = 'Escolha a data.'; return; }
        const doc = { tipo: radio(f, 'mt'), valor, data, mes: FL.mesDe(data), obs: $('#m-obs', el).value.trim(), autor: S.uid };
        const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
        const ok = editar
          ? await escrever(() => S.db.doc('cofrinho/' + item.id).update(doc), 'Movimentação atualizada')
          : await escrever(() => S.db.collection('cofrinho').add(Object.assign(doc, { criadoEm: Date.now() })), doc.tipo === 'retirada' ? 'Retirada registrada' : 'Guardado no cofrinho');
        if (ok) fecharModal(); else btn.disabled = false;
      });
      const d = $('#m-del', el);
      if (d) d.addEventListener('click', async () => {
        if (!d.dataset.armed) { d.dataset.armed = '1'; d.textContent = 'Toque de novo para excluir'; return; }
        d.disabled = true;
        if (await escrever(() => S.db.doc('cofrinho/' + item.id).delete(), 'Movimentação excluída')) fecharModal();
      });
    });
  }

  function formViagem() {
    const v = S.viagem || {};
    const hoje = mesHoje();
    const alvo = v.mes || FL.addMeses(hoje, 6);
    const [ay, am] = alvo.split('-').map(Number);
    const anos = []; for (let y = +hoje.slice(0, 4); y <= +hoje.slice(0, 4) + 4; y++) anos.push(y);
    const corpo = '<form id="f-viag" class="field" style="gap:14px" novalidate>' +
      '<div class="field"><label for="v-dest">Destino</label><input class="input" id="v-dest" maxlength="40" value="' + esc(v.destino || '') + '" placeholder="Ex.: Santa Catarina"></div>' +
      '<div class="field"><label for="v-meta">Meta do casal</label><div class="money-in"><span>R$</span><input id="v-meta" inputmode="decimal" value="' + (v.meta ? fmtInput(v.meta) : '') + '" placeholder="0,00"></div></div>' +
      '<div class="two"><div class="field"><label for="v-mes">Mês da viagem</label><select class="input" id="v-mes">' + MESES.map((n, i) => '<option value="' + pad(i + 1) + '"' + (i + 1 === am ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="v-ano">Ano</label><select class="input" id="v-ano">' + anos.map((y) => '<option' + (y === ay ? ' selected' : '') + '>' + y + '</option>').join('') + '</select></div></div>' +
      '<div class="hint">O app calcula quanto guardar por mês até o mês da viagem.</div>' +
      '<div class="err" id="v-err" hidden></div><button class="btn block" type="submit">Salvar meta</button></form>';
    abrirModal('Meta da viagem', corpo, (el) => {
      $('#f-viag', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const meta = FL.parseValor($('#v-meta', el).value);
        const err = $('#v-err', el);
        if (!(meta > 0)) { err.hidden = false; err.textContent = 'Informe a meta em reais.'; return; }
        const doc = { destino: $('#v-dest', el).value.trim() || 'Viagem', meta, mes: $('#v-ano', el).value + '-' + $('#v-mes', el).value, atualizadoEm: Date.now(), por: S.uid };
        if (await escrever(() => S.db.doc('config/viagem').set(doc), 'Meta salva')) fecharModal();
      });
    });
  }

  /* ---------- configurações ---------- */
  function formConfig() {
    const eu = pessoa(S.uid);
    const ps = casal().map((x) => pessoa(x.id));
    const cfg = S.cfgCasal || {};
    const modo = cfg.modo || 'renda';
    const a = ps[0];
    const fixoA = cfg.fixo && typeof cfg.fixo[a.id] === 'number' ? cfg.fixo[a.id] : 60;
    let corCfg = eu.cor;
    const usadas = ps.filter((p) => p.id !== S.uid).map((p) => p.cor);
    const corpo = '<form id="f-cfg" class="field" style="gap:16px" novalidate>' +
      '<div class="field"><label for="c-nome">Seu nome no app</label><input class="input" id="c-nome" maxlength="24" value="' + esc(eu.nome) + '"></div>' +
      '<div class="field"><span>Sua cor</span><div class="colors" id="c-cores">' + CORES.map((c) => '<button type="button" data-cor="' + c + '" aria-label="Cor ' + c + '" aria-pressed="' + (c === corCfg) + '" style="background:' + c + '"' + (usadas.includes(c) ? ' disabled' : '') + '></button>').join('') + '</div></div>' +
      (ps.length === 2 ? '<div class="field"><span>Divisão das despesas do casal</span>' + seg('modo', [['renda', 'Pela renda'], ['igual', 'Meio a meio'], ['fixo', 'Fixa']], modo) +
        '<div class="hint" id="c-hint"></div>' +
        '<div class="field" id="w-fixo"' + (modo === 'fixo' ? '' : ' hidden') + '><label for="c-fixo">Parte de ' + esc(a.nome) + ' (%)</label><input class="input" type="number" id="c-fixo" min="0" max="100" step="1" value="' + fixoA + '" inputmode="numeric"><div class="hint" id="c-fixo-b"></div></div></div>' : '') +
      '<div class="note">' + ICON.lock + '<span>Lançamentos “Só meu” ficam numa área do banco que só a sua conta acessa. A outra pessoa vê apenas os seus totais do mês (renda, gastos e a pagar).</span></div>' +
      '<div class="err" id="c-err" hidden></div><button class="btn block" type="submit">Salvar</button>' +
      '<div class="field" style="border-top:1px solid var(--line);padding-top:14px"><span>Sua conta</span><div class="sub">' + esc(S.email) + '</div>' +
      '<div class="btn-row"><button class="btn ghost" type="button" data-act="trocar-senha">Alterar senha</button><button class="btn danger" type="button" data-act="sair">Sair do app</button></div></div></form>';
    abrirModal('Configurações', corpo, (el) => {
      const f = $('#f-cfg', el);
      const dica = () => {
        const m = radio(f, 'modo');
        const h = $('#c-hint', el); if (!h) return;
        h.textContent = m === 'renda' ? 'Cada um paga a parte proporcional à renda lançada no mês. Se alguém ainda não lançou a renda, usa o último mês com as duas.' : m === 'igual' ? 'Cada um paga 50%.' : 'Vocês definem o percentual de cada um.';
        $('#w-fixo', el).hidden = m !== 'fixo';
        const fb = $('#c-fixo-b', el);
        if (fb && ps[1]) fb.textContent = ps[1].nome + ': ' + Math.max(0, 100 - (Number($('#c-fixo', el).value) || 0)) + '%';
      };
      dica();
      f.addEventListener('change', dica);
      f.addEventListener('input', dica);
      $('#c-cores', el).addEventListener('click', (e) => {
        const b = e.target.closest('button[data-cor]'); if (!b || b.disabled) return;
        corCfg = b.dataset.cor; $$('#c-cores button', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = $('#c-nome', el).value.trim();
        const err = $('#c-err', el);
        if (!nome) { err.hidden = false; err.textContent = 'Digite seu nome.'; return; }
        let ok = true;
        const me = S.membros[S.uid] || {};
        if (nome !== me.nome || corCfg !== me.cor) ok = await escrever(() => S.db.doc('membros/' + S.uid).update({ nome, cor: corCfg }));
        if (ok && ps.length === 2) {
          const m = radio(f, 'modo');
          const novo = { modo: m };
          if (m === 'fixo') {
            const x = Math.min(100, Math.max(0, Math.round(Number($('#c-fixo', el).value) || 0)));
            novo.fixo = { [ps[0].id]: x, [ps[1].id]: 100 - x };
          }
          if (FL.stable(novo) !== FL.stable({ modo: cfg.modo || 'renda', ...(cfg.fixo && (cfg.modo === 'fixo') ? { fixo: cfg.fixo } : {}) })) {
            ok = await escrever(() => S.db.doc('config/casal').set(Object.assign(novo, { atualizadoEm: Date.now(), por: S.uid })));
          }
        }
        if (ok) { toast('Configurações salvas'); fecharModal(); }
      });
    });
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'fechar-fundo') { if (e.target === el) fecharModal(); return; }
    if (act === 'fechar') return fecharModal();
    if (act === 'toggle-status') {
      e.stopPropagation();
      const src = el.dataset.src;
      const base = src === 'conj' ? S.conj : S.meus;
      const l = base.find((x) => x.id === el.dataset.id); if (!l) return;
      const novo = l.status === 'pendente' ? 'pago' : 'pendente';
      const ref = src === 'conj' ? S.db.doc('conjunto/' + l.id) : meusCol().doc(l.id);
      if (await escrever(() => ref.update({ status: novo }))) agendarSync();
      return;
    }
    if (act === 'mes-prev') { S.mes = FL.addMeses(S.mes, -1); render(); }
    else if (act === 'mes-next') { S.mes = FL.addMeses(S.mes, 1); render(); }
    else if (act === 'mes-hoje') { S.mes = mesHoje(); render(); }
    else if (act === 'ir') { location.hash = el.dataset.tab; }
    else if (act === 'filtro') { S.filtro = el.dataset.f; render(); }
    else if (act === 'abrir-lanc') {
      const src = el.dataset.src;
      const l = (src === 'conj' ? S.conj : S.meus).find((x) => x.id === el.dataset.id);
      if (l) formLanc(src, l);
    }
    else if (act === 'abrir-mov') { const x = S.cofre.find((y) => y.id === el.dataset.id); if (x) formMov(null, x); }
    else if (act === 'cofre-novo') formMov(el.dataset.tipo);
    else if (act === 'editar-viagem') formViagem();
    else if (act === 'config') formConfig();
    else if (act === 'trocar-senha') formSenha();
    else if (act === 'sair') { fecharModal(); await Conta.sair(); }
    else if (act === 'acerto-ok') {
      const m = modelo(); const ac = m.conj.acerto; if (!ac) return;
      await escrever(() => S.db.doc('acertos/' + S.mes).set({ quitado: true, valor: ac.valor, de: ac.de, para: ac.para, em: Date.now(), por: S.uid }), 'Acerto marcado como feito');
    }
    else if (act === 'acerto-desfazer') { await escrever(() => S.db.doc('acertos/' + S.mes).delete(), 'Acerto desmarcado'); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#modal').innerHTML) fecharModal();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
  });
  $('#fab').addEventListener('click', () => {
    if (S.aba === 'viagem') return S.viagem ? formMov('deposito') : formViagem();
    formLanc(S.aba === 'casal' ? 'conj' : 'meu');
  });
  window.addEventListener('hashchange', () => { S.aba = lerHash(); window.scrollTo(0, 0); render(); });

  /* ---------- login ---------- */
  function msgAuth(e) {
    const c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'E-mail ou senha incorretos.';
    if (c === 'auth/invalid-email') return 'Esse e-mail não é válido.';
    if (c === 'auth/missing-email') return 'Digite seu e-mail.';
    if (c === 'auth/too-many-requests') return 'Muitas tentativas. Espere alguns minutos ou redefina a senha.';
    if (c === 'auth/network-request-failed') return 'Sem internet. Confira a conexão e tente de novo.';
    if (c === 'auth/user-disabled') return 'Este acesso foi desativado.';
    if (c === 'auth/weak-password' || c === 'auth/password-does-not-meet-requirements') return 'Senha fraca: use pelo menos 6 caracteres.';
    if (c === 'auth/requires-recent-login') return 'Por segurança, saia e entre de novo antes de trocar a senha.';
    return 'Não deu certo agora. Tente de novo.';
  }

  function telaLogin() {
    return '<div class="center-screen"><form class="card welcome" id="f-login" novalidate>' +
      '<div class="eyebrow">Finanças do Casal</div><h2>Entrar</h2>' +
      '<div class="field"><label for="lg-email">E-mail</label><input class="input" id="lg-email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false"></div>' +
      '<div class="field"><label for="lg-senha">Senha</label><input class="input" id="lg-senha" type="password" autocomplete="current-password"></div>' +
      '<div class="err" id="lg-err" hidden></div><div class="note pos" id="lg-ok" hidden></div>' +
      '<button class="btn block" type="submit">Entrar</button>' +
      '<button class="link" type="button" id="lg-esqueci">Esqueci minha senha</button>' +
      '<p class="hint" style="margin:0">Primeiro acesso? Digite o e-mail cadastrado e toque em “Esqueci minha senha” para criar a sua senha.</p>' +
      '</form></div>';
  }
  function montarLogin() {
    const f = $('#f-login');
    if (!f) return;
    const err = $('#lg-err'), ok = $('#lg-ok');
    const aviso = (el, t) => { err.hidden = true; ok.hidden = true; if (el) { el.hidden = false; el.textContent = t; } };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#lg-email').value.trim();
      const senha = $('#lg-senha').value;
      if (!email || !senha) return aviso(err, 'Preencha e-mail e senha.');
      const b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Entrando…';
      try { await Conta.entrar(email, senha); } catch (x) { aviso(err, msgAuth(x)); b.disabled = false; b.textContent = 'Entrar'; }
    });
    $('#lg-esqueci').addEventListener('click', async () => {
      const email = $('#lg-email').value.trim();
      if (!email) return aviso(err, 'Digite seu e-mail acima e toque de novo em “Esqueci minha senha”.');
      try {
        await Conta.redefinir(email);
        aviso(ok, 'Se esse e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Confira também a caixa de spam.');
      } catch (x) { aviso(err, msgAuth(x)); }
    });
  }

  function formSenha() {
    const corpo = '<form id="f-senha" class="field" style="gap:14px" novalidate>' +
      '<input type="email" autocomplete="username" value="' + esc(S.email) + '" hidden>' +
      '<div class="field"><label for="s-atual">Senha atual</label><input class="input" id="s-atual" type="password" autocomplete="current-password"></div>' +
      '<div class="field"><label for="s-nova">Nova senha</label><input class="input" id="s-nova" type="password" autocomplete="new-password"></div>' +
      '<div class="field"><label for="s-conf">Repita a nova senha</label><input class="input" id="s-conf" type="password" autocomplete="new-password"></div>' +
      '<div class="err" id="s-err" hidden></div><button class="btn block" type="submit">Alterar senha</button></form>';
    abrirModal('Alterar senha', corpo, (el) => {
      const f = $('#f-senha', el);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#s-err', el);
        const atual = $('#s-atual', el).value, nova = $('#s-nova', el).value, conf = $('#s-conf', el).value;
        const erro = (t) => { err.hidden = false; err.textContent = t; };
        if (!atual || !nova) return erro('Preencha a senha atual e a nova.');
        if (nova.length < 6) return erro('A nova senha precisa ter pelo menos 6 caracteres.');
        if (nova !== conf) return erro('As duas senhas novas não são iguais.');
        const b = f.querySelector('button[type=submit]'); b.disabled = true;
        try { await Conta.trocarSenha(atual, nova); toast('Senha alterada'); fecharModal(); }
        catch (x) { erro(msgAuth(x)); b.disabled = false; }
      });
    });
  }

  /* ---------- conexão ---------- */
  let ouvintes = [];
  let timer = 0;
  function ouvir(ref, chave, aplicar) {
    const parar = ref.onSnapshot((snap) => {
      aplicar(snap);
      S.got[chave] = true;
      if (!snap.metadata.fromCache) S.firm[chave] = true;
      if (S.got.membros && S.got.meus) clearTimeout(timer);
      if (chave === 'meus' || chave === 'resumos') agendarSync();
      render();
    }, (err) => {
      console.warn('snapshot', chave, err);
      S.got[chave] = true;
      render();
    });
    ouvintes.push(parar);
  }
  const lista = (snap) => snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

  function limparDados() {
    ouvintes.forEach((p) => { try { p(); } catch (e) { /* ignora */ } });
    ouvintes = [];
    clearTimeout(timer);
    Object.assign(S, { uid: null, email: '', meus: [], conj: [], cofre: [], membros: {}, resumos: {}, cfgCasal: {}, viagem: null, acertos: {}, got: {}, firm: {}, timeout: false });
    fecharModal();
  }

  function conectar() {
    const db = S.db;
    timer = setTimeout(() => { S.timeout = true; render(); }, 10000);
    ouvir(db.collection('membros'), 'membros', (s) => { const o = {}; s.docs.forEach((d) => { o[d.id] = d.data(); }); S.membros = o; });
    ouvir(meusCol(), 'meus', (s) => { S.meus = lista(s).filter((x) => x.kind === 'lanc' && x.mes && x.data); });
    ouvir(db.collection('resumos'), 'resumos', (s) => { const o = {}; s.docs.forEach((d) => { o[d.id] = d.data(); }); S.resumos = o; });
    ouvir(db.collection('conjunto'), 'conj', (s) => { S.conj = lista(s).filter((x) => x.mes && x.data); });
    ouvir(db.collection('cofrinho'), 'cofre', (s) => { S.cofre = lista(s).filter((x) => x.mes && x.data); });
    ouvir(db.collection('config'), 'config', (s) => { S.cfgCasal = {}; S.viagem = null; s.docs.forEach((d) => { if (d.id === 'casal') S.cfgCasal = d.data(); if (d.id === 'viagem') S.viagem = d.data(); }); });
    ouvir(db.collection('acertos'), 'acertos', (s) => { const o = {}; s.docs.forEach((d) => { o[d.id] = d.data(); }); S.acertos = o; });
  }

  S.db = DB;
  render();
  Conta.aoMudar((u) => {
    limparDados();
    S.authPronto = true;
    if (u) { S.uid = u.uid; S.email = u.email || ''; conectar(); }
    render();
  });

})();
