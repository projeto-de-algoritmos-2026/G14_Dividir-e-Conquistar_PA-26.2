// HUD DOM da batalha: caixas de info, barras, caixa de texto, menus e o
// termometro de previsao. Fica por cima do canvas, num "palco" 16:9 que a cena
// posiciona e dimensiona (--u = pixels de CSS por unidade do palco, 480 x 270).
//
// Nenhuma regra do jogo mora aqui: so mostra o que a cena manda e devolve a
// escolha do jogador (teclado ou mouse) como uma promessa.

import { COR_TIPO } from "./batalha_arte.js";

const NOME_TIPO = { Fire: "Fogo", Water: "Agua", Rock: "Pedra", Psychic: "Psiquico", Normal: "Normal" };

export function corTipoCss(tipo) {
  const c = COR_TIPO[tipo] ?? 0x8a97a8;
  return "#" + c.toString(16).padStart(6, "0");
}

export const nomeTipo = (t) => NOME_TIPO[t] || t;

function el(tag, classe, html) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function corHp(frac) {
  if (frac > 0.5) return "#3fcf6b";
  if (frac > 0.2) return "#f2c230";
  return "#ef4a52";
}

export class UiBatalha {
  constructor() {
    this.raiz = el("div", "bt");
    this.raiz.hidden = true;
    this.palco = el("div", "bt-palco");
    this.raiz.append(this.palco);
    this.palco.append(el("div", "bt-vinheta"));

    this.o = this.criarInfo("bt-o", false);
    this.j = this.criarInfo("bt-j", true);
    this.palco.append(this.o.raiz, this.j.raiz);

    this.termo = el("aside", "bt-termo");
    this.termo.hidden = true;
    this.termo.title = "Clique pra recolher";
    this.termo.addEventListener("click", () => this.termo.classList.toggle("min"));
    this.palco.append(this.termo);

    this.caixa = el("div", "bt-caixa");
    this.texto = el("div", "bt-texto");
    this.seta = el("span", "bt-seta");
    this.seta.hidden = true;
    this.menu = el("div", "bt-grade bt-menu");
    this.golpes = el("div", "bt-grade bt-golpes");
    this.detalhe = el("div", "bt-detalhe");
    this.menu.hidden = true;
    this.golpes.hidden = true;
    this.detalhe.hidden = true;
    this.caixa.append(this.texto, this.seta, this.menu, this.golpes, this.detalhe);
    this.palco.append(this.caixa);
    this.painel = el("div", "bt-painel");
    this.painel.hidden = true;
    this.palco.append(this.painel);

    this.modo = "nada"; // texto | escolha | nada
    this.aoAvancar = null;
    this.escolha = null;
    document.body.append(this.raiz);
    this.teclado = (e) => this.aoTecla(e);
    window.addEventListener("keydown", this.teclado, true);
    this.caixa.addEventListener("click", () => { if (this.modo === "texto" && this.aoAvancar) this.aoAvancar(); });
  }

  criarInfo(classe, completo) {
    const raiz = el("div", "bt-info " + classe);
    raiz.hidden = true;
    const nome = el("div", "bt-nome");
    const b = el("b");
    const chip = el("span", "bt-chip");
    const nv = el("em");
    nome.append(b, chip, nv);
    const hpLinha = el("div", "bt-linha");
    const trilho = el("div", "bt-trilho");
    const barra = el("i");
    trilho.append(barra);
    hpLinha.append(el("label", "", "HP"), trilho);
    raiz.append(nome, hpLinha);
    const r = { raiz, b, chip, nv, barra };
    if (completo) {
      r.num = el("div", "bt-hpnum");
      const xpLinha = el("div", "bt-linha xp");
      const xt = el("div", "bt-trilho xp");
      r.xp = el("i");
      xt.append(r.xp);
      xpLinha.append(el("label", "", "XP"), xt);
      raiz.append(r.num, xpLinha);
    }
    return r;
  }

  // posiciona o palco: (esq, topo, largura) em px de CSS
  posicionar(esq, topo, larg) {
    const alt = (larg * 270) / 480;
    Object.assign(this.palco.style, { left: esq + "px", top: topo + "px", width: larg + "px", height: alt + "px" });
    this.palco.style.setProperty("--u", larg / 480 + "px");
  }

