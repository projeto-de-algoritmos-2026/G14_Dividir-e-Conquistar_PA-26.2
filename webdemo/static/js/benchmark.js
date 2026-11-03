// Tela Benchmark, em tres paginas: Trabalho 1, Trabalho 2 e Juntos.
//
// So desenha o snapshot (webdemo/dados/benchmark.json), que vem dos CSVs
// consolidados de bench/out. NENHUM numero e calculado ou estimado aqui, e cada
// bloco diz de onde veio. O protótipo tinha numeros ilustrativos no T2 e
// "paradas estimadas" em Juntos; o dado real contraria as duas coisas, e a tela
// mostra o que foi medido.

import { estado } from "./estado.js";

const $ = (s) => document.querySelector(s);

const ALGS = [["dfs", "DFS", "#f07178"], ["bfs", "BFS", "#4fd1b0"], ["dijkstra", "Dijkstra", "#8fb0ff"]];
const ESTR = [
  ["todo_centro", "Todo centro", "#8a97a8"],
  ["limiar_50", "Limiar 50%", "#e7c66b"],
  ["limiar_25", "Limiar 25%", "#efb86a"],
  ["limiar_10", "Limiar 10%", "#ef9a6a"],
  ["guloso", "Guloso", "#12b7a3"],
  ["otimo", "Ótimo (ref.)", "#cfd8e3"],
];
const NOME_ALCANCE = { curto: "Curto (30% da rota)", medio: "Médio (50%)", longo: "Longo (75%)" };

const fmt = (v, d = 1) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v) => `${fmt(v * 100, 0)}%`;

