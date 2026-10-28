// Spritesheets dos personagens, geradas em codigo (Graphics -> generateTexture).
// Cada folha tem 3 linhas (baixo, cima, direita) por 4 colunas (quadros de
// caminhada); a esquerda e a direita espelhada (setFlipX). Quadros:
//   0 parado | 1 passo com a perna A | 2 passagem (corpo sobe) | 3 passo com a perna B
// O desenho e uma lista de formas, renderizada duas vezes: primeiro engrossada
// na cor do contorno, depois com as cores reais. Assim o contorno acompanha
// cada pose sem desenhar nada a mao duas vezes.

import { ESC } from "./constantes.js";

export const CEL_W = 24; // celula de um quadro, em unidades do mundo
export const CEL_H = 36;
export const PES_Y = 34; // linha dos pes dentro da celula (origem Y = PES_Y / CEL_H)
export const LINHAS = { baixo: 0, cima: 1, dir: 2 };
export const QUADROS = 4;

// Paletas: jogador jade (contorno branco grosso) e tres treinadores CPU quentes.
export const PALETAS = {
  jogador: {
    tronco: 0x12b7a3, troncoSombra: 0x0b8577, calca: 0x1f3b5c, sapato: 0x0d1a2a, pele: 0xf1c9a3,
    gorro: 0x2a2350, faixa: 0xf2b84b, mochila: 0xf2b84b, contorno: 0xffffff, grosso: 1.5,
  },
  cpuA: {
    tronco: 0xd9544f, troncoSombra: 0xa83a3a, calca: 0x5a2b2b, sapato: 0x2a1414, pele: 0xe8b88c,
    gorro: 0xe0762a, faixa: 0xffffff, mochila: 0x7a3030, contorno: 0x2a1414, grosso: 0.8,
  },
  cpuB: {
    tronco: 0xc2468f, troncoSombra: 0x8f2f69, calca: 0x3d2a52, sapato: 0x1c1228, pele: 0xf1c9a3,
    gorro: 0xf2b84b, faixa: 0x3d2a52, mochila: 0x6b2f55, contorno: 0x24122a, grosso: 0.8,
  },
  cpuC: {
    tronco: 0xe89a2e, troncoSombra: 0xb56f16, calca: 0x4b3a22, sapato: 0x2a1c0e, pele: 0xd9a077,
    gorro: 0x8f2f2f, faixa: 0xf1f4f8, mochila: 0x7a5420, contorno: 0x2a1c0e, grosso: 0.8,
  },
};

// Deslocamentos de cada quadro: [perna A, perna B, braco A, braco B, corpo]
// (positivo = pra baixo/frente; a perna levantada tem dy negativo).
const POSES = [
  { la: 0, lb: 0, ba: 0, bb: 0, corpo: 0 },
  { la: -2.2, lb: 0.6, ba: 1.8, bb: -1.8, corpo: -0.4 },
  { la: 0, lb: 0, ba: 0, bb: 0, corpo: -1.1 },
  { la: 0.6, lb: -2.2, ba: -1.8, bb: 1.8, corpo: -0.4 },
];

