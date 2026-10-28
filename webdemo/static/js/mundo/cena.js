// Cena do mundo 2.5D. Renderiza o MESMO grid que a API ja devolve
// (/api/t2/jogo/novo) e anda o jogador pelo MESMO endpoint de movimento
// (/api/t2/jogo/mover). Nenhuma regra do jogo mora aqui: o cliente so
// PRE-CHECA com os campos que a API manda (pisavel_sem_surf / pisavel_com_surf)
// pra dar resposta imediata, e o servidor continua sendo quem decide.

import { api } from "../api.js";
import {
  ALTURA, CONTEUDO_GINASIO, DIRECOES, ESC, FOLGA, MARGEM_MAPA, TECLAS, TEMPO_PASSO, TH, TW,
  ZOOM_MAX_REL, ZOOM_MIN_REL, profundidade, projetar, topoDe,
} from "./constantes.js";
import { CORES_CRIATURA, NUM_VARIANTES, gerarTexturas } from "./texturas.js";
import { FACE, FOLHAS_CPU, PES_Y, CEL_H, gerarPersonagens } from "./personagens.js";

// Faixas da tela ocupadas por HUD (esquerda) e ajuda (rodape), em px de CSS.
// O mapa e enquadrado na area livre pra nada ficar escondido atras delas.
const RESERVA = { esq: 270, topo: 0, base: 70 };

// escala: tamanho relativo do desenho (props discretos, o Centro e o jogador
// mandam na leitura). sombra: escala da sombra no chao.
const PROPS = {
  bloqueio: { chave: "arvore", sombra: 0.8, origemY: 0.96, escala: 0.72 },
  pokemon: { chave: "criatura_0_0", sombra: 0.5, origemY: 0.95, escala: 0.7 },
  cpu: { chave: "folha_cpuA", sombra: 0.55, origemY: PES_Y / CEL_H, escala: 0.88 },
  pokebola: { chave: "pokebola", sombra: 0.35, origemY: 1.0, escala: 0.62 },
  surf: { chave: "surf", sombra: 0.45, origemY: 0.9, escala: 0.7 },
  centro: { chave: "centro", sombra: 0.85, origemY: 0.97, escala: 0.66 },
  [CONTEUDO_GINASIO]: { chave: "ginasio", sombra: 1.2, origemY: 0.97, escala: 0.9 },
};


const NOME_CONTEUDO = {
  bloqueio: "arvore (bloqueio)", pokemon: "pokemon selvagem", cpu: "treinador",
  pokebola: "pokebola", surf: "item Surf", centro: "Centro Pokemon", livre: "livre",
  visitado: "visitado", [CONTEUDO_GINASIO]: "ginasio",
};

const NOME_TERRENO = { concrete: "concreto", grass: "grama", water: "agua" };

function parametros() {
  const q = new URLSearchParams(location.search);
  const inteiro = (nome, padrao) => {
    const v = parseInt(q.get(nome), 10);
    return Number.isFinite(v) ? v : padrao;
  };
  // ?ginasio=r,c so existe pra pre-visualizar o tile reservado, ja que o grid
  // ainda nao gera nenhum. Nao muda regra nenhuma, so o desenho dessa celula.
  const g = (q.get("ginasio") || "").split(",").map((x) => parseInt(x, 10));
  return {
    size: inteiro("size", 12),
    seed: inteiro("seed", 42),
    energia: q.get("energia") || undefined,
    // ?lento=N estica o passo N vezes, so pra capturar um quadro no meio dele
    lento: Math.max(1, inteiro("lento", 1)),
    ginasio: g.length === 2 && g.every(Number.isFinite) ? g : null,
  };
}

export class CenaMundo extends Phaser.Scene {
  constructor() {
    super("mundo");
    this.ocupado = false;
    this.encerrado = false;
    this.props = new Map(); // "r,c" -> { objeto, sombra, marcador }
    this.vivos = []; // entidades com idle manual (bob, respiracao, piscada), ver animarVivos
    this.tufos = new Map(); // "r,c" -> sprite de grama que balanca
    this.ultimoPasso = -1e9;
  }