  mostrar() { this.raiz.hidden = false; document.body.classList.add("em-batalha"); }
  esconder() { this.raiz.hidden = true; document.body.classList.remove("em-batalha"); }
  destruir() {
    window.removeEventListener("keydown", this.teclado, true);
    document.body.classList.remove("em-batalha");
    this.raiz.remove();
  }

  // ---------- caixas de info ----------

  info(lado, { nome, nivel, tipo, hp, hpMax }) {
    const c = lado === "o" ? this.o : this.j;
    c.raiz.hidden = false;
    c.raiz.style.setProperty("--tipo", corTipoCss(tipo));
    c.b.textContent = nome;
    c.chip.textContent = nomeTipo(tipo);
    c.chip.style.setProperty("--tipo", corTipoCss(tipo));
    c.nv.textContent = "Nv " + nivel;
    this.hp(lado, hpMax ? hp / hpMax : 1, hp, hpMax);
  }

  esconderInfo(lado) { (lado === "o" ? this.o : this.j).raiz.hidden = true; }

  nivel(lado, n) { (lado === "o" ? this.o : this.j).nv.textContent = "Nv " + n; }

  hp(lado, frac, hp, hpMax) {
    const c = lado === "o" ? this.o : this.j;
    const f = Math.max(0, Math.min(1, frac));
    c.barra.style.width = f * 100 + "%";
    c.barra.style.background = corHp(f);
    if (c.num) c.num.textContent = `${Math.max(0, Math.round(hp))} / ${hpMax}`;
  }

  xp(frac) { this.j.xp.style.width = Math.max(0, Math.min(1, frac)) * 100 + "%"; }

  // ---------- texto ----------

  parcial(str) { this.texto.textContent = str; }

  textoFixo(str) {
    this.caixa.classList.remove("cheia");
    this.texto.textContent = str;
    this.seta.hidden = true;
  }

  cheia(sim) { this.caixa.classList.toggle("cheia", sim); }

  // ---------- escolhas ----------

  // Mostra um conjunto de botoes e devolve {indice} ou {voltar: true}.
  //   tipo: "menu" (2x2 na caixa), "golpes" (2x2 + detalhe) ou "lista" (painel)
  //   itens: [{ rotulo, sub, tipoGolpe, ativo, detalhe, extra }]
  escolher({ tipo, itens, colunas = 2, inicial = 0, titulo = "", podeVoltar = true }) {
    this.limparEscolha();
    return new Promise((resolver) => {
      const container = tipo === "menu" ? this.menu : tipo === "golpes" ? this.golpes : this.painel;
      container.hidden = false;
      container.replaceChildren();
      if (tipo === "lista") container.style.setProperty("--cols", colunas);
      if (tipo === "lista" && titulo) container.append(el("h4", "", titulo));
      if (tipo === "golpes") this.caixa.classList.add("golpes");
      this.cheia(false);
      const botoes = itens.map((it, i) => {
        const b = el("div", "bt-btn" + (it.ativo === false ? " off" : ""));
        if (it.tipoGolpe) {
          const chip = el("span", "bt-chip", nomeTipo(it.tipoGolpe));
          chip.style.setProperty("--tipo", corTipoCss(it.tipoGolpe));
          b.append(chip);
        }
        b.append(el("span", "", it.rotulo));
        if (it.sub) b.append(el("small", "", it.sub));
        if (it.extra) b.append(it.extra);
        b.addEventListener("mouseenter", () => this.selecionar(i));
        b.addEventListener("click", (e) => { e.stopPropagation(); this.selecionar(i); this.confirmar(); });
        container.append(b);
        return b;
      });
      this.escolha = { tipo, itens, botoes, colunas, sel: -1, resolver, podeVoltar, container };
      const primeiro = itens[inicial]?.ativo === false ? itens.findIndex((x) => x.ativo !== false) : inicial;
      this.selecionar(Math.max(0, primeiro));
      this.modo = "escolha";
      if (tipo === "lista") this.painel.addEventListener("click", (e) => e.stopPropagation());
    });
  }

