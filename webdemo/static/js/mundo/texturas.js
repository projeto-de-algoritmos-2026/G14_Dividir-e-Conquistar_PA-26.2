// Toda a arte e gerada aqui, em codigo (Phaser Graphics -> generateTexture).
// Nenhum arquivo de imagem, nenhum sprite de terceiros: formas simples e
// paleta propria (constantes.js).

import { TW, TH, FOLGA, ALTURA, COR } from "./constantes.js";

const VARIANTES = 3;

// Pseudo-aleatorio deterministico: as texturas saem iguais a cada carga.
function lcg(semente) {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function textura(cena, chave, w, h, desenhar) {
  const g = cena.make.graphics({ x: 0, y: 0, add: false });
  desenhar(g);
  g.generateTexture(chave, w, h);
  g.destroy();
}

// Bloco isometrico: face de topo + duas faces laterais. (cx, base) e o vertice
// de baixo do losango do chao; hw/hh sao meia-largura e meia-altura do losango.
function bloco(g, cx, base, hw, hh, alt, cores) {
  const yTopo = base - alt; // vertice de baixo da face de topo
  g.fillStyle(cores.esq, 1);
  g.fillPoints([
    { x: cx - hw, y: yTopo - hh }, { x: cx, y: yTopo },
    { x: cx, y: base }, { x: cx - hw, y: base - hh },
  ], true);
  g.fillStyle(cores.dir, 1);
  g.fillPoints([
    { x: cx + hw, y: yTopo - hh }, { x: cx, y: yTopo },
    { x: cx, y: base }, { x: cx + hw, y: base - hh },
  ], true);
  g.fillStyle(cores.topo, 1);
  g.fillPoints([
    { x: cx, y: yTopo - 2 * hh }, { x: cx + hw, y: yTopo - hh },
    { x: cx, y: yTopo }, { x: cx - hw, y: yTopo - hh },
  ], true);
  return { cx, yTopo, hw, hh };
}

// Ponto aleatorio dentro do losango da face de topo (com margem).
function pontoNoTopo(rnd, geo, margem = 0.78) {
  for (;;) {
    const u = rnd() * 2 - 1;
    const v = rnd() * 2 - 1;
    if (Math.abs(u) + Math.abs(v) <= margem) {
      return { x: geo.cx + u * geo.hw, y: geo.yTopo - geo.hh + v * geo.hh };
    }
  }
}

function gerarTiles(cena) {
  const hw = TW / 2;
  const hh = TH / 2;
  const altura = FOLGA + TH;
  for (const terreno of ["grass", "concrete", "water"]) {
    const cores = COR[terreno];
    const alt = ALTURA[terreno];
    for (let v = 0; v < VARIANTES; v++) {
      textura(cena, `tile_${terreno}_${v}`, TW, altura, (g) => {
        const geo = bloco(g, hw, altura, hw, hh, alt, cores);
        const rnd = lcg(terreno.length * 97 + v * 31 + 7);
        // contorno fino do topo, so pra separar as celulas
        g.lineStyle(1, cores.esq, 0.55);
        g.strokePoints([
          { x: geo.cx, y: geo.yTopo - 2 * hh }, { x: geo.cx + hw, y: geo.yTopo - hh },
          { x: geo.cx, y: geo.yTopo }, { x: geo.cx - hw, y: geo.yTopo - hh },
        ], true);
        if (terreno === "grass") {
          for (let i = 0; i < 7; i++) {
            const p = pontoNoTopo(rnd, geo);
            g.lineStyle(2, i % 2 ? cores.detalhe : cores.sombra, 1);
            g.lineBetween(p.x, p.y, p.x - 1, p.y - 4);
            g.lineBetween(p.x + 2, p.y, p.x + 3, p.y - 3);
          }
        } else if (terreno === "concrete") {
          for (let i = 0; i < 6; i++) {
            const p = pontoNoTopo(rnd, geo, 0.85);
            g.fillStyle(i % 2 ? cores.detalhe : cores.sombra, 1);
            g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
          }
          // junta de laje
          g.lineStyle(1, cores.sombra, 0.7);
          g.lineBetween(geo.cx - hw * 0.45, geo.yTopo - hh * 1.45, geo.cx + hw * 0.45, geo.yTopo - hh * 0.55);
        } else {
          for (let i = 0; i < 4; i++) {
            const p = pontoNoTopo(rnd, geo, 0.7);
            g.lineStyle(1, i % 2 ? cores.detalhe : cores.sombra, 1);
            g.lineBetween(p.x - 4, p.y, p.x + 4, p.y);
          }
        }
      });
    }
  }
}

function gerarSombra(cena) {
  textura(cena, "sombra", 40, 16, (g) => {
    g.fillStyle(0x000000, 0.32);
    g.fillEllipse(20, 8, 34, 12);
  });
  textura(cena, "anel", 64, 32, (g) => {
    g.lineStyle(2, COR.jade, 0.95);
    g.strokePoints([{ x: 32, y: 2 }, { x: 62, y: 16 }, { x: 32, y: 30 }, { x: 2, y: 16 }], true);
  });
}

function gerarArvore(cena) {
  textura(cena, "arvore", 40, 52, (g) => {
    g.fillStyle(0x6b4a2f, 1);
    g.fillRect(17, 30, 6, 20);
    g.fillStyle(0x553a24, 1);
    g.fillRect(20, 30, 3, 20);
    g.fillStyle(0x2f6b3a, 1);
    g.fillCircle(20, 24, 15);
    g.fillCircle(11, 28, 10);
    g.fillCircle(29, 28, 10);
    g.fillStyle(0x3f8a49, 1);
    g.fillCircle(18, 19, 11);
    g.fillCircle(27, 24, 7);
    g.fillStyle(0x66b05c, 1);
    g.fillCircle(14, 15, 5);
  });
}

// Predio generico em bloco isometrico; devolve a geometria pra quem quiser
// pintar detalhes nas paredes.
function predio(g, cx, base, hw, hh, alt, cores) {
  return bloco(g, cx, base, hw, hh, alt, cores);
}

// Retangulo "colado" na parede direita (u0..u1 ao longo, v0..v1 de altura).
function paredeDireita(g, geo, base, alt, u0, u1, v0, v1) {
  const yb = (u) => base - (u * geo.hh) / geo.hw;
  g.fillPoints([
    { x: geo.cx + u0, y: yb(u0) - v0 }, { x: geo.cx + u1, y: yb(u1) - v0 },
    { x: geo.cx + u1, y: yb(u1) - v1 }, { x: geo.cx + u0, y: yb(u0) - v1 },
  ], true);
}

function paredeEsquerda(g, geo, base, alt, u0, u1, v0, v1) {
  const yb = (u) => base + (u * geo.hh) / geo.hw; // u negativo
  g.fillPoints([
    { x: geo.cx + u0, y: yb(u0) - v0 }, { x: geo.cx + u1, y: yb(u1) - v0 },
    { x: geo.cx + u1, y: yb(u1) - v1 }, { x: geo.cx + u0, y: yb(u0) - v1 },
  ], true);
}

function gerarCentro(cena) {
  const hw = 18;
  const hh = 9;
  const alt = 24;
  const w = hw * 2 + 6;
  const h = alt + hh * 2 + 8;
  textura(cena, "centro", w, h, (g) => {
    const cx = w / 2;
    const base = h - 2;
    const geo = predio(g, cx, base, hw, hh, alt, {
      topo: COR.jade, esq: 0xdde6ec, dir: 0xb8c5cf,
    });
    // faixa do telhado
    g.lineStyle(2, COR.jadeEscuro, 1);
    g.strokePoints([
      { x: cx, y: geo.yTopo - 2 * hh }, { x: cx + hw, y: geo.yTopo - hh },
      { x: cx, y: geo.yTopo }, { x: cx - hw, y: geo.yTopo - hh },
    ], true);
    // placa com cruz na parede direita
    g.fillStyle(COR.jadeEscuro, 1);
    paredeDireita(g, geo, base, alt, 4, 15, 8, 20);
    g.fillStyle(COR.papel, 1);
    paredeDireita(g, geo, base, alt, 8, 11, 10, 18);
    paredeDireita(g, geo, base, alt, 5.5, 13.5, 13, 15);
    // porta na parede esquerda
    g.fillStyle(0x2a3a47, 1);
    paredeEsquerda(g, geo, base, alt, -12, -5, 0, 13);
  });
}

function gerarGinasio(cena) {
  // Reservado: o grid ainda nao gera ginasio, mas o tipo ja existe e e desenhado.
  const hw = 22;
  const hh = 11;
  const alt = 30;
  const w = hw * 2 + 6;
  const h = alt + hh * 2 + 18;
  textura(cena, "ginasio", w, h, (g) => {
    const cx = w / 2;
    const base = h - 2;
    const geo = predio(g, cx, base, hw, hh, alt, {
      topo: 0x5a4a9c, esq: 0x8a7bd0, dir: 0x6e60b4,
    });
    g.lineStyle(2, COR.ambar, 1);
    g.strokePoints([
      { x: cx, y: geo.yTopo - 2 * hh }, { x: cx + hw, y: geo.yTopo - hh },
      { x: cx, y: geo.yTopo }, { x: cx - hw, y: geo.yTopo - hh },
    ], true);
    // faixa dourada na parede direita com um G desenhado em arco
    g.fillStyle(COR.ambar, 1);
    paredeDireita(g, geo, base, alt, 3, 19, 10, 22);
    g.fillStyle(0x3a2f6e, 1);
    paredeDireita(g, geo, base, alt, 4.5, 17.5, 11.5, 20.5);
    const gx = cx + 11;
    const gy = base - 6.5 - 16;
    g.lineStyle(2, COR.ambar, 1);
    g.beginPath();
    g.arc(gx, gy, 4, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(320), false);
    g.strokePath();
    g.lineBetween(gx, gy, gx + 4, gy);
    // bandeira no topo
    g.lineStyle(2, 0x2a2350, 1);
    g.lineBetween(cx, geo.yTopo - hh - 2, cx, geo.yTopo - hh - 16);
    g.fillStyle(COR.ambar, 1);
    g.fillTriangle(cx, geo.yTopo - hh - 16, cx + 10, geo.yTopo - hh - 12, cx, geo.yTopo - hh - 8);
  });
}

function gerarItens(cena) {
  // Esfera de captura: capsula indigo e branca (desenho proprio).
  textura(cena, "pokebola", 20, 20, (g) => {
    g.fillStyle(0x3b3f8c, 1);
    g.fillCircle(10, 10, 8);
    g.fillStyle(0xf4f7fa, 1);
    g.slice(10, 10, 8, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(180), false);
    g.fillPath();
    g.lineStyle(2, 0x1c1f4d, 1);
    g.lineBetween(2, 10, 18, 10);
    g.strokeCircle(10, 10, 8);
    g.fillStyle(COR.ambar, 1);
    g.fillCircle(10, 10, 3);
    g.lineStyle(1, 0x1c1f4d, 1);
    g.strokeCircle(10, 10, 3);
  });
  // Prancha de surf
  textura(cena, "surf", 30, 22, (g) => {
    g.fillStyle(COR.ambar, 1);
    g.fillEllipse(15, 11, 26, 11);
    g.fillStyle(0xfff3d6, 1);
    g.fillEllipse(15, 11, 20, 4);
    g.lineStyle(1.5, 0x7a4a00, 1);
    g.strokeEllipse(15, 11, 26, 11);
  });
}

function gerarCriaturas(cena) {
  // Criatura selvagem: bolota roxa com orelhas. Desenho proprio.
  textura(cena, "criatura", 28, 30, (g) => {
    g.fillStyle(0x8a5cc4, 1);
    g.fillTriangle(5, 12, 9, 1, 13, 10);
    g.fillTriangle(23, 12, 19, 1, 15, 10);
    g.fillEllipse(14, 19, 24, 20);
    g.fillStyle(0xb894e6, 1);
    g.fillEllipse(14, 22, 14, 10);
    g.fillStyle(0x1b1030, 1);
    g.fillCircle(9, 17, 2);
    g.fillCircle(19, 17, 2);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(9.6, 16.4, 0.8);
    g.fillCircle(19.6, 16.4, 0.8);
  });
  // Treinador adversario (CPU): boneco de bone laranja.
  textura(cena, "treinador", 24, 38, (g) => {
    g.fillStyle(0x8a3b3b, 1);
    g.fillRect(6, 24, 4, 12);
    g.fillRect(14, 24, 4, 12);
    g.fillStyle(0xd9544f, 1);
    g.fillRoundedRect(4, 12, 16, 15, 4);
    g.fillStyle(0xf1c9a3, 1);
    g.fillCircle(12, 8, 6);
    g.fillStyle(0xe0762a, 1);
    g.fillRect(5, 3, 14, 4);
    g.fillRect(10, 6, 11, 2);
    g.fillStyle(0x1b1030, 1);
    g.fillRect(9, 9, 2, 2);
    g.fillRect(14, 9, 2, 2);
  });
}

function gerarJogador(cena) {
  textura(cena, "jogador", 24, 38, (g) => {
    g.fillStyle(0x1f3b5c, 1);
    g.fillRect(6, 25, 4, 11);
    g.fillRect(14, 25, 4, 11);
    g.fillStyle(0x12b7a3, 1);
    g.fillRoundedRect(4, 12, 16, 16, 4);
    g.fillStyle(0x0b8577, 1);
    g.fillRect(4, 22, 16, 2);
    g.fillStyle(0xf1c9a3, 1);
    g.fillCircle(12, 8, 6);
    g.fillStyle(0x2a2350, 1);
    g.fillRoundedRect(5, 1, 14, 6, 3);
    g.fillRect(12, 5, 9, 2);
    g.fillStyle(0x1b1030, 1);
    g.fillRect(9, 9, 2, 2);
    g.fillRect(14, 9, 2, 2);
  });
}

function gerarMarcador(cena) {
  // Seta/farol jade que flutua sobre cada Centro.
  textura(cena, "marcador", 22, 26, (g) => {
    g.fillStyle(0x04231f, 1);
    g.fillTriangle(1, 3, 21, 3, 11, 25);
    g.fillStyle(COR.jade, 1);
    g.fillTriangle(4, 5, 18, 5, 11, 20);
    g.fillStyle(COR.papel, 1);
    g.fillRect(9, 7, 4, 7);
    g.fillRect(7.5, 8.8, 7, 3.4);
  });
}

export function gerarTexturas(cena) {
  gerarTiles(cena);
  gerarSombra(cena);
  gerarArvore(cena);
  gerarCentro(cena);
  gerarGinasio(cena);
  gerarItens(cena);
  gerarCriaturas(cena);
  gerarJogador(cena);
  gerarMarcador(cena);
}

export const NUM_VARIANTES = VARIANTES;