export function criarTelaBenchmark() {
  const Q = { pagina: "t1", size: 15, alcance: "medio" };

  const procedencia = (b) => `medido em ${b.commit || "?"}, ${String(b.gerado_em || "").slice(0, 10)}`;

  // Cartao de metrica: barras horizontais; "melhor" so quando a metrica distingue.
  // `excluir`: estrategias que falham e nao entram no destaque de "melhor".
  function cartao(titulo, nota, linhas, melhor, casas = 1, excluir = []) {
    const max = Math.max(...linhas.map((l) => l.v), 1e-9);
    const candidatos = linhas.filter((l) => !excluir.includes(l.k)).map((l) => l.v);
    const alvo = !melhor || !candidatos.length ? null : melhor === "min" ? Math.min(...candidatos) : Math.max(...candidatos);
    const barras = linhas.map((l) => {
      const ganhou = alvo !== null && l.v === alvo && !excluir.includes(l.k);
      return `<div class="bar${ganhou ? " best" : ""}"><span class="nm" title="${l.nome}">${l.nome}</span><span class="track"><i class="fill" data-w="${(l.v / max * 100).toFixed(1)}" style="background:${l.cor}"></i></span><span class="val">${l.texto ?? fmt(l.v, casas)}${ganhou ? "<em>melhor</em>" : ""}</span></div>`;
    }).join("");
    return `<div class="metric"><div class="mt">${titulo}${nota ? `<small>${nota}</small>` : ""}</div>${barras}</div>`;
  }

  const t1 = (b) => Object.fromEntries(b.t1.rota.map((r) => [`${r.algoritmo}-${r.tamanho}`, r]));
  const t1p = (b) => Object.fromEntries(b.t1.partida.map((r) => [`${r.algoritmo}-${r.tamanho}`, r]));

  function paginaT1(b) {
    const rota = t1(b);
    const part = t1p(b);
    const linhas = (tab, campo) => ALGS.map(([k, nome, cor]) => ({ k, nome, cor, v: tab[`${k}-${Q.size}`][campo] }));
    const rotas = [
      ["Custo médio", "menor paga menos", "custo_medio", "min"],
      ["Passos médios", "", "passos_medio", "min"],
      ["Nós expandidos", "esforço, não tempo", "nos_expandidos_medio", "min"],
    ].map(([t, n, c, m]) => cartao(t, n, linhas(rota, c), m)).join("");
    const partidas = [
      ["Objetivos", "mais é melhor", "objetivos_medio", "max"],
      ["Passos", "ler junto com objetivos", "passos_medio", null],
      ["Batalhas", "não distingue", "batalhas_medio", null],
      ["HP perdido", "não distingue", "hp_perdido_medio", null],
    ].map(([t, n, c, m]) => cartao(t, n, linhas(part, c), m)).join("");
    const bfs = rota[`bfs-${Q.size}`];
    const dij = rota[`dijkstra-${Q.size}`];
    return `<div class="bn-group"><h3>Rota pura <span class="prov real">real · ${procedencia(b)} · ${b.t1.filtro_rota}</span></h3><div class="bn-row c3">${rotas}</div></div>
      <div class="bn-group"><h3>Partida completa <span class="prov real">real · ${procedencia(b)}</span></h3><div class="bn-row c4">${partidas}</div></div>
      <div class="tese-bn">Em ${Q.size}×${Q.size}: o BFS anda <b>${fmt(bfs.passos_medio)}</b> passos e paga <b>${fmt(bfs.custo_medio)}</b>; o Dijkstra anda <b>${fmt(dij.passos_medio)}</b> e paga <b>${fmt(dij.custo_medio)}</b>. <b>Menos passos não é menor custo.</b></div>`;
  }

  function linhasT2(b) {
    // o snapshot traz uma linha por (tamanho, alcance, algoritmo, estrategia); a
    // pagina mostra o Dijkstra, a rota do Trabalho 1 que o guloso recebe
    return b.t2.linhas.filter((l) => l.tamanho === Q.size && l.alcance === Q.alcance && l.algoritmo === "dijkstra");
  }

  function paginaT2(b) {
    const dados = Object.fromEntries(linhasT2(b).map((l) => [l.estrategia, l]));
    const lin = (campo, conv = (x) => x) => ESTR.filter(([k]) => dados[k]).map(([k, nome, cor]) => ({ k, nome, cor, v: conv(dados[k][campo]) }));
    const falham = ESTR.map(([k]) => k).filter((k) => dados[k] && dados[k].taxa_desmaio > 0.05);
    const alguma = dados.guloso;
    const inviaveis = alguma ? alguma.taxa_inviavel : 0;
    const execs = alguma ? alguma.execucoes : 0;
    const cards = [
      cartao("Paradas médias", "menos é melhor (quem desmaia não conta)", lin("paradas_medio"), "min", 2, falham),
      cartao("Desmaios", "% das rotas", lin("taxa_desmaio", (x) => x * 100).map((l) => ({ ...l, texto: pct(l.v / 100) })), "min", 0),
      cartao("Energia desperdiçada", "ao recarregar (quem desmaia não conta)", lin("energia_desperdicada_medio"), "min", 1, falham),
    ].join("");
    return `<div class="bn-group"><h3>Guloso e rivais <span class="prov real">real · ${procedencia(b)} · ${NOME_ALCANCE[Q.alcance]}</span></h3><div class="bn-row c3">${cards}</div></div>
      <div class="tese-bn">Grade herdada do T1: tamanhos 8, 15 e 30, 30 seeds, alcance em 3 níveis. A rota vem do Dijkstra do T1 e o <b>guloso só escolhe onde parar</b>. Em ${Q.size}×${Q.size} com alcance ${Q.alcance}, <b>${pct(inviaveis)}</b> das rotas sequer têm solução (foram descartadas; as médias contam as ${execs} que têm). Quem desmaia (${falham.map((k) => ESTR.find((e) => e[0] === k)[1]).join(", ") || "ninguém"}) não entra no "melhor". Guloso e ótimo têm as mesmas paradas em todos os pares medidos.</div>`;
  }

  function paginaJuntos(b) {
    const linhas = b.t2.cruzamento.filter((c) => c.tamanho === Q.size);
    const rota = t1(b);
    const custos = cartao("Custo médio da rota", "Trabalho 1 · real", ALGS.map(([k, nome, cor]) => ({ k, nome, cor, v: rota[`${k}-${Q.size}`].custo_medio })), "min", 1);
    const corpo = ["curto", "medio", "longo"].map((a) => {
      const c = linhas.find((x) => x.alcance === a);
      if (!c) return "";
      const destaque = a === Q.alcance ? ' style="background:rgba(18,183,163,.07)"' : "";
      return `<tr${destaque}><td>${NOME_ALCANCE[a]}</td><td>${c.destinos_comparados}</td><td class="g">${c.dijkstra_menos_paradas}</td><td>${c.empates}</td><td class="x">${c.dijkstra_mais_paradas}</td></tr>`;
    }).join("");
    const tabela = `<div class="metric"><div class="mt">Paradas do guloso: Dijkstra contra DFS e BFS<small>Trabalho 2 · real · mesmos destinos</small></div>
      <table class="mtx"><thead><tr><th>Alcance</th><th>Destinos</th><th>Dijkstra menos</th><th>Empate</th><th>Dijkstra mais</th></tr></thead><tbody>${corpo}</tbody></table></div>`;
    const total = linhas.reduce((s, c) => s + c.destinos_comparados, 0);
    const menos = linhas.reduce((s, c) => s + c.dijkstra_menos_paradas, 0);
    const mais = linhas.reduce((s, c) => s + c.dijkstra_mais_paradas, 0);
    const porTamanho = ["8", "15", "30"].map((t) => {
      const cs = b.t2.cruzamento.filter((c) => c.tamanho === Number(t));
      return `${t}×${t}: ${cs.reduce((s, c) => s + c.dijkstra_menos_paradas, 0)} de ${cs.reduce((s, c) => s + c.destinos_comparados, 0)}`;
    }).join("; ");
    return `<div class="bn-group"><h3>Do T1 ao T2 <span class="prov real">custos reais</span> <span class="prov real">paradas medidas · ${procedencia(b)}</span></h3><div class="bn-row c2">${custos}${tabela}</div></div>
      <div class="tese-bn">A rota mais barata do T1 <b>pode</b> precisar de menos paradas no T2, mas o medido é modesto: em ${Q.size}×${Q.size}, o Dijkstra precisou de menos paradas em <b>${menos}</b> de ${total} destinos, empatou no resto e <b>${mais === 0 ? "nunca precisou de mais" : `precisou de mais em ${mais}`}</b>. Destinos em que o Dijkstra precisou de menos paradas, por mapa: ${porTamanho}. Três tamanhos não provam uma tendência; é o que a grade mediu.</div>`;
  }

  // Trabalho 3: grafico desenhado aqui em SVG a partir de bench/out/selecao_resumo.csv
  // (medias de 3 seeds por entrada, algoritmo e n). Nada e calculado alem de leitura do CSV.
  const T3 = { dados: null, erro: null, entrada: "aleatoria", medida: "comp" };
  const T3_SERIES = [
    ["mediana_medianas", "Mediana das medianas", "#12b7a3", 3.6],
    ["ordenar", "Ordenar (Python)", "#f2b84b", 2],
    ["quickselect_aleatorio", "Quickselect aleatório", "#7aa2f7", 2],
    ["quickselect_ingenuo", "Quickselect ingênuo", "#ef6a6a", 2],
  ];
  const T3_ENTRADAS = [["aleatoria", "Aleatória"], ["niveis", "Níveis do jogo"], ["adversaria", "Lista azarada"]];
  const T3_MEDIDAS = [["comp", "Comparações por número"], ["tempo", "Tempo (ms)"]];
  const T3_NS = [1000, 3000, 10000, 30000, 100000, 300000, 1000000];

  function lerCsvT3(texto) {
    const [cab, ...linhas] = texto.trim().split(/\r?\n/);
    const col = cab.split(",");
    const d = {};
    for (const l of linhas) {
      const c = l.split(",");
      const r = Object.fromEntries(col.map((k, i) => [k, c[i]]));
      ((d[r.distribuicao] ??= {})[r.algoritmo] ??= {})[Number(r.n)] = {
        tempo: Number(r.tempo_ms_medio), comp: Number(r.comparacoes_por_n), compTotal: Number(r.comparacoes_medio),
      };
    }
    return d;
  }

  function cartoesT3(d) {
    const g = (e, a, n) => d[e]?.[a]?.[n];
    const ing = g("adversaria", "quickselect_ingenuo", 10000), mm = g("adversaria", "mediana_medianas", 10000);
    const ord = g("aleatoria", "ordenar", 1000000), mm1 = g("aleatoria", "mediana_medianas", 1000000);
    const tetoMM = Math.max(...Object.values(d).flatMap((e) => Object.values(e.mediana_medianas).map((x) => x.comp)));
    const L = (v) => Math.round(v).toLocaleString("pt-BR");
    const c = (num, leg) => `<div class="t3-card"><div class="t3-num">${num}</div><div class="t3-leg">${leg}</div></div>`;
    return c(`${L(ing.compTotal)} <i>x</i> ${L(mm.compTotal)}`, "comparações: quickselect ingênuo contra mediana das medianas, numa lista azarada de 10.000 números")
      + c(`~${Math.round(tetoMM)} <small>por número</small>`, "comparações da mediana das medianas, de mil a 1 milhão de números: não cresce")
      + c(`${L(ord.tempo)} ms <i>x</i> ${L(mm1.tempo)} ms`, "ordenar contra mediana das medianas, 1 milhão de números aleatórios: no relógio, ordenar ganha");
  }

  function paginaT3() {
    const seg = (id, itens, atual) => `<div class="seg t3-seg" id="${id}">${itens.map(([k, n]) => `<button data-k="${k}"${k === atual ? ' class="on"' : ""}>${n}</button>`).join("")}</div>`;
    const legenda = T3_SERIES.map(([, n, cor]) => `<span><i style="background:${cor}"></i>${n}</span>`).join("");
    return `<div class="t3">
      <div class="t3-cards" id="t3-cards"></div>
      <div class="t3-chart">
        <div class="t3-ctl"><label>Entrada</label>${seg("t3-entrada", T3_ENTRADAS, T3.entrada)}<label>Medida</label>${seg("t3-medida", T3_MEDIDAS, T3.medida)}<div class="t3-legenda">${legenda}</div></div>
        <div class="t3-plot" id="t3-plot"></div>
      </div>
      <div class="t3-fim"><b>Não é a mais rápida.</b> É a única que nunca degrada.</div>
    </div>`;
  }

  async function prepararT3() {
    if (!T3.dados && !T3.erro) {
      try {
        const r = await fetch("/bench/out/selecao_resumo.csv");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        T3.dados = lerCsvT3(await r.text());
      } catch (e) { T3.erro = String(e.message || e); }
    }
    if (Q.pagina !== "t3" || !$("#t3-plot")) return;
    if (T3.erro) { $("#t3-plot").innerHTML = `<div class="erro-tela">Sem dados do T3 (${T3.erro}).</div>`; return; }
    $("#t3-cards").innerHTML = cartoesT3(T3.dados);
    $("#t3-entrada").onclick = (e) => { const x = e.target.closest("button"); if (x) { T3.entrada = x.dataset.k; marcarT3(); } };
    $("#t3-medida").onclick = (e) => { const x = e.target.closest("button"); if (x) { T3.medida = x.dataset.k; marcarT3(); } };
    marcarT3();
  }

  function marcarT3() {
    for (const [id, v] of [["t3-entrada", T3.entrada], ["t3-medida", T3.medida]]) {
      document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle("on", x.dataset.k === v));
    }
    graficoT3();
  }

  const NS_ROT = { 1000: "1 mil", 10000: "10 mil", 100000: "100 mil", 1000000: "1 milhão" };

  function graficoT3() {
    const box = $("#t3-plot");
    if (!box || !T3.dados) return;
    const W = box.clientWidth, H = box.clientHeight;
    if (W < 50 || H < 50) return;
    const ent = T3.dados[T3.entrada];
    const campo = T3.medida;
    const temIng = T3.entrada === "adversaria";
    const log = campo === "tempo" || temIng;
    const m = { l: 62, r: 44, t: 12, b: 32 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const todos = T3_SERIES.flatMap(([k]) => Object.values(ent[k]).map((x) => x[campo]));
    const vmax = Math.max(...todos), vmin = Math.min(...todos);
    let y0, y1, ticks = [];
    if (log) {
      y0 = Math.floor(Math.log10(vmin)); y1 = Math.ceil(Math.log10(vmax));
      for (let e = y0; e <= y1; e++) ticks.push(10 ** e);
    } else {
      const passo = vmax > 16 ? 5 : 2;
      y0 = 0; y1 = Math.ceil(vmax / passo) * passo;
      for (let v = 0; v <= y1; v += passo) ticks.push(v);
    }
    const X = (n) => m.l + (Math.log10(n) - 3) / 3 * iw;
    const Y = (v) => m.t + ih - (log ? (Math.log10(v) - y0) / (y1 - y0) : (v - y0) / (y1 - y0)) * ih;
    const fv = (v) => (v >= 1000 ? v.toLocaleString("pt-BR") : v >= 10 ? String(Math.round(v)) : String(Number(v.toPrecision(2))).replace(".", ","));
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Seleção do k-ésimo: ${campo === "comp" ? "comparações por número" : "tempo em ms"} por tamanho da lista">`;
    for (const t of ticks) {
      svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="#243040" stroke-width="1"/><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end" fill="#8a97a8" font-size="12" font-family="var(--mono)">${fv(t)}</text>`;
    }
    for (const n of Object.keys(NS_ROT).map(Number)) {
      svg += `<line x1="${X(n)}" x2="${X(n)}" y1="${m.t}" y2="${m.t + ih}" stroke="#243040" stroke-width="1" stroke-dasharray="2 4"/><text x="${X(n)}" y="${H - 11}" text-anchor="middle" fill="#8a97a8" font-size="12.5">${NS_ROT[n]}</text>`;
    }
    let nota = "";
    const ordem = [...T3_SERIES].reverse();   // destaque por cima
    for (const [k, nome, cor, esp] of ordem) {
      const pts = T3_NS.filter((n) => ent[k][n]).map((n) => [X(n), Y(ent[k][n][campo]), n]);
      if (!pts.length) continue;
      svg += `<polyline fill="none" stroke="${cor}" stroke-width="${esp}" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}"/>`;
      for (const p of pts) svg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${esp > 3 ? 4 : 3}" fill="${cor}"/>`;
      if (k === "quickselect_ingenuo" && pts.length < T3_NS.length) {
        const u = pts[pts.length - 1];
        nota = `<circle cx="${u[0]}" cy="${u[1]}" r="8" fill="none" stroke="${cor}" stroke-width="1.5"/><text x="${u[0] + 14}" y="${u[1] + 4}" fill="${cor}" font-size="13" font-weight="700">parou: levaria ~7 h</text>`;
      }
    }
    svg += nota;
    svg += `<line id="t3-guia" y1="${m.t}" y2="${m.t + ih}" stroke="#8a97a8" stroke-width="1" opacity="0"/>`;
    svg += `<rect id="t3-hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
    box.innerHTML = svg;

    const tip = $("#tip"), guia = $("#t3-guia");
    const unidade = campo === "comp" ? "" : " ms";
    $("#t3-hit").onmousemove = (ev) => {
      const r = box.getBoundingClientRect();
      const lx = (ev.clientX - r.left - m.l) / iw * 3 + 3;           // log10(n)
      const n = T3_NS.reduce((a, b) => (Math.abs(Math.log10(b) - lx) < Math.abs(Math.log10(a) - lx) ? b : a));
      guia.setAttribute("x1", X(n)); guia.setAttribute("x2", X(n)); guia.setAttribute("opacity", ".6");
      const lin = T3_SERIES.map(([k, nome, cor]) => {
        const v = ent[k][n];
        return `<div><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cor};margin-right:6px"></i>${nome}: <b>${v ? fv(v[campo]) + unidade : "não medido"}</b></div>`;
      }).join("");
      tip.innerHTML = `<div style="color:var(--muted);margin-bottom:3px">${n.toLocaleString("pt-BR")} números</div>${lin}`;
      tip.classList.add("on");
      const w = tip.offsetWidth;
      tip.style.left = `${Math.min(ev.clientX + 14, window.innerWidth - w - 8)}px`;
      tip.style.top = `${ev.clientY + 14}px`;
    };
    $("#t3-hit").onmouseleave = () => { tip.classList.remove("on"); guia.setAttribute("opacity", "0"); };
  }
  window.addEventListener("resize", () => { if (Q.pagina === "t3") graficoT3(); });

  const SUB = {
    t3: "<b>Trabalho 3 · Seleção.</b> Mediana das medianas, ordenar e quickselect (aleatório e ingênuo) achando o k-ésimo elemento.",
    t1: "<b>Trabalho 1 · Grafos.</b> DFS, BFS e Dijkstra. Médias de 30 seeds por tamanho, HP cheio e sem Surf.",
    t2: "<b>Trabalho 2 · Guloso.</b> Seis regras de parada sobre a rota do Dijkstra, medidas em 7.109 simulações.",
    ac: "<b>Juntos.</b> A rota do primeiro trabalho vira entrada do segundo: o que muda quando o caminho é mais barato?",
  };

  function desenhar() {
    const b = estado.benchmark;
    const corpo = $("#bn-body");
    if (!b || b.erro) {
      corpo.innerHTML = `<div class="erro-tela"><b>Sem dados do benchmark.</b><br>${b ? b.erro : "snapshot não carregado"}<br><small>Rode <code>python -m webdemo.snapshot</code> e recarregue.</small></div>`;
      return;
    }
    document.querySelectorAll("#bn-page button").forEach((x) => x.classList.toggle("on", x.dataset.p === Q.pagina));
    document.querySelectorAll("#bn-size button").forEach((x) => x.classList.toggle("on", Number(x.dataset.s) === Q.size));
    document.querySelectorAll("#bn-alc button").forEach((x) => x.classList.toggle("on", x.dataset.a === Q.alcance));
    $("#bn-alc-wrap").style.display = Q.pagina === "t2" ? "" : "none";
    $("#bn-size-wrap").style.display = Q.pagina === "t3" ? "none" : "";
    $("#bn-sub").innerHTML = SUB[Q.pagina];
    corpo.innerHTML = { t1: paginaT1, t2: paginaT2, ac: paginaJuntos, t3: paginaT3 }[Q.pagina](b);
    if (Q.pagina === "t3") prepararT3();
    requestAnimationFrame(() => requestAnimationFrame(() => corpo.querySelectorAll(".fill").forEach((f) => { f.style.width = f.dataset.w + "%"; })));
  }

  let ligada = false;
  return {
    abrir() {
      if (!ligada) {
        ligada = true;
        $("#bn-page").onclick = (e) => { const x = e.target.closest("button"); if (x) { Q.pagina = x.dataset.p; desenhar(); } };
        $("#bn-size").onclick = (e) => { const x = e.target.closest("button"); if (x) { Q.size = Number(x.dataset.s); desenhar(); } };
        $("#bn-alc").onclick = (e) => { const x = e.target.closest("button"); if (x) { Q.alcance = x.dataset.a; desenhar(); } };
      }
      desenhar();
    },
  };
}