  selecionar(i) {
    const e = this.escolha;
    if (!e || i < 0 || i >= e.itens.length) return;
    e.sel = i;
    e.botoes.forEach((b, k) => b.classList.toggle("sel", k === i));
    if (e.tipo === "golpes") {
      const d = e.itens[i].detalhe;
      this.detalhe.hidden = !d;
      if (d) this.detalhe.innerHTML = d;
    }
  }

  confirmar() {
    const e = this.escolha;
    if (!e) return;
    const it = e.itens[e.sel];
    if (!it || it.ativo === false) return;
    this.limparEscolha();
    e.resolver({ indice: e.sel });
  }

  voltar() {
    const e = this.escolha;
    if (!e || !e.podeVoltar) return;
    this.limparEscolha();
    e.resolver({ voltar: true });
  }

  limparEscolha() {
    const e = this.escolha;
    this.escolha = null;
    if (e) { e.container.hidden = true; }
    this.menu.hidden = true;
    this.golpes.hidden = true;
    this.detalhe.hidden = true;
    this.painel.hidden = true;
    this.caixa.classList.remove("golpes");
    this.modo = "nada";
  }

  aoTecla(e) {
    const k = e.key;
    const avanca = k === "Enter" || k === " " || k === "z" || k === "Z";
    if (this.modo === "texto") {
      if (avanca && this.aoAvancar) { e.preventDefault(); e.stopPropagation(); this.aoAvancar(); }
      return;
    }
    if (this.modo !== "escolha" || !this.escolha) return;
    const s = this.escolha;
    const n = s.itens.length;
    const cols = s.colunas;
    let alvo = s.sel;
    const mover = (delta) => {
      let t = s.sel;
      for (let i = 0; i < n; i++) {
        t += delta;
        if (t < 0 || t >= n) return;
        if (s.itens[t].ativo !== false) { alvo = t; return; }
      }
    };
    if (k === "ArrowRight") mover(cols > 1 ? 1 : 0);
    else if (k === "ArrowLeft") mover(cols > 1 ? -1 : 0);
    else if (k === "ArrowDown") mover(cols);
    else if (k === "ArrowUp") mover(-cols);
    else if (avanca) { e.preventDefault(); e.stopPropagation(); this.confirmar(); return; }
    else if (k === "Escape" || k === "x" || k === "X" || k === "Backspace") { e.preventDefault(); e.stopPropagation(); this.voltar(); return; }
    else return;
    e.preventDefault();
    e.stopPropagation();
    this.selecionar(alvo);
  }

  // ---------- termometro de previsao ----------

  termometro(prev) {
    const t = this.termo;
    t.hidden = false;
    t.classList.remove("min");
    const pct = (x) => Math.round(x * 100);
    const v = prev.vitoria;
    const classe = v >= 0.65 ? "alta" : v >= 0.4 ? "media" : "baixa";
    const h = prev.hp_restante;
    t.innerHTML = `
      <div class="cab"><span>Previsao</span><b class="${classe}">${pct(v)}% de vitoria</b></div>
      <div class="reg"><i class="faixa" style="left:${h.p10 * 100}%;width:${Math.max(0.8, (h.p90 - h.p10) * 100)}%"></i><i class="p50" style="left:${h.p50 * 100}%"></i><i class="real" hidden></i></div>
      <div class="nums"><span>p10 ${pct(h.p10)}%</span><span>p50 ${pct(h.p50)}%</span><span>p90 ${pct(h.p90)}%</span></div>
      <div class="nota">HP final do time. ${prev.n} batalhas simuladas, percentis pela mediana das medianas.</div>
      <div class="res" hidden></div>`;
  }

  // marca onde o resultado real caiu (fracao 0..1 do HP total do time)
  termometroReal(frac, rotulo) {
    const real = this.termo.querySelector(".real");
    const res = this.termo.querySelector(".res");
    if (!real) return;
    this.termo.classList.remove("min");
    real.hidden = false;
    real.style.left = "0%";
    requestAnimationFrame(() => requestAnimationFrame(() => { real.style.left = Math.max(0, Math.min(1, frac)) * 100 + "%"; }));
    res.hidden = false;
    res.textContent = rotulo;
  }

  esconderTermometro() { this.termo.hidden = true; }
}