  create() {
    gerarTexturas(this);
    gerarPersonagens(this);
    // Aviso em DOM (nitido em qualquer densidade de pixel).
    this.aviso = document.getElementById("aviso");
    this.aviso.textContent = "carregando mapa...";
    this.carregar().catch((erro) => {
      this.aviso.textContent = "erro: " + erro.message;
      console.error(erro);
    });
    this.scale.on("resize", () => this.aoRedimensionar());

    this.teclas = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,W,A,S,D,R");
    this.input.on("wheel", (_p, _o, _dx, dy) => {
      if (!this.zoomBase) return;
      const cam = this.cameras.main;
      const z = Phaser.Math.Clamp(
        cam.zoom * (dy > 0 ? 0.9 : 1.1), this.zoomBase * ZOOM_MIN_REL, this.zoomBase * ZOOM_MAX_REL,
      );
      cam.setZoom(z);
      this.zoomManual = true;
    });
    this.recarregarTeclaSolta = true;
    // Buffer de 1 passo: se a tecla vem com um passo em andamento (requisicao
    // em voo ou animacao), so a ULTIMA fica guardada e sai quando ele termina.
    // Sem fila longa. Toque rapido tambem passa por aqui (o poll de isDown no
    // update perderia um keydown+keyup dentro do mesmo quadro).
    this.proximo = null;
    this.input.keyboard.on("keydown", (e) => {
      if (e.repeat) return; // tecla segurada e tratada pelo poll do update
      const nome = e.key.replace(/^Arrow/, "").toUpperCase();
      const dir = TECLAS[nome];
      if (!dir || !this.sessao || this.encerrado) return;
      if (this.ocupado) this.proximo = dir;
      else this.tentarPasso(dir);
    });
  }

  async carregar() {
    const p = parametros();
    const jogo = await api.jogoNovo(p.size, p.seed, p.energia);
    this.sessao = jogo.sessao;
    this.size = jogo.size;
    this.celulas = jogo.celulas;
    this.centros = jogo.centros || [];
    this.jogador = jogo.jogador;
    this.energia = { atual: jogo.jogador.energia, max: jogo.jogador.energia_max };
    this.fatorTempo = p.lento;
    this.ginasios = p.ginasio ? [p.ginasio] : [];
    this.aviso.hidden = true;

    this.montarMapa();
    this.criarJogador(jogo.posicao);
    this.configurarCamera();
    this.atualizarHud(`Mapa ${this.size}x${this.size}, seed ${jogo.seed}. Use as setas ou WASD.`);
    this.atualizarMarcadorCentro();
  }

  // Conteudo que decide o desenho da celula. Centro vem tambem da lista
  // `centros` da API (e o campo que o mapa 2D usa); ginasio e o tipo reservado.
  tipoDoConteudo(r, c) {
    if (this.ginasios.some(([gr, gc]) => gr === r && gc === c)) return CONTEUDO_GINASIO;
    if (this.centros.some(([cr, cc]) => cr === r && cc === c)) return "centro";
    return this.celulas[r][c].conteudo;
  }

