// Galeria das criaturas da batalha: todas as especies, frente e costas, nos 2
// quadros de idle, numa grade. Serve pra conferir a arte (e pros prints), nao
// faz parte do jogo. Abre em /galeria.html.

import { CAIXA_H, CAIXA_W, ESCB, ESPECIES, PES, chaveCriatura, garantirCriatura } from "./batalha_arte.js";

const TIPO = { Chamandrel: "Fire", Charzardo: "Fire", Squirtuga: "Water", Geobruto: "Rock", Onixo: "Rock", Sonolax: "Normal", Miaupsi: "Psychic" };
const LINHAS = [["frente", 0], ["frente", 1], ["costas", 0], ["costas", 1]];

class Galeria extends Phaser.Scene {
  constructor() { super("galeria"); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const colw = W / ESPECIES.length;
    const rowh = (H - 34) / LINHAS.length;
    const k = Math.min(colw / CAIXA_W, rowh / CAIXA_H) * 0.96;
    this.add.rectangle(W / 2, H / 2, W, H, 0x182231);
    LINHAS.forEach(([vista, q], r) => {
      this.add.rectangle(W / 2, 34 + r * rowh + rowh / 2, W - 8, rowh - 6, r < 2 ? 0x24402f : 0x2a3350).setAlpha(0.55);
      ESPECIES.forEach((esp, c) => {
        garantirCriatura(this, esp, TIPO[esp]);
        const x = colw * (c + 0.5);
        const base = 34 + r * rowh + rowh * 0.9;
        this.add.image(x, base, chaveCriatura(esp, TIPO[esp], vista, q))
          .setOrigin(0.5, PES / CAIXA_H).setScale(k / ESCB);
        if (r === 0) {
          this.add.text(x, 18, esp, { fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "16px", fontStyle: "700", color: "#f1f4f8" }).setOrigin(0.5);
        }
      });
      this.add.text(10, 34 + r * rowh + 6, `${vista} q${q}`, { fontFamily: "ui-monospace, monospace", fontSize: "11px", color: "#9fb0c6" });
    });
  }
}

const q = new URLSearchParams(location.search);
const dpr = Math.min(Math.max(parseFloat(q.get("dpr")) || window.devicePixelRatio || 1, 1), 3);
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "jogo",
  backgroundColor: "#0b0f14",
  antialias: true,
  scale: { mode: Phaser.Scale.NONE, width: Math.round(window.innerWidth * dpr), height: Math.round(window.innerHeight * dpr), zoom: 1 / dpr },
  scene: [Galeria],
});
