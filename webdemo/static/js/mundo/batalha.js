// Cena da batalha (Phaser 3). Abre em cima do mapa, toca a lista de eventos que
// a API devolve (/api/t3/batalha/*) uma animacao por evento e devolve o
// resultado pro mapa. Nenhuma regra de jogo mora aqui: dano, efetividade, ordem
// dos golpes, captura, fuga e XP chegam prontos nos eventos; a cena so decide
// COMO mostrar. O HUD e DOM (batalha_ui.js), o resto e desenhado em codigo
// (batalha_arte.js).

import { api3 } from "../api.js";
import {
  BORDA_FUNDO, CAIXA_H, COR_TIPO, ESCB, FUNDO_H, FUNDO_W, HORIZONTE, PES, PLAT_H, PLAT_W, TAMANHO_ESPECIE,
  chaveCriatura, garantirCriatura, garantirFundo, garantirPlataforma, gerarEfeitos,
} from "./batalha_arte.js";
import { UiBatalha, nomeTipo } from "./batalha_ui.js";
import { ESC } from "./constantes.js";
import { CEL_H, FOLHAS_CPU, PES_Y } from "./personagens.js";

// Palco logico: 480 x 270 unidades. Plataformas (centro) de cada lado.
const PLAT_O = { x: 352, y: 134, k: 0.8 };
const PLAT_J = { x: 122, y: 198, k: 1.0 };
const ESCALA_O = 1.0; // escala da criatura do adversario (de frente, mais longe)
const ESCALA_J = 1.5; // e da sua (de costas, mais perto)
const CELULA = 24;

// Tipo do golpe so pra escolher a animacao. Os golpes do jogador chegam com tipo
// (estado.jogador.golpes); os do adversario nao, entao cai neste catalogo
// (docs/api-batalha-t3.md) e, fora dele, no tipo de quem atacou.
const TIPO_DO_GOLPE = {
  Flamethrower: "Fire", "Fire-blast": "Fire", Hydropump: "Water", "Rock-throw": "Rock",
  "Mind-beam": "Psychic", "Psychic-slam": "Psychic",
};

