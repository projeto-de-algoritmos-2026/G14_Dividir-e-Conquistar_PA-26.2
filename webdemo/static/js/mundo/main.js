// Ponto de entrada do mundo 2.5D (Phaser 3.90, vendorizado em /static/vendor/).
//
// Nitidez HiDPI: o Phaser 3.90 nao tem mais o `resolution` do Game, entao o
// canvas e criado no tamanho da janela VEZES devicePixelRatio (modo NONE) e o
// `zoom` da Scale (1/dpr) devolve o tamanho de CSS. Cada pixel do canvas vira
// um pixel fisico da tela. ?dpr=2 forca a razao (so pra conferir em tela comum).

import { CenaMundo } from "./cena.js";

const q = new URLSearchParams(location.search);
const forcado = parseFloat(q.get("dpr"));
const dpr = Math.min(Math.max(Number.isFinite(forcado) ? forcado : window.devicePixelRatio || 1, 1), 3);

const tamanho = () => ({ w: Math.round(window.innerWidth * dpr), h: Math.round(window.innerHeight * dpr) });
const t = tamanho();

const jogo = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "jogo",
  backgroundColor: "#0b0f14",
  antialias: true,
  roundPixels: false,
  scale: { mode: Phaser.Scale.NONE, width: t.w, height: t.h, zoom: 1 / dpr },
  scene: [CenaMundo],
});

window.addEventListener("resize", () => {
  const n = tamanho();
  jogo.scale.resize(n.w, n.h);
});