  montarMapa() {
    this.camadaAgua = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cel = this.celulas[r][c];
        const base = projetar(r, c);
        const variante = (r * 7 + c * 13) % NUM_VARIANTES;
        const tile = this.add.image(base.x, base.y, `tile_${cel.terreno}_${variante}`)
          .setOrigin(0, 1).setScale(1 / ESC).setDepth(profundidade(r));
        if (cel.terreno === "water") { this.camadaAgua.push(tile); this.brilhoAgua(r, c); }
        if (cel.terreno === "grass") this.plantarTufo(r, c);
        this.colocarProp(r, c, this.tipoDoConteudo(r, c));
      }
    }
    // Brilho lento da agua: um unico tween move o alfa de todas as celulas.
    this.tweens.add({
      targets: this.camadaAgua, alpha: { from: 1, to: 0.9 }, duration: 1400,
      yoyo: true, repeat: -1, ease: "Sine.inOut",
    });
  }

  // Brilho da agua: um traco claro que acende e apaga em tempos defasados.
  brilhoAgua(r, c) {
    const h = (r * 31 + c * 17) % 11;
    const topo = topoDe(r, c, ALTURA.water);
    const x = topo.x + ((h % 5) - 2) * 6;
    const y = topo.y - 2 + ((h % 3) - 1) * 4;
    const b = this.add.image(x, y, "brilhoAgua").setScale(1 / ESC)
      .setDepth(profundidade(r) + 0.05).setAlpha(0);
    this.tweens.add({
      targets: b, alpha: { from: 0, to: 0.85 }, x: x + 4, duration: 900, yoyo: true,
      repeat: -1, repeatDelay: 600 + h * 120, delay: h * 230, ease: "Sine.inOut",
    });
  }

  // Tufo de grama decorativo: balanca quando o jogador pisa na celula.
  plantarTufo(r, c) {
    const h = (r * 11 + c * 7) % 10;
    if (h > 4) return;
    const topo = topoDe(r, c, ALTURA.grass);
    const t = this.add.image(topo.x + (h - 2) * 7, topo.y + 6 - (h % 2) * 5, "tufo")
      .setOrigin(0.5, 1).setScale(0.9 / ESC).setDepth(profundidade(r) + 0.2);
    this.tufos.set(`${r},${c}`, t);
  }

  balancarGrama(r, c) {
    const t = this.tufos.get(`${r},${c}`);
    if (!t) return;
    this.tweens.killTweensOf(t);
    t.setAngle(0);
    this.tweens.add({
      targets: t, angle: { from: -16, to: 16 }, duration: 110, yoyo: true, repeat: 2,
      ease: "Sine.inOut", onComplete: () => t.setAngle(0),
    });
  }

  colocarProp(r, c, tipo) {
    const def = PROPS[tipo];
    if (!def) return; // livre / visitado: so o chao
    const cel = this.celulas[r][c];
    const alt = ALTURA[cel.terreno] ?? ALTURA.concrete;
    const topo = topoDe(r, c, alt);
    const d = profundidade(r);
    const sombra = this.add.image(topo.x, topo.y, "sombra")
      .setScale(def.sombra / ESC).setDepth(d + 0.1);
    let chave = def.chave;
    let frame;
    const h = (r * 5 + c * 3) % 3;
    if (tipo === "pokemon") chave = `criatura_${h}_0`;
    if (tipo === "cpu") { chave = "folha_" + FOLHAS_CPU[h]; frame = "baixo_0"; }
    const objeto = this.add.image(topo.x, topo.y + 3, chave, frame)
      .setOrigin(0.5, def.origemY).setScale(def.escala / ESC).setDepth(d + 0.3);
    const entrada = { objeto, sombra };
    const fase = (r * 977 + c * 331) % 3000;
    const base = { y: objeto.y, sx: objeto.scaleX, sy: objeto.scaleY };
    if (tipo === "pokemon") {
      entrada.vivo = { tipo: "criatura", obj: objeto, sombra, fase, base, pal: h };
    } else if (tipo === "cpu") {
      // treinador CPU vira pra uma direcao fixa por celula e respira
      const faces = ["baixo_0", "baixo_0", "cima_0", "dir_0"];
      const f = faces[(r + 2 * c) % faces.length];
      objeto.setFrame(f);
      if ((r + c) % 5 === 4) objeto.setFlipX(true);
      entrada.vivo = { tipo: "gente", obj: objeto, sombra, fase, base };
    } else if (tipo === "pokebola" || tipo === "surf") {
      entrada.vivo = { tipo: "item", obj: objeto, sombra, fase, base };
    } else if (tipo === "centro") {
      // luz pulsando no telhado, bem discreta
      const luz = this.add.image(objeto.x, objeto.y - 15.6, "luz").setScale(0.7 / ESC)
        .setDepth(d + 0.35).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.2);
      this.tweens.add({
        targets: luz, alpha: { from: 0.1, to: 0.4 }, duration: 1500 + fase % 500, yoyo: true,
        repeat: -1, ease: "Sine.inOut", delay: fase % 700,
      });
      entrada.luz = luz;
    } else if (tipo === CONTEUDO_GINASIO) {
      const mx = objeto.x;
      const my = objeto.y + (3 - 0.97 * 57) * def.escala;
      const bandeira = this.add.image(mx, my, "bandeira_0").setOrigin(0, 2 / 14)
        .setScale(def.escala / ESC).setDepth(d + 0.35);
      const ordem = [0, 1, 0, 2];
      let i = 0;
      this.time.addEvent({
        delay: 170, loop: true, callback: () => { i = (i + 1) % ordem.length; bandeira.setTexture(`bandeira_${ordem[i]}`); },
      });
      entrada.bandeira = bandeira;
    }
    if (entrada.vivo) this.vivos.push(entrada.vivo);

    if (tipo === "centro" || tipo === CONTEUDO_GINASIO) {
      // Marcacao visivel: anel pulsante no chao + seta jade flutuando acima.
      // Anel discreto no chao em todo Centro; a seta so aparece no mais proximo
      // do jogador (atualizarMarcadorCentro), pra nao poluir o mapa.
      entrada.anel = this.add.image(topo.x, topo.y, "anel").setScale(1 / ESC)
        .setDepth(d + 0.05).setAlpha(0.55);
    }
    this.props.set(`${r},${c}`, entrada);
  }

  removerProp(r, c) {
    const e = this.props.get(`${r},${c}`);
    if (!e) return;
    this.tweens.add({
      targets: [e.objeto, e.sombra], alpha: 0, y: "-=8", duration: 180,
      onComplete: () => { e.objeto.destroy(); e.sombra.destroy(); if (e.anel) e.anel.destroy(); },
    });
    if (e.vivo) this.vivos = this.vivos.filter((v) => v !== e.vivo);
    for (const extra of [e.luz, e.bandeira]) if (extra) this.tweens.add({ targets: extra, alpha: 0, duration: 180, onComplete: () => extra.destroy() });
    this.props.delete(`${r},${c}`);
  }

  criarJogador([r, c]) {
    this.ESC_J = 0.98 / ESC;
    this.lin = r;
    this.col = c;
    const alt = ALTURA[this.celulas[r][c].terreno];
    const topo = topoDe(r, c, alt);
    this.sombraJogador = this.add.image(topo.x, topo.y, "sombra").setScale(0.8 / ESC);
    // anel jade pulsando sob os pes: marca o jogador entre os treinadores CPU
    this.anelJogador = this.add.image(topo.x, topo.y, "anelJogador").setScale(1 / ESC);
    this.tweens.add({
      targets: this.anelJogador, alpha: { from: 1, to: 0.55 }, duration: 800,
      yoyo: true, repeat: -1, ease: "Sine.inOut",
    });
    this.spriteJogador = this.add.image(topo.x, topo.y + 3, "folha_jogador", "baixo_0")
      .setOrigin(0.5, PES_Y / CEL_H).setScale(this.ESC_J);
    this.faceAtual = "baixo";
    this.passoPar = 0;
    this.andando = false;
    this.ponto = { x: topo.x, y: topo.y };
    this.depthJogador(r);
  }

  depthJogador(r) {
    const d = profundidade(r) + 0.6;
    this.sombraJogador.setDepth(d - 0.3);
    this.anelJogador.setDepth(d - 0.2);
    this.spriteJogador.setDepth(d);
  }

  // Seta jade so no Centro mais proximo (distancia de Manhattan, a que o
  // jogador paga andando). Dado continua vindo da API; so a leitura muda.
  atualizarMarcadorCentro() {
    let melhor = null;
    let dist = Infinity;
    for (const [cr, cc] of this.centros) {
      const d = Math.abs(cr - this.lin) + Math.abs(cc - this.col);
      if (d < dist && this.props.has(`${cr},${cc}`)) { dist = d; melhor = [cr, cc]; }
    }
    const chave = melhor ? `${melhor[0]},${melhor[1]}` : null;
    if (chave === this.chaveMarcada) return;
    this.chaveMarcada = chave;
    if (this.marcador) { this.marcador.tween.stop(); this.marcador.img.destroy(); this.marcador = null; }
    if (!melhor) return;
    const e = this.props.get(chave);
    const y = e.objeto.y - e.objeto.displayHeight - 3;
    const img = this.add.image(e.objeto.x, y, "marcador").setScale(0.8 / ESC)
      .setDepth(1000).setAlpha(0.8);
    const tween = this.tweens.add({
      targets: img, y: y - 4, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut",
    });
    this.marcador = { img, tween };
  }

  // Zoom que enquadra o mapa inteiro com margem, em px fisicos do canvas.
  calcularZoomBase() {
    const dpr = this.dpr();
    const cam = this.cameras.main;
    const mapaW = this.size * TW;
    const mapaH = this.size * TH + FOLGA;
    const m = MARGEM_MAPA * dpr;
    const livreW = cam.width - RESERVA.esq * dpr;
    const livreH = cam.height - (RESERVA.topo + RESERVA.base) * dpr;
    return Math.min((livreW - 2 * m) / mapaW, (livreH - 2 * m) / mapaH);
  }

  // Razao de pixels do canvas (canvas fisico / tamanho CSS da janela).
  dpr() {
    return this.scale.width / window.innerWidth || 1;
  }

  configurarCamera() {
    const cam = this.cameras.main;
    cam.setBackgroundColor("#0b0f14");
    this.zoomBase = this.calcularZoomBase();
    cam.setZoom(this.zoomBase);
    this.zoomManual = false;
    cam.roundPixels = false;
    // Alvo da camera: o jogador quando o mapa nao cabe na janela, o centro do
    // mapa quando cabe (atualizarAlvoCamera, chamado a cada quadro).
    this.alvoCamera = { x: this.ponto.x, y: this.ponto.y };
    this.centroMapa = { x: (this.size * TW) / 2, y: (this.size * TH) / 2 };
    this.atualizarAlvoCamera(true);
    cam.startFollow(this.alvoCamera, false, 0.12, 0.12);
    cam.centerOn(this.alvoCamera.x, this.alvoCamera.y);
  }

  atualizarAlvoCamera() {
    if (!this.alvoCamera) return;
    const cam = this.cameras.main;
    const dpr = this.dpr();
    const livreW = cam.width - RESERVA.esq * dpr;
    const livreH = cam.height - (RESERVA.topo + RESERVA.base) * dpr;
    const cabeX = this.size * TW * cam.zoom <= livreW;
    const cabeY = (this.size * TH + FOLGA) * cam.zoom <= livreH;
    // o centro da area livre (fora do HUD e da ajuda) nao e o centro da tela:
    // o alvo anda o deslocamento correspondente, em unidades do mundo
    const dx = (RESERVA.esq * dpr) / 2 / cam.zoom;
    const dy = ((RESERVA.topo - RESERVA.base) * dpr) / 2 / cam.zoom;
    this.alvoCamera.x = (cabeX ? this.centroMapa.x : this.ponto.x) - dx;
    this.alvoCamera.y = (cabeY ? this.centroMapa.y : this.ponto.y) - dy;
  }

  aoRedimensionar() {
    if (!this.zoomBase) return;
    const cam = this.cameras.main;
    const relativo = cam.zoom / this.zoomBase;
    this.zoomBase = this.calcularZoomBase();
    cam.setZoom(this.zoomBase * (this.zoomManual ? relativo : 1));
  }

  // Pre-checagem com a MESMA ordem de game.mover: dentro do mapa, conteudo
  // inacessivel, agua sem surf. Os campos pisavel_* vem prontos da API.
  precheck(dr, dc) {
    const r = this.lin + dr;
    const c = this.col + dc;
    if (r < 0 || c < 0 || r >= this.size || c >= this.size) return { ok: false, motivo: "fora do mapa" };
    const cel = this.celulas[r][c];
    const pisavel = this.jogador.surf ? cel.pisavel_com_surf : cel.pisavel_sem_surf;
    if (pisavel) return { ok: true };
    if (cel.conteudo === "bloqueio") return { ok: false, motivo: "celula inacessivel" };
    return { ok: false, motivo: "agua sem surf" };
  }

  update(t) {
    if (!this.sessao) return;
    this.animarVivos(t);
    this.atualizarAlvoCamera();
    if (this.ocupado || this.encerrado) return;
    const T = this.teclas;
    for (const nome of Object.keys(TECLAS)) {
      if (T[nome] && T[nome].isDown) {
        this.tentarPasso(TECLAS[nome]);
        return;
      }
    }
    if (T.R.isDown && this.recarregarTeclaSolta) {
      this.recarregarTeclaSolta = false;
      this.recarregar();
    } else if (T.R.isUp) {
      this.recarregarTeclaSolta = true;
    }
  }

  async tentarPasso(dir) {
    const [dr, dc] = DIRECOES[dir];
    const pre = this.precheck(dr, dc);
    this.ocupado = true;
    if (!pre.ok) {
      this.tremer(dr, dc);
      this.atualizarHud(`Bloqueado: ${pre.motivo}.`);
      this.time.delayedCall(220, () => {
        this.ocupado = false;
        const prox = this.proximo;
        this.proximo = null;
        if (prox && !this.encerrado) this.tentarPasso(prox);
      });
      return;
    }
    try {
      const res = await api.jogoMover(this.sessao, dir);
      this.jogador = res.jogador;
      this.energia = { atual: res.jogador.energia, max: res.jogador.energia_max };
      if (!res.valido) {
        this.tremer(dr, dc);
        this.atualizarHud(res.desmaiou ? "Sem energia: desmaiou." : `Recusado: ${res.motivo}.`);
      } else {
        await this.animarPasso(res.posicao, dir);
        const [r, c] = res.posicao;
        this.celulas[r][c] = { ...this.celulas[r][c], conteudo: res.celula.conteudo };
        if (res.celula.conteudo === "visitado") this.removerProp(r, c);
        this.atualizarMarcadorCentro();
        this.atualizarHud(this.relato(res));
      }
    } catch (erro) {
      this.atualizarHud("erro: " + erro.message);
      console.error(erro);
    }
    if (this.jogador.situacao !== "jogando") {
      this.encerrado = true;
      this.atualizarHud(`Partida encerrada: ${this.jogador.situacao}${this.jogador.motivo ? " (" + this.jogador.motivo + ")" : ""}.`);
    }
    this.ocupado = false;
    // sai o passo guardado enquanto este estava em voo (so a ultima tecla)
    const guardado = this.proximo;
    this.proximo = null;
    if (guardado && !this.encerrado) this.tentarPasso(guardado);
  }

  relato(res) {
    const partes = [];
    if (res.batalhou) partes.push(`batalha (HP -${res.hp_perdido})`);
    if (res.pegou_pokebola) partes.push("pegou pokebola");
    if (res.pegou_surf) partes.push("pegou Surf: agua liberada");
    if (res.em_centro) partes.push("no Centro (R recarrega)");
    if (res.energia_gasta) partes.push(`-${res.energia_gasta} energia`);
    return partes.length ? partes.join(", ") + "." : "Passo.";
  }

  // Vira o boneco pra direcao `dir` (W/A/S/D) e mostra o quadro parado.
  virar(dir, quadro = 0) {
    const [linha, espelha] = FACE[dir];
    this.faceAtual = linha;
    this.spriteJogador.setFlipX(espelha);
    this.spriteJogador.setFrame(`${linha}_${quadro}`);
  }

  // Nuvenzinhas de poeira nos pes, saindo pra tras do passo.
  poeira(x, y, dr, dc, tom = 0xffffff) {
    for (let i = 0; i < 3; i++) {
      const p = this.add.image(x - dc * 5 + (i - 1) * 4, y + 1 - dr * 3, "poeira")
        .setScale(0.5 / ESC * 4).setAlpha(0.75).setTint(tom).setDepth(this.spriteJogador.depth - 0.1);
      this.tweens.add({
        targets: p, x: p.x - dc * (4 + i * 3) + (i - 1) * 3, y: p.y - 4 - i * 2,
        scale: p.scale * 1.8, alpha: 0, duration: 340 + i * 60, ease: "Sine.out",
        onComplete: () => p.destroy(),
      });
    }
  }

  animarPasso([r, c], dir) {
    return new Promise((resolver) => {
      const alt = ALTURA[this.celulas[r][c].terreno];
      const alvo = topoDe(r, c, alt);
      const [dr, dc] = DIRECOES[dir];
      const origem = { x: this.ponto.x, y: this.ponto.y };
      const par = this.passoPar;
      this.passoPar = 1 - par;
      // quadros: um passo e meio ciclo (passo A + passagem, ou passo B + parado)
      const seq = par === 0 ? [1, 2] : [3, 0];
      const naAgua = this.celulas[r][c].terreno === "water";
      this.andando = true;
      this.virar(dir, seq[0]);
      this.poeira(origem.x, origem.y + 3, dr, dc, naAgua ? 0xcfeaff : 0xffffff);
      // o depth ja vai pro destino: o boneco nao some atras do tile pra onde anda
      this.depthJogador(Math.max(r, this.lin));
      this.lin = r;
      this.col = c;
      let balancou = false;
      this.tweens.addCounter({
        from: 0, to: 1, duration: TEMPO_PASSO * this.fatorTempo, ease: "Linear",
        onUpdate: (tw) => {
          const p = tw.getValue();
          const x = origem.x + (alvo.x - origem.x) * p;
          const y = origem.y + (alvo.y - origem.y) * p;
          this.ponto.x = x; this.ponto.y = y;
          this.sombraJogador.setPosition(x, y);
          this.anelJogador.setPosition(x, y);
          // sobe um pouco no meio do passo; so o corpo, a sombra fica no chao
          const salto = Math.sin(Math.PI * p) * 2.2;
          this.spriteJogador.setPosition(x, y + 3 - salto);
          this.spriteJogador.setFrame(`${this.faceAtual}_${p < 0.5 ? seq[0] : seq[1]}`);
          if (!balancou && p > 0.45) { balancou = true; this.balancarGrama(r, c); }
        },
        onComplete: () => {
          this.ponto.x = alvo.x; this.ponto.y = alvo.y;
          this.spriteJogador.setPosition(alvo.x, alvo.y + 3);
          this.depthJogador(r);
          this.ultimoPasso = this.time.now;
          resolver();
        },
      });
    });
  }

  // Passo recusado: vira pra direcao, da um saltinho e empurra pra frente e volta.
  tremer(dr, dc) {
    const dir = Object.keys(DIRECOES).find((k) => DIRECOES[k][0] === dr && DIRECOES[k][1] === dc);
    if (dir) this.virar(dir, 0);
    this.ultimoPasso = this.time.now;
    const s = this.spriteJogador;
    const bx = this.ponto.x;
    const by = this.ponto.y + 3;
    this.tweens.addCounter({
      from: 0, to: 1, duration: 210, onUpdate: (tw) => {
        const p = tw.getValue();
        const salto = Math.sin(Math.PI * Math.min(1, p * 1.6)) * 6;
        const tremor = p > 0.4 ? Math.sin(p * 38) * (1 - p) * 2.4 : 0;
        s.setPosition(bx + dc * Math.sin(Math.PI * p) * 3 + (dc === 0 ? tremor : 0), by - salto + (dr === 0 ? 0 : tremor * 0.4));
      },
      onComplete: () => s.setPosition(bx, by),
    });
  }

  // Idle manual a cada quadro: respiracao do jogador e dos treinadores, bob e
  // piscada das criaturas, balanco dos itens. Leve: poucas dezenas de sprites.
  animarVivos(t) {
    for (const v of this.vivos) {
      const ph = (t + v.fase) / 1000;
      const o = v.obj;
      if (v.tipo === "gente") {
        const k = Math.sin(ph * 2.4) * 0.5 + 0.5;
        o.setScale(v.base.sx, v.base.sy * (1 + 0.035 * k));
      } else if (v.tipo === "criatura") {
        const k = Math.sin(ph * 3.1);
        o.y = v.base.y - Math.max(0, k) * 2.2;
        o.setScale(v.base.sx * (1 + 0.03 * (1 - Math.abs(k))), v.base.sy * (1 - 0.04 * (1 - Math.abs(k))));
        const pisca = (t + v.fase) % 3100 < 130;
        const q = pisca ? 1 : 0;
        if (v.q !== q) { v.q = q; o.setTexture(`criatura_${v.pal}_${q}`); }
      } else {
        o.y = v.base.y - (Math.sin(ph * 2.6) * 0.5 + 0.5) * 1.8;
      }
    }
    // jogador parado: respira (escala em Y a partir dos pes) e quadro 0
    if (this.spriteJogador && !this.encerrado) {
      const parado = !this.ocupado && t - this.ultimoPasso > 120;
      if (parado) {
        if (this.andando) { this.andando = false; this.spriteJogador.setFrame(`${this.faceAtual}_0`); }
        const k = Math.sin(t / 1000 * 2.2) * 0.5 + 0.5;
        this.spriteJogador.setScale(this.ESC_J, this.ESC_J * (1 + 0.04 * k));
      } else {
        this.spriteJogador.setScale(this.ESC_J);
      }
    }
  }

  async recarregar() {
    this.ocupado = true;
    try {
      const res = await api.jogoRecarregar(this.sessao);
      this.jogador = res.jogador;
      this.energia = { atual: res.jogador.energia, max: res.jogador.energia_max };
      this.atualizarHud(res.recarregou ? `Recarregou +${res.entrou} de energia.` : `Sem recarga: ${res.motivo}.`);
    } catch (erro) {
      this.atualizarHud("erro: " + erro.message);
    }
    this.ocupado = false;
  }

  atualizarHud(mensagem) {
    const el = (id) => document.getElementById(id);
    if (!el("hud-energia")) return;
    const pct = this.energia.max ? Math.round((100 * this.energia.atual) / this.energia.max) : 0;
    el("hud-energia").textContent = `${this.energia.atual} / ${this.energia.max}`;
    el("hud-barra").style.width = pct + "%";
    el("hud-hp").textContent = this.jogador.hp_lider;
    el("hud-surf").textContent = this.jogador.surf ? "sim" : "nao";
    el("hud-pokemon").textContent = `${this.jogador.pokemon} / ${this.jogador.meta}`;
    const cel = this.celulas[this.lin][this.col];
    el("hud-pos").textContent = `(${this.lin}, ${this.col}) ${NOME_TERRENO[cel.terreno] || cel.terreno}`;
    el("hud-centros").textContent = this.centros.length;
    if (mensagem) el("hud-msg").textContent = mensagem;
  }
}