const nomeBase = (nome) => String(nome || "").split("-")[0];
const cubo = (n) => n * n * n;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function paletaDe(texto) {
  let h = 0;
  for (const ch of String(texto)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FOLHAS_CPU[h % FOLHAS_CPU.length];
}

export class CenaBatalha extends Phaser.Scene {
  constructor() {
    super("batalha");
  }

  init(dados) {
    this.d = dados;
    this.f = Math.max(0.2, dados.lento || 1); // fator de tempo (?lento=N)
    this.recs = [];
    this.trans = null;
    this.extras = [];
    this.timeLocal = [];
  }

  create() {
    gerarEfeitos(this);
    this.ui = new UiBatalha();
    this.ajustarCamera();
    this.scale.on("resize", this.ajustarCamera, this);
    this.gTrans = this.add.graphics().setDepth(9000);
    this.flashRect = this.add.rectangle(240, 135, 4000, 3000, 0xffffff, 0).setDepth(9500);
    this.events.once("shutdown", () => { this.scale.off("resize", this.ajustarCamera, this); this.ui.destruir(); });
    window.__bt = this;
    this.run();
  }

  // ---------------- camera e palco ----------------

  ajustarCamera() {
    const cam = this.cameras.main;
    const W = this.scale.width;
    const H = this.scale.height;
    const z = Math.min(W / 480, H / 270);
    this.z = z;
    cam.setZoom(z);
    cam.centerOn(240, 135);
    this.amplo = { w: W / z, h: H / z };
    const dpr = W / window.innerWidth || 1;
    const larg = (480 * z) / dpr;
    this.ui.posicionar((window.innerWidth - larg) / 2, (window.innerHeight - (larg * 270) / 480) / 2, larg);
  }

  // ---------------- utilidades de tempo ----------------

  esp(ms) {
    return new Promise((r) => this.time.delayedCall(Math.max(1, ms * this.f), r));
  }

  tw(alvos, props, dur, ease = "Sine.out", extra = {}) {
    return new Promise((r) => this.tweens.add({ targets: alvos, ...props, duration: Math.max(1, dur * this.f), ease, onComplete: r, ...extra }));
  }

  contar(dur, fn, ease = "Linear") {
    return new Promise((r) => this.tweens.addCounter({
      from: 0, to: 1, duration: Math.max(1, dur * this.f), ease,
      onUpdate: (t) => fn(t.getValue()), onComplete: () => { fn(1); r(); },
    }));
  }

  // movimento em arco: de -> para, com `altura` de parabola
  arco(obj, de, para, dur, altura = 40, ease = "Sine.inOut") {
    return this.contar(dur, (p) => {
      obj.x = de.x + (para.x - de.x) * p;
      obj.y = de.y + (para.y - de.y) * p - Math.sin(Math.PI * p) * altura;
    }, ease);
  }

  // ---------------- transicao (flash + mosaico em espiral) ----------------

  async flash() {
    for (let i = 0; i < 2; i++) {
      this.flashRect.setAlpha(0.9);
      await this.tw(this.flashRect, { alpha: 0 }, 60, "Quad.out");
    }
  }

  transicao(modo, dur) {
    const cx = 240;
    const cy = 135;
    const w = this.amplo.w + CELULA * 2;
    const h = this.amplo.h + CELULA * 2;
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;
    const cols = Math.ceil(w / CELULA);
    const lin = Math.ceil(h / CELULA);
    const maxD = Math.hypot(w / 2, h / 2);
    const celulas = [];
    for (let r = 0; r < lin; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x0 + c * CELULA + CELULA / 2;
        const py = y0 + r * CELULA + CELULA / 2;
        const ang = (Math.atan2(py - cy, px - cx) + Math.PI) / (2 * Math.PI);
        celulas.push({ x: px, y: py, rank: (Math.hypot(px - cx, py - cy) / maxD) * 0.66 + ang * 0.34, par: (r + c) % 2 });
      }
    }
    return new Promise((resolver) => {
      this.trans = { modo, celulas, t: 0, dur: dur * this.f, resolver };
    });
  }

  desenharTransicao(p, modo) {
    const g = this.gTrans;
    g.clear();
    for (const c of this.trans.celulas) {
      const s = clamp((p - c.rank * 0.62) / 0.38, 0, 1);
      const k = modo === "cobrir" ? s : 1 - s;
      if (k <= 0) continue;
      const lado = CELULA * k + (k >= 1 ? 1 : 0);
      g.fillStyle(c.par ? 0x0b0f14 : 0x0f1620, 1);
      g.fillRect(c.x - lado / 2, c.y - lado / 2, lado, lado);
      if (k < 1) {
        g.lineStyle(0.8, 0x12b7a3, 0.8);
        g.strokeRect(c.x - lado / 2, c.y - lado / 2, lado, lado);
      }
    }
  }

  // ---------------- fluxo principal ----------------

  async run() {
    let saida = {};
    try {
      await this.flash();
      await this.transicao("cobrir", 300);
      const dados = await this.d.promessa;
      this.montar(dados);
      await this.transicao("revelar", 270);
      this.ui.mostrar();
      await this.abertura();
      await this.loop();
      saida = await this.final();
    } catch (erro) {
      console.error(erro);
      saida = { erro: erro.message || String(erro) };
      this.ui.limparEscolha();
    }
    await this.sair(saida);
  }

  montar(dados) {
    this.id = dados.batalha_id;
    this.tipo = dados.tipo;
    this.adv = dados.adversario || {};
    this.est = dados;
    this.previsao = dados.previsao;
    this.hpMaxInicial = dados.jogador.time.reduce((s, m) => s + m.hp_max, 0);
    this.timeLocal = dados.jogador.time.map((m) => ({ ...m }));
    this.ultimoJogo = null;
    const terreno = this.tipo === "lider" ? "ginasio" : this.d.terreno || "grass";
    this.terreno = terreno;
    this.montarCenario(terreno);
    // o mapa fica escondido por baixo enquanto a batalha roda
    this.scene.setVisible(false, "mundo");
    this.ajustarCamera();
  }

  montarCenario(terreno) {
    const chave = garantirFundo(this, terreno);
    const cor = BORDA_FUNDO[terreno];
    const d = -50;
    const larg = 1400;
    this.extras.push(
      this.add.rectangle(240, -400 + 0, larg, 800, cor.ceu).setDepth(d - 1),
      this.add.rectangle(240, FUNDO_H + 400, larg, 800, cor.chao).setDepth(d - 1),
    );
    const k = 1 / 3;
    this.extras.push(
      this.add.image(0, 0, chave).setOrigin(0, 0).setScale(k).setDepth(d),
      this.add.image(0, 0, chave).setOrigin(1, 0).setScale(k).setFlipX(true).setDepth(d),
      this.add.image(FUNDO_W, 0, chave).setOrigin(0, 0).setScale(k).setFlipX(true).setDepth(d),
    );
    const plat = garantirPlataforma(this, terreno);
    for (const p of [PLAT_O, PLAT_J]) {
      this.extras.push(this.add.image(p.x, p.y, plat).setScale(p.k / ESCB).setDepth(1));
    }
    this.ambiente(terreno);
  }

  // Particulas lentas de ambiente, uma por terreno (so enfeite).
  ambiente(terreno) {
    const cfg = {
      grass: { cor: 0xd8f5a8, n: 14, vy: 6, ay: [0, 200], blend: 0 },
      water: { cor: 0xffffff, n: 18, vy: 0, ay: [HORIZONTE, 250], blend: 1, pisca: true },
      concrete: { cor: 0xffd98a, n: 12, vy: -4, ay: [60, 250], blend: 1 },
      ginasio: { cor: 0xf2b84b, n: 18, vy: -10, ay: [20, 250], blend: 1 },
    }[terreno];
    for (let i = 0; i < cfg.n; i++) {
      const x = (i * 97) % 520 - 20;
      const y = cfg.ay[0] + ((i * 53) % (cfg.ay[1] - cfg.ay[0]));
      const s = this.add.image(x, y, "bt_disco").setTint(cfg.cor).setDepth(3).setAlpha(0.0)
        .setDisplaySize(3 + (i % 3) * 1.4, 3 + (i % 3) * 1.4);
      if (cfg.blend) s.setBlendMode(Phaser.BlendModes.ADD);
      this.extras.push(s);
      this.tweens.add({
        targets: s, alpha: { from: 0, to: cfg.pisca ? 0.8 : 0.55 }, y: y + cfg.vy * 2, x: x + 14 + (i % 4) * 4,
        duration: 1800 + (i % 5) * 450, yoyo: true, repeat: -1, delay: i * 210, ease: "Sine.inOut",
      });
    }
  }

  // ---------------- criaturas e treinadores ----------------

  crearRec(lado, dados) {
    const p = lado === "o" ? PLAT_O : PLAT_J;
    garantirCriatura(this, dados.especie, dados.tipo);
    const escala = (lado === "o" ? ESCALA_O : ESCALA_J) * (TAMANHO_ESPECIE[dados.especie] ?? 1);
    const vista = lado === "o" ? "frente" : "costas";
    const rec = {
      lado, vista, especie: dados.especie, tipo: dados.tipo, nome: dados.nome, escala,
      x: p.x, y: p.y - 1, off: { x: 0, y: 0, sx: 1, sy: 1, a: 0, rot: 0 }, fase: Math.random() * 6, vivo: true, q: -1,
    };
    rec.img = this.add.image(rec.x, rec.y, chaveCriatura(rec.especie, rec.tipo, vista, 0))
      .setOrigin(0.5, PES / CAIXA_H).setDepth(lado === "o" ? 5 : 6).setAlpha(0);
    rec.sombra = this.add.image(p.x, p.y - 1, "bt_sombra").setDepth(2).setAlpha(0);
    rec.sombraW = 40 * escala;
    this.recs.push(rec);
    return rec;
  }

  apagarRec(rec) {
    if (!rec) return;
    rec.img.destroy();
    rec.sombra.destroy();
    this.recs = this.recs.filter((r) => r !== rec);
  }

  centro(rec) {
    return { x: rec.x + rec.off.x, y: rec.y + rec.off.y - 30 * rec.escala };
  }

  criarTreinador(lado, folha, escala, frame) {
    const p = lado === "o" ? PLAT_O : PLAT_J;
    const img = this.add.image(p.x, p.y - 2, "folha_" + folha, frame)
      .setOrigin(0.5, PES_Y / CEL_H).setScale(escala / ESC).setDepth(lado === "o" ? 5 : 6);
    const sombra = this.add.image(p.x, p.y - 1, "bt_sombra").setDisplaySize(46, 14).setDepth(2);
    const t = { img, sombra, x: p.x, y: p.y - 2, escala };
    this.tweens.add({ targets: img, scaleY: (escala / ESC) * 1.03, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    return t;
  }

  async deslizarTreinador(t, deX, paraX, dur = 520) {
    t.img.x = deX;
    t.sombra.x = deX;
    await Promise.all([this.tw(t.img, { x: paraX }, dur, "Cubic.out"), this.tw(t.sombra, { x: paraX }, dur, "Cubic.out")]);
  }

  // idle das criaturas: bob, respiracao e troca de quadro
  update(tempo, delta) {
    if (this.trans) {
      const tr = this.trans;
      tr.t += delta;
      const p = clamp(tr.t / tr.dur, 0, 1);
      this.desenharTransicao(p, tr.modo);
      if (p >= 1) {
        this.trans = null;
        if (tr.modo === "revelar") this.gTrans.clear();
        tr.resolver();
      }
    }
    for (const r of this.recs) {
      if (!r.img.active) continue;
      const t = tempo / 1000 + r.fase;
      const mew = r.especie === "Mew";
      const s = Math.sin(t * (mew ? 1.8 : 2.3));
      const flut = mew ? -7 - 3.4 * s : 0;
      r.img.setPosition(r.x + r.off.x, r.y + r.off.y + flut);
      r.img.setScale((r.escala * r.off.sx * (1 - s * 0.012)) / ESCB, (r.escala * r.off.sy * (1 + s * 0.024)) / ESCB);
      r.img.setRotation(r.off.rot).setAlpha(r.off.a);
      r.sombra.setPosition(r.x + r.off.x * 0.6, r.y - 1).setAlpha(Math.min(0.85, r.off.a) * (mew ? 0.7 : 1))
        .setDisplaySize(r.sombraW * r.off.sx * (mew ? 0.85 + s * 0.05 : 1), r.sombraW * 0.3 * r.off.sx);
      const q = Math.floor(tempo / (mew ? 380 : 540) + r.fase * 3) % 2;
      if (q !== r.q) { r.q = q; r.img.setTexture(chaveCriatura(r.especie, r.tipo, r.vista, q)); }
    }
  }

  // ---------------- texto ----------------

  async dizer(str, { espera = 620, tecla = false } = {}) {
    const ui = this.ui;
    ui.limparEscolha();
    ui.cheia(true);
    ui.modo = "texto";
    ui.seta.hidden = true;
    ui.parcial("");
    await new Promise((res) => {
      let i = 0;
      const ev = this.time.addEvent({
        delay: 20 * this.f, loop: true,
        callback: () => {
          i += 1;
          ui.parcial(str.slice(0, i));
          if (i >= str.length) { ev.remove(); ui.aoAvancar = null; res(); }
        },
      });
      ui.aoAvancar = () => { ev.remove(); ui.parcial(str); ui.aoAvancar = null; res(); };
    });
    if (tecla) {
      ui.seta.hidden = false;
      await new Promise((res) => { ui.aoAvancar = () => { ui.aoAvancar = null; res(); }; });
      ui.seta.hidden = true;
    } else {
      await new Promise((res) => {
        const t = this.time.delayedCall(Math.max(1, espera * this.f), () => { ui.aoAvancar = null; res(); });
        ui.aoAvancar = () => { t.remove(false); ui.aoAvancar = null; res(); };
      });
    }
  }

  // ---------------- abertura ----------------

  infoDe(lado, c) {
    return { nome: nomeBase(c.nome), nivel: c.nivel, tipo: c.tipo, hp: c.hp, hpMax: c.hp_max };
  }

  async abertura() {
    const ui = this.ui;
    ui.termometro(this.previsao);
    const J = this.est.jogador.ativo;
    const O = this.est.oponente.ativo;
    this.nomeAdv = this.adv.nome || "";
    ui.textoFixo("");
    ui.cheia(true);

    // seu treinador entra pela esquerda
    this.tJ = this.criarTreinador("j", "jogador", 2.9, "cima_0");
    this.tJ.img.x = -80; this.tJ.sombra.x = -80;
    const entrouJ = this.deslizarTreinador(this.tJ, -90, PLAT_J.x, 560);

    if (this.tipo === "selvagem") {
      this.rO = this.crearRec("o", O);
      this.rO.off.x = 260;
      this.rO.off.a = 1;
      this.rO.img.setTintFill(0xffffff);
      await Promise.all([entrouJ, this.tw(this.rO.off, { x: 0 }, 640, "Cubic.out")]);
      this.rO.img.clearTint();
      this.poeira(this.rO.x, this.rO.y, 6);
      ui.info("o", this.infoDe("o", O));
      await this.dizer(`Um ${nomeBase(O.nome)} selvagem apareceu!`, { espera: 700 });
    } else {
      const lider = this.tipo === "lider";
      const folha = lider ? "cpuB" : paletaDe(this.nomeAdv);
      this.tO = this.criarTreinador("o", folha, lider ? 2.7 : 2.3, "baixo_0");
      if (lider) {
        const aura = this.add.image(PLAT_O.x, PLAT_O.y - 36, "bt_ponto").setTint(0xf2b84b).setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(150, 150).setAlpha(0.5).setDepth(4);
        this.tweens.add({ targets: aura, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 });
        this.tO.aura = aura;
        aura.x = 700;
      }
      const entrouO = this.deslizarTreinador(this.tO, 560, PLAT_O.x, 620);
      if (lider) this.tw(this.tO.aura, { x: PLAT_O.x }, 620, "Cubic.out");
      await Promise.all([entrouJ, entrouO]);
      await this.dizer(`${this.nomeAdv} quer batalhar!`, { espera: 650 });
      if (lider) await this.dizer(`"Meu time e de nivel ${this.adv.nivel}. Mostre o que sabe!"`, { espera: 900 });
      // o treinador sai, a criatura entra
      this.rO = this.crearRec("o", O);
      const bolaDe = { x: PLAT_O.x - 10, y: PLAT_O.y - 60 };
      const saiu = Promise.all([
        this.tw(this.tO.img, { x: 580, alpha: 0 }, 480, "Cubic.in"), this.tw(this.tO.sombra, { x: 580, alpha: 0 }, 480, "Cubic.in"),
        this.tO.aura ? this.tw(this.tO.aura, { x: 700 }, 480, "Cubic.in") : Promise.resolve(),
      ]);
      await this.esp(120);
      const ent = this.entrar(this.rO, bolaDe);
      await Promise.all([saiu, ent]);
      ui.info("o", this.infoDe("o", O));
      await this.dizer(`${this.nomeAdv} mandou ${nomeBase(O.nome)}!`, { espera: 650 });
    }

    // sua criatura
    this.rJ = this.crearRec("j", J);
    const bolaJ = { x: PLAT_J.x + 14, y: PLAT_J.y - 72 };
    await this.dizer(`Vai, ${nomeBase(J.nome)}!`, { espera: 200 });
    const sai = Promise.all([this.tw(this.tJ.img, { x: -90, alpha: 0 }, 460, "Cubic.in"), this.tw(this.tJ.sombra, { x: -90, alpha: 0 }, 460, "Cubic.in")]);
    await this.esp(90);
    await Promise.all([sai, this.entrar(this.rJ, bolaJ)]);
    this.xpAtual = { nivel: J.nivel, xp: J.xp };
    ui.info("j", this.infoDe("j", J));
    ui.xp(this.fracXp(J.xp, J.nivel));
    await this.esp(250);
  }

  fracXp(xp, nivel) {
    // So pra desenhar a barra: curva documentada (XP total do nivel L = L ao cubo).
    const base = cubo(nivel);
    const prox = cubo(nivel + 1);
    return clamp((xp - base) / (prox - base), 0, 1);
  }

  poeira(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x + (i - n / 2) * 6, y - 2, "bt_disco").setTint(0xe8ecf2).setAlpha(0.6).setDepth(7).setDisplaySize(7, 7);
      this.tweens.add({
        targets: p, x: p.x + (i - n / 2) * 7, y: p.y - 6 - (i % 3) * 3, alpha: 0, scale: p.scale * 2.2, duration: 460 * this.f,
        ease: "Sine.out", onComplete: () => p.destroy(),
      });
    }
  }

  // Criatura sai da bola: arco da bola, estouro de luz, a criatura cresce em branco.
  async entrar(rec, bolaDe) {
    const alvo = this.centro(rec);
    if (bolaDe) {
      const bola = this.add.image(bolaDe.x, bolaDe.y, "bt_bola").setDisplaySize(20, 20).setDepth(12);
      const giro = this.tweens.add({ targets: bola, angle: 720, duration: 520 * this.f });
      await this.arco(bola, bolaDe, alvo, 480, 36);
      giro.stop();
      bola.setTexture("bt_bola_aberta");
      this.tw(bola, { alpha: 0, scale: bola.scale * 1.4 }, 200).then(() => bola.destroy());
    }
    this.brilhoEm(alvo.x, alvo.y, 0xffffff, 3.6, 360);
    this.estrelas(alvo.x, alvo.y, 7, 0xfff2a8, 26);
    rec.img.setTintFill(0xffffff);
    rec.off.a = 1;
    rec.off.sx = 0.08; rec.off.sy = 0.08;
    await this.tw(rec.off, { sx: 1, sy: 1 }, 380, "Back.out");
    rec.img.clearTint();
  }

  brilhoEm(x, y, cor, escala, dur) {
    const b = this.add.image(x, y, "bt_ponto").setTint(cor).setBlendMode(Phaser.BlendModes.ADD).setDepth(15).setDisplaySize(8, 8).setAlpha(0.95);
    this.tweens.add({ targets: b, displayWidth: escala * 30, displayHeight: escala * 30, alpha: 0, duration: dur * this.f, ease: "Quad.out", onComplete: () => b.destroy() });
  }

  estrelas(x, y, n, cor, raio, depth = 16) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const s = this.add.image(x, y, "bt_estrela").setTint(cor).setDepth(depth).setDisplaySize(7, 7).setAlpha(1);
      this.tweens.add({
        targets: s, x: x + Math.cos(a) * raio, y: y + Math.sin(a) * raio - 4, scale: s.scale * 1.7, alpha: 0, angle: 120,
        duration: (520 + Math.random() * 200) * this.f, ease: "Cubic.out", onComplete: () => s.destroy(),
      });
    }
  }

  // ---------------- laco de turnos ----------------

  async loop() {
    for (;;) {
      if (this.est.estado === "fim") return;
      let corpo = null;
      if (this.est.estado === "troca_forcada") corpo = await this.escolherTroca(true);
      else corpo = await this.escolherAcao();
      if (!corpo) continue;
      let res;
      try {
        res = await api3.batalhaAcao(this.id, corpo.acao, corpo.extra || {});
      } catch (erro) {
        await this.dizer(`Nao deu: ${erro.message}.`, { espera: 900 });
        continue;
      }
      await this.tocar(res);
    }
  }

  async tocar(res) {
    this.estFinal = res.estado;
    this.ultimoJogo = res.jogo;
    for (const ev of res.eventos) await this.evento(ev);
    this.est = res.estado;
    this.timeLocal = res.estado.jogador.time.map((m) => ({ ...m }));
    this.sincronizar(res.estado);
  }

  sincronizar(est) {
    const J = est.jogador.ativo;
    const O = est.oponente.ativo;
    if (this.rJ && this.rJ.vivo) {
      this.ui.info("j", this.infoDe("j", J));
      this.ui.xp(this.fracXp(J.xp, J.nivel));
      this.xpAtual = { nivel: J.nivel, xp: J.xp };
    }
    if (this.rO && this.rO.vivo) this.ui.info("o", this.infoDe("o", O));
  }

  // ---------------- menus ----------------

  async escolherAcao() {
    const ui = this.ui;
    const J = this.est.jogador.ativo;
    const validas = this.est.acoes_validas || [];
    let inicial = 0;
    for (;;) {
      await this.promptTexto(`O que ${nomeBase(J.nome)} vai fazer?`);
      const r = await ui.escolher({
        tipo: "menu", inicial, podeVoltar: false,
        itens: [
          { rotulo: "Lutar", ativo: validas.includes("lutar") },
          { rotulo: "Mochila", ativo: validas.includes("mochila") },
          { rotulo: "Pokemon", ativo: validas.includes("pokemon") },
          { rotulo: "Fugir", ativo: validas.includes("fugir") },
        ],
      });
      inicial = r.indice;
      if (r.indice === 0) {
        const c = await this.escolherGolpe();
        if (c) return c;
      } else if (r.indice === 1) {
        const c = await this.escolherItem();
        if (c) return c;
      } else if (r.indice === 2) {
        const c = await this.escolherTroca(false);
        if (c) return c;
      } else {
        return { acao: "fugir" };
      }
    }
  }

  promptTexto(str) {
    this.ui.limparEscolha();
    this.ui.cheia(false);
    this.ui.textoFixo(str);
    return Promise.resolve();
  }

  async escolherGolpe() {
    const golpes = this.est.jogador.golpes || [];
    const semPP = golpes.every((g) => g.pp <= 0);
    const itens = semPP
      ? [{ rotulo: "Esforco", sub: "sem PP", tipoGolpe: "Normal", detalhe: "<b>Esforco</b>Tipo: Normal<br>Poder 50<br>Recuo: 1/4 do HP" }]
      : [0, 1, 2, 3].map((i) => {
        const g = golpes[i];
        if (!g) return { rotulo: "-", ativo: false };
        return {
          rotulo: g.nome, sub: `PP ${g.pp}/${g.pp_max}`, tipoGolpe: g.tipo, ativo: g.pp > 0,
          detalhe: `<b>${g.nome}</b>Tipo: ${nomeTipo(g.tipo)}<br>PP: ${g.pp}/${g.pp_max}<br>Poder: ${g.poder}<br>Precisao: ${g.precisao}`,
        };
      });
    this.ui.textoFixo("");
    const r = await this.ui.escolher({ tipo: "golpes", itens, colunas: 2 });
    if (r.voltar) return null;
    return { acao: "lutar", extra: { golpe: semPP ? 0 : golpes[r.indice].indice } };
  }

  async escolherItem() {
    const m = this.est.jogador.mochila || {};
    const r = await this.ui.escolher({
      tipo: "lista", titulo: "Mochila", colunas: 1,
      itens: [
        { rotulo: "Pocao", sub: "cura HP", extra: this.chipQtd(m.pocao), ativo: (m.pocao || 0) > 0 },
        { rotulo: "Pokebola", sub: "captura", extra: this.chipQtd(m.pokebola), ativo: (m.pokebola || 0) > 0 },
      ],
    });
    if (r.voltar) return null;
    return { acao: "mochila", extra: { item: r.indice === 0 ? "pocao" : "pokebola" } };
  }

  chipQtd(n) {
    const e = document.createElement("b");
    e.textContent = "x" + (n || 0);
    e.style.fontFamily = "var(--mono)";
    return e;
  }

  async escolherTroca(forcada) {
    const time = this.est.jogador.time;
    const itens = time.map((m) => {
      const frac = m.hp_max ? m.hp / m.hp_max : 0;
      const mini = document.createElement("div");
      mini.className = "bt-mini";
      const barra = document.createElement("i");
      barra.style.width = frac * 100 + "%";
      barra.style.background = frac > 0.5 ? "#3fcf6b" : frac > 0.2 ? "#f2c230" : "#ef4a52";
      mini.append(barra);
      const bloco = document.createElement("span");
      bloco.className = "bt-mini-nome";
      bloco.textContent = `${m.hp}/${m.hp_max}`;
      bloco.style.cssText = "font:600 11px var(--mono);color:#93a4b8";
      const dir = document.createElement("div");
      dir.append(bloco, mini);
      dir.style.textAlign = "right";
      return {
        rotulo: `${nomeBase(m.nome)} Nv ${m.nivel}`, sub: m.ativo ? "em campo" : m.vivo ? nomeTipo(m.tipo) : "desmaiado",
        extra: dir, ativo: m.vivo && !m.ativo,
      };
    });
    this.ui.textoFixo(forcada ? "Escolha o proximo Pokemon." : "");
    const r = await this.ui.escolher({ tipo: "lista", titulo: "Pokemon", itens, colunas: 1, podeVoltar: !forcada });
    if (r.voltar) return null;
    return { acao: "pokemon", extra: { alvo: time[r.indice].indice } };
  }

  // ---------------- eventos ----------------

  nm(nome, quem) {
    const b = nomeBase(nome);
    return quem === "oponente" && this.tipo === "selvagem" ? `${b} selvagem` : b;
  }

  tipoGolpe(ev, atacante) {
    const meu = (this.est.jogador.golpes || []).find((g) => g.nome === ev.golpe);
    if (ev.quem === "jogador" && meu) return meu.tipo;
    if (TIPO_DO_GOLPE[ev.golpe]) return TIPO_DO_GOLPE[ev.golpe];
    if (["Claw", "Slap", "Bite", "head-butt", "Body-slam", "Esforco"].includes(ev.golpe)) return "Normal";
    return atacante.tipo;
  }

  async evento(ev) {
    const jog = ev.quem === "jogador";
    const a = jog ? this.rJ : this.rO;
    const d = jog ? this.rO : this.rJ;
    switch (ev.tipo) {
      case "golpe": {
        await this.dizer(`${this.nm(ev.pokemon, ev.quem)} usou ${ev.golpe}!`, { espera: 160 });
        const tg = this.tipoGolpe(ev, a);
        await this.fx(tg, a, d, true, ev);
        this.registrarHp(jog ? "o" : "j", ev);
        await this.receberDano(d, ev);
        if (ev.critico) await this.dizer("Acerto critico!", { espera: 420 });
        if (ev.efetividade > 1) await this.dizer("Foi super efetivo!", { espera: 480 });
        else if (ev.efetividade < 1) await this.dizer("Nao foi muito efetivo...", { espera: 480 });
        break;
      }
      case "errou": {
        await this.dizer(`${this.nm(ev.pokemon, ev.quem)} usou ${ev.golpe}!`, { espera: 160 });
        const tg = this.tipoGolpe(ev, a);
        await this.fx(tg, a, d, false, ev);
        await this.dizer(`${this.nm(ev.pokemon, ev.quem)} errou o golpe!`, { espera: 560 });
        break;
      }
      case "recuo": {
        this.registrarHp(jog ? "j" : "o", ev);
        await this.receberDano(a, { ...ev, efetividade: 1, critico: false });
        await this.dizer(`${this.nm(ev.pokemon, ev.quem)} se machucou com o esforco!`, { espera: 560 });
        break;
      }
      case "pocao": {
        await this.dizer(`Voce usou uma pocao em ${nomeBase(ev.pokemon)}!`, { espera: 160 });
        this.registrarHp("j", ev);
        await Promise.all([this.fxCura(this.rJ), this.animarHp("j", ev.hp_antes, ev.hp_depois, ev.hp_max, 520)]);
        await this.dizer(`${nomeBase(ev.pokemon)} recuperou ${ev.cura} de HP.`, { espera: 560 });
        break;
      }
      case "troca": await this.evTroca(ev); break;
      case "desmaio": {
        const rec = jog ? this.rJ : this.rO;
        await this.dizer(`${this.nm(ev.pokemon, ev.quem)} desmaiou!`, { espera: 150 });
        await this.fxDesmaio(rec);
        this.ui.esconderInfo(jog ? "j" : "o");
        await this.esp(200);
        break;
      }
      case "xp": await this.evXp(ev); break;
      case "dinheiro":
        await this.dizer(`Voce ganhou $${ev.ganho}!`, { espera: 600 });
        break;
      case "captura": await this.evCaptura(ev); break;
      case "fuga": {
        if (ev.sucesso) {
          await this.dizer("Voce fugiu em seguranca!", { espera: 150 });
          await Promise.all([this.tw(this.rJ.off, { x: -170, a: 0 }, 520, "Cubic.in"), this.tw(this.rJ.sombra, { alpha: 0 }, 400)]);
        } else {
          await this.dizer("Nao conseguiu fugir!", { espera: 150 });
          this.tremer(this.rJ, 4);
          await this.esp(300);
        }
        break;
      }
      case "fim": this.resultado = ev.resultado; break;
      default: break;
    }
  }

  // guarda o HP novo no estado local (pra info e pra troca)
  registrarHp(lado, ev) {
    if (lado === "j") {
      const m = this.timeLocal.find((x) => x.nome === (ev.alvo || ev.pokemon));
      if (m) m.hp = ev.hp_depois;
    }
  }

  // ---------------- animacoes de dano e HP ----------------

  async receberDano(rec, ev) {
    const lado = rec.lado;
    const forte = ev.efetividade > 1;
    const fraco = ev.efetividade < 1;
    const crit = !!ev.critico;
    const cam = this.cameras.main;
    if (forte || crit) cam.shake(forte && crit ? 240 : 170, forte ? 0.006 : 0.004);
    else cam.shake(90, 0.0016);
    const c = this.centro(rec);
    if (forte) this.flutuante(c.x, c.y - 26, "SUPER EFETIVO!", "#ffb347", 11);
    if (crit) this.flutuante(c.x, c.y - (forte ? 38 : 26), "CRITICO!", "#fff06a", 11);
    if (ev.dano !== undefined) this.flutuante(c.x + 14, c.y - 6, "-" + ev.dano, fraco ? "#c7d2e0" : "#ffffff", forte || crit ? 14 : 11);
    this.estrelas(c.x, c.y, forte ? 10 : crit ? 8 : 5, forte ? 0xff9a5a : 0xfff2a8, forte ? 34 : 22);
    const dur = clamp((ev.dano / ev.hp_max) * 1500, 320, 1000);
    await Promise.all([
      this.piscar(rec, forte || crit ? 8 : 6, forte || crit ? 4 : 2.6),
      this.animarHp(lado, ev.hp_antes, ev.hp_depois, ev.hp_max, dur),
    ]);
    await this.esp(160);
  }

  async piscar(rec, vezes, amp) {
    rec.img.setTintFill(0xffffff);
    await this.esp(50);
    rec.img.clearTint();
    const tremor = this.contar(vezes * 60, (p) => { rec.off.x = Math.sin(p * vezes * 3.1) * amp * (1 - p); });
    for (let i = 0; i < vezes; i++) {
      rec.off.a = i % 2 ? 1 : 0.18;
      await this.esp(55);
    }
    rec.off.a = 1;
    await tremor;
    rec.off.x = 0;
  }

  tremer(rec, amp) {
    return this.contar(280, (p) => { rec.off.x = Math.sin(p * 22) * amp * (1 - p); });
  }

  animarHp(lado, de, para, hpMax, dur) {
    const ui = this.ui;
    return this.contar(dur, (p) => {
      const hp = de + (para - de) * p;
      ui.hp(lado, hp / hpMax, hp, hpMax);
    }, "Quad.out");
  }

  flutuante(x, y, texto, cor, tam) {
    const t = this.add.text(x, y, texto, {
      fontFamily: "ui-sans-serif, system-ui, 'Segoe UI', sans-serif", fontStyle: "800", fontSize: tam + "px", color: cor,
      stroke: "#1a1424", strokeThickness: Math.max(2, tam / 4),
    }).setOrigin(0.5).setDepth(30).setResolution(Math.min(8, Math.ceil(this.z * 2)));
    this.tweens.add({
      targets: t, y: y - 16, alpha: { from: 1, to: 0 }, duration: 1100 * this.f, ease: "Cubic.out", delay: 300 * this.f,
      onComplete: () => t.destroy(),
    });
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 160 * this.f, ease: "Back.out" });
  }

  // ---------------- efeitos de golpe ----------------

  boca(a) {
    const dir = a.lado === "j" ? 1 : -1;
    const c = this.centro(a);
    return { x: c.x + dir * 22 * a.escala * 0.7, y: c.y - 6 * a.escala * 0.5 };
  }

  async fx(tipo, a, d, acerta, ev) {
    const fn = { Fire: this.fxFogo, Water: this.fxAgua, Rock: this.fxPedra, Psychic: this.fxPsiquico }[tipo] || this.fxNormal;
    const potencia = acerta ? (ev.efetividade > 1 ? 1.5 : ev.efetividade < 1 ? 0.65 : 1) : 1;
    await fn.call(this, a, d, acerta, potencia);
    if (!acerta) {
      const dir = a.lado === "j" ? 1 : -1;
      // quem era o alvo se esquiva
      this.tw(d.off, { x: dir * 16, y: -8 }, 140, "Quad.out").then(() => this.tw(d.off, { x: 0, y: 0 }, 220, "Quad.in"));
      await this.esp(200);
    }
  }

  async avanco(a, dist, ida = 130) {
    await this.tw(a.off, { x: dist }, ida, "Quad.out");
  }

  async fxFogo(a, d, acerta, pot) {
    const dir = a.lado === "j" ? 1 : -1;
    const o = this.boca(a);
    const t = this.centro(d);
    const dest = acerta ? t : { x: t.x + dir * 190, y: t.y - 30 };
    this.tw(a.off, { x: -dir * 7 }, 150, "Quad.out").then(() => this.tw(a.off, { x: dir * 5 }, 100, "Quad.in")).then(() => this.tw(a.off, { x: 0 }, 160));
    this.brilhoEm(o.x, o.y, 0xffa63a, 2.2, 360);
    const proms = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      proms.push(this.esp(60 + i * 34).then(async () => {
        const jx = (Math.random() - 0.5) * 8;
        const jy = (Math.random() - 0.5) * 8;
        const f = this.add.image(o.x, o.y, "bt_chama").setDepth(18).setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(19 + Math.random() * 9, 27 + Math.random() * 12);
        const ang = Math.atan2(dest.y - o.y, dest.x - o.x);
        f.setRotation(ang + Math.PI / 2);
        await this.contar(320, (p) => {
          f.x = o.x + (dest.x - o.x + jx) * p;
          f.y = o.y + (dest.y - o.y + jy) * p - Math.sin(Math.PI * p) * 6;
          f.alpha = 1 - p * 0.3;
        }, "Quad.in");
        if (acerta) this.fagulhas(f.x, f.y);
        this.tw(f, { alpha: 0, scale: f.scale * 1.8 }, 160).then(() => f.destroy());
      }));
    }
    await Promise.all(proms);
    if (acerta) {
      this.brilhoEm(t.x, t.y, 0xff7a2a, 4.4 * pot, 460);
      this.brilhoEm(t.x, t.y, 0xffe58a, 2.6 * pot, 320);
      this.tintarPulso(d, 0xff6a2a);
    }
  }

  fagulhas(x, y) {
    for (let i = 0; i < 2; i++) {
      const e = this.add.image(x, y, "bt_chama").setDepth(17).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(5, 7);
      this.tweens.add({
        targets: e, x: x + (Math.random() - 0.5) * 36, y: y - 10 - Math.random() * 26, alpha: 0, duration: 520 * this.f, ease: "Cubic.out",
        onComplete: () => e.destroy(),
      });
    }
  }

  tintarPulso(rec, cor) {
    rec.img.setTint(cor);
    this.esp(220).then(() => rec.img.clearTint());
  }

  async fxAgua(a, d, acerta, pot) {
    const dir = a.lado === "j" ? 1 : -1;
    const o = this.boca(a);
    const t = this.centro(d);
    const dest = acerta ? t : { x: t.x + dir * 190, y: t.y - 20 };
    this.tw(a.off, { y: -4 }, 120).then(() => this.tw(a.off, { y: 0 }, 220, "Bounce.out"));
    const proms = [];
    for (let i = 0; i < 16; i++) {
      proms.push(this.esp(50 + i * 28).then(async () => {
        const gota = this.add.image(o.x, o.y, i % 4 === 0 ? "bt_bolha" : "bt_gota").setDepth(18).setDisplaySize(12 + Math.random() * 6, 16 + Math.random() * 7);
        const jy = (Math.random() - 0.5) * 8;
        await this.contar(340, (p) => {
          gota.x = o.x + (dest.x - o.x) * p;
          gota.y = o.y + (dest.y - o.y + jy) * p - Math.sin(Math.PI * p) * 22;
          gota.setRotation(Math.atan2(dest.y - o.y - Math.cos(Math.PI * p) * 22, dest.x - o.x) + Math.PI / 2);
        }, "Quad.in");
        if (acerta) this.respingo(gota.x, gota.y);
        gota.destroy();
      }));
    }
    await Promise.all(proms);
    if (acerta) {
      const anel = this.add.image(t.x, t.y + 10, "bt_anel").setTint(0x9ad4ff).setDepth(17).setDisplaySize(8, 8).setAlpha(0.9);
      this.tweens.add({ targets: anel, displayWidth: 78 * pot, displayHeight: 34 * pot, alpha: 0, duration: 520 * this.f, onComplete: () => anel.destroy() });
      this.brilhoEm(t.x, t.y, 0x7cc4ff, 3.4 * pot, 420);
      for (let i = 0; i < 6; i++) this.bolhaSobe(t.x + (Math.random() - 0.5) * 36, t.y + 8);
      this.tintarPulso(d, 0x8fd0ff);
    }
  }

  respingo(x, y) {
    const g = this.add.image(x, y, "bt_gota").setDepth(17).setDisplaySize(5, 7);
    this.tweens.add({
      targets: g, x: x + (Math.random() - 0.5) * 26, y: y + 8 + Math.random() * 10, alpha: 0, duration: 380 * this.f,
      ease: "Quad.in", onComplete: () => g.destroy(),
    });
  }

  bolhaSobe(x, y) {
    const b = this.add.image(x, y, "bt_bolha").setDepth(17).setDisplaySize(5 + Math.random() * 5, 5 + Math.random() * 5).setAlpha(0.9);
    this.tweens.add({
      targets: b, x: x + (Math.random() - 0.5) * 12, y: y - 22 - Math.random() * 20, alpha: 0, duration: (600 + Math.random() * 400) * this.f,
      onComplete: () => b.destroy(),
    });
  }

  async fxPedra(a, d, acerta, pot) {
    const t = this.centro(d);
    const chao = d.y - 4;
    const dir = a.lado === "j" ? 1 : -1;
    this.tw(a.off, { y: -10 }, 160, "Quad.out").then(() => this.tw(a.off, { y: 0 }, 200, "Bounce.out"));
    const proms = [];
    const n = acerta ? 6 : 5;
    for (let i = 0; i < n; i++) {
      proms.push(this.esp(100 + i * 85).then(async () => {
        const dx = acerta ? (i - (n - 1) / 2) * 11 : dir * 60 + (i - 2) * 10;
        const x = t.x + dx;
        const p = this.add.image(x, -30, "bt_pedra").setDepth(18).setDisplaySize(20 + Math.random() * 10, 20 + Math.random() * 10).setAngle(Math.random() * 90);
        const alvoY = acerta ? t.y + 6 + (i % 2) * 6 : chao + (i % 3) * 3;
        await this.tw(p, { y: alvoY, angle: p.angle + 200 }, 300, "Quad.in");
        this.poeiraPedra(x, alvoY);
        if (i % 2 === 0) this.cameras.main.shake(80, 0.0024);
        this.tw(p, { alpha: 0, y: p.y + 4 }, 260).then(() => p.destroy());
      }));
    }
    await Promise.all(proms);
    if (acerta) {
      this.brilhoEm(t.x, t.y + 6, 0xd9c9a0, 3 * pot, 320);
      this.tintarPulso(d, 0xb9a77a);
    }
  }

  poeiraPedra(x, y) {
    for (let i = 0; i < 4; i++) {
      const p = this.add.image(x, y, "bt_disco").setTint(0xcbb98f).setDepth(17).setAlpha(0.8).setDisplaySize(7, 7);
      this.tweens.add({
        targets: p, x: x + (i - 1.5) * 9, y: y - 4 - Math.random() * 7, alpha: 0, scale: p.scale * 2.2, duration: 460 * this.f,
        ease: "Sine.out", onComplete: () => p.destroy(),
      });
    }
  }

  async fxPsiquico(a, d, acerta, pot) {
    const dir = a.lado === "j" ? 1 : -1;
    const o = this.centro(a);
    const t = this.centro(d);
    const dest = acerta ? t : { x: t.x + dir * 190, y: t.y - 20 };
    this.brilhoEm(o.x, o.y, 0xd884ff, 3.6, 520);
    this.tw(a.off, { y: -9 }, 260, "Sine.out").then(() => this.tw(a.off, { y: 0 }, 260, "Sine.in"));
    const proms = [];
    for (let i = 0; i < 4; i++) {
      proms.push(this.esp(60 + i * 130).then(async () => {
        const r = this.add.image(o.x, o.y, "bt_onda").setTint(i % 2 ? 0xe27bff : 0xb88cff).setDepth(18).setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(8, 8).setAlpha(0.9);
        r.setAngle(0);
        await this.contar(380, (p) => {
          r.x = o.x + (dest.x - o.x) * p;
          r.y = o.y + (dest.y - o.y) * p;
          const w = 8 + p * 40;
          r.setDisplaySize(w, w * (1 + Math.sin(p * 9) * 0.2));
          r.alpha = 0.9 - p * 0.2;
        }, "Sine.in");
        if (acerta) {
          this.tw(r, { alpha: 0, displayWidth: 110 * pot, displayHeight: 110 * pot }, 360, "Cubic.out").then(() => r.destroy());
        } else {
          this.tw(r, { alpha: 0, x: r.x + dir * 70 }, 300).then(() => r.destroy());
        }
      }));
    }
    await Promise.all(proms);
    if (acerta) {
      this.brilhoEm(t.x, t.y, 0xe27bff, 4 * pot, 520);
      this.tintarPulso(d, 0xe9a0ff);
      // a criatura "ondula"
      this.contar(420, (p) => {
        d.off.sx = 1 + Math.sin(p * 34) * 0.07 * (1 - p);
        d.off.sy = 1 - Math.sin(p * 34) * 0.07 * (1 - p);
      }).then(() => { d.off.sx = 1; d.off.sy = 1; });
      this.rajadaTela(0xc45fd0);
    }
  }

  rajadaTela(cor) {
    const r = this.add.rectangle(240, 135, 2000, 1400, cor, 0.28).setDepth(8000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: r, alpha: 0, duration: 380 * this.f, onComplete: () => r.destroy() });
  }

  async fxNormal(a, d, acerta, pot) {
    const dir = a.lado === "j" ? 1 : -1;
    const t = this.centro(d);
    const dist = (t.x - a.x) * (acerta ? 0.78 : 0.5);
    await this.tw(a.off, { x: -dir * 9 }, 130, "Quad.out");
    this.rastro(a);
    await this.tw(a.off, { x: dist, y: -3 }, 150, "Quad.in");
    if (acerta) {
      this.brilhoEm(t.x - dir * 8, t.y, 0xffffff, 3.2 * pot, 320);
      const e = this.add.image(t.x - dir * 8, t.y, "bt_estrela").setDepth(19).setDisplaySize(16 * pot, 16 * pot).setAngle(Math.random() * 40);
      this.tweens.add({ targets: e, scale: e.scale * 2, alpha: 0, angle: e.angle + 60, duration: 360 * this.f, ease: "Cubic.out", onComplete: () => e.destroy() });
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 * i) / 8;
        const r = this.add.image(t.x - dir * 8, t.y, "bt_raio").setDepth(18).setRotation(ang).setDisplaySize(5, 2.2).setAlpha(0.95).setOrigin(0, 0.5);
        this.tweens.add({
          targets: r, x: r.x + Math.cos(ang) * 22, y: r.y + Math.sin(ang) * 22, displayWidth: 14 * pot, alpha: 0, duration: 340 * this.f, ease: "Cubic.out",
          onComplete: () => r.destroy(),
        });
      }
    }
    this.tw(a.off, { x: 0, y: 0 }, 260, "Quad.out");
  }

  rastro(a) {
    for (let i = 0; i < 4; i++) {
      const s = this.add.image(a.img.x, a.img.y, a.img.texture.key).setOrigin(0.5, PES / CAIXA_H).setScale(a.img.scaleX, a.img.scaleY)
        .setAlpha(0.22).setDepth(a.img.depth - 0.1).setTintFill(0xffffff);
      this.tweens.add({ targets: s, alpha: 0, duration: 260 * this.f, delay: i * 50 * this.f, onComplete: () => s.destroy() });
    }
  }

  // ---------------- outros efeitos ----------------

  async fxCura(rec) {
    const c = this.centro(rec);
    this.brilhoEm(c.x, c.y, 0x6df0a0, 3, 560);
    for (let i = 0; i < 8; i++) {
      this.esp(i * 60).then(() => {
        const k = this.add.image(c.x + (Math.random() - 0.5) * 40, c.y + 10, "bt_cruz").setDepth(17).setDisplaySize(7, 7).setAlpha(0.95);
        this.tweens.add({ targets: k, y: k.y - 34 - Math.random() * 14, alpha: 0, duration: 760 * this.f, ease: "Sine.out", onComplete: () => k.destroy() });
      });
    }
    await this.esp(500);
  }

  async fxDesmaio(rec) {
    rec.vivo = false;
    const c = this.centro(rec);
    this.poeira(rec.x, rec.y, 6);
    await Promise.all([
      this.tw(rec.off, { y: 26, sy: 0.15, a: 0 }, 640, "Quad.in"),
      this.tw(rec.off, { sx: 1.15 }, 640),
    ]);
    this.brilhoEm(c.x, c.y + 14, 0xc7d2e0, 1.4, 300);
  }

  fxNivel(rec) {
    const c = this.centro(rec);
    this.cameras.main.flash(160 * this.f, 255, 240, 170, false);
    for (let i = 0; i < 3; i++) {
      this.esp(i * 130).then(() => {
        const an = this.add.image(c.x, c.y + 20, "bt_anel").setTint(0xf2b84b).setDepth(17).setDisplaySize(8, 8).setAlpha(0.95)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: an, displayWidth: 96, displayHeight: 40, alpha: 0, y: an.y - 36, duration: 700 * this.f, ease: "Cubic.out", onComplete: () => an.destroy() });
      });
    }
    this.brilhoEm(c.x, c.y, 0xffe9a0, 4.6, 640);
    for (let i = 0; i < 12; i++) {
      this.esp(i * 45).then(() => {
        const e = this.add.image(c.x + (Math.random() - 0.5) * 56, c.y + 24, "bt_estrela").setTint(0xffe27a).setDepth(17).setDisplaySize(8, 8);
        this.tweens.add({ targets: e, y: e.y - 56 - Math.random() * 20, alpha: 0, angle: 140, duration: 900 * this.f, ease: "Sine.out", onComplete: () => e.destroy() });
      });
    }
  }

  // ---------------- eventos compostos ----------------

  async evTroca(ev) {
    const jog = ev.quem === "jogador";
    if (jog) {
      if (!ev.forcada && this.rJ && this.rJ.vivo) {
        await this.dizer(`Volte, ${nomeBase(ev.de)}!`, { espera: 160 });
        await this.recolher(this.rJ);
        this.ui.esconderInfo("j");
      }
      this.apagarRec(this.rJ);
      const novo = this.timeLocal.find((m) => m.nome === ev.para) || this.est.jogador.time.find((m) => m.nome === ev.para);
      const dados = { ...novo, hp: novo.hp };
      this.rJ = this.crearRec("j", dados);
      await this.dizer(`Vai, ${nomeBase(ev.para)}!`, { espera: 160 });
      await this.entrar(this.rJ, { x: PLAT_J.x - 56, y: PLAT_J.y - 40 });
      this.ui.info("j", { nome: nomeBase(dados.nome), nivel: dados.nivel, tipo: dados.tipo, hp: dados.hp, hpMax: dados.hp_max });
      const at = this.estFinal.jogador.ativo;
      if (at.nome === ev.para) { this.ui.xp(this.fracXp(at.xp, at.nivel)); this.xpAtual = { nivel: at.nivel, xp: at.xp }; }
    } else {
      this.apagarRec(this.rO);
      const novo = this.estFinal.oponente.ativo;
      this.rO = this.crearRec("o", novo);
      if (this.tipo !== "selvagem") await this.dizer(`${this.nomeAdv} vai mandar ${nomeBase(ev.para)}!`, { espera: 500 });
      await this.entrar(this.rO, { x: PLAT_O.x + 40, y: PLAT_O.y - 70 });
      this.ui.info("o", { nome: nomeBase(novo.nome), nivel: novo.nivel, tipo: novo.tipo, hp: novo.hp_max, hpMax: novo.hp_max });
    }
  }

  async recolher(rec) {
    const c = this.centro(rec);
    rec.img.setTintFill(0xff4a4a);
    this.brilhoEm(c.x, c.y, 0xff6a6a, 2.6, 300);
    await Promise.all([this.tw(rec.off, { sx: 0.05, sy: 0.05, a: 0 }, 300, "Quad.in")]);
    rec.img.clearTint();
  }

  async evXp(ev) {
    const rec = this.rJ;
    const nome = nomeBase(ev.pokemon);
    await this.dizer(`${nome} ganhou ${ev.ganho} pontos de experiencia!`, { espera: 260 });
    const ui = this.ui;
    const xpAntes = ev.xp_total - ev.ganho;
    let nivel = ev.nivel_antes;
    let hpAtual = this.timeLocal.find((m) => m.nome === ev.pokemon)?.hp ?? ev.hp;
    if (ev.nivel_depois > ev.nivel_antes) {
      let f0 = this.fracXp(xpAntes, nivel);
      for (; nivel < ev.nivel_depois; nivel++) {
        await this.contar(520, (p) => ui.xp(f0 + (1 - f0) * p), "Quad.out");
        this.fxNivel(rec);
        ui.nivel("j", nivel + 1);
        await this.dizer(`${nome} subiu para o nivel ${nivel + 1}!`, { tecla: true });
        ui.xp(0);
        f0 = 0;
      }
      ui.hp("j", ev.hp / ev.hp_max, ev.hp, ev.hp_max);
      await this.contar(520, (p) => ui.xp(this.fracXp(ev.xp_total, ev.nivel_depois) * p), "Quad.out");
    } else {
      const f0 = this.fracXp(xpAntes, nivel);
      const f1 = this.fracXp(ev.xp_total, nivel);
      await this.contar(620, (p) => ui.xp(f0 + (f1 - f0) * p), "Quad.out");
    }
    this.xpAtual = { nivel: ev.nivel_depois, xp: ev.xp_total };
    await this.esp(300);
  }

  async evCaptura(ev) {
    const o = this.rO;
    const j = this.rJ;
    const de = this.boca(j);
    const alvo = this.centro(o);
    const nome = nomeBase(ev.pokemon);
    await this.dizer("Voce jogou uma pokebola!", { espera: 150 });
    const bola = this.add.image(de.x, de.y, "bt_bola").setDisplaySize(20, 20).setDepth(14);
    const giro = this.tweens.add({ targets: bola, angle: 900, duration: 620 * this.f });
    await this.arco(bola, de, alvo, 620, 54);
    giro.stop();
    // a criatura vira luz e entra na bola
    this.brilhoEm(alvo.x, alvo.y, 0xff6a6a, 3.2, 360);
    o.img.setTintFill(0xff5a5a);
    await this.tw(o.off, { sx: 0.05, sy: 0.05, y: -34 * o.escala * 0.5 }, 330, "Quad.in");
    o.off.a = 0;
    o.img.clearTint();
    bola.setAngle(0);
    const chao = o.y - 8;
    await this.tw(bola, { y: chao }, 460, "Bounce.out");
    await this.esp(260);
    for (let i = 0; i < ev.balancadas; i++) {
      await this.tw(bola, { angle: -24 }, 150, "Sine.out");
      await this.tw(bola, { angle: 24 }, 260, "Sine.inOut");
      await this.tw(bola, { angle: 0 }, 150, "Sine.in");
      await this.esp(420);
    }
    if (ev.sucesso) {
      this.estrelas(bola.x, bola.y - 4, 10, 0xfff2a8, 30);
      this.brilhoEm(bola.x, bola.y, 0xfff2a8, 2.8, 480);
      bola.setTint(0xd2d6e6);
      await this.tw(bola, { y: bola.y - 4 }, 140, "Quad.out");
      await this.tw(bola, { y: bola.y + 4 }, 200, "Bounce.out");
      await this.dizer(`Capturou ${nome}!`, { espera: 700 });
      this.bolaCapturada = bola;
    } else {
      bola.setTexture("bt_bola_aberta");
      this.brilhoEm(bola.x, bola.y, 0xffffff, 3.2, 360);
      this.tw(bola, { alpha: 0 }, 160).then(() => bola.destroy());
      o.img.setTintFill(0xffffff);
      o.off.a = 1;
      await this.tw(o.off, { sx: 1, sy: 1, y: 0 }, 340, "Back.out");
      o.img.clearTint();
      await this.dizer(ev.balancadas >= 3 ? `Quase! ${nome} escapou!` : `${nome} escapou da pokebola!`, { espera: 600 });
    }
  }

  // ---------------- final ----------------

  async final() {
    const ui = this.ui;
    const res = this.resultado || this.est.resultado;
    const jogo = this.ultimoJogo;
    if (res === "vitoria" && this.tipo !== "selvagem" && this.tO) {
      this.tO.img.setAlpha(1).x = 580;
      this.tO.sombra.setAlpha(1).x = 580;
      this.tO.img.setAlpha(1);
      await Promise.all([this.tw(this.tO.img, { x: PLAT_O.x }, 520, "Cubic.out"), this.tw(this.tO.sombra, { x: PLAT_O.x }, 520, "Cubic.out"),
        this.tO.aura ? this.tw(this.tO.aura, { x: PLAT_O.x }, 520, "Cubic.out") : Promise.resolve()]);
      await this.dizer(`Voce derrotou ${this.nomeAdv}!`, { espera: 700 });
      if (this.tipo === "lider") await this.dizer('"Foi uma boa batalha. O ginasio e seu."', { espera: 900 });
    }
    // termometro: onde o resultado real caiu
    if (jogo) {
      const hp = res === "derrota" ? 0 : jogo.time.reduce((s, m) => s + m.hp, 0);
      const frac = clamp(hp / this.hpMaxInicial, 0, 1);
      const h = this.previsao.hp_restante;
      const dentro = frac >= h.p10 - 1e-9 && frac <= h.p90 + 1e-9;
      const rotulo = `Real: ${Math.round(frac * 100)}% do HP, ${dentro ? "dentro" : "fora"} da faixa p10-p90`;
      ui.termometroReal(frac, rotulo);
    }
    const texto = {
      vitoria: this.tipo === "selvagem" ? "Voce venceu a batalha!" : "Voce venceu!",
      derrota: "Todos os seus Pokemon desmaiaram...",
      fuga: "Voce voltou pro mapa.",
      captura: "Captura concluida.",
    }[res] || "Fim da batalha.";
    await this.dizer(texto, { tecla: true });
    return { resultado: res, jogo };
  }

  async sair(saida) {
    this.ui.limparEscolha();
    await this.transicao("cobrir", 300);
    this.ui.esconder();
    for (const o of [...this.extras, ...this.recs.flatMap((r) => [r.img, r.sombra]), this.tJ?.img, this.tJ?.sombra, this.tO?.img, this.tO?.sombra, this.tO?.aura, this.bolaCapturada]) {
      if (o && o.destroy) o.destroy();
    }
    this.recs = [];
    this.scene.setVisible(true, "mundo");
    this.scene.resume("mundo");
    await this.transicao("revelar", 270);
    this.d.aoFim(saida);
    this.scene.stop();
  }
}
