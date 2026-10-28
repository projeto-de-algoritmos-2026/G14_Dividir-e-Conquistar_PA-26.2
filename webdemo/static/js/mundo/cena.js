// Cena do mundo 2.5D. Renderiza o MESMO grid que a API ja devolve
// (/api/t2/jogo/novo) e anda o jogador pelo MESMO endpoint de movimento
// (/api/t2/jogo/mover). Nenhuma regra do jogo mora aqui: o cliente so
// PRE-CHECA com os campos que a API manda (pisavel_sem_surf / pisavel_com_surf)
// pra dar resposta imediata, e o servidor continua sendo quem decide.

import { api } from "../api.js";
import {
  ALTURA, CONTEUDO_GINASIO, DIRECOES, TECLAS, TEMPO_PASSO, TH, ZOOM_INICIAL, ZOOM_MAX,
  ZOOM_MIN, profundidade, projetar, topoDe,
} from "./constantes.js";
import { NUM_VARIANTES, gerarTexturas } from "./texturas.js";

const PROPS = {
  bloqueio: { chave: "arvore", sombra: 1.0, origemY: 0.92 },
  pokemon: { chave: "criatura", sombra: 0.7, origemY: 0.95 },
  cpu: { chave: "treinador", sombra: 0.7, origemY: 0.95 },
  pokebola: { chave: "pokebola", sombra: 0.5, origemY: 1.0 },
  surf: { chave: "surf", sombra: 0.6, origemY: 0.9 },
  centro: { chave: "centro", sombra: 1.3, origemY: 0.95 },
  [CONTEUDO_GINASIO]: { chave: "ginasio", sombra: 1.5, origemY: 0.95 },
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
    ginasio: g.length === 2 && g.every(Number.isFinite) ? g : null,
  };
}

export class CenaMundo extends Phaser.Scene {
  constructor() {
    super("mundo");
    this.ocupado = false;
    this.encerrado = false;
    this.props = new Map(); // "r,c" -> { objeto, sombra, marcador }
  }