// Gera as formas de um quadro. Cada forma: [tipo, x, y, w, h, cor].
function formas(pal, linha, q) {
  const p = POSES[q];
  const f = [];
  const R = (x, y, w, h, cor) => f.push(["r", x, y, w, h, cor]);
  const E = (cx, cy, w, h, cor) => f.push(["e", cx, cy, w, h, cor]);
  const b = p.corpo;

  if (linha === "dir") {
    // perfil: as pernas se afastam no eixo X, o corpo e mais estreito
    const sa = q === 1 ? 3.2 : q === 3 ? -3.2 : 0;
    const sb = -sa;
    R(10.5 + sb, 24 + b + p.lb * 0.4, 3.6, 9.5 - p.lb * 0.4 + (p.lb < 0 ? 0 : 0), pal.calca);
    R(10.5 + sa, 24 + b + p.la * 0.4, 3.6, 9.5 - p.la * 0.4, pal.calca);
    R(10 + sb, 32 + (p.lb < 0 ? -1.4 : 0), 5, 2.2, pal.sapato);
    R(10 + sa, 32 + (p.la < 0 ? -1.4 : 0), 5, 2.2, pal.sapato);
    R(8, 14 + b, 8, 11, pal.tronco);
    R(8, 22 + b, 8, 2.5, pal.troncoSombra);
    R(8.4, 15.5 + b, 2.4, 8, pal.mochila); // mochila nas costas (lado esquerdo)
    R(11 - sa * 0.5, 15 + b, 3, 8, pal.troncoSombra); // braco que balanca
    R(11 - sa * 0.5, 22.3 + b, 3, 1.8, pal.pele);
    E(12.5, 9 + b, 9, 10, pal.pele);
    E(12, 6.2 + b, 10, 6, pal.gorro);
    R(12, 6.3 + b, 7.5, 2, pal.gorro); // aba do gorro pra frente
    R(8, 7 + b, 8, 1.2, pal.faixa);
    R(15.6, 9.2 + b, 1.6, 2.2, 0x1b1030); // olho
  } else if (linha === "cima") {
    R(8 + 0, 24 + b + p.la * 0.4, 3.6, 9.5 - p.la * 0.4, pal.calca);
    R(12.4, 24 + b + p.lb * 0.4, 3.6, 9.5 - p.lb * 0.4, pal.calca);
    R(7.6, 32 + (p.la < 0 ? -1.4 : 0), 4.4, 2.2, pal.sapato);
    R(12, 32 + (p.lb < 0 ? -1.4 : 0), 4.4, 2.2, pal.sapato);
    R(5, 15 + b + p.ba * 0.5, 3, 8, pal.troncoSombra);
    R(16, 15 + b + p.bb * 0.5, 3, 8, pal.troncoSombra);
    R(5, 22.3 + b + p.ba * 0.5, 3, 1.8, pal.pele);
    R(16, 22.3 + b + p.bb * 0.5, 3, 1.8, pal.pele);
    R(7, 14 + b, 10, 11, pal.tronco);
    R(8.5, 15.5 + b, 7, 7.5, pal.mochila); // mochila de frente pra camera
    R(8.5, 21 + b, 7, 2, pal.troncoSombra);
    E(12, 9 + b, 10, 10, pal.pele);
    E(12, 7.2 + b, 11, 8.6, pal.gorro); // nuca coberta pelo gorro
    R(7, 9.6 + b, 10, 1.2, pal.faixa);
  } else {
    R(8, 24 + b + p.la * 0.4, 3.6, 9.5 - p.la * 0.4, pal.calca);
    R(12.4, 24 + b + p.lb * 0.4, 3.6, 9.5 - p.lb * 0.4, pal.calca);
    R(7.6, 32 + (p.la < 0 ? -1.4 : 0), 4.4, 2.2, pal.sapato);
    R(12, 32 + (p.lb < 0 ? -1.4 : 0), 4.4, 2.2, pal.sapato);
    R(4.8, 15 + b + p.ba * 0.5, 3, 8, pal.troncoSombra);
    R(16.2, 15 + b + p.bb * 0.5, 3, 8, pal.troncoSombra);
    R(4.8, 22.3 + b + p.ba * 0.5, 3, 1.8, pal.pele);
    R(16.2, 22.3 + b + p.bb * 0.5, 3, 1.8, pal.pele);
    R(7, 14 + b, 10, 11, pal.tronco);
    R(7, 22 + b, 10, 2.5, pal.troncoSombra);
    E(12, 9 + b, 10, 10, pal.pele);
    E(12, 6.2 + b, 11, 6, pal.gorro);
    R(6.5, 7.2 + b, 11, 1.2, pal.faixa);
    R(8.8, 9.6 + b, 1.7, 2.2, 0x1b1030);
    R(13.5, 9.6 + b, 1.7, 2.2, 0x1b1030);
  }
  return f;
}

function desenhar(g, lista, ox, oy, crescer, cor) {
  for (const [t, x, y, w, h, c] of lista) {
    g.fillStyle(cor ?? c, 1);
    if (t === "r") g.fillRoundedRect(ox + x - crescer, oy + y - crescer, w + 2 * crescer, h + 2 * crescer, 1);
    else g.fillEllipse(ox + x, oy + y, w + 2 * crescer, h + 2 * crescer);
  }
}

// Gera a folha `chave` e registra os quadros "<linha>_<q>" nela.
function gerarFolha(cena, chave, pal) {
  const linhas = Object.keys(LINHAS);
  const W = CEL_W * QUADROS;
  const H = CEL_H * linhas.length;
  const g = cena.make.graphics({ x: 0, y: 0, add: false });
  g.scaleCanvas(ESC, ESC);
  linhas.forEach((linha, i) => {
    for (let q = 0; q < QUADROS; q++) {
      const lista = formas(pal, linha, q);
      const ox = q * CEL_W;
      const oy = i * CEL_H;
      desenhar(g, lista, ox, oy, pal.grosso, pal.contorno);
      desenhar(g, lista, ox, oy, 0, null);
    }
  });
  g.generateTexture(chave, W * ESC, H * ESC);
  g.destroy();
  const tex = cena.textures.get(chave);
  linhas.forEach((linha, i) => {
    for (let q = 0; q < QUADROS; q++) {
      tex.add(`${linha}_${q}`, 0, q * CEL_W * ESC, i * CEL_H * ESC, CEL_W * ESC, CEL_H * ESC);
    }
  });
}

export const FOLHAS_CPU = ["cpuA", "cpuB", "cpuC"];

export function gerarPersonagens(cena) {
  for (const nome of ["jogador", ...FOLHAS_CPU]) gerarFolha(cena, "folha_" + nome, PALETAS[nome]);
}

// Direcao da API -> [linha da folha, espelhar]
export const FACE = {
  S: ["baixo", false],
  W: ["cima", false],
  D: ["dir", false],
  A: ["dir", true],
};
