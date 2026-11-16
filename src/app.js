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

  /* ---------- categorias (catálogo compartilhado, com grupos) ---------- */
  const CATALOGO_PADRAO = {
    grupos: [
      { id: 'moradia', nome: 'Moradia' }, { id: 'alimentacao', nome: 'Alimentação' }, { id: 'veiculo', nome: 'Veículo e transporte' },
      { id: 'saude', nome: 'Saúde e bem-estar' }, { id: 'lazer', nome: 'Lazer e compras' }, { id: 'servicos', nome: 'Assinaturas e educação' },
      { id: 'outros', nome: 'Outros' }, { id: 'receitas', nome: 'Receitas' },
    ],
    cats: [
      ['moradia', '🏠', 'Aluguel / financiamento', 'moradia'], ['agua', '💧', 'Água', 'moradia'], ['energia', '💡', 'Energia', 'moradia'],
      ['internet', '📶', 'Internet / telefone', 'moradia'], ['diarista', '🧹', 'Diarista', 'moradia'], ['gas', '🔥', 'Gás', 'moradia'],
      ['iptu', '🏛️', 'IPTU', 'moradia'], ['contas', '🧾', 'Outras contas da casa', 'moradia'],
      ['mercado', '🛒', 'Mercado', 'alimentacao'], ['alimentacao', '🍽️', 'Restaurante e delivery', 'alimentacao'],
      ['transporte', '⛽', 'Combustível e transporte', 'veiculo'], ['seguro_carro', '🛡️', 'Seguro do veículo', 'veiculo'],
      ['ipva', '📄', 'IPVA / licenciamento', 'veiculo'], ['manutencao', '🔧', 'Manutenção do veículo', 'veiculo'],
      ['saude', '💊', 'Saúde', 'saude'], ['academia', '🏋️', 'Academia', 'saude'], ['esportes', '🥊', 'Esportes / lutas', 'saude'],
      ['cuidados', '💇', 'Cuidados pessoais', 'saude'],
      ['lazer', '🎉', 'Lazer', 'lazer'], ['compras', '🛍️', 'Compras', 'lazer'], ['presentes', '🎁', 'Presentes', 'lazer'],
      ['viagem', '✈️', 'Viagem', 'lazer'], ['pets', '🐾', 'Pets', 'lazer'],
      ['assinaturas', '📺', 'Assinaturas', 'servicos'], ['educacao', '📚', 'Educação', 'servicos'],
      ['cartao', '💳', 'Fatura de cartão (total)', 'outros'], ['outros', '📦', 'Outros', 'outros'],
      ['salario', '💼', 'Salário', 'receitas'], ['prolabore', '🏢', 'Pró-labore', 'receitas'], ['comissao', '📈', 'Comissão', 'receitas'],
      ['extra', '✨', 'Renda extra', 'receitas'], ['rendimentos', '🏦', 'Rendimentos', 'receitas'], ['outros_r', '📦', 'Outras receitas', 'receitas'],
    ].map(([id, ico, nome, grupo]) => ({ id, ico, nome, grupo })),
  };
  let CAT_MAP = {};
  function catalogo() {
    const c = S.catalogo;
    if (!c || !Array.isArray(c.grupos) || !Array.isArray(c.cats) || !c.cats.length) return CATALOGO_PADRAO;
    const grupos = c.grupos.some((g) => g.id === 'receitas') ? c.grupos : c.grupos.concat([{ id: 'receitas', nome: 'Receitas' }]);
    return { grupos, cats: c.cats };
  }
  function reindexarCats() {
    CAT_MAP = {};
    CATALOGO_PADRAO.cats.forEach((c) => { CAT_MAP[c.id] = c; });
    catalogo().cats.forEach((c) => { CAT_MAP[c.id] = c; });
  }
  const cat = (k) => CAT_MAP[k] || { id: k, ico: '📦', nome: 'Outros', grupo: 'outros' };
  function gruposDe(tipo) {
    const cg = catalogo();
    return cg.grupos
      .filter((g) => (tipo === 'receita' ? g.id === 'receitas' : g.id !== 'receitas'))
      .map((g) => ({ g, cats: cg.cats.filter((c) => c.grupo === g.id && !c.oculta) }))
      .filter((x) => x.cats.length);
  }
  const catsLista = (tipo) => gruposDe(tipo).flatMap((x) => x.cats);
  function catChips(tipo, sel) {
    return '<div class="catbox">' + gruposDe(tipo).map(({ g, cats }) => '<div class="cg"><div class="cg-nome">' + esc(g.nome) + '</div><div class="catpick">' +
      cats.map((c) => '<button type="button" data-cat="' + esc(c.id) + '" aria-pressed="' + (c.id === sel) + '">' + c.ico + ' ' + esc(c.nome) + '</button>').join('') + '</div></div>').join('') + '</div>';
  }
  function ligarCatChips(box, st, onChange) {
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cat]'); if (!b) return;
      st.cat = b.dataset.cat;
      $$('button[data-cat]', box).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (onChange) onChange();
    });
  }

  /* ---------- formas de pagamento e cartões ---------- */
  const PAGS = [['pix', 'Pix'], ['debito', 'Débito'], ['dinheiro', 'Dinheiro'], ['boleto', 'Boleto']];
  const cartaoDe = (id) => S.cartoes.find((c) => c.id === id) || null;
  function opcoesPag(pag, cartaoId) {
    const v = pag === 'cartao' && cartaoId ? 'c:' + cartaoId : (pag || 'pix');
    return PAGS.map(([k, n]) => '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>' + n + '</option>').join('') +
      (S.cartoes.length ? '<optgroup label="Cartão de crédito">' + S.cartoes.map((c) => '<option value="c:' + esc(c.id) + '"' + (v === 'c:' + c.id ? ' selected' : '') + '>💳 ' + esc(c.nome) + '</option>').join('') + '</optgroup>' : '') +
      '<option value="novo-cartao">+ Cadastrar cartão…</option>';
  }
  function lerPag(valor) {
    if (valor && valor.startsWith('c:')) return { pag: 'cartao', cartaoId: valor.slice(2) };
    return { pag: valor || 'pix', cartaoId: null };
  }
  /* Ajusta mês/data de um lançamento pago no cartão: "data" vira o vencimento da fatura */
  function noCartao(doc, dataCompra, cartaoId, deslocamento) {
    const c = cartaoDe(cartaoId);
    if (!c) return Object.assign(doc, { pag: 'pix', cartaoId: null, dataCompra: null });
    const mesF = FL.addMeses(FL.mesFatura(dataCompra, c.fechamento, c.vencimento), deslocamento || 0);
    return Object.assign(doc, { pag: 'cartao', cartaoId: c.id, dataCompra, mes: mesF, data: FL.vencFatura(mesF, c.vencimento) });
  }
  const DIVS = () => {
    const par = parceiro();
    return [['padrao', 'Padrão do casal (' + (S.cfgCasal.modo === 'igual' ? 'meio a meio' : S.cfgCasal.modo === 'fixo' ? 'percentual fixo' : 'proporcional à renda') + ')'], ['igual', 'Meio a meio'], ['so_autor', 'Só eu (não divide)'], ['so_outro', 'Só ' + (par ? par.nome : 'a outra pessoa') + ' (me reembolsa)']];
  };
  function textoDivisao(l) {
    if (!l.divisao || l.divisao === 'padrao') return '';
    if (l.divisao === 'igual') return 'meio a meio';
    const autor = pessoa(l.autor);
    const outro = casal().map((x) => pessoa(x.id)).find((p) => p.id !== l.autor);
    return l.divisao === 'so_autor' ? 'só ' + autor.nome : 'só ' + (outro ? outro.nome : 'o outro');
  }

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
    evolucao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7"/><path d="M3 20h18"/></svg>',
    metas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 10c0-3.3-3.1-6-7-6S5 6.7 5 10c0 1.9 1 3.6 2.6 4.7L7 19h3l.5-2h3l.5 2h3l-.6-4.3c1-.7 1.8-1.6 2.2-2.7H21v-3h-2.2c.1.3.2.6.2 1z"/><circle cx="15" cy="9.5" r=".6" fill="currentColor"/></svg>',
    busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    viagem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
  };

  const S = {
    db: null, user: null, uid: null, email: '', authPronto: false, canWrite: true, fatal: null, timeout: false, err: null,
    mes: mesHoje(), aba: 'painel', filtro: 'tudo',
    meus: [], conj: [], cofre: [], membros: {}, resumos: {}, cfgCasal: {}, viagem: null, acertos: {},
    fixas: [], fixasCasal: [], limites: {}, limitesCasal: {}, cartoes: [], catalogo: null, metas: [], metasPess: [], movPess: [],
    busca: { q: '', onde: 'tudo', periodo: '12', status: 'todas', tipo: 'todos', cat: '', pag: '' },
    evoQuem: 'casal', evoN: 6, evoSel: null, evoModo: 'hist', evoAno: null, prevVar: true, rendaPrev: {},
    got: {}, firm: {},
  };
  const meusCol = () => S.db.collection('usuarios/' + S.uid + '/lancamentos');
  const fixasCol = () => S.db.collection('usuarios/' + S.uid + '/fixas');
  const TABS_NAV = ['painel', 'meus', 'casal', 'metas', 'evolucao'];
  const ABAS = TABS_NAV.concat(['busca']);
  const lerHash = () => { let h = (location.hash || '').slice(1); if (h === 'viagem') h = 'metas'; return ABAS.includes(h) ? h : 'painel'; };
  S.aba = lerHash();
  reindexarCats();

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
  function modelo(mesParam) {
    const mes = mesParam || S.mes;
    const I = ids();
    const resumos = Object.assign({}, S.resumos);
    if (S.uid) resumos[S.uid] = { meses: meuResumo() };
    const div = FL.divisao(mes, I, resumos, S.cfgCasal);
    const divHoje = FL.divisao(mesHoje(), I, resumos, S.cfgCasal);
    const conj = FL.conjuntoMes(S.conj, mes, I, div.pct);
    const cof = FL.cofrinho(S.cofre, S.viagem, mesHoje(), I, divHoje.pct);
    const guardMes = cof.noMes[mes] || {};
    const cartoes = {};
    I.forEach((id) => { const rm = resumos[id] && resumos[id].meses && resumos[id].meses[mes]; cartoes[id] = FL.cartaoPessoa(rm, conj.parte[id], (guardMes[id] || 0) + ((rm && rm.metas) || 0)); });
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
    const meusMes = S.meus.filter((l) => l.mes === mes);
    const orcMeu = FL.orcamento(FL.porCategoria(meusMes, (l) => l.tipo !== 'receita'), S.limites);
    const orcCasal = FL.orcamento(FL.porCategoria(conj.itens), S.limitesCasal);
    return { mes, I, div, divHoje, conj, cof, cartoes, tot, temResumo, meusMes, orcMeu, orcCasal, resumos };
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
    top.innerHTML = cabecalho();
    if (S.aba === 'busca' && $('#f-busca')) { $('#busca-res').innerHTML = resultadosBusca(); tabs.hidden = false; return; }
    const m = modelo();
    let html = '';
    if (S.canWrite === false) html += '<div class="banner">Seu acesso a este app é só de leitura. Para lançar, peça para ser convidado(a) por e-mail com acesso de Editor.</div>';
    if (S.timeout && !S.firm.membros) html += '<div class="banner">Sem conexão com o banco de dados no momento — os números podem estar desatualizados.</div>';
    if (S.aba === 'painel') html += viewPainel(m);
    else if (S.aba === 'meus') html += viewMeus(m);
    else if (S.aba === 'casal') html += viewCasal(m);
    else if (S.aba === 'evolucao') html += viewEvolucao(m);
    else if (S.aba === 'busca') html += viewBusca();
    else html += viewMetas();
    main.innerHTML = html;
    if (S.aba === 'busca') montarBusca();
    tabs.hidden = false;
    tabs.innerHTML = '<div class="in">' + TABS_NAV.map((a) => '<a href="#' + a + '"' + (S.aba === a ? ' aria-current="page"' : '') + '>' + ICON[a] + '<span>' + ({ painel: 'Painel', meus: 'Meus', casal: 'Casal', metas: 'Metas', evolucao: 'Evolução' })[a] + '</span></a>').join('') + '</div>';
    fab.hidden = S.canWrite === false;
    fab.setAttribute('aria-label', S.aba === 'metas' ? 'Guardar dinheiro numa meta' : 'Novo lançamento');
  }

  function cabecalhoSimples() {
    return '<div class="top-row"><div class="brand"><h1>Finanças do Casal</h1></div></div>';
  }
  function cabecalho() {
    const ms = casal().map((x) => pessoa(x.id));
    const pair = '<span class="pair">' + ms.map((p) => '<span style="background:' + esc(p.cor) + '">' + inicial(p.nome) + '</span>').join('') + '</span>';
    const hoje = S.mes !== mesHoje() ? '<button class="hoje" data-act="mes-hoje" type="button">Hoje</button>' : '';
    const mostraMes = S.aba !== 'metas';
    return '<div class="top-row"><div class="brand">' + pair + '<h1>Finanças do Casal</h1></div>' +
      '<div class="top-acts"><button class="icon-btn" type="button" data-act="ir" data-tab="busca" aria-label="Buscar lançamentos">' + ICON.busca + '</button><button class="icon-btn" type="button" data-act="config" aria-label="Configurações">' + ICON.gear + '</button></div></div>' +
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
    h += botaoRapido();
    h += cardFechamento();

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
      '<div class="stat"><span class="k">Guardado em metas</span><span class="v">' + fmt(t.guardado) + '</span></div></div>' +
      (segs.length ? '<div class="stack" role="img" aria-label="Para onde foi a renda do casal">' + segs.map((s) => '<i style="width:' + (s.v / base * 100).toFixed(2) + '%;background:' + s.cor + '"></i>').join('') + '</div>' +
        '<div class="legend">' + segs.map((s) => '<span><b style="background:' + s.cor + '"></b>' + esc(s.nome) + ' ' + fmt(s.v) + '</span>').join('') + '</div>' : '') +
      (t.aPagar > 0 ? '<div class="note warn">Ainda a pagar neste mês: <strong>' + fmt(t.aPagar) + '</strong></div>' : '') +
      '</section>';

    h += cardAlertas(m);
    h += cardVencimentos();

    // Pessoas
    h += '<div class="people">' + ps.map((p) => cardPessoa(p, m)).join('') + '</div>';

    // Acerto
    if (m.I.length === 2 && m.conj.total > 0) h += cardAcerto(m, true);

    // Viagem
    h += cardMetasMini();
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
        '<div class="rowkv"><span class="k">Guardado em metas</span><span class="v">' + fmt(c.guardado) + '</span></div>' +
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

  /* ---------- itens ---------- */
  function itemHTML(l, src, mostrarData) {
    const c = cat(l.cat);
    const autor = src === 'conj' ? pessoa(l.autor) : null;
    const meu = src === 'meu' || l.autor === S.uid;
    const sub = [c.nome];
    if (l.parcela) sub.push(l.parcela);
    if (l.pag === 'cartao') {
      const k = meu ? cartaoDe(l.cartaoId) : null;
      sub.push('💳 ' + (k ? k.nome : 'cartão') + (l.dataCompra ? ' · compra ' + dataCurta(l.dataCompra).slice(0, 5) : ''));
    }
    if (autor) sub.push('pago por ' + autor.nome);
    const dv = src === 'conj' ? textoDivisao(l) : '';
    if (dv) sub.push(dv);
    if (mostrarData) sub.push(dataCurta(l.data).slice(0, 5));
    const receita = l.tipo === 'receita';
    const st = l.status === 'pendente' ? (receita ? 'A receber' : 'A pagar') : (receita ? 'Recebido' : 'Pago');
    const cls = l.status === 'pendente' ? 'pendente' : 'pago';
    const pill = meu && S.canWrite !== false
      ? '<span class="pill ' + cls + '" role="button" tabindex="0" data-act="toggle-status" data-id="' + esc(l.id) + '" data-src="' + src + '" title="Tocar para alterar">' + st + '</span>'
      : '<span class="pill ' + cls + '">' + st + '</span>';
    const est = l.estimado && l.status === 'pendente';
    return '<div class="item" role="button" tabindex="0" data-act="abrir-lanc" data-id="' + esc(l.id) + '" data-src="' + src + '">' +
      '<span class="ico">' + c.ico + (autor ? '<span class="dot" style="background:' + esc(autor.cor) + '"></span>' : '') + '</span>' +
      '<div style="min-width:0"><div class="t">' + esc(l.desc) + '</div><div class="s">' + esc(sub.join(' · ')) + '</div></div>' +
      '<span class="r"><span class="val ' + (receita ? 'pos' : '') + '">' + (receita ? '+' : '−') + ' ' + (est ? '≈ ' : '') + fmt(l.valor) + '</span>' + (est && meu && S.canWrite !== false ? '<span class="pill est" role="button" tabindex="0" data-act="toggle-status" data-id="' + esc(l.id) + '" data-src="' + src + '" title="Confirmar o valor real">estimado · confirmar</span>' : est ? '<span class="pill est">estimado</span>' : pill) + '</span></div>';
  }

  /* ---------- vencimentos ---------- */
  function somaDias(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  function rotuloVenc(iso) {
    const hoje = hojeISO();
    if (iso === hoje) return 'Hoje';
    if (iso === somaDias(hoje, 1)) return 'Amanhã';
    if (iso === somaDias(hoje, -1)) return 'Ontem';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(/\./g, '');
  }
  function itensFatura(cartaoId, mes) {
    return S.meus.filter((l) => l.cartaoId === cartaoId && l.mes === mes).map((l) => ({ l, src: 'meu' }))
      .concat(S.conj.filter((l) => l.autor === S.uid && l.cartaoId === cartaoId && l.mes === mes).map((l) => ({ l, src: 'conj' })));
  }
  function resumoFatura(c, mes) {
    const itens = itensFatura(c.id, mes);
    const total = FL.r2(itens.reduce((t, x) => t + (x.l.tipo === 'receita' ? -x.l.valor : x.l.valor), 0));
    const aberto = FL.r2(itens.filter((x) => x.l.status === 'pendente').reduce((t, x) => t + x.l.valor, 0));
    return { c, mes, itens, total, aberto, venc: FL.vencFatura(mes, c.vencimento), paga: itens.length > 0 && aberto === 0 };
  }
  function vencimentos() {
    const hoje = hojeISO();
    const lim = somaDias(hoje, 7);
    const out = [];
    S.meus.filter((l) => l.tipo !== 'receita' && l.status === 'pendente' && l.pag !== 'cartao').forEach((l) => out.push({ k: 'l', l, src: 'meu', data: l.data, valor: l.valor, desc: l.desc, ico: cat(l.cat).ico }));
    S.conj.filter((l) => l.autor === S.uid && l.status === 'pendente' && l.pag !== 'cartao').forEach((l) => out.push({ k: 'l', l, src: 'conj', data: l.data, valor: l.valor, desc: l.desc + ' (casal)', ico: cat(l.cat).ico }));
    const vistos = new Set();
    S.meus.concat(S.conj.filter((l) => l.autor === S.uid)).filter((l) => l.pag === 'cartao' && l.status === 'pendente' && cartaoDe(l.cartaoId)).forEach((l) => {
      const key = l.cartaoId + '|' + l.mes;
      if (vistos.has(key)) return;
      vistos.add(key);
      const f = resumoFatura(cartaoDe(l.cartaoId), l.mes);
      out.push({ k: 'f', f, data: f.venc, valor: f.aberto, desc: 'Fatura ' + f.c.nome + ' · ' + mesCurto(f.mes), ico: '💳' });
    });
    out.sort((a, b) => a.data.localeCompare(b.data));
    return { atrasadas: out.filter((x) => x.data < hoje), proximas: out.filter((x) => x.data >= hoje && x.data <= lim), depois: out.filter((x) => x.data > lim) };
  }
  function linhaVenc(x, atrasada) {
    const pagar = x.k === 'f'
      ? '<button class="pill pendente" type="button" data-act="fatura-pagar" data-id="' + esc(x.f.c.id) + '" data-mes="' + x.f.mes + '">Pagar</button>'
      : '<button class="pill pendente" type="button" data-act="toggle-status" data-id="' + esc(x.l.id) + '" data-src="' + x.src + '">Pagar</button>';
    const abrir = x.k === 'f' ? 'data-act="fatura-ver" data-id="' + esc(x.f.c.id) + '" data-mes="' + x.f.mes + '"' : 'data-act="abrir-lanc" data-id="' + esc(x.l.id) + '" data-src="' + x.src + '"';
    return '<div class="venc" role="button" tabindex="0" ' + abrir + '><span class="vt"><b>' + x.ico + ' ' + esc(x.desc) + '</b><small class="vd' + (atrasada ? ' neg' : '') + '">' + esc(rotuloVenc(x.data)) + '</small></span>' +
      '<span class="vv">' + (x.l && x.l.estimado ? '≈ ' : '') + fmt(x.valor) + '</span>' + pagar + '</div>';
  }
  function cardVencimentos() {
    if (S.canWrite === false) return '';
    const v = vencimentos();
    if (!v.atrasadas.length && !v.proximas.length) {
      const prox = v.depois[0];
      return prox ? '<section class="card"><div class="card-head"><h2>Vencimentos</h2></div><p class="sub" style="margin:0">Nada vence nos próximos 7 dias. Próximo: ' + esc(prox.desc) + ' em ' + esc(dataCurta(prox.data).slice(0, 5)) + ' (' + fmt(prox.valor) + ').</p></section>' : '';
    }
    let h = '<section class="card"><div class="card-head"><h2>Vencimentos</h2><span class="sub">próximos 7 dias</span></div>';
    if (v.atrasadas.length) h += '<div class="venc-g"><div class="tag neg" style="justify-self:start">▲ Atrasadas · ' + fmt(v.atrasadas.reduce((t, x) => t + x.valor, 0)) + '</div>' + v.atrasadas.slice(0, 8).map((x) => linhaVenc(x, true)).join('') + '</div>';
    if (v.proximas.length) h += '<div class="venc-g">' + (v.atrasadas.length ? '<div class="cg-nome">Próximos 7 dias · ' + fmt(v.proximas.reduce((t, x) => t + x.valor, 0)) + '</div>' : '') + v.proximas.map((x) => linhaVenc(x, false)).join('') + '</div>';
    return h + '</section>';
  }

  /* ---------- cartões de crédito ---------- */
  function cardCartoes() {
    let h = '<section class="card"><div class="card-head"><h2>Cartões de crédito</h2>' + (S.canWrite !== false ? '<button class="link" type="button" data-act="cartao-novo">+ Novo</button>' : '') + '</div>';
    if (!S.cartoes.length) {
      return h + '<p class="sub" style="margin:0">Cadastre seus cartões com o dia de fechamento e de vencimento. As compras no cartão caem sozinhas na fatura certa, inclusive as parceladas.</p></section>';
    }
    h += '<div class="rows">' + S.cartoes.map((c) => {
      const f = resumoFatura(c, S.mes);
      const prox = [1, 2, 3].map((i) => resumoFatura(c, FL.addMeses(S.mes, i)));
      const tag = !f.itens.length ? '<span class="tag">Sem compras</span>' : f.paga ? '<span class="tag pos">✓ Paga</span>' : '<span class="tag warn">● Aberta</span>';
      return '<div class="cartao" role="button" tabindex="0" data-act="fatura-ver" data-id="' + esc(c.id) + '" data-mes="' + S.mes + '">' +
        '<div class="ct-top"><span class="nm">💳 ' + esc(c.nome) + '</span>' + tag + '</div>' +
        '<div class="ct-val"><span class="amt">' + fmt(f.total) + '</span><span class="sub">fatura de ' + esc(MESES_C[+S.mes.slice(5) - 1]) + ' · vence ' + esc(dataCurta(f.venc).slice(0, 5)) + '</span></div>' +
        '<div class="ct-prox">' + prox.map((p) => '<span>' + esc(MESES_C[+p.mes.slice(5) - 1]) + ' <b>' + fmt(p.total) + '</b></span>').join('') + '</div></div>';
    }).join('') + '</div>';
    return h + '</section>';
  }

  function verFatura(cartaoId, mes) {
    const c = cartaoDe(cartaoId);
    if (!c) return;
    const f = resumoFatura(c, mes);
    const corpo = '<div class="fat-nav"><button class="icon-btn" type="button" data-act="fatura-ver" data-id="' + esc(c.id) + '" data-mes="' + FL.addMeses(mes, -1) + '" aria-label="Fatura anterior">' + ICON.left + '</button>' +
      '<div><div class="amt">' + fmt(f.total) + '</div><div class="sub">fatura de ' + esc(mesLongo(mes)) + ' · vence ' + esc(dataCurta(f.venc)) + '</div></div>' +
      '<button class="icon-btn" type="button" data-act="fatura-ver" data-id="' + esc(c.id) + '" data-mes="' + FL.addMeses(mes, 1) + '" aria-label="Próxima fatura">' + ICON.right + '</button></div>' +
      '<div class="sub">Fecha todo dia ' + c.fechamento + ' · vence todo dia ' + c.vencimento + '</div>' +
      (f.itens.length ? '<div class="list">' + f.itens.sort((a, b) => (a.l.dataCompra || a.l.data).localeCompare(b.l.dataCompra || b.l.data)).map((x) => itemHTML(x.l, x.src)).join('') + '</div>' : '<div class="empty">Nenhuma compra nesta fatura.</div>') +
      (f.itens.length ? (f.paga
        ? '<button class="btn ghost" type="button" data-act="fatura-reabrir" data-id="' + esc(c.id) + '" data-mes="' + mes + '">Reabrir fatura (marcar como a pagar)</button>'
        : '<button class="btn" type="button" data-act="fatura-pagar" data-id="' + esc(c.id) + '" data-mes="' + mes + '">Marcar fatura como paga · ' + fmt(f.aberto) + '</button>') : '') +
      '<button class="btn ghost" type="button" data-act="cartao-editar" data-id="' + esc(c.id) + '">Editar cartão</button>';
    abrirModal('💳 ' + c.nome, corpo);
  }

  async function pagarFatura(cartaoId, mes, status) {
    const alvo = itensFatura(cartaoId, mes).filter((x) => x.l.status !== status);
    let ok = true;
    for (const x of alvo) {
      if (!ok) break;
      const ref = x.src === 'conj' ? S.db.doc('conjunto/' + x.l.id) : meusCol().doc(x.l.id);
      ok = await escrever(() => ref.update({ status, estimado: false }));
    }
    if (ok) { agendarSync(); toast(status === 'pago' ? 'Fatura marcada como paga' : 'Fatura reaberta'); }
    return ok;
  }

  function formCartao(item, depois) {
    const corpo = '<form id="f-cartao" class="field" style="gap:14px" novalidate>' +
      '<div class="field"><label for="k-nome">Nome do cartão</label><input class="input" id="k-nome" maxlength="30" placeholder="Ex.: Mercado Pago" value="' + esc(item ? item.nome : '') + '"></div>' +
      '<div class="two"><div class="field"><label for="k-fech">Dia do fechamento</label><input class="input" type="number" id="k-fech" min="1" max="31" inputmode="numeric" value="' + (item ? item.fechamento : '') + '"></div>' +
      '<div class="field"><label for="k-venc">Dia do vencimento</label><input class="input" type="number" id="k-venc" min="1" max="31" inputmode="numeric" value="' + (item ? item.vencimento : '') + '"></div></div>' +
      '<div class="hint">Compras feitas a partir do dia do fechamento vão para a fatura seguinte. Só você vê seus cartões.</div>' +
      '<div class="err" id="k-err" hidden></div><button class="btn block" type="submit">' + (item ? 'Salvar' : 'Cadastrar cartão') + '</button>' +
      (item ? '<button class="btn danger" type="button" id="k-del">Excluir cartão</button>' : '') + '</form>';
    abrirModal(item ? 'Editar cartão' : 'Novo cartão', corpo, (el) => {
      $('#f-cartao', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = $('#k-nome', el).value.trim();
        const fech = Math.floor(Number($('#k-fech', el).value));
        const venc = Math.floor(Number($('#k-venc', el).value));
        const err = $('#k-err', el);
        if (!nome) { err.hidden = false; err.textContent = 'Dê um nome ao cartão.'; return; }
        if (!(fech >= 1 && fech <= 31 && venc >= 1 && venc <= 31)) { err.hidden = false; err.textContent = 'Os dias precisam ser de 1 a 31.'; return; }
        const col = S.db.collection('usuarios/' + S.uid + '/cartoes');
        const ref = item ? col.doc(item.id) : col.doc();
        const ok = await escrever(() => (item ? ref.update({ nome, fechamento: fech, vencimento: venc }) : ref.set({ nome, fechamento: fech, vencimento: venc, criadoEm: Date.now() })), item ? 'Cartão atualizado' : 'Cartão cadastrado');
        if (ok) { fecharModal(); if (depois) depois(ref.id); }
      });
      const d = $('#k-del', el);
      if (d) d.addEventListener('click', async () => {
        if (!d.dataset.armed) { d.dataset.armed = '1'; d.textContent = 'Toque de novo: os lançamentos continuam, sem o cartão'; return; }
        d.disabled = true;
        if (await escrever(() => S.db.doc('usuarios/' + S.uid + '/cartoes/' + item.id).delete(), 'Cartão excluído')) fecharModal();
      });
    });
  }

  function formConfirmarValor(l, src) {
    const corpo = '<form id="f-conf" class="field" style="gap:14px" novalidate><p class="sub" style="margin:0">' + esc(l.desc) + ' muda de valor todo mês. Qual foi o valor de ' + esc(mesLongo(l.mes)) + '?</p>' +
      '<div class="money-in"><span>R$</span><input id="cf-valor" inputmode="decimal" value="' + fmtInput(l.valor) + '"></div>' +
      '<div class="err" id="cf-err" hidden></div><button class="btn block" type="submit">Confirmar e marcar como pago</button></form>';
    abrirModal('Valor real da conta', corpo, (el) => {
      const inp = $('#cf-valor', el); inp.select();
      $('#f-conf', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const valor = FL.parseValor(inp.value);
        if (!(valor > 0)) { const er = $('#cf-err', el); er.hidden = false; er.textContent = 'Informe o valor.'; return; }
        const ref = src === 'conj' ? S.db.doc('conjunto/' + l.id) : meusCol().doc(l.id);
        if (await escrever(() => ref.update({ valor, status: 'pago', estimado: false }), 'Valor confirmado')) { fecharModal(); agendarSync(); }
      });
    });
  }

  /* ---------- editor de categorias ---------- */
  async function salvarCatalogo(cg, msg) {
    return escrever(() => S.db.doc('config/categorias').set({ grupos: cg.grupos, cats: cg.cats, atualizadoEm: Date.now(), por: S.uid }), msg);
  }
  const clonarCatalogo = () => JSON.parse(JSON.stringify(catalogo()));
  function formCategorias() {
    const cg = catalogo();
    const corpo = '<p class="sub" style="margin:0">As categorias valem para os dois. Toque numa categoria para renomear, trocar de grupo ou esconder.</p>' +
      cg.grupos.map((g) => '<div class="cg"><div class="cg-head"><span class="cg-nome">' + esc(g.nome) + '</span>' + (g.id !== 'receitas' ? '<button class="link" type="button" data-act="grupo-editar" data-id="' + esc(g.id) + '">Renomear</button>' : '') + '</div><div class="catpick">' +
        cg.cats.filter((c) => c.grupo === g.id).map((c) => '<button type="button" class="' + (c.oculta ? 'oculta' : '') + '" data-act="cat-editar" data-id="' + esc(c.id) + '">' + c.ico + ' ' + esc(c.nome) + '</button>').join('') + '</div></div>').join('') +
      '<div class="btn-row"><button class="btn" type="button" data-act="cat-nova">+ Nova categoria</button><button class="btn ghost" type="button" data-act="grupo-novo">+ Novo grupo</button></div>';
    abrirModal('Categorias', corpo);
  }
  const ICONES = ['🏠', '💧', '💡', '📶', '🧹', '🔥', '🧾', '🛒', '🍽️', '☕', '⛽', '🚗', '🛡️', '🔧', '🚌', '💊', '🏋️', '🥊', '⚽', '💇', '🎉', '🛍️', '👕', '🎁', '✈️', '🐾', '📺', '🎮', '📚', '🎓', '💳', '🏦', '💼', '📈', '✨', '👶', '⛪', '🧑‍🔧', '📦'];
  function formCategoria(item) {
    const cg = catalogo();
    const st = { ico: item ? item.ico : '📦' };
    const corpo = '<form id="f-cat" class="field" style="gap:14px" novalidate>' +
      '<div class="field"><label for="ct-nome">Nome</label><input class="input" id="ct-nome" maxlength="30" value="' + esc(item ? item.nome : '') + '" placeholder="Ex.: Muay Thai"></div>' +
      '<div class="field"><span>Ícone</span><div class="icones" id="ct-icos">' + ICONES.map((i) => '<button type="button" data-ico="' + i + '" aria-pressed="' + (i === st.ico) + '">' + i + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="ct-grupo">Grupo</label><select class="input" id="ct-grupo">' + cg.grupos.map((g) => '<option value="' + esc(g.id) + '"' + ((item ? item.grupo : 'outros') === g.id ? ' selected' : '') + '>' + esc(g.nome) + '</option>').join('') + '</select></div>' +
      (item ? '<label class="check"><input type="checkbox" id="ct-oculta"' + (item.oculta ? ' checked' : '') + '> Esconder esta categoria (os lançamentos antigos continuam)</label>' : '') +
      '<div class="err" id="ct-err" hidden></div><button class="btn block" type="submit">' + (item ? 'Salvar' : 'Criar categoria') + '</button></form>';
    abrirModal(item ? 'Editar categoria' : 'Nova categoria', corpo, (el) => {
      $('#ct-icos', el).addEventListener('click', (e) => {
        const b = e.target.closest('button[data-ico]'); if (!b) return;
        st.ico = b.dataset.ico; $$('#ct-icos button', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      $('#f-cat', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = $('#ct-nome', el).value.trim();
        if (!nome) { const er = $('#ct-err', el); er.hidden = false; er.textContent = 'Dê um nome à categoria.'; return; }
        const novo = clonarCatalogo();
        const grupo = $('#ct-grupo', el).value;
        if (item) {
          const c = novo.cats.find((x) => x.id === item.id) || (novo.cats.push(Object.assign({}, item)), novo.cats[novo.cats.length - 1]);
          Object.assign(c, { nome, ico: st.ico, grupo, oculta: !!($('#ct-oculta', el) && $('#ct-oculta', el).checked) });
        } else {
          novo.cats.push({ id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nome, ico: st.ico, grupo });
        }
        if (await salvarCatalogo(novo, item ? 'Categoria atualizada' : 'Categoria criada')) formCategorias();
      });
    });
  }
  function formGrupo(item) {
    const corpo = '<form id="f-grp" class="field" style="gap:14px" novalidate><div class="field"><label for="g-nome">Nome do grupo</label><input class="input" id="g-nome" maxlength="30" value="' + esc(item ? item.nome : '') + '" placeholder="Ex.: Filhos"></div>' +
      '<button class="btn block" type="submit">' + (item ? 'Salvar' : 'Criar grupo') + '</button></form>';
    abrirModal(item ? 'Renomear grupo' : 'Novo grupo', corpo, (el) => {
      $('#f-grp', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = $('#g-nome', el).value.trim(); if (!nome) return;
        const novo = clonarCatalogo();
        if (item) novo.grupos.find((g) => g.id === item.id).nome = nome;
        else novo.grupos.splice(novo.grupos.findIndex((g) => g.id === 'receitas'), 0, { id: 'g_' + Date.now().toString(36), nome });
        if (await salvarCatalogo(novo, item ? 'Grupo renomeado' : 'Grupo criado')) formCategorias();
      });
    });
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
    h += cardOrcamento(m.orcMeu, 'meu');
    h += cardCartoes();
    h += cardFixas('meu');

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
    h += cardOrcamento(m.orcCasal, 'casal');
    h += cardFixas('casal');
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
      '<p class="sub" style="margin:0">Seus lançamentos pessoais ficam privados: ' + (outro ? esc(outro.nome) : 'a outra pessoa') + ' vê só os seus totais do mês. As despesas e as metas do casal os dois veem.</p>' +
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
    if (!S.firm.meus || !S.got.resumos || !S.firm.fixas || !S.firm.cartoes || !S.firm.limites || !S.firm.metasPess || !S.firm.movPess || !souMembro() || S.canWrite === false) return;
    if (syncando) { syncDeNovo = true; return; }
    const meses = meuResumo();
    const prev = {};
    minhaProjecao(proximosMeses(12)).forEach((p) => { prev[p.mes] = { renda: p.renda, despesas: p.despesas, metas: p.metas }; });
    const novo = { meses, prev, varMedia: FL.mediaVariavel(S.meus, mesHoje()), varAtual: FL.gastoVariavel(S.meus, mesHoje()) };
    const atual = S.resumos[S.uid];
    if (atual && FL.stable({ meses: atual.meses || {}, prev: atual.prev || {}, varMedia: atual.varMedia || 0, varAtual: atual.varAtual || 0 }) === FL.stable(novo)) return;
    syncando = true;
    try { await S.db.doc('resumos/' + S.uid).set(Object.assign(novo, { atualizadoEm: Date.now() })); } catch (e) { console.warn('resumo', e); }
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
    clearTimeout(toastT); toastT = setTimeout(() => { el.innerHTML = ''; }, /limite/.test(msg) ? 5500 : 3200);
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
  function formLanc(src, item, rascunho) {
    const editar = !!item;
    if (editar && src === 'conj' && item.autor !== S.uid) return verLancOutro(item);
    const base = item || rascunho || {};
    const st = {
      destino: src === 'conj' ? 'casal' : (base.destino || 'pessoal'),
      tipo: base.tipo || 'despesa',
      cat: base.cat || 'mercado',
    };
    const ehCartao = base.pag === 'cartao' && cartaoDe(base.cartaoId);
    const dataIni = editar ? (item.dataCompra || item.data) : (base.data || dataPadrao());
    const travaData = editar && item.pag === 'cartao' && item.parcela;
    const corpo = '<form id="f-lanc" class="field" style="gap:14px" novalidate>' +
      (editar || rascunho ? '' : '<button class="quick sm" type="button" data-act="rapido"><span>⚡</span><span>Lançar por texto ou voz</span><span class="mic">🎙️</span></button>') +
      (editar ? '' : '<div class="field"><span>Para quem é</span>' + seg('dest', [['pessoal', 'Só meu (privado)'], ['casal', 'Do casal']], st.destino) + '</div>') +
      '<div class="field" id="w-tipo"' + (st.destino === 'casal' ? ' hidden' : '') + '><span>Tipo</span>' + seg('tipo', [['despesa', 'Despesa'], ['receita', 'Receita']], st.tipo) + '</div>' +
      '<div class="field"><label for="f-valor" id="l-valor">Valor</label><div class="money-in"><span>R$</span><input id="f-valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + (base.valor ? fmtInput(base.valor) : '') + '"></div></div>' +
      '<div class="field"><label for="f-desc">Descrição</label><input class="input" id="f-desc" maxlength="60" placeholder="Ex.: Mercado do mês" value="' + esc(base.desc || '') + '"></div>' +
      '<div class="field"><span>Categoria</span><div id="f-cats"></div></div>' +
      '<div class="field" id="w-pag"><label for="f-pag">Forma de pagamento</label><select class="input" id="f-pag">' + opcoesPag(base.pag, base.cartaoId) + '</select></div>' +
      '<div class="two"><div class="field"><label for="f-data" id="l-data">Data</label><input class="input" type="date" id="f-data" value="' + esc(dataIni) + '"' + (travaData ? ' disabled' : '') + '></div>' +
      '<div class="field" id="w-status"><label for="f-status">Situação</label><select class="input" id="f-status"></select></div></div>' +
      '<div class="hint" id="h-cartao" hidden></div>' +
      '<div class="field" id="w-div"' + (st.destino === 'casal' ? '' : ' hidden') + '><label for="f-div">Divisão desta despesa</label><select class="input" id="f-div">' + DIVS().map(([k, n]) => '<option value="' + k + '"' + ((base.divisao || 'padrao') === k ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></div>' +
      (editar ? (item.parcela ? '<div class="hint">Parcela ' + esc(item.parcela) + '. A alteração vale só para esta.</div>' : '') +
        (item.fixaId ? '<div class="note"><span>Conta fixa: esta alteração vale só para ' + esc(mesLongo(item.mes)) + '.' + (acharFixa(src, item.fixaId) ? ' <button class="link" type="button" data-act="fixa-abrir" data-esc="' + (src === 'conj' ? 'casal' : 'meu') + '" data-id="' + esc(item.fixaId) + '">Editar a conta fixa</button>' : '') + '</span></div>' : '') :
        '<div class="field"><span>Repetir</span>' + seg('rep', [['unica', 'Uma vez'], ['parcelada', 'Parcelado'], ['fixa', 'Conta fixa']], base.parcelas > 1 ? 'parcelada' : 'unica') +
        '<div class="hint" id="h-fixa" hidden>Lança sozinho todo mês, no mesmo dia, até você encerrar. Dá para ver e editar em “Contas fixas”.</div>' +
        '<div class="two" id="w-n"' + (base.parcelas > 1 ? '' : ' hidden') + '><div class="field"><label for="f-n">Quantidade de parcelas</label><input class="input" type="number" id="f-n" min="2" max="60" value="' + (base.parcelas > 1 ? base.parcelas : 2) + '" inputmode="numeric"></div><div class="hint" id="h-n" style="align-self:end;padding-bottom:6px"></div></div></div>') +
      '<div class="err" id="f-err" hidden></div>' +
      '<button class="btn block" type="submit">' + (editar ? 'Salvar alterações' : 'Lançar') + '</button>' +
      (editar ? '<div class="btn-row"><button class="btn danger" type="button" id="b-del">Excluir</button>' + (item.grupo ? '<button class="btn danger" type="button" id="b-del-g">Excluir esta e as próximas</button>' : '') + '</div>' : '') +
      '</form>';
    abrirModal(editar ? 'Editar lançamento' : 'Novo lançamento', corpo, (el) => {
      const f = $('#f-lanc', el);
      const pagSel = $('#f-pag', el);
      const atualizar = () => {
        const rec = st.tipo === 'receita' && st.destino === 'pessoal';
        $('#w-pag', el).hidden = rec;
        const { pag, cartaoId } = lerPag(pagSel.value);
        const c = !rec && pag === 'cartao' ? cartaoDe(cartaoId) : null;
        $('#w-status', el).hidden = !!c;
        $('#l-data', el).textContent = c ? 'Data da compra' : 'Data';
        const sel = $('#f-status', el);
        const atual = sel.value || (base.status || 'pago');
        sel.innerHTML = '<option value="pago">' + (rec ? 'Recebido' : 'Pago') + '</option><option value="pendente">' + (rec ? 'A receber' : 'A pagar') + '</option>';
        sel.value = atual === 'pendente' ? 'pendente' : 'pago';
        const rep = radio(f, 'rep');
        const w = $('#w-n', el);
        if (w) w.hidden = rep !== 'parcelada';
        const hf = $('#h-fixa', el); if (hf) hf.hidden = rep !== 'fixa';
        const n = Math.max(2, Math.floor(Number(($('#f-n', el) || {}).value) || 2));
        const v = FL.parseValor($('#f-valor', el).value);
        const hn = $('#h-n', el);
        if (rep === 'parcelada') { $('#l-valor', el).textContent = 'Valor total'; if (hn) hn.textContent = v > 0 ? n + '× de ' + fmt(v / n) : 'O total é dividido em parcelas mensais.'; }
        else $('#l-valor', el).textContent = rep === 'fixa' ? 'Valor por mês' : 'Valor';
        const hc = $('#h-cartao', el);
        const data = $('#f-data', el).value;
        if (c && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
          const mf = FL.mesFatura(data, c.fechamento, c.vencimento);
          hc.hidden = false;
          hc.textContent = rep === 'parcelada' ? 'Parcelas nas faturas de ' + mesCurto(mf) + ' a ' + mesCurto(FL.addMeses(mf, n - 1)) + '.' : 'Cai na fatura de ' + mesCurto(mf) + ' (vence ' + dataCurta(FL.vencFatura(mf, c.vencimento)).slice(0, 5) + ').';
        } else hc.hidden = true;
      };
      const desenharCats = () => {
        const tipo = st.tipo === 'receita' && st.destino === 'pessoal' ? 'receita' : 'despesa';
        if (!catsLista(tipo).some((c) => c.id === st.cat)) st.cat = catsLista(tipo)[0].id;
        $('#f-cats', el).innerHTML = catChips(tipo, st.cat);
        atualizar();
      };
      ligarCatChips($('#f-cats', el), st);
      desenharCats();
      pagSel.addEventListener('change', () => {
        if (pagSel.value === 'novo-cartao') {
          const rasc = coletar();
          pagSel.value = 'pix';
          formCartao(null, (novoId) => setTimeout(() => formLanc(src, null, Object.assign(rasc, { pag: 'cartao', cartaoId: novoId })), 300));
          return;
        }
        atualizar();
      });
      f.addEventListener('change', (e) => {
        if (e.target.name === 'dest') { st.destino = e.target.value; $('#w-tipo', el).hidden = st.destino === 'casal'; $('#w-div', el).hidden = st.destino !== 'casal'; desenharCats(); }
        else if (e.target.name === 'tipo') { st.tipo = e.target.value; desenharCats(); }
        else atualizar();
      });
      f.addEventListener('input', (e) => { if (['f-n', 'f-valor', 'f-data'].includes(e.target.id)) atualizar(); });
      function coletar() {
        const { pag, cartaoId } = lerPag(pagSel.value);
        return { destino: st.destino, tipo: st.tipo, cat: st.cat, valor: FL.parseValor($('#f-valor', el).value) || null, desc: $('#f-desc', el).value.trim(), data: $('#f-data', el).value, pag, cartaoId, divisao: $('#f-div', el).value, status: $('#f-status', el).value };
      }
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#f-err', el);
        const erro = (t) => { err.hidden = false; err.textContent = t; };
        const valor = FL.parseValor($('#f-valor', el).value);
        if (!(valor > 0)) return erro('Informe um valor maior que zero (ex.: 150,90).');
        const data = $('#f-data', el).value;
        if (!travaData && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro('Escolha a data.');
        const tipo = st.destino === 'casal' ? 'despesa' : st.tipo;
        const desc = $('#f-desc', el).value.trim() || cat(st.cat).nome;
        let { pag, cartaoId } = lerPag(pagSel.value);
        if (tipo === 'receita') { pag = null; cartaoId = null; }
        const usaCartao = pag === 'cartao' && cartaoDe(cartaoId);
        const status = usaCartao ? 'pendente' : $('#f-status', el).value;
        const divisao = st.destino === 'casal' ? $('#f-div', el).value : null;
        const escopo = st.destino === 'casal' ? 'casal' : 'meu';
        const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
        if (editar) {
          const ref = src === 'conj' ? S.db.doc('conjunto/' + item.id) : meusCol().doc(item.id);
          const upd = { tipo, desc, valor, cat: st.cat, divisao, estimado: false, pag: pag || null, cartaoId: cartaoId || null };
          if (travaData) { /* parcela no cartão: mantém a fatura */ }
          else if (usaCartao) {
            noCartao(upd, data, cartaoId, 0);
            upd.status = item.pag === 'cartao' ? item.status : 'pendente';
          } else Object.assign(upd, { data, mes: FL.mesDe(data), dataCompra: null, status });
          const ok = await escrever(() => ref.update(upd));
          if (ok) { fecharModal(); agendarSync(); toast(avisoLimite(escopo, st.cat, upd.mes || item.mes, valor, item.id, tipo) || 'Lançamento atualizado'); } else btn.disabled = false;
          return;
        }
        const rep = radio(f, 'rep');
        if (rep === 'fixa') {
          const ok = await criarFixa(escopo, { tipo, desc, valor, cat: st.cat, dia: +data.slice(8), inicio: FL.mesDe(data), pag: pag || null, cartaoId: cartaoId || null, divisao }, { data, status });
          if (ok) { fecharModal(); agendarSync(); toast(avisoLimite(escopo, st.cat, FL.mesDe(data), valor, null, tipo) || 'Conta fixa criada: lança todo dia ' + (+data.slice(8)) + '.'); location.hash = escopo === 'casal' ? 'casal' : 'meus'; render(); }
          else btn.disabled = false;
          return;
        }
        const n = rep === 'unica' ? 1 : Math.floor(Number($('#f-n', el).value) || 0);
        if (rep !== 'unica' && (n < 2 || n > 60)) { btn.disabled = false; return erro('Use de 2 a 60 parcelas.'); }
        const serie = FL.gerarSerie(valor, n, rep, data);
        const grupo = serie.length > 1 ? 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : null;
        const coll = st.destino === 'casal' ? S.db.collection('conjunto') : meusCol();
        btn.textContent = serie.length > 1 ? 'Lançando 0/' + serie.length + '…' : 'Lançando…';
        let ok = true;
        let mesPrimeiro = FL.mesDe(data);
        for (let i = 0; i < serie.length && ok; i++) {
          const it = serie[i];
          let doc = { kind: 'lanc', tipo, desc, valor: it.valor, cat: st.cat, data: it.data, mes: FL.mesDe(it.data), status: i === 0 ? status : 'pendente', parcela: it.parcela, grupo, autor: S.uid, criadoEm: Date.now(), pag: pag || null, cartaoId: null, divisao };
          if (usaCartao) { doc = noCartao(doc, data, cartaoId, i); doc.status = 'pendente'; }
          if (i === 0) mesPrimeiro = doc.mes;
          ok = await escrever(() => coll.add(doc));
          if (serie.length > 1) btn.textContent = 'Lançando ' + (i + 1) + '/' + serie.length + '…';
        }
        if (ok) {
          fecharModal(); agendarSync();
          toast(avisoLimite(escopo, st.cat, mesPrimeiro, serie[0].valor, null, tipo) || (usaCartao ? 'Lançado na fatura de ' + mesCurto(mesPrimeiro) : serie.length > 1 ? serie.length + ' lançamentos criados' : (st.destino === 'casal' ? 'Lançado no casal' : 'Lançado')));
          if (mesPrimeiro !== S.mes && !(rascunho && rascunho._rapido)) S.mes = mesPrimeiro;
          if (rascunho && rascunho._rapido && rapidoDrafts.length) setTimeout(() => formRapido(true), 450);
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
          const tpl = item.fixaId ? acharFixa(src, item.fixaId) : null;
          const mesCobr = item.fixaId ? item.id.slice(-7) : item.mes;
          if (tpl) await escrever(() => (src === 'conj' ? S.db.collection('fixasCasal') : fixasCol()).doc(tpl.id).update({ pulados: (tpl.pulados || []).concat(mesCobr) }));
          const ok = await escrever(() => collRef().doc(item.id).delete(), tpl ? 'Excluído só deste mês' : 'Lançamento excluído');
          if (ok) { fecharModal(); agendarSync(); }
        });
        armar($('#b-del-g', el), async () => {
          const lista = src === 'conj' ? S.conj : S.meus;
          const alvo = lista.filter((l) => l.grupo === item.grupo && l.mes >= item.mes && (src !== 'conj' || l.autor === S.uid));
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
      '<div class="field" style="border-top:1px solid var(--line);padding-top:14px"><span>Organização</span><div class="btn-row"><button class="btn ghost" type="button" data-act="categorias">Categorias</button><button class="btn ghost" type="button" data-act="cartao-novo">Novo cartão</button></div></div>' +
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

  /* ---------- limites por categoria ---------- */
  function avisoLimite(escopo, catKey, mes, valor, ignorarId, tipo) {
    if (tipo === 'receita') return null;
    const lim = (escopo === 'casal' ? S.limitesCasal : S.limites)[catKey];
    if (!(lim > 0)) return null;
    const base = escopo === 'casal' ? S.conj : S.meus.filter((l) => l.tipo !== 'receita');
    const gasto = FL.r2(base.filter((l) => l.mes === mes && l.cat === catKey && l.id !== ignorarId).reduce((t, l) => t + (l.valor || 0), 0) + valor);
    const nome = cat(catKey).nome + (escopo === 'casal' ? ' (casal)' : '');
    if (gasto > lim) return '⚠️ ' + nome + ' passou do limite do mês: ' + fmt(gasto) + ' de ' + fmt(lim) + '.';
    if (gasto >= lim * 0.8) return nome + ' já usou ' + pct(gasto / lim) + ' do limite do mês (' + fmt(gasto) + ' de ' + fmt(lim) + ').';
    return null;
  }

  function linhaOrc(l, max) {
    const c = cat(l.cat);
    let bar, sub;
    if (!l.limite) {
      bar = '<div class="meter muted"><i style="width:' + (l.gasto / (max || 1) * 100).toFixed(1) + '%"></i></div>';
      sub = '<span>sem limite</span>';
    } else {
      const cls = l.status === 'estourou' ? 'neg' : l.status === 'perto' ? 'warn' : 'pos';
      bar = '<div class="meter ' + cls + '"><i style="width:' + Math.min(100, l.pct * 100).toFixed(1) + '%"></i></div>';
      const tag = l.status === 'estourou'
        ? '<span class="tag neg">▲ ' + fmt(-l.sobra) + ' acima</span>'
        : l.status === 'perto'
          ? '<span class="tag warn">● Perto · restam ' + fmt(l.sobra) + '</span>'
          : '<span class="tag pos">✓ Restam ' + fmt(l.sobra) + '</span>';
      sub = '<span>de ' + fmt(l.limite) + ' · ' + pct(l.pct) + '</span>' + tag;
    }
    return '<div class="orc-row"><div class="orc-top"><span>' + c.ico + '</span><span class="nm">' + esc(c.nome) + '</span><span class="vv">' + fmt(l.gasto) + '</span></div>' + bar + '<div class="orc-sub">' + sub + '</div></div>';
  }

  function cardOrcamento(orc, escopo) {
    const titulo = escopo === 'casal' ? 'Orçamento do casal' : 'Orçamento do mês';
    let h = '<section class="card"><div class="card-head"><h2>' + titulo + '</h2>' +
      (S.canWrite !== false ? '<button class="link" type="button" data-act="limites" data-esc="' + escopo + '">' + (orc.total ? 'Editar limites' : 'Definir limites') + '</button>' : '') + '</div>';
    if (orc.total) {
      const t = orc.total;
      const acima = t.sobra < 0;
      h += '<div class="settle" style="grid-template-columns:1fr auto"><div><div class="sub">Categorias com limite</div><div class="amt">' + fmt(t.gasto) + '</div><div class="sub">de ' + fmt(t.limite) + ' no total</div></div>' +
        '<span class="tag ' + (acima ? 'neg' : 'pos') + '">' + (acima ? '▲ ' + fmt(-t.sobra) + ' acima' : '✓ Sobra ' + fmt(t.sobra)) + '</span></div>';
    }
    if (!orc.linhas.length) {
      h += '<p class="sub" style="margin:0">Nenhum gasto ' + (escopo === 'casal' ? 'do casal ' : '') + 'neste mês. Defina limites por categoria para acompanhar quanto ainda pode gastar e receber alertas.</p>';
    } else {
      const max = Math.max(1, ...orc.linhas.map((l) => l.gasto));
      const porGrupo = {};
      orc.linhas.forEach((l) => { const g = cat(l.cat).grupo || 'outros'; (porGrupo[g] = porGrupo[g] || []).push(l); });
      h += catalogo().grupos.filter((g) => porGrupo[g.id]).map((g) => {
        const ls = porGrupo[g.id];
        const tot = FL.r2(ls.reduce((t, l) => t + l.gasto, 0));
        return '<div class="orc-g"><div class="cg-head"><span class="cg-nome">' + esc(g.nome) + '</span><span class="cg-tot">' + fmt(tot) + '</span></div><div class="orc">' + ls.map((l) => linhaOrc(l, max)).join('') + '</div></div>';
      }).join('');
      if (!orc.total) h += '<div class="hint">Defina limites para ver quanto sobra em cada categoria e ser avisado quando passar.</div>';
    }
    return h + '</section>';
  }

  function cardAlertas(m) {
    const itens = m.orcMeu.alertas.map((l) => ({ l, esc: 'meu' })).concat(m.orcCasal.alertas.map((l) => ({ l, esc: 'casal' })));
    if (!itens.length) return '';
    return '<section class="card alert-card"><div class="card-head"><h2>Alertas do mês</h2><span class="sub">' + itens.length + (itens.length === 1 ? ' categoria' : ' categorias') + '</span></div><div class="rows">' +
      itens.map(({ l, esc: e }) => {
        const c = cat(l.cat);
        const est = l.status === 'estourou';
        return '<button class="alert-row" type="button" data-act="ir" data-tab="' + (e === 'casal' ? 'casal' : 'meus') + '"><span class="tag ' + (est ? 'neg' : 'warn') + '">' + (est ? '▲ Passou' : '● Perto') + '</span>' +
          '<span class="nm">' + c.ico + ' ' + esc(c.nome) + (e === 'casal' ? ' · casal' : '') + '</span>' +
          '<span class="vv">' + fmt(l.gasto) + ' de ' + fmt(l.limite) + (est ? ' · ' + fmt(-l.sobra) + ' acima' : ' · ' + pct(l.pct)) + '</span></button>';
      }).join('') + '</div></section>';
  }

  function formLimites(escopo) {
    const atual = (escopo === 'casal' ? S.limitesCasal : S.limites) || {};
    const m = modelo();
    const gastos = {};
    (escopo === 'casal' ? m.orcCasal : m.orcMeu).linhas.forEach((l) => { gastos[l.cat] = l.gasto; });
    const corpo = '<form id="f-lim" class="field" style="gap:12px" novalidate>' +
      '<p class="sub" style="margin:0">' + (escopo === 'casal' ? 'Limites mensais das despesas do casal. Os dois veem.' : 'Seus limites mensais. Só você vê.') + ' Deixe em branco a categoria sem limite.</p>' +
      gruposDe('despesa').map(({ g, cats }) => '<div class="cg"><div class="cg-nome">' + esc(g.nome) + '</div><div class="lim-grid">' + cats.map((c) => '<label class="lim-row" for="lim-' + esc(c.id) + '"><span>' + c.ico + ' ' + esc(c.nome) + '<small>' + (gastos[c.id] ? 'gasto em ' + MESES_C[+S.mes.slice(5) - 1] + ': ' + fmt(gastos[c.id]) : '') + '</small></span>' +
        '<span class="money-in sm"><span>R$</span><input id="lim-' + esc(c.id) + '" data-cat="' + esc(c.id) + '" inputmode="decimal" autocomplete="off" placeholder="sem limite" value="' + (atual[c.id] > 0 ? fmtInput(atual[c.id]) : '') + '"></span></label>').join('') + '</div></div>').join('') +
      '<div class="err" id="lim-err" hidden></div><button class="btn block" type="submit">Salvar limites</button></form>';
    abrirModal(escopo === 'casal' ? 'Limites do casal' : 'Meus limites', corpo, (el) => {
      $('#f-lim', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const limites = {};
        let ruim = null;
        $$('input[data-cat]', el).forEach((inp) => {
          const t = inp.value.trim(); if (!t) return;
          const v = FL.parseValor(t);
          if (!(v > 0)) ruim = cat(inp.dataset.cat).nome; else limites[inp.dataset.cat] = v;
        });
        if (ruim) { const er = $('#lim-err', el); er.hidden = false; er.textContent = 'Valor inválido em ' + ruim + '.'; return; }
        const ref = escopo === 'casal' ? S.db.doc('config/limitesCasal') : S.db.doc('usuarios/' + S.uid + '/config/limites');
        if (await escrever(() => ref.set({ limites, atualizadoEm: Date.now(), por: S.uid }), 'Limites salvos')) fecharModal();
      });
    });
  }

  /* ---------- contas fixas ---------- */
  function acharFixa(src, id) {
    return (src === 'conj' || src === 'casal' ? S.fixasCasal : S.fixas).find((f) => f.id === id) || null;
  }

  /* mesCobr = mês da cobrança (o id usa esse mês); com cartão, o lançamento vai para o mês da fatura */
  function docDaFixa(f, mesCobr, data, status) {
    const doc = { kind: 'lanc', tipo: f.tipo || 'despesa', desc: f.desc, valor: f.valor, cat: f.cat, data, mes: mesCobr, status, fixaId: f.id, parcela: null, grupo: null, autor: S.uid, criadoEm: Date.now(), pag: f.pag || null, cartaoId: null, divisao: f.divisao || null, estimado: !!f.variavel && status === 'pendente' };
    if (f.pag === 'cartao' && f.cartaoId && cartaoDe(f.cartaoId)) { noCartao(doc, data, f.cartaoId, 0); if (status === 'pendente') doc.status = 'pendente'; }
    return doc;
  }

  async function criarFixa(escopo, dados, primeiro) {
    const coll = escopo === 'casal' ? S.db.collection('fixasCasal') : fixasCol();
    const ref = coll.doc();
    const tpl = Object.assign({ tipo: 'despesa', variavel: false, fim: null, pag: null, cartaoId: null, divisao: null }, dados, { ativa: true, pulados: [], autor: S.uid, criadoEm: Date.now() });
    if (escopo === 'casal') tpl.tipo = 'despesa';
    let ok = await escrever(() => ref.set(tpl));
    if (ok && primeiro) {
      const mes = FL.mesDe(primeiro.data);
      const destino = escopo === 'casal' ? S.db.collection('conjunto') : meusCol();
      const doc = docDaFixa(Object.assign({ id: ref.id }, tpl), mes, primeiro.data, tpl.pag === 'cartao' ? 'pendente' : primeiro.status);
      ok = await escrever(() => destino.doc(FL.idFixa(ref.id, mes)).set(doc));
    }
    return ok;
  }

  function cardFixas(escopo) {
    const hoje = mesHoje();
    const lista = (escopo === 'casal' ? S.fixasCasal : S.fixas).filter((f) => !f.fim || f.fim >= hoje).sort((a, b) => (a.dia || 0) - (b.dia || 0));
    let h = '<section class="card"><div class="card-head"><h2>' + (escopo === 'casal' ? 'Contas fixas do casal' : 'Contas fixas') + '</h2>' +
      (S.canWrite !== false ? '<button class="link" type="button" data-act="fixa-nova" data-esc="' + escopo + '">+ Nova</button>' : '') + '</div>';
    if (!lista.length) {
      return h + '<p class="sub" style="margin:0">' + (escopo === 'casal' ? 'Aluguel, internet, luz… cadastre uma vez e o app lança sozinho todo mês, para quem paga.' : 'Assinaturas, academia, salário… cadastre uma vez e o app lança sozinho todo mês.') + '</p></section>';
    }
    const desp = FL.r2(lista.filter((f) => f.tipo !== 'receita').reduce((t, f) => t + (f.valor || 0), 0));
    const rec = FL.r2(lista.filter((f) => f.tipo === 'receita').reduce((t, f) => t + (f.valor || 0), 0));
    h += '<div class="list">' + lista.map((f) => {
      const c = cat(f.cat);
      const p = escopo === 'casal' ? pessoa(f.autor) : null;
      const receita = f.tipo === 'receita';
      const sub = ['todo dia ' + (f.dia || 1), c.nome];
      if (f.pag === 'cartao') { const k = f.autor === S.uid ? cartaoDe(f.cartaoId) : null; sub.push('💳 ' + (k ? k.nome : 'cartão')); }
      if (f.fim) sub.push('até ' + mesCurto(f.fim));
      if (p) sub.push('paga: ' + p.nome);
      return '<div class="item" role="button" tabindex="0" data-act="fixa-abrir" data-esc="' + escopo + '" data-id="' + esc(f.id) + '"><span class="ico">' + c.ico + (p ? '<span class="dot" style="background:' + esc(p.cor) + '"></span>' : '') + '</span>' +
        '<div style="min-width:0"><div class="t">' + esc(f.desc) + '</div><div class="s">' + esc(sub.join(' · ')) + '</div></div>' +
        '<span class="r"><span class="val ' + (receita ? 'pos' : '') + '">' + (receita ? '+' : '−') + ' ' + (f.variavel ? '≈ ' : '') + fmt(f.valor) + '</span><span class="sub" style="font-size:11px">' + (f.variavel ? 'varia' : 'por mês') + '</span></span></div>';
    }).join('') + '</div>' +
      '<div class="rows" style="border-top:1px dashed var(--line);padding-top:8px">' + (desp ? '<div class="rowkv"><span class="k">Despesas fixas por mês</span><span class="v">' + fmt(desp) + '</span></div>' : '') + (rec ? '<div class="rowkv"><span class="k">Receitas fixas por mês</span><span class="v pos">' + fmt(rec) + '</span></div>' : '') + '</div>';
    return h + '</section>';
  }

  function seletorMes(idMes, idAno, valor, comVazio, anosAdiante) {
    const hoje = mesHoje();
    const y0 = +hoje.slice(0, 4);
    const anos = []; for (let y = y0 - 1; y <= y0 + (anosAdiante || 1); y++) anos.push(y);
    const [vy, vm] = valor ? valor.split('-').map(Number) : [null, null];
    return '<div class="two" style="gap:6px"><select class="input" id="' + idMes + '">' + (comVazio ? '<option value="">—</option>' : '') + MESES_C.map((n, i) => '<option value="' + pad(i + 1) + '"' + (vm === i + 1 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<select class="input" id="' + idAno + '">' + (comVazio ? '<option value="">—</option>' : '') + anos.map((y) => '<option' + (vy === y ? ' selected' : '') + '>' + y + '</option>').join('') + '</select></div>';
  }

  function formFixa(escopo, item) {
    const editar = !!item;
    if (editar && escopo === 'casal' && item.autor !== S.uid) {
      const p = pessoa(item.autor); const c = cat(item.cat);
      return abrirModal('Conta fixa do casal', '<div class="who">' + avatar(p) + '<div><div class="name">' + esc(item.desc) + '</div><div class="sub">Paga por ' + esc(p.nome) + '</div></div></div>' +
        '<div class="rows"><div class="rowkv"><span class="k">Valor por mês</span><span class="v">' + (item.variavel ? '≈ ' : '') + fmt(item.valor) + '</span></div><div class="rowkv"><span class="k">Dia</span><span class="v">todo dia ' + (item.dia || 1) + '</span></div><div class="rowkv"><span class="k">Categoria</span><span class="v">' + c.ico + ' ' + esc(c.nome) + '</span></div>' +
        (item.fim ? '<div class="rowkv"><span class="k">Termina em</span><span class="v">' + esc(mesCurto(item.fim)) + '</span></div>' : '') + '</div>' +
        '<div class="note">Só ' + esc(p.nome) + ' pode alterar ou encerrar esta conta fixa.</div>');
    }
    const st = { tipo: (item && item.tipo) || 'despesa', cat: (item && item.cat) || (escopo === 'casal' ? 'moradia' : 'assinaturas') };
    const hoje = mesHoje();
    const corpo = '<form id="f-fixa" class="field" style="gap:14px" novalidate>' +
      (escopo === 'meu' ? '<div class="field"><span>Tipo</span>' + seg('ftipo', [['despesa', 'Despesa fixa'], ['receita', 'Receita fixa']], st.tipo) + '</div>' : '<div class="note">Despesa do casal paga por você. Entra na divisão do mês como as outras.</div>') +
      '<div class="field"><label for="x-valor">Valor por mês</label><div class="money-in"><span>R$</span><input id="x-valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + (item ? fmtInput(item.valor) : '') + '"></div></div>' +
      '<label class="check"><input type="checkbox" id="x-var"' + (item && item.variavel ? ' checked' : '') + '> O valor muda todo mês (luz, água…). O app lança uma estimativa e pede o valor real quando você pagar.</label>' +
      '<div class="field"><label for="x-desc">Descrição</label><input class="input" id="x-desc" maxlength="60" placeholder="Ex.: Internet" value="' + esc(item ? item.desc : '') + '"></div>' +
      '<div class="field"><span>Categoria</span><div id="x-cats"></div></div>' +
      '<div class="field" id="wx-pag"><label for="x-pag">Forma de pagamento</label><select class="input" id="x-pag">' + opcoesPag(item ? item.pag : 'pix', item ? item.cartaoId : null).replace('<option value="novo-cartao">+ Cadastrar cartão…</option>', '') + '</select></div>' +
      (escopo === 'casal' ? '<div class="field"><label for="x-div">Divisão</label><select class="input" id="x-div">' + DIVS().map(([k, n]) => '<option value="' + k + '"' + (((item && item.divisao) || 'padrao') === k ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></div>' : '') +
      '<div class="two"><div class="field"><label for="x-dia">Dia do mês</label><input class="input" type="number" id="x-dia" min="1" max="31" inputmode="numeric" value="' + ((item && item.dia) || +hojeISO().slice(8)) + '"></div>' +
      (editar ? '<div class="field"><span>Desde</span><div class="input" style="background:transparent">' + esc(mesCurto(item.inicio)) + '</div></div>' :
        '<div class="field"><label for="x-mes">Começa em</label>' + seletorMes('x-mes', 'x-ano', hoje, false, 1) + '</div>') + '</div>' +
      '<div class="field"><label for="x-fmes">Termina em (opcional)</label>' + seletorMes('x-fmes', 'x-fano', item && item.fim, true, 6) + '<div class="hint">Para financiamentos, planos com prazo ou assinaturas que você vai cancelar. Deixe em branco se não tem data para acabar.</div></div>' +
      (editar ? '<div class="hint">Alterar vale para este mês (se ainda estiver a pagar) e os próximos. Meses anteriores ficam como estão.</div>' : '<div class="hint">O app lança sozinho todo mês, como “a pagar”. Meses anteriores ao atual entram como pagos.</div>') +
      '<div class="err" id="x-err" hidden></div><button class="btn block" type="submit">' + (editar ? 'Salvar alterações' : 'Criar conta fixa') + '</button>' +
      (editar ? '<button class="btn danger" type="button" id="x-fim">Encerrar conta fixa agora</button>' : '') + '</form>';
    abrirModal(editar ? 'Editar conta fixa' : (escopo === 'casal' ? 'Nova conta fixa do casal' : 'Nova conta fixa'), corpo, (el) => {
      const f = $('#f-fixa', el);
      const cats = () => {
        const tipo = st.tipo === 'receita' ? 'receita' : 'despesa';
        if (!catsLista(tipo).some((c) => c.id === st.cat)) st.cat = catsLista(tipo)[0].id;
        $('#x-cats', el).innerHTML = catChips(tipo, st.cat);
        $('#wx-pag', el).hidden = tipo === 'receita';
      };
      ligarCatChips($('#x-cats', el), st);
      cats();
      f.addEventListener('change', (e) => { if (e.target.name === 'ftipo') { st.tipo = e.target.value; cats(); } });
      const coll = escopo === 'casal' ? S.db.collection('fixasCasal') : fixasCol();
      const lancs = () => (escopo === 'casal' ? S.conj : S.meus).filter((l) => item && l.fixaId === item.id && l.id.slice(-7) >= mesHoje() && l.status === 'pendente');
      const destino = () => (escopo === 'casal' ? S.db.collection('conjunto') : meusCol());
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#x-err', el);
        const erro = (t) => { err.hidden = false; err.textContent = t; };
        const valor = FL.parseValor($('#x-valor', el).value);
        if (!(valor > 0)) return erro('Informe o valor por mês (ex.: 119,90).');
        const dia = Math.floor(Number($('#x-dia', el).value));
        if (!(dia >= 1 && dia <= 31)) return erro('O dia precisa ser de 1 a 31.');
        const fm = $('#x-fmes', el).value, fa = $('#x-fano', el).value;
        if (!!fm !== !!fa) return erro('Para “Termina em”, escolha mês e ano (ou deixe os dois em branco).');
        const fim = fm && fa ? fa + '-' + fm : null;
        const desc = $('#x-desc', el).value.trim() || cat(st.cat).nome;
        const tipo = escopo === 'casal' ? 'despesa' : st.tipo;
        let { pag, cartaoId } = lerPag($('#x-pag', el).value);
        if (tipo === 'receita') { pag = null; cartaoId = null; }
        const dados = { tipo, desc, valor, cat: st.cat, dia, fim, variavel: $('#x-var', el).checked, pag: pag || null, cartaoId: cartaoId || null, divisao: escopo === 'casal' ? $('#x-div', el).value : null };
        const b = f.querySelector('button[type=submit]'); b.disabled = true;
        if (!editar) {
          const inicio = $('#x-ano', el).value + '-' + $('#x-mes', el).value;
          if (fim && fim < inicio) { b.disabled = false; return erro('O mês de término é antes do início.'); }
          const ok = await criarFixa(escopo, Object.assign(dados, { inicio }));
          if (ok) { fecharModal(); toast('Conta fixa criada: lança todo dia ' + dia + '.'); agendarFixas(); } else b.disabled = false;
          return;
        }
        let ok = await escrever(() => coll.doc(item.id).update(dados));
        const novo = Object.assign({}, item, dados);
        for (const l of lancs()) {
          if (!ok) break;
          const mesCobr = l.id.slice(-7);
          if (fim && mesCobr > fim) { ok = await escrever(() => destino().doc(l.id).delete()); continue; }
          const [y, mm] = mesCobr.split('-').map(Number);
          const data = mesCobr + '-' + pad(Math.min(dia, new Date(y, mm, 0).getDate()));
          const doc = docDaFixa(novo, mesCobr, data, 'pendente');
          delete doc.criadoEm;
          ok = await escrever(() => destino().doc(l.id).update(doc));
        }
        if (ok) { fecharModal(); agendarSync(); agendarFixas(); toast('Conta fixa atualizada'); } else b.disabled = false;
      });
      const fimBtn = $('#x-fim', el);
      if (fimBtn) fimBtn.addEventListener('click', async () => {
        if (!fimBtn.dataset.armed) { fimBtn.dataset.armed = '1'; fimBtn.textContent = 'Toque de novo: encerra e remove os meses a pagar a partir de agora'; return; }
        fimBtn.disabled = true;
        let ok = await escrever(() => coll.doc(item.id).delete());
        for (const l of lancs()) { if (!ok) break; ok = await escrever(() => destino().doc(l.id).delete()); }
        if (ok) { fecharModal(); agendarSync(); toast('Conta fixa encerrada. Os meses já pagos continuam lançados.'); }
      });
    });
  }

  /* Cria os lançamentos das contas fixas que faltam (até o mês que vem). Só quem paga gera os do casal. */
  const tentados = new Set();
  let fixasT = 0, gerandoFixas = false, gerarDeNovo = false;
  function agendarFixas() { clearTimeout(fixasT); fixasT = setTimeout(gerarFixas, 900); }
  async function gerarFixas() {
    if (!S.uid || !souMembro() || S.canWrite === false) return;
    if (gerandoFixas) { gerarDeNovo = true; return; }
    gerandoFixas = true;
    try {
      const hoje = mesHoje();
      const ate = FL.addMeses(hoje, 1);
      const lotes = [];
      if (!S.firm.cartoes) return;
      if (S.firm.meus && S.firm.fixas) lotes.push({ fixas: S.fixas, exist: new Set(S.meus.map((l) => l.id)), destino: meusCol() });
      if (S.firm.conj && S.firm.fixasCasal) lotes.push({ fixas: S.fixasCasal.filter((f) => f.autor === S.uid), exist: new Set(S.conj.map((l) => l.id)), destino: S.db.collection('conjunto') });
      for (const lote of lotes) {
        for (const g of FL.fixasAGerar(lote.fixas, lote.exist, ate, hoje)) {
          if (tentados.has(g.id)) continue;
          tentados.add(g.id);
          try { await lote.destino.doc(g.id).set(docDaFixa(g.fixa, g.mes, g.data, g.status)); } catch (e) { console.warn('conta fixa', g.id, e); }
        }
      }
    } finally {
      gerandoFixas = false;
      if (gerarDeNovo) { gerarDeNovo = false; agendarFixas(); }
    }
  }

  /* ---------- evolução ---------- */
  const fmtEixo = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const NUM = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function passoBonito(max) {
    const bruto = max / 4;
    const p = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= bruto) return k * p;
    return 10 * p;
  }
  function grafico(serie, sel, largura) {
    const W = largura, H = 240, pl = 44, pr = 8, pt = 12, pb = 26;
    const pw = W - pl - pr, ph = H - pt - pb;
    const n = serie.length;
    const maxV = Math.max(1, ...serie.map((d) => Math.max(d.renda, d.gastos, d.sobra)));
    const minV = Math.min(0, ...serie.map((d) => d.sobra));
    const passo = passoBonito(maxV - minV);
    const top = Math.ceil(maxV / passo) * passo;
    const bot = Math.floor(minV / passo) * passo;
    const y = (v) => pt + (top - v) / (top - bot) * ph;
    const bw = pw / n;
    const barW = Math.max(3, Math.min(24, (bw - 10) / 2));
    let g = '';
    for (let v = bot; v <= top + 1e-6; v += passo) {
      const yy = y(v).toFixed(1);
      g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="' + (Math.abs(v) < 1e-6 ? 'eixo0' : 'grade') + '"/>' +
        '<text x="' + (pl - 6) + '" y="' + (+yy + 4) + '" text-anchor="end" class="tick">' + (v === 0 ? '0' : fmtEixo.format(v)) + '</text>';
    }
    const y0 = y(0);
    const coluna = (x, v, cls) => {
      if (!(v > 0)) return '';
      const yt = y(v), h = y0 - yt, r = Math.min(4, h, barW / 2);
      return '<path class="' + cls + '" d="M' + x.toFixed(1) + ' ' + y0.toFixed(1) + 'V' + (yt + r).toFixed(1) + 'Q' + x.toFixed(1) + ' ' + yt.toFixed(1) + ' ' + (x + r).toFixed(1) + ' ' + yt.toFixed(1) + 'H' + (x + barW - r).toFixed(1) + 'Q' + (x + barW).toFixed(1) + ' ' + yt.toFixed(1) + ' ' + (x + barW).toFixed(1) + ' ' + (yt + r).toFixed(1) + 'V' + y0.toFixed(1) + 'Z"/>';
    };
    const pulo = bw < 30 ? 2 : 1;
    let barras = '', rotulos = '', alvos = '', fundo = '';
    serie.forEach((d, i) => {
      const cx = pl + bw * i + bw / 2;
      if (i === sel) fundo += '<rect x="' + (pl + bw * i + 1).toFixed(1) + '" y="' + pt + '" width="' + (bw - 2).toFixed(1) + '" height="' + ph + '" rx="6" class="sel"/>';
      barras += coluna(cx - barW - 1, d.renda, 'b-renda') + coluna(cx + 1, d.gastos, 'b-gastos');
      if ((n - 1 - i) % pulo === 0) {
        const [yy, mm] = d.mes.split('-');
        rotulos += '<text x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="tick' + (i === sel ? ' forte' : '') + '">' + MESES_C[+mm - 1] + (mm === '01' || i === 0 ? '/' + yy.slice(2) : '') + '</text>';
      }
      alvos += '<rect x="' + (pl + bw * i).toFixed(1) + '" y="0" width="' + bw.toFixed(1) + '" height="' + H + '" fill="transparent" data-act="evo-sel" data-i="' + i + '" tabindex="0" role="button" aria-label="' + esc(mesLongo(d.mes) + ': renda ' + fmt(d.renda) + ', gastos ' + fmt(d.gastos) + ', sobra ' + fmt(d.sobra)) + '"/>';
    });
    const pts = serie.map((d, i) => [pl + bw * i + bw / 2, y(d.sobra)]);
    const linha = '<polyline class="l-sobra" points="' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>' +
      pts.map((p, i) => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (i === sel ? 5 : 4) + '" class="p-sobra"/>').join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Renda, gastos e sobra por mês">' + fundo + g + barras + linha + rotulos + alvos + '</svg>';
  }

  function viewEvolucao(m) {
    if (S.evoModo === 'prev') return viewPrevisao(m);
    if (S.evoModo === 'ano') return viewAno(m);
    const I = m.I;
    const par = parceiro();
    const quem = S.evoQuem === 'casal' || I.includes(S.evoQuem) ? S.evoQuem : 'casal';
    const meses = [];
    for (let i = S.evoN - 1; i >= 0; i--) meses.push(FL.addMeses(S.mes, -i));
    const serie = FL.evolucao(meses, I, m.resumos, S.conj, S.cofre, S.cfgCasal, quem === 'casal' ? 'casal' : quem);
    const sel = S.evoSel != null && S.evoSel < serie.length ? S.evoSel : serie.length - 1;
    const d = serie[sel];
    const larg = Math.max(280, Math.min(720, ($('#main') ? $('#main').clientWidth : 360) - 34));
    const opcoes = [['casal', 'Casal'], [S.uid, 'Eu']].concat(par ? [[par.id, par.nome]] : []);
    const comDados = serie.filter((x) => x.renda || x.gastos);
    const media = (f) => comDados.length ? FL.r2(comDados.reduce((t, x) => t + x[f], 0) / comDados.length) : 0;
    const totGuard = FL.r2(serie.reduce((t, x) => t + x.guardado, 0));
    const melhor = comDados.length ? comDados.reduce((a, b) => (b.sobra > a.sobra ? b : a)) : null;
    let h = '<section class="card">' + abasEvo() + '<div class="card-head"><div><div class="eyebrow">Histórico</div><h2>Renda, gastos e sobra</h2></div></div>' +
      '<div class="evo-ctrl"><div class="chips" role="group" aria-label="De quem">' + opcoes.map(([v, n]) => '<button class="chip" type="button" data-act="evo-quem" data-v="' + esc(v) + '" aria-pressed="' + (quem === v) + '">' + esc(n) + '</button>').join('') + '</div>' +
      '<div class="chips" role="group" aria-label="Período">' + [[6, '6 meses'], [12, '12 meses']].map(([v, n]) => '<button class="chip" type="button" data-act="evo-n" data-v="' + v + '" aria-pressed="' + (S.evoN === v) + '">' + n + '</button>').join('') + '</div></div>' +
      (par && quem === par.id ? '<div class="note">' + ICON.lock + '<span>De ' + esc(par.nome) + ' aparecem só os totais do mês.</span></div>' : '') +
      '<div class="legend"><span><b style="background:var(--s-renda)"></b>Renda</span><span><b style="background:var(--s-gastos)"></b>Gastos</span><span><b class="lk" style="background:var(--s-sobra)"></b>Sobra</span></div>' +
      grafico(serie, sel, larg) +
      '<div class="readout"><div class="rd-mes">' + esc(nomeMes(d.mes)) + '</div><div class="rd-grid">' +
      '<div><span class="k"><b style="background:var(--s-renda)"></b>Renda</span><span class="v">' + fmt(d.renda) + '</span></div>' +
      '<div><span class="k"><b style="background:var(--s-gastos)"></b>Gastos</span><span class="v">' + fmt(d.gastos) + '</span></div>' +
      '<div><span class="k">Guardado</span><span class="v">' + fmt(d.guardado) + '</span></div>' +
      '<div><span class="k"><b class="lk" style="background:var(--s-sobra)"></b>Sobra</span><span class="v ' + valorCls(d.sobra) + '">' + fmt(d.sobra) + '</span></div></div>' +
      '<div class="hint">Toque em um mês do gráfico para ver os valores.</div>' + (quem !== (par && par.id) && (d.renda || d.gastos) ? '<button class="link" type="button" data-act="fechamento" data-mes="' + d.mes + '">Relatório de fechamento de ' + esc(mesCurto(d.mes)) + '</button>' : '') + '</div></section>';
    h += '<section class="card"><div class="stats">' +
      '<div class="stat"><span class="k">Gasto médio por mês</span><span class="v">' + fmt(media('gastos')) + '</span></div>' +
      '<div class="stat"><span class="k">Sobra média por mês</span><span class="v ' + valorCls(media('sobra')) + '">' + fmt(media('sobra')) + '</span></div>' +
      '<div class="stat"><span class="k">Guardado no período</span><span class="v">' + fmt(totGuard) + '</span></div></div>' +
      (melhor ? '<div class="hint">Melhor mês: ' + esc(mesLongo(melhor.mes)) + ', com ' + fmt(melhor.sobra) + ' de sobra.</div>' : '<div class="hint">Os números aparecem conforme vocês forem lançando renda e gastos.</div>') + '</section>';
    const nf = (v) => NUM.format(v || 0);
    h += '<section class="card"><div class="card-head"><h2>Mês a mês</h2><span class="sub">valores em R$</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th>Renda</th><th>Gastos</th><th>Guardado</th><th>Sobra</th></tr></thead><tbody>' +
      serie.slice().reverse().map((x) => '<tr><td>' + esc(mesCurto(x.mes)) + '</td><td class="v">' + nf(x.renda) + '</td><td class="v">' + nf(x.gastos) + '</td><td class="v">' + nf(x.guardado) + '</td><td class="v ' + valorCls(x.sobra) + '">' + nf(x.sobra) + '</td></tr>').join('') +
      '</tbody></table></div><div class="hint">Gastos incluem a parte de cada um nas despesas do casal. Sobra = renda − gastos − guardado nas metas.</div></section>';
    return h;
  }

  /* ---------- previsão ---------- */
  function mapaCartoes() { const o = {}; S.cartoes.forEach((c) => { o[c.id] = { fechamento: c.fechamento, vencimento: c.vencimento }; }); return o; }
  function proximosMeses(n, ini) { const b = ini || mesHoje(); return Array.from({ length: n }, (_, i) => FL.addMeses(b, i)); }
  function minhaProjecao(meses) {
    const res = FL.projecao(S.meus, S.fixas, meses, mesHoje(), mapaCartoes(), S.rendaPrev);
    const rm = reservaMetas(metasMinhas(), meses);
    res.forEach((p) => { p.metas = rm[p.mes] || 0; });
    return res;
  }
  function metasPorMes(meses) { return reservaMetas(metasCasal(), meses); }
  function seletorEvo(quem, opcoes) {
    return '<div class="chips" role="group" aria-label="De quem">' + opcoes.map(([v, n]) => '<button class="chip" type="button" data-act="evo-quem" data-v="' + esc(v) + '" aria-pressed="' + (quem === v) + '">' + esc(n) + '</button>').join('') + '</div>';
  }
  function abasEvo() {
    return '<div class="seg-tabs" role="tablist">' + [['hist', 'Histórico'], ['prev', 'Previsão'], ['ano', 'Ano']].map(([k, n]) => '<button type="button" role="tab" data-act="evo-modo" data-v="' + k + '" aria-selected="' + (S.evoModo === k) + '">' + n + '</button>').join('') + '</div>';
  }

  function viewPrevisao(m) {
    const I = m.I;
    const par = parceiro();
    const quem = S.evoQuem === 'casal' || I.includes(S.evoQuem) ? S.evoQuem : 'casal';
    const meses = proximosMeses(12);
    const prevs = {}, varMedias = {}, varAtuais = {};
    I.forEach((id) => {
      if (id === S.uid) { prevs[id] = {}; minhaProjecao(meses).forEach((p) => { prevs[id][p.mes] = p; }); varMedias[id] = FL.mediaVariavel(S.meus, mesHoje()); varAtuais[id] = FL.gastoVariavel(S.meus, mesHoje()); }
      else { const r = S.resumos[id] || {}; prevs[id] = r.prev || {}; varMedias[id] = r.varMedia || 0; varAtuais[id] = r.varAtual || 0; }
    });
    const serie = FL.previsao({ meses, ids: I, prevs, varMedias, varAtuais, resumos: m.resumos, conj: S.conj, fixasCasal: S.fixasCasal, mesHoje: mesHoje(), cfg: S.cfgCasal, metasPorMes: metasPorMes(meses), incluirVar: S.prevVar, quem });
    const sel = S.evoSel != null && S.evoSel < serie.length ? S.evoSel : 0;
    const d = serie[sel];
    const larg = Math.max(280, Math.min(720, ($('#main') ? $('#main').clientWidth : 360) - 34));
    const opcoes = [['casal', 'Casal'], [S.uid, 'Eu']].concat(par ? [[par.id, par.nome]] : []);
    const negativos = serie.filter((x) => x.sobra < 0);
    const manual = quem === S.uid && prevs[S.uid][d.mes] && prevs[S.uid][d.mes].rendaManual;
    let h = '<section class="card">' + abasEvo() +
      '<div><div class="eyebrow">Previsão · próximos 12 meses</div><h2>Quanto deve sobrar</h2></div>' +
      '<div class="evo-ctrl">' + seletorEvo(quem, opcoes) +
      '<button class="chip" type="button" data-act="prev-var" aria-pressed="' + S.prevVar + '">' + (S.prevVar ? '✓ ' : '') + 'Gastos do dia a dia</button></div>' +
      (par && quem === par.id ? '<div class="note">' + ICON.lock + '<span>De ' + esc(par.nome) + ' aparecem só os totais previstos.</span></div>' : '') +
      '<div class="legend"><span><b style="background:var(--s-renda)"></b>Renda prevista</span><span><b style="background:var(--s-gastos)"></b>Saídas previstas</span><span><b class="lk" style="background:var(--s-sobra)"></b>Sobra prevista</span></div>' +
      grafico(serie.map((x) => ({ mes: x.mes, renda: x.renda, gastos: FL.r2(x.compromissos + x.variaveis), sobra: x.sobra })), sel, larg) +
      '<div class="readout"><div class="rd-mes">' + esc(nomeMes(d.mes)) + '</div><div class="rd-grid">' +
      '<div><span class="k"><b style="background:var(--s-renda)"></b>Renda prevista' + (manual ? ' (ajustada)' : '') + '</span><span class="v">' + fmt(d.renda) + '</span></div>' +
      '<div><span class="k"><b style="background:var(--s-gastos)"></b>Contas, parcelas e faturas</span><span class="v">' + fmt(d.compromissos) + '</span></div>' +
      (S.prevVar ? '<div><span class="k">Dia a dia (média)</span><span class="v">' + fmt(d.variaveis) + '</span></div>' : '') +
      '<div><span class="k">Reservar para metas</span><span class="v">' + fmt(d.metas) + '</span></div>' +
      '<div><span class="k"><b class="lk" style="background:var(--s-sobra)"></b>Sobra prevista</span><span class="v ' + valorCls(d.sobra) + '">' + fmt(d.sobra) + '</span></div>' +
      '<div><span class="k">Renda comprometida</span><span class="v">' + (d.pct == null ? '—' : pct(d.pct)) + '</span></div></div>' +
      (quem === S.uid ? '<button class="link" type="button" data-act="prev-renda" data-mes="' + d.mes + '">Ajustar minha renda prevista de ' + esc(mesCurto(d.mes)) + '</button>' : '') + '</div>' +
      (negativos.length ? '<div class="note warn"><span>▲ Sobra prevista negativa em ' + negativos.length + (negativos.length === 1 ? ' mês' : ' meses') + ': ' + esc(negativos.slice(0, 4).map((x) => mesCurto(x.mes)).join(', ')) + (negativos.length > 4 ? '…' : '') + '.</span></div>' : '') +
      '</section>';
    const nf = (v) => NUM.format(v || 0);
    h += '<section class="card"><div class="card-head"><h2>Mês a mês</h2><span class="sub">valores em R$</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th>Renda</th><th>Saídas</th><th>Metas</th><th>Sobra</th></tr></thead><tbody>' +
      serie.map((x, i) => '<tr data-act="evo-sel" data-i="' + i + '" class="' + (i === sel ? 'sel' : '') + '"><td>' + esc(mesCurto(x.mes)) + '</td><td class="v">' + nf(x.renda) + '</td><td class="v">' + nf(x.compromissos + x.variaveis) + '</td><td class="v">' + nf(x.metas) + '</td><td class="v ' + valorCls(x.sobra) + '">' + nf(x.sobra) + '</td></tr>').join('') +
      '</tbody></table></div><div class="hint">A previsão soma contas fixas (inclusive as que ainda vão ser lançadas), parcelas e faturas de cartão' + (S.prevVar ? ', mais a média dos gastos do dia a dia dos últimos 3 meses' : '') + '. A renda vem das receitas fixas e do que você ajustar. Metas = quanto guardar por mês para chegar às metas no prazo.</div></section>';
    return h;
  }

  function formRendaPrev(mes) {
    const p = minhaProjecao([mes])[0];
    const atual = (S.rendaPrev || {})[mes];
    const corpo = '<form id="f-rp" class="field" style="gap:14px" novalidate><p class="sub" style="margin:0">Quanto você espera receber em ' + esc(mesLongo(mes)) + '? Só você vê esse valor; a outra pessoa vê apenas os totais previstos.</p>' +
      '<div class="money-in"><span>R$</span><input id="rp-valor" inputmode="decimal" value="' + fmtInput(p.renda) + '"></div>' +
      '<label class="check"><input type="checkbox" id="rp-seguintes"> Usar o mesmo valor nos meses seguintes deste ano</label>' +
      '<button class="btn block" type="submit">Salvar renda prevista</button>' +
      (atual ? '<button class="btn ghost" type="button" id="rp-auto">Voltar ao automático (receitas fixas)</button>' : '') + '</form>';
    abrirModal('Renda prevista', corpo, (el) => {
      const salvar = async (mapa) => {
        if (await escrever(() => S.db.doc('usuarios/' + S.uid + '/config/previsao').set({ renda: mapa, atualizadoEm: Date.now() }), 'Renda prevista salva')) { fecharModal(); agendarSync(); }
      };
      $('#f-rp', el).addEventListener('submit', (e) => {
        e.preventDefault();
        const v = FL.parseValor($('#rp-valor', el).value);
        if (!(v >= 0)) return;
        const mapa = Object.assign({}, S.rendaPrev || {});
        mapa[mes] = v;
        if ($('#rp-seguintes', el).checked) for (let x = FL.addMeses(mes, 1); x.slice(0, 4) === mes.slice(0, 4); x = FL.addMeses(x, 1)) mapa[x] = v;
        salvar(mapa);
      });
      const auto = $('#rp-auto', el);
      if (auto) auto.addEventListener('click', () => { const mapa = Object.assign({}, S.rendaPrev || {}); delete mapa[mes]; salvar(mapa); });
    });
  }

  /* ---------- visão do ano ---------- */
  function viewAno(m) {
    const I = m.I;
    const ano = S.evoAno || +S.mes.slice(0, 4);
    const quem = S.evoQuem === 'casal' ? 'casal' : 'eu';
    const lancs = quem === 'casal' ? S.conj : S.meus;
    const desp = FL.anoCategorias(lancs, ano, (l) => l.tipo !== 'receita');
    const mesesAno = MESES_C.map((_, i) => ano + '-' + pad(i + 1));
    const nf = (v) => (v ? NUM.format(v) : '');
    const soma = (arrs) => mesesAno.map((_, i) => FL.r2(arrs.reduce((t, a) => t + (a[i] || 0), 0)));
    const linha = (rot, vals, cls) => {
      const tm = FL.totalMedia(vals);
      return '<tr class="' + (cls || '') + '"><td>' + rot + '</td>' + vals.map((v) => '<td class="v">' + nf(v) + '</td>').join('') + '<td class="v tot">' + nf(tm.total) + '</td><td class="v">' + nf(tm.media) + '</td></tr>';
    };
    let corpo = '';
    const blocos = [];
    catalogo().grupos.filter((g) => g.id !== 'receitas').forEach((g) => {
      const cs = Object.keys(desp).filter((k) => (cat(k).grupo || 'outros') === g.id);
      if (!cs.length) return;
      corpo += '<tr class="grp"><td colspan="15">' + esc(g.nome) + '</td></tr>';
      cs.sort((a, b) => FL.totalMedia(desp[b]).total - FL.totalMedia(desp[a]).total).forEach((k) => { corpo += linha(cat(k).ico + ' ' + esc(cat(k).nome), desp[k]); });
      const sub = soma(cs.map((k) => desp[k]));
      blocos.push(sub);
      corpo += linha('Subtotal ' + esc(g.nome), sub, 'subtot');
    });
    let parte = null;
    if (quem === 'eu' && I.length === 2) {
      parte = mesesAno.map((mm) => FL.conjuntoMes(S.conj, mm, I, FL.divisao(mm, I, m.resumos, S.cfgCasal).pct).parte[S.uid] || 0);
      if (parte.some((v) => v)) { corpo += linha('👥 Minha parte no casal', parte, 'subtot'); blocos.push(parte); }
    }
    const totalDesp = soma(blocos);
    corpo += linha('TOTAL DE DESPESAS', totalDesp, 'total');
    if (quem === 'eu') {
      const rec = FL.anoCategorias(S.meus, ano, (l) => l.tipo === 'receita');
      const totRec = soma(Object.values(rec));
      corpo += linha('Receitas', totRec, 'subtot');
      corpo += linha('Saldo', totRec.map((v, i) => FL.r2(v - totalDesp[i])), 'total');
      corpo += '<tr class="subtot"><td>% comprometido</td>' + totRec.map((v, i) => '<td class="v">' + (v ? pct(totalDesp[i] / v) : '') + '</td>').join('') + '<td class="v tot">' + (FL.totalMedia(totRec).total ? pct(FL.totalMedia(totalDesp).total / FL.totalMedia(totRec).total) : '') + '</td><td></td></tr>';
    }
    let h = '<section class="card">' + abasEvo() +
      '<div class="card-head"><div><div class="eyebrow">Visão do ano</div><h2>Por categoria</h2></div>' +
      '<div class="ano-nav"><button class="icon-btn" type="button" data-act="evo-ano" data-v="' + (ano - 1) + '" aria-label="Ano anterior">' + ICON.left + '</button><b>' + ano + '</b><button class="icon-btn" type="button" data-act="evo-ano" data-v="' + (ano + 1) + '" aria-label="Próximo ano">' + ICON.right + '</button></div></div>' +
      seletorEvo(quem === 'casal' ? 'casal' : S.uid, [[S.uid, 'Eu'], ['casal', 'Casal']]) +
      (Object.keys(desp).length ? '<div class="tbl-wrap"><table class="tbl tbl-ano"><thead><tr><th>Categoria</th>' + MESES_C.map((n) => '<th>' + n + '</th>').join('') + '<th>Total</th><th>Média</th></tr></thead><tbody>' + corpo + '</tbody></table></div>' +
        '<div class="hint">Valores em R$. Média = média dos meses com valor, como na planilha. Compras no cartão entram no mês da fatura.</div>'
        : '<div class="empty">Nenhuma despesa ' + (quem === 'casal' ? 'do casal ' : '') + 'em ' + ano + '.</div>') + '</section>';
    // comparativo com o ano anterior
    const quemEvo = quem === 'casal' ? 'casal' : S.uid;
    const atual = FL.evolucao(mesesAno, I, m.resumos, S.conj, S.cofre, S.cfgCasal, quemEvo);
    const ant = FL.evolucao(mesesAno.map((x) => FL.addMeses(x, -12)), I, m.resumos, S.conj, S.cofre, S.cfgCasal, quemEvo);
    if (atual.some((x) => x.gastos) || ant.some((x) => x.gastos)) {
      const tA = FL.r2(atual.reduce((t, x) => t + x.gastos, 0)), tB = FL.r2(ant.reduce((t, x) => t + x.gastos, 0));
      h += '<section class="card"><div class="card-head"><h2>' + ano + ' x ' + (ano - 1) + '</h2><span class="sub">gastos por mês, em R$</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th>' + ano + '</th><th>' + (ano - 1) + '</th><th>Variação</th><th>%</th></tr></thead><tbody>' +
        atual.map((x, i) => {
          const b = ant[i].gastos, dv = FL.r2(x.gastos - b);
          return '<tr><td>' + MESES_C[i] + '</td><td class="v">' + nf(x.gastos) + '</td><td class="v">' + nf(b) + '</td><td class="v ' + (dv > 0 ? 'neg' : dv < 0 ? 'pos' : '') + '">' + (x.gastos && b ? (dv > 0 ? '+' : '') + NUM.format(dv) : '') + '</td><td class="v">' + (x.gastos && b ? (dv > 0 ? '+' : '') + pct(dv / b) : '') + '</td></tr>';
        }).join('') +
        '<tr class="total"><td>Ano</td><td class="v">' + nf(tA) + '</td><td class="v">' + nf(tB) + '</td><td class="v">' + (tA && tB ? (tA - tB > 0 ? '+' : '') + NUM.format(FL.r2(tA - tB)) : '') + '</td><td class="v">' + (tA && tB ? pct((tA - tB) / tB) : '') + '</td></tr></tbody></table></div>' +
        '<div class="hint">A comparação só fica justa nos meses em que os dois anos têm lançamentos.</div></section>';
    }
    return h;
  }

  /* ---------- fechamento do mês ---------- */
  let textoRelatorio = '';
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };
  function cardFechamento() {
    const hoje = hojeISO();
    if (+hoje.slice(8) > 10 || S.mes !== mesHoje()) return '';
    const ant = FL.addMeses(mesHoje(), -1);
    if (lsGet('fech-' + ant)) return '';
    const m = modelo(ant);
    if (!m.meusMes.length && !m.conj.itens.length) return '';
    return '<section class="card fech-card"><div class="card-head"><div><div class="eyebrow">Fechamento do mês</div><h2>' + esc(nomeMes(ant)) + ' fechou</h2></div></div>' +
      '<p class="sub" style="margin:0">Veja quanto sobrou, os maiores gastos, o orçamento e o acerto do casal.</p>' +
      '<div class="btn-row"><button class="btn" type="button" data-act="fechamento" data-mes="' + ant + '">Ver relatório</button><button class="btn ghost" type="button" data-act="fech-dispensar" data-mes="' + ant + '">Dispensar</button></div></section>';
  }
  function relatorioMes(mes) {
    const at = modelo(mes), an = modelo(FL.addMeses(mes, -1));
    const nomeAnt = MESES_C[+FL.addMeses(mes, -1).slice(5) - 1];
    const dl = (a, b, inverso) => {
      if (!b) return '';
      const d = (a - b) / Math.abs(b);
      if (Math.abs(d) < 0.005) return '<span class="tag">= ' + nomeAnt + '</span>';
      const ruim = inverso ? d < 0 : d > 0;
      return '<span class="tag ' + (ruim ? 'neg' : 'pos') + '">' + (d > 0 ? '▲ ' : '▼ ') + pct(Math.abs(d)) + ' vs ' + nomeAnt + '</span>';
    };
    const eu = at.cartoes[S.uid] || FL.cartaoPessoa(null, 0, 0);
    const euA = an.cartoes[S.uid] || FL.cartaoPessoa(null, 0, 0);
    const gastos = FL.r2(eu.gastos + eu.parte), gastosA = FL.r2(euA.gastos + euA.parte);
    const topo = FL.porCategoria(at.meusMes, (l) => l.tipo !== 'receita').slice(0, 5);
    const antCat = {}; FL.porCategoria(an.meusMes, (l) => l.tipo !== 'receita').forEach(([k, v]) => { antCat[k] = v; });
    const pend = at.meusMes.filter((l) => l.tipo !== 'receita' && l.status === 'pendente').concat(at.conj.itens.filter((l) => l.autor === S.uid && l.status === 'pendente'));
    const reg = S.acertos[mes];
    const ac = at.conj.acerto;
    const guard = (at.cof.noMes[mes] || {})[S.uid] || 0;
    const linhas = [];
    linhas.push('📊 Fechamento de ' + mesLongo(mes));
    linhas.push('Renda: ' + fmt(eu.renda) + ' | Gastos: ' + fmt(gastos) + ' | Guardado: ' + fmt(eu.guardado) + ' | Sobra: ' + fmt(eu.saldo));
    if (topo.length) linhas.push('Maiores gastos: ' + topo.slice(0, 3).map(([k, v]) => cat(k).nome + ' ' + fmt(v)).join(', '));
    if (at.conj.total) linhas.push('Casal: ' + fmt(at.conj.total) + (ac ? ' | Acerto: ' + pessoa(ac.de).nome + ' → ' + pessoa(ac.para).nome + ' ' + fmt(ac.valor) : ''));
    textoRelatorio = linhas.join('\n');
    let h = '<div class="rel-hero"><div class="sub">Sobra livre</div><div class="money-big ' + valorCls(eu.saldo) + '">' + fmt(eu.saldo) + '</div>' + dl(eu.saldo, euA.saldo, true) + '</div>' +
      '<div class="rows">' +
      '<div class="rowkv"><span class="k">Renda</span><span class="v">' + fmt(eu.renda) + '</span></div>' +
      '<div class="rowkv"><span class="k">Gastos (pessoais + parte no casal)</span><span class="v">' + fmt(gastos) + ' ' + dl(gastos, gastosA) + '</span></div>' +
      '<div class="rowkv"><span class="k">Guardado para metas</span><span class="v">' + fmt(eu.guardado) + '</span></div>' +
      (eu.pctComprometido != null ? '<div class="rowkv"><span class="k">Renda comprometida</span><span class="v">' + pct(eu.pctComprometido) + '</span></div>' : '') + '</div>';
    if (topo.length) {
      h += '<h3 class="rel-h">Maiores gastos</h3><div class="rows">' + topo.map(([k, v]) => '<div class="rowkv"><span class="k">' + cat(k).ico + ' ' + esc(cat(k).nome) + '</span><span class="v">' + fmt(v) + ' ' + dl(v, antCat[k] || 0) + '</span></div>').join('') + '</div>';
    }
    if (at.orcMeu.total) {
      const est = at.orcMeu.linhas.filter((l) => l.status === 'estourou');
      h += '<h3 class="rel-h">Orçamento</h3><div class="rows"><div class="rowkv"><span class="k">Categorias com limite</span><span class="v">' + fmt(at.orcMeu.total.gasto) + ' de ' + fmt(at.orcMeu.total.limite) + '</span></div>' +
        (est.length ? '<div class="note warn"><span>▲ Passaram do limite: ' + esc(est.map((l) => cat(l.cat).nome + ' (' + fmt(-l.sobra) + ')').join(', ')) + '</span></div>' : '<div class="note pos"><span>✓ Todas as categorias ficaram dentro do limite.</span></div>') + '</div>';
    }
    if (at.conj.total) {
      h += '<h3 class="rel-h">Casal</h3><div class="rows"><div class="rowkv"><span class="k">Despesas do casal</span><span class="v">' + fmt(at.conj.total) + ' ' + dl(at.conj.total, an.conj.total) + '</span></div>' +
        (ac ? '<div class="rowkv"><span class="k">Acerto: ' + esc(pessoa(ac.de).nome) + ' → ' + esc(pessoa(ac.para).nome) + '</span><span class="v">' + fmt(ac.valor) + ' ' + (reg && reg.quitado ? '<span class="tag pos">✓ feito</span>' : '<span class="tag warn">● pendente</span>') + '</span></div>' : '') + '</div>';
    }
    if (pend.length) h += '<div class="note warn"><span>Ficaram ' + pend.length + ' contas suas marcadas como “a pagar” em ' + esc(MESES[+mes.slice(5) - 1]) + ' (' + fmt(pend.reduce((t, l) => t + l.valor, 0)) + ').</span></div>';
    if (guard) h += '<div class="note"><span>🐷 Você guardou ' + fmt(guard) + ' para as metas neste mês.</span></div>';
    h += '<div class="btn-row"><button class="btn" type="button" data-act="copiar-relatorio">Copiar resumo</button><button class="btn ghost" type="button" data-act="ir-mes" data-mes="' + mes + '" data-tab="meus">Ver lançamentos</button></div>';
    lsSet('fech-' + mes, '1');
    abrirModal('Fechamento de ' + mesLongo(mes), h);
  }

  /* ---------- metas (vários cofrinhos) ---------- */
  function metasCasal() {
    const l = [];
    if (S.viagem) l.push({ id: 'viagem', nome: S.viagem.destino || 'Viagem', meta: S.viagem.meta, mes: S.viagem.mes, ico: '✈️', escopo: 'casal' });
    S.metas.filter((x) => x.ativa !== false).forEach((x) => l.push(Object.assign({ ico: '🎯' }, x, { escopo: 'casal' })));
    return l;
  }
  const metasMinhas = () => S.metasPess.filter((x) => x.ativa !== false).map((x) => Object.assign({ ico: '🎯' }, x, { escopo: 'meu' }));
  const todasMetas = () => metasCasal().concat(metasMinhas());
  function movsDe(meta) {
    return meta.escopo === 'casal' ? S.cofre.filter((x) => (x.metaId || 'viagem') === meta.id) : S.movPess.filter((x) => x.metaId === meta.id);
  }
  function calcMeta(meta) {
    const I = ids();
    if (meta.escopo === 'casal') {
      const res = Object.assign({}, S.resumos); res[S.uid] = { meses: meuResumo() };
      return FL.cofrinho(movsDe(meta), meta, mesHoje(), I, FL.divisao(mesHoje(), I, res, S.cfgCasal).pct);
    }
    return FL.cofrinho(movsDe(meta), meta, mesHoje(), [S.uid], { [S.uid]: 1 });
  }
  function meuResumo() {
    const r = FL.resumoPessoal(S.meus);
    for (const x of S.movPess) {
      if (!x.mes || !(x.valor > 0)) continue;
      const v = (x.tipo === 'retirada' ? -1 : 1) * x.valor;
      r[x.mes] = r[x.mes] || { renda: 0, despesas: 0, aPagar: 0, aReceber: 0 };
      r[x.mes].metas = FL.r2((r[x.mes].metas || 0) + v);
    }
    return r;
  }
  function reservaMetas(lista, meses) {
    const o = {};
    lista.forEach((mt) => {
      const c = calcMeta(mt);
      if (!c.mesAlvo || !(c.porMes > 0)) return;
      meses.forEach((x) => { if (x >= mesHoje() && x < c.mesAlvo) o[x] = FL.r2((o[x] || 0) + c.porMes); });
    });
    return o;
  }

  function cardMeta(mt) {
    const c = calcMeta(mt);
    const ps = mt.escopo === 'casal' ? ids().map(pessoa) : [];
    const divHoje = ps.length === 2 ? FL.divisao(mesHoje(), ids(), Object.assign({}, S.resumos, { [S.uid]: { meses: meuResumo() } }), S.cfgCasal) : null;
    const nMov = movsDe(mt).length;
    let h = '<section class="card meta-card"><div class="card-head"><div class="who"><span class="meta-ico">' + esc(mt.ico) + '</span><div><div class="name">' + esc(mt.nome) + '</div><div class="sub">' + (c.mesAlvo ? 'até ' + esc(mesLongo(c.mesAlvo)) : 'sem prazo') + (mt.escopo === 'meu' ? ' · só você vê' : '') + '</div></div></div>' +
      (S.canWrite !== false ? '<button class="link" type="button" data-act="meta-editar" data-id="' + esc(mt.id) + '" data-esc="' + mt.escopo + '">Editar</button>' : '') + '</div>' +
      '<div class="ring-wrap">' + anel(c.progresso) + '<div class="rows"><div><div class="sub">Guardado</div><div class="money-big pos">' + fmt(c.guardado) + '</div><div class="sub">de ' + fmt(c.meta) + '</div></div>' +
      '<div class="rowkv"><span class="k">Falta</span><span class="v">' + fmt(c.falta) + '</span></div></div></div>';
    if (c.mesesRestantes != null) {
      if (c.falta <= 0) h += '<div class="note pos"><span>✓ <strong>Meta batida!</strong></span></div>';
      else if (c.mesesRestantes > 0) {
        h += '<div class="settle" style="grid-template-columns:1fr"><div><div class="sub">Para chegar em ' + esc(mesLongo(c.mesAlvo)) + ' (' + c.mesesRestantes + ' ' + (c.mesesRestantes === 1 ? 'mês' : 'meses') + ')</div><div class="amt">' + fmt(c.porMes) + ' por mês</div></div></div>';
        if (ps.length === 2) h += '<div class="rows">' + ps.map((p) => '<div class="rowkv"><span class="k">' + esc(p.nome) + ' (' + pct(divHoje.pct[p.id]) + ')</span><span class="v">' + fmt(c.sugestao[p.id]) + '/mês</span></div>').join('') + '</div>';
      } else h += '<div class="note warn"><span>O prazo chegou. Faltaram ' + fmt(c.falta) + '.</span></div>';
    }
    if (ps.length === 2) {
      const max = Math.max(1, ...ps.map((p) => Math.abs(c.porPessoa[p.id] || 0)));
      h += '<div class="rows">' + ps.map((p) => '<div style="display:grid;gap:4px"><div class="rowkv"><span class="k" style="display:flex;align-items:center;gap:8px">' + avatar(p, 20) + esc(p.nome) + ' guardou</span><span class="v">' + fmt(c.porPessoa[p.id]) + '</span></div><div class="meter"><i style="width:' + (Math.max(0, c.porPessoa[p.id]) / max * 100).toFixed(1) + '%;background:' + esc(p.cor) + '"></i></div></div>').join('') + '</div>';
    }
    if (S.canWrite !== false) h += '<div class="btn-row"><button class="btn" type="button" data-act="mov-novo" data-tipo="deposito" data-id="' + esc(mt.id) + '" data-esc="' + mt.escopo + '">Guardar</button><button class="btn ghost" type="button" data-act="mov-novo" data-tipo="retirada" data-id="' + esc(mt.id) + '" data-esc="' + mt.escopo + '">Retirar</button></div>';
    if (nMov) h += '<button class="link" type="button" data-act="movs-ver" data-id="' + esc(mt.id) + '" data-esc="' + mt.escopo + '">Ver movimentações (' + nMov + ')</button>';
    return h + '</section>';
  }

  function viewMetas() {
    const cas = metasCasal(), minhas = metasMinhas();
    let h = '<div class="sec-head"><h2>Metas do casal</h2>' + (S.canWrite !== false ? '<button class="link" type="button" data-act="meta-nova" data-esc="casal">+ Nova meta</button>' : '') + '</div>';
    h += cas.length ? cas.map(cardMeta).join('') : '<section class="card"><p class="sub" style="margin:0">Viagem, reserva de emergência, carro… Crie uma meta, defina o valor e o prazo, e o app calcula quanto cada um guarda por mês.</p><button class="btn" type="button" data-act="meta-nova" data-esc="casal">Criar meta do casal</button></section>';
    h += '<div class="sec-head"><h2>Minhas metas</h2>' + (S.canWrite !== false ? '<button class="link" type="button" data-act="meta-nova" data-esc="meu">+ Nova meta</button>' : '') + '</div>';
    h += minhas.length ? minhas.map(cardMeta).join('') : '<section class="card"><p class="sub" style="margin:0">Metas só suas, que a outra pessoa não vê em detalhe (ela vê só o total guardado no mês).</p></section>';
    return h;
  }

  function cardMetasMini() {
    const lista = todasMetas();
    if (!lista.length) return '<section class="card"><h2>Metas</h2><p class="sub" style="margin:0">Crie metas como a viagem ou uma reserva e acompanhe quanto falta.</p><button class="btn ghost" type="button" data-act="ir" data-tab="metas">Criar meta</button></section>';
    return '<section class="card"><div class="card-head"><h2>Metas</h2><button class="link" type="button" data-act="ir" data-tab="metas">Abrir</button></div><div class="rows">' +
      lista.map((mt) => {
        const c = calcMeta(mt);
        return '<div class="meta-mini"><div class="rowkv"><span class="k">' + esc(mt.ico) + ' ' + esc(mt.nome) + (mt.escopo === 'meu' ? ' 🔒' : '') + '</span><span class="v">' + pct(c.progresso) + '</span></div>' +
          '<div class="meter pos"><i style="width:' + (c.progresso * 100).toFixed(1) + '%"></i></div>' +
          '<div class="sub" style="font-size:12px">' + fmt(c.guardado) + ' de ' + fmt(c.meta) + (c.mesesRestantes > 0 && c.falta > 0 ? ' · ' + fmt(c.porMes) + '/mês até ' + esc(mesCurto(c.mesAlvo)) : '') + '</div></div>';
      }).join('') + '</div></section>';
  }

  function acharMeta(id, escopo) { return (escopo === 'casal' ? metasCasal() : metasMinhas()).find((x) => x.id === id) || null; }

  function formMeta(escopo, mt) {
    const editar = !!mt;
    const st = { ico: (mt && mt.ico) || (escopo === 'casal' ? '🎯' : '🐷') };
    const ICS = ['✈️', '🏖️', '🏠', '🚗', '🛟', '💍', '🎓', '👶', '🐷', '🎯', '💻', '📱', '🎁', '🏥', '🛋️', '🏍️'];
    const corpo = '<form id="f-meta" class="field" style="gap:14px" novalidate>' +
      '<div class="field"><label for="mt-nome">Nome</label><input class="input" id="mt-nome" maxlength="40" value="' + esc(mt ? mt.nome : '') + '" placeholder="Ex.: Reserva de emergência"></div>' +
      '<div class="field"><span>Ícone</span><div class="icones" id="mt-icos">' + ICS.map((i) => '<button type="button" data-ico="' + i + '" aria-pressed="' + (i === st.ico) + '">' + i + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="mt-valor">Valor da meta</label><div class="money-in"><span>R$</span><input id="mt-valor" inputmode="decimal" value="' + (mt && mt.meta ? fmtInput(mt.meta) : '') + '" placeholder="0,00"></div></div>' +
      '<div class="field"><label for="mt-mes">Prazo</label>' + seletorMes('mt-mes', 'mt-ano', mt ? mt.mes : FL.addMeses(mesHoje(), 6), true, 6) + '<div class="hint">Com o prazo, o app calcula quanto guardar por mês' + (escopo === 'casal' ? ' e a parte de cada um (pela mesma divisão do casal)' : '') + '.</div></div>' +
      '<div class="err" id="mt-err" hidden></div><button class="btn block" type="submit">' + (editar ? 'Salvar' : 'Criar meta') + '</button>' +
      (editar && mt.id !== 'viagem' ? '<button class="btn danger" type="button" id="mt-del">Excluir meta</button>' : '') + '</form>';
    abrirModal(editar ? 'Editar meta' : (escopo === 'casal' ? 'Nova meta do casal' : 'Nova meta pessoal'), corpo, (el) => {
      $('#mt-icos', el).addEventListener('click', (e) => {
        const b = e.target.closest('button[data-ico]'); if (!b) return;
        st.ico = b.dataset.ico; $$('#mt-icos button', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      const ref = () => {
        if (editar && mt.id === 'viagem') return S.db.doc('config/viagem');
        const col = escopo === 'casal' ? S.db.collection('metas') : S.db.collection('usuarios/' + S.uid + '/metas');
        return editar ? col.doc(mt.id) : col.doc();
      };
      $('#f-meta', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#mt-err', el);
        const nome = $('#mt-nome', el).value.trim();
        const valor = FL.parseValor($('#mt-valor', el).value);
        const mm = $('#mt-mes', el).value, aa = $('#mt-ano', el).value;
        if (!nome) { err.hidden = false; err.textContent = 'Dê um nome à meta.'; return; }
        if (!(valor > 0)) { err.hidden = false; err.textContent = 'Informe o valor da meta.'; return; }
        if (!!mm !== !!aa) { err.hidden = false; err.textContent = 'Escolha mês e ano do prazo (ou deixe os dois em branco).'; return; }
        const mes = mm && aa ? aa + '-' + mm : null;
        const doc = editar && mt.id === 'viagem' ? { destino: nome, meta: valor, mes, atualizadoEm: Date.now(), por: S.uid } : { nome, ico: st.ico, meta: valor, mes, ativa: true, atualizadoEm: Date.now(), por: S.uid };
        const r = ref();
        const ok = await escrever(() => (editar && mt.id !== 'viagem' ? r.update(doc) : r.set(editar ? doc : Object.assign(doc, { criadoEm: Date.now() }))), editar ? 'Meta atualizada' : 'Meta criada');
        if (ok) { fecharModal(); agendarSync(); if (!editar) location.hash = 'metas'; }
      });
      const d = $('#mt-del', el);
      if (d) d.addEventListener('click', async () => {
        if (!d.dataset.armed) { d.dataset.armed = '1'; d.textContent = 'Toque de novo: a meta some e as movimentações dela deixam de contar'; return; }
        d.disabled = true;
        if (await escrever(() => ref().delete(), 'Meta excluída')) { fecharModal(); agendarSync(); }
      });
    });
  }

  function verMovs(mt) {
    const movs = movsDe(mt).slice().sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm || 0) - (a.criadoEm || 0));
    abrirModal(mt.ico + ' ' + mt.nome, '<div class="list">' + movs.map((x) => {
      const p = mt.escopo === 'casal' ? pessoa(x.autor) : pessoa(S.uid);
      const ret = x.tipo === 'retirada';
      return '<div class="item" role="button" tabindex="0" data-act="mov-abrir" data-id="' + esc(x.id) + '" data-meta="' + esc(mt.id) + '" data-esc="' + mt.escopo + '"><span class="ico">' + (ret ? '↩️' : '🐷') + '<span class="dot" style="background:' + esc(p.cor) + '"></span></span>' +
        '<div style="min-width:0"><div class="t">' + (ret ? 'Retirada' : 'Guardou') + ' · ' + esc(p.nome) + '</div><div class="s">' + esc(dataCurta(x.data) + (x.obs ? ' · ' + x.obs : '')) + '</div></div>' +
        '<span class="r"><span class="val ' + (ret ? 'neg' : 'pos') + '">' + (ret ? '−' : '+') + ' ' + fmt(x.valor) + '</span></span></div>';
    }).join('') + '</div>');
  }

  function formMov(tipo, item, mt) {
    const editar = !!item;
    if (editar && mt.escopo === 'casal' && item.autor !== S.uid) {
      const p = pessoa(item.autor);
      return abrirModal('Movimentação', '<div class="who">' + avatar(p) + '<div><div class="name">' + (item.tipo === 'retirada' ? 'Retirada' : 'Guardou') + ' ' + fmt(item.valor) + '</div><div class="sub">' + esc(p.nome) + ' · ' + esc(dataCurta(item.data)) + '</div></div></div>' + (item.obs ? '<p class="sub" style="margin:0">' + esc(item.obs) + '</p>' : '') + '<div class="note">Só ' + esc(p.nome) + ' pode alterar esta movimentação.</div>');
    }
    tipo = (item && item.tipo) || tipo || 'deposito';
    const lista = todasMetas();
    const corpo = '<form id="f-mov" class="field" style="gap:14px" novalidate>' +
      (editar ? '' : '<div class="field"><label for="m-meta">Meta</label><select class="input" id="m-meta">' + lista.map((x) => '<option value="' + x.escopo + ':' + esc(x.id) + '"' + (mt && mt.id === x.id && mt.escopo === x.escopo ? ' selected' : '') + '>' + esc(x.ico + ' ' + x.nome + (x.escopo === 'meu' ? ' (minha)' : '')) + '</option>').join('') + '</select></div>') +
      '<div class="field"><span>Movimento</span>' + seg('mt', [['deposito', 'Guardar'], ['retirada', 'Retirar']], tipo) + '</div>' +
      '<div class="field"><label for="m-valor">Valor</label><div class="money-in"><span>R$</span><input id="m-valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + (item ? fmtInput(item.valor) : '') + '"></div></div>' +
      '<div class="two"><div class="field"><label for="m-data">Data</label><input class="input" type="date" id="m-data" value="' + esc(item ? item.data : hojeISO()) + '"></div>' +
      '<div class="field"><label for="m-obs">Observação</label><input class="input" id="m-obs" maxlength="60" placeholder="Opcional" value="' + esc(item ? item.obs || '' : '') + '"></div></div>' +
      '<div class="err" id="m-err" hidden></div><button class="btn block" type="submit">' + (editar ? 'Salvar' : 'Confirmar') + '</button>' +
      (editar ? '<button class="btn danger" type="button" id="m-del">Excluir</button>' : '') + '</form>';
    abrirModal(editar ? 'Editar movimentação' : 'Guardar ou retirar', corpo, (el) => {
      const f = $('#f-mov', el);
      const alvo = () => {
        if (editar) return mt;
        const [esc2, id] = $('#m-meta', el).value.split(':');
        return acharMeta(id, esc2);
      };
      const colDe = (m2) => (m2.escopo === 'casal' ? S.db.collection('cofrinho') : S.db.collection('usuarios/' + S.uid + '/metasMov'));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const valor = FL.parseValor($('#m-valor', el).value);
        const data = $('#m-data', el).value;
        const err = $('#m-err', el);
        const m2 = alvo();
        if (!m2) { err.hidden = false; err.textContent = 'Crie uma meta primeiro.'; return; }
        if (!(valor > 0)) { err.hidden = false; err.textContent = 'Informe um valor maior que zero.'; return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { err.hidden = false; err.textContent = 'Escolha a data.'; return; }
        const doc = { tipo: radio(f, 'mt'), valor, data, mes: FL.mesDe(data), obs: $('#m-obs', el).value.trim(), autor: S.uid, metaId: m2.id };
        const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
        const ok = editar
          ? await escrever(() => colDe(m2).doc(item.id).update(doc), 'Movimentação atualizada')
          : await escrever(() => colDe(m2).add(Object.assign(doc, { criadoEm: Date.now() })), doc.tipo === 'retirada' ? 'Retirada registrada' : 'Guardado em ' + m2.nome);
        if (ok) { fecharModal(); agendarSync(); } else btn.disabled = false;
      });
      const d = $('#m-del', el);
      if (d) d.addEventListener('click', async () => {
        if (!d.dataset.armed) { d.dataset.armed = '1'; d.textContent = 'Toque de novo para excluir'; return; }
        d.disabled = true;
        if (await escrever(() => colDe(mt).doc(item.id).delete(), 'Movimentação excluída')) { fecharModal(); agendarSync(); }
      });
    });
  }

  /* ---------- busca ---------- */
  function viewBusca() {
    const b = S.busca;
    const opt = (v, n, cur) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(n) + '</option>';
    return '<div class="sec-head"><h2>Buscar lançamentos</h2><button class="link" type="button" data-act="busca-limpar" id="busca-limpar"' + (buscaMudou() ? '' : ' hidden') + '>Limpar</button></div>' +
      '<section class="card"><form id="f-busca" class="field" style="gap:10px" novalidate onsubmit="return false">' +
      '<div class="busca-q"><input class="input" type="search" id="busca-q" placeholder="Buscar por descrição, categoria ou valor" value="' + esc(b.q) + '" autocomplete="off" enterkeyhint="search"></div>' +
      '<div class="busca-f">' +
      '<select class="input" id="bf-onde" aria-label="Onde">' + opt('tudo', 'Meus e do casal', b.onde) + opt('meu', 'Só meus', b.onde) + opt('casal', 'Só do casal', b.onde) + '</select>' +
      '<select class="input" id="bf-periodo" aria-label="Período">' + opt('mes', 'Só este mês', b.periodo) + opt('3', '3 meses', b.periodo) + opt('12', '12 meses', b.periodo) + opt('tudo', 'Tudo', b.periodo) + '</select>' +
      '<select class="input" id="bf-status" aria-label="Situação">' + opt('todas', 'Pagas e a pagar', b.status) + opt('pendente', 'Só em aberto', b.status) + opt('pago', 'Só pagas', b.status) + '</select>' +
      '<select class="input" id="bf-tipo" aria-label="Tipo">' + opt('todos', 'Tudo', b.tipo) + opt('despesa', 'Despesas', b.tipo) + opt('receita', 'Receitas', b.tipo) + '</select>' +
      '<select class="input" id="bf-cat" aria-label="Categoria">' + opt('', 'Categoria', b.cat) + catalogo().grupos.map((g) => '<optgroup label="' + esc(g.nome) + '">' + catalogo().cats.filter((c) => c.grupo === g.id).map((c) => opt(c.id, c.ico + ' ' + c.nome, b.cat)).join('') + '</optgroup>').join('') + '</select>' +
      '<select class="input" id="bf-pag" aria-label="Pagamento">' + opt('', 'Pagamento', b.pag) + PAGS.map(([k, n]) => opt(k, n, b.pag)).join('') + S.cartoes.map((c) => opt('c:' + c.id, '💳 ' + c.nome, b.pag)).join('') + '</select>' +
      '</div></form></section><div id="busca-res">' + resultadosBusca() + '</div>';
  }
  function buscaMudou() { const b = S.busca; return !!(b.onde !== 'tudo' || b.periodo !== '12' || b.status !== 'todas' || b.tipo !== 'todos' || b.cat || b.pag || b.q); }
  function resultadosBusca() {
    const b = S.busca;
    const q = FL.normalizar(b.q);
    const ini = b.periodo === 'mes' ? S.mes : b.periodo === '3' ? FL.addMeses(S.mes, -2) : b.periodo === '12' ? FL.addMeses(S.mes, -11) : '0000-00';
    const fim = b.periodo === 'tudo' ? '9999-99' : S.mes;
    const fonte = (b.onde !== 'casal' ? S.meus.map((l) => ({ l, src: 'meu' })) : []).concat(b.onde !== 'meu' ? S.conj.map((l) => ({ l, src: 'conj' })) : []);
    const res = fonte.filter(({ l }) => {
      if (l.mes < ini || l.mes > fim) return false;
      if (b.status !== 'todas' && (l.status === 'pendente' ? 'pendente' : 'pago') !== b.status) return false;
      if (b.tipo !== 'todos' && (l.tipo === 'receita' ? 'receita' : 'despesa') !== b.tipo) return false;
      if (b.cat && l.cat !== b.cat) return false;
      if (b.pag) { if (b.pag.startsWith('c:')) { if (l.cartaoId !== b.pag.slice(2)) return false; } else if ((l.pag || '') !== b.pag) return false; }
      if (q) {
        const alvo = FL.normalizar(l.desc + ' ' + cat(l.cat).nome + ' ' + fmtInput(l.valor) + ' ' + String(l.valor));
        if (!q.split(/\s+/).every((p) => alvo.includes(p))) return false;
      }
      return true;
    }).sort((a, z) => z.l.mes.localeCompare(a.l.mes) || z.l.data.localeCompare(a.l.data));
    if (!res.length) return '<section class="card"><div class="empty">Nada encontrado com esses filtros.</div></section>';
    const desp = FL.r2(res.filter((x) => x.l.tipo !== 'receita').reduce((t, x) => t + x.l.valor, 0));
    const rec = FL.r2(res.filter((x) => x.l.tipo === 'receita').reduce((t, x) => t + x.l.valor, 0));
    let h = '<section class="card"><div class="stats"><div class="stat"><span class="k">Encontrados</span><span class="v">' + res.length + '</span></div><div class="stat"><span class="k">Despesas</span><span class="v neg">' + fmt(desp) + '</span></div><div class="stat"><span class="k">Receitas</span><span class="v pos">' + fmt(rec) + '</span></div></div></section>';
    const porMes = {};
    res.slice(0, 400).forEach((x) => { (porMes[x.l.mes] = porMes[x.l.mes] || []).push(x); });
    h += Object.keys(porMes).sort().reverse().map((mm) => {
      const xs = porMes[mm];
      const t = FL.r2(xs.reduce((s, x) => s + (x.l.tipo === 'receita' ? x.l.valor : -x.l.valor), 0));
      return '<section class="card"><div class="card-head"><h2>' + esc(nomeMes(mm)) + '</h2><span class="sub">' + xs.length + ' · ' + (t >= 0 ? '+' : '−') + ' ' + fmt(Math.abs(t)) + '</span></div><div class="list">' + xs.map((x) => itemHTML(x.l, x.src, true)).join('') + '</div></section>';
    }).join('');
    if (res.length > 400) h += '<div class="hint">Mostrando os 400 mais recentes. Use os filtros para refinar.</div>';
    return h;
  }
  function montarBusca() {
    const f = $('#f-busca');
    if (!f || f.dataset.ok) return;
    f.dataset.ok = '1';
    const ler = () => {
      Object.assign(S.busca, { q: $('#busca-q').value, onde: $('#bf-onde').value, periodo: $('#bf-periodo').value, status: $('#bf-status').value, tipo: $('#bf-tipo').value, cat: $('#bf-cat').value, pag: $('#bf-pag').value });
      $('#busca-res').innerHTML = resultadosBusca();
      $('#busca-limpar').hidden = !buscaMudou();
    };
    let t = 0;
    f.addEventListener('input', () => { clearTimeout(t); t = setTimeout(ler, 150); });
    f.addEventListener('change', ler);
    if (!S.busca.q && window.matchMedia('(min-width: 640px)').matches) $('#busca-q').focus();
  }

  /* ---------- lançamento rápido por texto ou voz ---------- */
  let rapidoDrafts = [];
  function ctxRapido() { return { hoje: hojeISO(), cats: catalogo().cats, cartoes: S.cartoes }; }
  function chipsDraft(d) {
    const c = cat(d.cat);
    const k = d.pag === 'cartao' ? cartaoDe(d.cartaoId) : null;
    const partes = [d.destino === 'casal' ? '👥 casal' : '🔒 meu', d.tipo === 'receita' ? 'receita' : null, d.data === hojeISO() ? 'hoje' : dataCurta(d.data).slice(0, 5),
      k ? '💳 ' + k.nome + (d.cartaoIncerto ? '?' : '') : d.pag ? (PAGS.find((p) => p[0] === d.pag) || [0, d.pag])[1] : null,
      d.parcelas > 1 ? d.parcelas + '×' : null, d.status === 'pendente' ? 'a pagar' : null].filter(Boolean);
    return '<div class="rd-item' + (d.erro ? ' erro' : '') + '"><span class="ico">' + c.ico + '</span><div style="min-width:0"><div class="t">' + esc(d.desc || c.nome) + '</div><div class="s">' + esc(c.nome) + ' · ' + esc(partes.join(' · ')) + '</div>' + (d.erro ? '<div class="err">' + esc(d.erro) + ' — toque em Editar.</div>' : '') + '</div>' +
      '<span class="r"><span class="val ' + (d.tipo === 'receita' ? 'pos' : '') + '">' + (d.valor ? fmt(d.valor) : '—') + '</span></span></div>';
  }
  function desenharDrafts(el) {
    const box = $('#rp-lista', el);
    const ok = rapidoDrafts.filter((d) => !d.erro);
    box.innerHTML = rapidoDrafts.length ? rapidoDrafts.map((d, i) => '<div class="rd-wrap">' + chipsDraft(d) + '<div class="rd-acts"><button class="link" type="button" data-act="rp-editar" data-i="' + i + '">Editar</button><button class="link" type="button" data-act="rp-tirar" data-i="' + i + '">Remover</button></div></div>').join('') +
      (ok.length ? '<button class="btn block" type="button" id="rp-lancar">Lançar ' + (ok.length === 1 ? 'este' : 'os ' + ok.length) + '</button>' : '') : '';
    const b = $('#rp-lancar', el);
    if (b) b.addEventListener('click', async () => {
      b.disabled = true;
      let n = 0;
      for (const d of rapidoDrafts.filter((x) => !x.erro)) { b.textContent = 'Lançando ' + (n + 1) + '/' + ok.length + '…'; if (await salvarRascunho(d)) n++; else break; }
      rapidoDrafts = [];
      fecharModal(); agendarSync(); render();
      toast(n === 1 ? 'Lançado' : n + ' lançamentos criados');
    });
  }
  async function salvarRascunho(d) {
    const casalD = d.destino === 'casal';
    const tipo = casalD ? 'despesa' : d.tipo;
    const coll = casalD ? S.db.collection('conjunto') : meusCol();
    const usaCartao = tipo !== 'receita' && d.pag === 'cartao' && cartaoDe(d.cartaoId);
    const serie = FL.gerarSerie(d.valor, d.parcelas || 1, d.parcelas > 1 ? 'parcelada' : 'unica', d.data);
    const grupo = serie.length > 1 ? 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : null;
    let ok = true;
    for (let i = 0; i < serie.length && ok; i++) {
      const it = serie[i];
      let doc = { kind: 'lanc', tipo, desc: d.desc || cat(d.cat).nome, valor: it.valor, cat: d.cat, data: it.data, mes: FL.mesDe(it.data), status: i === 0 ? d.status : 'pendente', parcela: it.parcela, grupo, autor: S.uid, criadoEm: Date.now(), pag: tipo === 'receita' ? null : (d.pag || null), cartaoId: null, divisao: casalD ? 'padrao' : null };
      if (usaCartao) { doc = noCartao(doc, d.data, d.cartaoId, i); doc.status = 'pendente'; }
      ok = await escrever(() => coll.add(doc));
    }
    return ok;
  }
  function formRapido(manter) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const corpo = '<div class="field" style="gap:10px"><label for="rp-texto" class="sub">Escreva ou fale como você falaria. Dá para lançar vários de uma vez.</label>' +
      '<textarea class="input" id="rp-texto" rows="3" placeholder="mercado 230 casal&#10;uber 25 ontem e ifood 48,90 no pix&#10;tênis 600 em 3x no cartão&#10;recebi salário 5 mil dia 5"></textarea>' +
      '<div class="btn-row">' + (SR ? '<button class="btn ghost" type="button" id="rp-mic">🎙️ Falar</button>' : '') + '<button class="btn" type="button" id="rp-ler">Interpretar</button></div>' +
      (SR ? '' : '<div class="hint">Para ditar, use o microfone do teclado do celular.</div>') +
      '<div id="rp-lista" class="rd-lista"></div></div>';
    abrirModal('⚡ Lançamento rápido', corpo, (el) => {
      const inp = $('#rp-texto', el);
      const ler = () => { rapidoDrafts = FL.interpretar(inp.value, ctxRapido()); desenharDrafts(el); };
      $('#rp-ler', el).addEventListener('click', ler);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ler(); } });
      if (manter && rapidoDrafts.length) desenharDrafts(el); else rapidoDrafts = [];
      const mic = $('#rp-mic', el);
      let rec = null;
      if (mic) mic.addEventListener('click', () => {
        if (rec) { rec.stop(); return; }
        try { rec = new SR(); } catch (e) { toast('Ditado não disponível. Use o microfone do teclado.'); return; }
        rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = false;
        const base = inp.value.trim() ? inp.value.trim() + '\n' : '';
        rec.onresult = (e) => { let txt = ''; for (const r of e.results) txt += r[0].transcript; inp.value = base + txt; };
        rec.onerror = (e) => { toast(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Permita o uso do microfone para ditar.' : 'Não consegui ouvir. Tente de novo.'); };
        rec.onend = () => { rec = null; mic.textContent = '🎙️ Falar'; mic.classList.remove('gravando'); if (inp.value.trim()) ler(); };
        mic.textContent = '● Ouvindo… toque para parar'; mic.classList.add('gravando');
        try { rec.start(); } catch (e) { rec = null; mic.textContent = '🎙️ Falar'; mic.classList.remove('gravando'); }
      });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act^="rp-"]'); if (!b) return;
        e.stopPropagation();
        const i = +b.dataset.i;
        if (b.dataset.act === 'rp-tirar') { rapidoDrafts.splice(i, 1); desenharDrafts(el); }
        else if (b.dataset.act === 'rp-editar') {
          const d = rapidoDrafts.splice(i, 1)[0];
          d._rapido = true;
          formLanc(d.destino === 'casal' ? 'conj' : 'meu', null, d);
        }
      }, true);
    });
  }
  const botaoRapido = () => (S.canWrite !== false ? '<button class="quick" type="button" data-act="rapido"><span>⚡</span><span>Lançar rápido: “mercado 230 casal”, “uber 25 ontem”…</span><span class="mic">🎙️</span></button>' : '');

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
      if (l.estimado && l.status === 'pendente') return formConfirmarValor(l, src);
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
    else if (act === 'mov-novo') formMov(el.dataset.tipo, null, acharMeta(el.dataset.id, el.dataset.esc));
    else if (act === 'mov-abrir') { const mt = acharMeta(el.dataset.meta, el.dataset.esc); const x = mt && movsDe(mt).find((y) => y.id === el.dataset.id); if (x) formMov(null, x, mt); }
    else if (act === 'movs-ver') { const mt = acharMeta(el.dataset.id, el.dataset.esc); if (mt) verMovs(mt); }
    else if (act === 'meta-nova') formMeta(el.dataset.esc);
    else if (act === 'meta-editar') { const mt = acharMeta(el.dataset.id, el.dataset.esc); if (mt) formMeta(el.dataset.esc, mt); }
    else if (act === 'rapido') formRapido(false);
    else if (act === 'busca-limpar') { S.busca = { q: '', onde: 'tudo', periodo: '12', status: 'todas', tipo: 'todos', cat: '', pag: '' }; $('#main').innerHTML = ''; render(); }
    else if (act === 'config') formConfig();
    else if (act === 'limites') formLimites(el.dataset.esc);
    else if (act === 'cartao-novo') formCartao(null);
    else if (act === 'cartao-editar') { const c = cartaoDe(el.dataset.id); if (c) formCartao(c); }
    else if (act === 'fatura-ver') verFatura(el.dataset.id, el.dataset.mes);
    else if (act === 'fatura-pagar' || act === 'fatura-reabrir') { e.stopPropagation(); const noModal = !!el.closest('.sheet'); if (await pagarFatura(el.dataset.id, el.dataset.mes, act === 'fatura-pagar' ? 'pago' : 'pendente') && noModal) setTimeout(() => verFatura(el.dataset.id, el.dataset.mes), 400); }
    else if (act === 'categorias') formCategorias();
    else if (act === 'cat-editar') { const c = catalogo().cats.find((x) => x.id === el.dataset.id); if (c) formCategoria(c); }
    else if (act === 'cat-nova') formCategoria(null);
    else if (act === 'grupo-editar') { const g = catalogo().grupos.find((x) => x.id === el.dataset.id); if (g) formGrupo(g); }
    else if (act === 'grupo-novo') formGrupo(null);
    else if (act === 'fixa-nova') formFixa(el.dataset.esc);
    else if (act === 'fixa-abrir') { const f = acharFixa(el.dataset.esc === 'casal' ? 'conj' : 'meu', el.dataset.id); if (f) formFixa(el.dataset.esc, f); }
    else if (act === 'evo-quem') { S.evoQuem = el.dataset.v; S.evoSel = null; render(); }
    else if (act === 'evo-n') { S.evoN = +el.dataset.v; S.evoSel = null; render(); }
    else if (act === 'evo-sel') { S.evoSel = +el.dataset.i; render(); }
    else if (act === 'evo-modo') { S.evoModo = el.dataset.v; S.evoSel = null; if (S.evoModo === 'ano' && S.evoQuem !== 'casal') S.evoQuem = S.uid; render(); }
    else if (act === 'evo-ano') { S.evoAno = +el.dataset.v; render(); }
    else if (act === 'prev-var') { S.prevVar = !S.prevVar; render(); }
    else if (act === 'prev-renda') formRendaPrev(el.dataset.mes);
    else if (act === 'fechamento') relatorioMes(el.dataset.mes);
    else if (act === 'fech-dispensar') { lsSet('fech-' + el.dataset.mes, '1'); render(); }
    else if (act === 'copiar-relatorio') { try { await navigator.clipboard.writeText(textoRelatorio); toast('Resumo copiado'); } catch (x) { toast('Não consegui copiar neste aparelho.'); } }
    else if (act === 'ir-mes') { fecharModal(); S.mes = el.dataset.mes; location.hash = el.dataset.tab; render(); }
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
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });
  $('#fab').addEventListener('click', () => {
    if (S.aba === 'metas') { const l = todasMetas(); return l.length ? formMov('deposito', null, l[0]) : formMeta('casal'); }
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
      if (['meus', 'resumos', 'fixas', 'cartoes', 'limites', 'metasPess', 'movPess', 'metas', 'config', 'cofre'].includes(chave)) agendarSync();
      if (chave === 'meus' || chave === 'fixas' || chave === 'conj' || chave === 'fixasCasal' || chave === 'membros' || chave === 'cartoes') agendarFixas();
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
    Object.assign(S, { uid: null, email: '', meus: [], conj: [], cofre: [], membros: {}, resumos: {}, cfgCasal: {}, viagem: null, acertos: {}, fixas: [], fixasCasal: [], limites: {}, limitesCasal: {}, cartoes: [], catalogo: null, rendaPrev: {}, metas: [], metasPess: [], movPess: [], evoSel: null, got: {}, firm: {}, timeout: false });
    reindexarCats();
    tentados.clear();
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
    ouvir(db.collection('config'), 'config', (s) => { S.cfgCasal = {}; S.viagem = null; S.limitesCasal = {}; S.catalogo = null; s.docs.forEach((d) => { if (d.id === 'casal') S.cfgCasal = d.data(); if (d.id === 'viagem') S.viagem = d.data(); if (d.id === 'limitesCasal') S.limitesCasal = d.data().limites || {}; if (d.id === 'categorias') S.catalogo = d.data(); }); reindexarCats(); });
    ouvir(fixasCol(), 'fixas', (s) => { S.fixas = lista(s); });
    ouvir(db.collection('metas'), 'metas', (s) => { S.metas = lista(s).sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0)); });
    ouvir(db.collection('usuarios/' + S.uid + '/metas'), 'metasPess', (s) => { S.metasPess = lista(s).sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0)); });
    ouvir(db.collection('usuarios/' + S.uid + '/metasMov'), 'movPess', (s) => { S.movPess = lista(s).filter((x) => x.mes && x.data); });
    ouvir(db.collection('usuarios/' + S.uid + '/cartoes'), 'cartoes', (s) => { S.cartoes = lista(s).sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0)); });
    ouvir(db.collection('fixasCasal'), 'fixasCasal', (s) => { S.fixasCasal = lista(s); });
    ouvir(db.collection('usuarios/' + S.uid + '/config'), 'limites', (s) => { S.limites = {}; S.rendaPrev = {}; s.docs.forEach((d) => { if (d.id === 'limites') S.limites = d.data().limites || {}; if (d.id === 'previsao') S.rendaPrev = d.data().renda || {}; }); });
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