  create() {
    gerarTexturas(this);
    this.aviso = this.add.text(16, 16, "carregando mapa...", {
      fontFamily: "monospace", fontSize: "14px", color: "#8a97a8",
    }).setScrollFactor(0).setDepth(1e6);
    this.carregar().catch((erro) => {
      this.aviso.setText("erro: " + erro.message);
      console.error(erro);
    });

    this.teclas = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,W,A,S,D,R");
    this.input.on("wheel", (_p, _o, _dx, dy) => {
      const z = Phaser.Math.Clamp(this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1), ZOOM_MIN, ZOOM_MAX);
      this.cameras.main.setZoom(z);
    });
    this.recarregarTeclaSolta = true;
    // Toque rapido: o poll de isDown no update perderia um keydown+keyup dentro
    // do mesmo quadro, entao o keydown tambem enfileira a direcao.
    this.pendente = null;
    this.input.keyboard.on("keydown", (e) => {
      const nome = e.key.replace(/^Arrow/, "").toUpperCase();
      if (TECLAS[nome]) this.pendente = TECLAS[nome];
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
    this.ginasios = p.ginasio ? [p.ginasio] : [];
    this.aviso.destroy();

    this.montarMapa();
    this.criarJogador(jogo.posicao);
    this.configurarCamera();
    this.atualizarHud(`Mapa ${this.size}x${this.size}, seed ${jogo.seed}. Use as setas ou WASD.`);
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
        const alt = ALTURA[cel.terreno] ?? ALTURA.concrete;
        const base = projetar(r, c);
        const variante = (r * 7 + c * 13) % NUM_VARIANTES;
        const tile = this.add.image(base.x, base.y, `tile_${cel.terreno}_${variante}`)
          .setOrigin(0.5, 1).setDepth(profundidade(r, c));
        if (cel.terreno === "water") this.camadaAgua.push(tile);
        this.colocarProp(r, c, this.tipoDoConteudo(r, c));
      }
    }
    // Brilho lento da agua: um unico tween move o alfa de todas as celulas.
    this.tweens.add({
      targets: this.camadaAgua, alpha: { from: 1, to: 0.82 }, duration: 1400,
      yoyo: true, repeat: -1, ease: "Sine.inOut",
    });
  }

  colocarProp(r, c, tipo) {
    const def = PROPS[tipo];
    if (!def) return; // livre / visitado: so o chao
    const cel = this.celulas[r][c];
    const alt = ALTURA[cel.terreno] ?? ALTURA.concrete;
    const topo = topoDe(r, c, alt);
    const d = profundidade(r, c);
    const sombra = this.add.image(topo.x, topo.y, "sombra")
      .setScale(def.sombra).setDepth(d + 0.1);
    const objeto = this.add.image(topo.x, topo.y + 4, def.chave)
      .setOrigin(0.5, def.origemY).setDepth(d + 0.3);
    const entrada = { objeto, sombra };

    if (tipo === "centro" || tipo === CONTEUDO_GINASIO) {
      // Marcacao visivel: anel pulsante no chao + seta jade flutuando acima.
      entrada.anel = this.add.image(topo.x, topo.y, "anel").setDepth(d + 0.05);
      this.tweens.add({
        targets: entrada.anel, alpha: { from: 1, to: 0.25 }, scaleX: { from: 1, to: 1.25 },
        scaleY: { from: 1, to: 1.25 }, duration: 900, yoyo: true, repeat: -1,
      });
      if (tipo === "centro") {
        const marcador = this.add.image(topo.x, topo.y - objeto.height - 6, "marcador")
          .setDepth(d + 0.4);
        this.tweens.add({
          targets: marcador, y: marcador.y - 6, duration: 700, yoyo: true,
          repeat: -1, ease: "Sine.inOut",
        });
        entrada.marcador = marcador;
      }
    }
    this.props.set(`${r},${c}`, entrada);
  }

  removerProp(r, c) {
    const e = this.props.get(`${r},${c}`);
    if (!e) return;
    this.tweens.add({
      targets: [e.objeto, e.sombra], alpha: 0, y: "-=8", duration: 180,
      onComplete: () => { e.objeto.destroy(); e.sombra.destroy(); },
    });
    this.props.delete(`${r},${c}`);
  }

  criarJogador([r, c]) {
    this.lin = r;
    this.col = c;
    const alt = ALTURA[this.celulas[r][c].terreno];
    const topo = topoDe(r, c, alt);
    this.sombraJogador = this.add.image(topo.x, topo.y, "sombra").setScale(0.7);
    this.spriteJogador = this.add.image(topo.x, topo.y + 3, "jogador").setOrigin(0.5, 0.95);
    this.ponto = { x: topo.x, y: topo.y };
    this.depthJogador(r, c);
  }

  depthJogador(r, c) {
    const d = profundidade(r, c) + 0.6;
    this.sombraJogador.setDepth(d - 0.2);
    this.spriteJogador.setDepth(d);
  }

  configurarCamera() {
    const cam = this.cameras.main;
    cam.setZoom(ZOOM_INICIAL);
    cam.setBackgroundColor("#0b0f14");
    cam.startFollow(this.ponto, true, 0.12, 0.12);
    cam.roundPixels = true;
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

  update() {
    if (!this.sessao || this.ocupado || this.encerrado) return;
    const T = this.teclas;
    if (this.pendente) {
      const dir = this.pendente;
      this.pendente = null;
      this.tentarPasso(dir);
      return;
    }
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
      this.time.delayedCall(TEMPO_PASSO, () => { this.ocupado = false; });
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

  animarPasso([r, c], dir) {
    return new Promise((resolver) => {
      const alt = ALTURA[this.celulas[r][c].terreno];
      const alvo = topoDe(r, c, alt);
      this.spriteJogador.setFlipX(dir === "D" || dir === "S");
      // o depth ja vai pro destino: o boneco nao some atras do tile pra onde anda
      this.depthJogador(Math.max(r, this.lin), Math.max(c, this.col));
      this.lin = r;
      this.col = c;
      this.tweens.add({
        targets: this.ponto, x: alvo.x, y: alvo.y, duration: TEMPO_PASSO, ease: "Linear",
      });
      this.tweens.add({
        targets: this.sombraJogador, x: alvo.x, y: alvo.y, duration: TEMPO_PASSO, ease: "Linear",
      });
      this.tweens.add({
        targets: this.spriteJogador, x: alvo.x, y: alvo.y + 3, duration: TEMPO_PASSO, ease: "Linear",
      });
      // pulinho: so o corpo sobe, a sombra fica no chao
      this.tweens.add({
        targets: this.spriteJogador, scaleY: { from: 1, to: 1.08 }, duration: TEMPO_PASSO / 2, yoyo: true,
      });
      this.time.delayedCall(TEMPO_PASSO, () => {
        this.depthJogador(r, c);
        resolver();
      });
    });
  }

  // Passo recusado: o boneco empurra meio pixel de tile e volta.
  tremer(dr, dc) {
    const sx = (dc - dr) * 4;
    const sy = (dc + dr) * (TH / 8);
    const base = { x: this.spriteJogador.x, y: this.spriteJogador.y };
    this.tweens.add({
      targets: this.spriteJogador, x: base.x + sx, y: base.y + sy,
      duration: 60, yoyo: true,
    });
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
