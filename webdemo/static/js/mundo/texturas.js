// Toda a arte e gerada aqui, em codigo (Phaser Graphics -> generateTexture).
// Nenhum arquivo de imagem, nenhum sprite de terceiros: formas simples e
// paleta propria (constantes.js). Cada textura e desenhada em ESC vezes o
// tamanho do mundo (scaleCanvas) pra ficar nitida em tela HiDPI.

import { TW, TH, FOLGA, ALTURA, COR, ESC } from "./constantes.js";

const VARIANTES = 3;

// Pseudo-aleatorio deterministico: as texturas saem iguais a cada carga.
function lcg(semente) {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// w x h em unidades do mundo; o desenho usa essas mesmas unidades.
function textura(cena, chave, w, h, desenhar) {
  const g = cena.make.graphics({ x: 0, y: 0, add: false });
  g.scaleCanvas(ESC, ESC);
  desenhar(g);
  g.generateTexture(chave, w * ESC, h * ESC);
  g.destroy();
}

function gerarTiles(cena) {
  const altura = FOLGA + TH;
  for (const terreno of ["grass", "concrete", "water"]) {
    const cores = COR[terreno];
    const alt = ALTURA[terreno];
    for (let v = 0; v < VARIANTES; v++) {
      textura(cena, `tile_${terreno}_${v}`, TW, altura, (g) => {
        const yTopo = altura - alt - TH; // borda de cima da face de topo
        // face frontal (a parede do bloco)
        g.fillStyle(cores.frente, 1);
        g.fillRect(0, yTopo + TH, TW, alt);
        g.fillStyle(0x000000, 0.14);
        g.fillRect(0, yTopo + TH, TW, 1.5);
        // face de topo
        g.fillStyle(cores.topo, 1);
        g.fillRect(0, yTopo, TW, TH);
        // contorno fino so pra separar as celulas
        g.lineStyle(1, cores.borda, 0.7);
        g.strokeRect(0.5, yTopo + 0.5, TW - 1, TH - 1);
        const rnd = lcg(terreno.length * 97 + v * 31 + 7);
        const ponto = (margem) => ({
          x: margem + rnd() * (TW - 2 * margem),
          y: yTopo + margem + rnd() * (TH - 2 * margem),
        });
        if (terreno === "grass") {
          for (let i = 0; i < 7; i++) {
            const p = ponto(6);
            g.lineStyle(1, i % 2 ? cores.detalhe : cores.sombra, 1);
            g.lineBetween(p.x, p.y, p.x - 1, p.y - 3.5);
            g.lineBetween(p.x + 2, p.y, p.x + 3, p.y - 2.5);
          }
        } else if (terreno === "concrete") {
          for (let i = 0; i < 6; i++) {
            const p = ponto(5);
            g.fillStyle(i % 2 ? cores.detalhe : cores.sombra, 1);
            g.fillRect(p.x, p.y, 2, 1);
          }
          g.lineStyle(1, cores.sombra, 0.7);
          g.lineBetween(TW / 2, yTopo + 2, TW / 2, yTopo + TH - 2);
        } else {
          for (let i = 0; i < 4; i++) {
            const p = ponto(8);
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
    g.fillStyle(0x000000, 0.34);
    g.fillEllipse(20, 8, 34, 12);
  });
  // anel do Centro / ginasio, no chao
  textura(cena, "anel", 44, 20, (g) => {
    g.lineStyle(1.5, COR.jade, 0.95);
    g.strokeEllipse(22, 10, 40, 16);
  });
  // anel do jogador: jade com miolo claro, destaca do resto sem gritar
  textura(cena, "anelJogador", 40, 18, (g) => {
    g.lineStyle(3, 0x04231f, 0.9);
    g.strokeEllipse(20, 9, 34, 13);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeEllipse(20, 9, 34, 13);
    g.fillStyle(COR.jade, 0.35);
    g.fillEllipse(20, 9, 32, 11);
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

// Predio em visao obliqua: parede frontal + faixa de telhado (a face de topo
// aparece achatada acima da parede) + volume lateral so como sombra.
function predio(g, x, base, larg, altParede, altTelhado, cores) {
  // volume: tampa mais escura atras do telhado, da a ideia de profundidade
  g.fillStyle(cores.telhadoFundo, 1);
  g.fillRect(x + 2, base - altParede - altTelhado - 3, larg - 4, 3);
  g.fillStyle(cores.telhado, 1);
  g.fillRect(x, base - altParede - altTelhado, larg, altTelhado);
  g.fillStyle(cores.parede, 1);
  g.fillRect(x, base - altParede, larg, altParede);
  g.fillStyle(cores.paredeSombra, 1);
  g.fillRect(x, base - 3, larg, 3);
  g.fillRect(x + larg - 3, base - altParede, 3, altParede);
  g.lineStyle(1, cores.contorno, 1);
  g.strokeRect(x + 0.5, base - altParede - altTelhado + 0.5, larg - 1, altParede + altTelhado - 1);
}

function gerarCentro(cena) {
  const larg = 34;
  const altParede = 18;
  const altTelhado = 9;
  const w = larg + 6;
  const h = altParede + altTelhado + 8;
  textura(cena, "centro", w, h, (g) => {
    const x = 3;
    const base = h - 1;
    predio(g, x, base, larg, altParede, altTelhado, {
      telhado: COR.jade, telhadoFundo: COR.jadeEscuro, parede: 0xe4ecf1,
      paredeSombra: 0xb8c5cf, contorno: COR.jadeEscuro,
    });
    // cruz no telhado
    g.fillStyle(COR.papel, 1);
    g.fillRect(x + larg / 2 - 1.5, base - altParede - altTelhado + 1.5, 3, 6);
    g.fillRect(x + larg / 2 - 3, base - altParede - altTelhado + 3, 6, 3);
    // porta e janelas
    g.fillStyle(0x2a3a47, 1);
    g.fillRect(x + larg / 2 - 4, base - 12, 8, 12);
    g.fillStyle(COR.jadeEscuro, 1);
    g.fillRect(x + 4, base - 13, 6, 6);
    g.fillRect(x + larg - 10, base - 13, 6, 6);
    g.fillStyle(0xa9d8f7, 1);
    g.fillRect(x + 5, base - 12, 4, 4);
    g.fillRect(x + larg - 9, base - 12, 4, 4);
  });
}

function gerarGinasio(cena) {
  // Reservado: o grid ainda nao gera ginasio, mas o tipo ja existe e e desenhado.
  const larg = 42;
  const altParede = 24;
  const altTelhado = 11;
  const w = larg + 6;
  const h = altParede + altTelhado + 22;
  textura(cena, "ginasio", w, h, (g) => {
    const x = 3;
    const base = h - 1;
    predio(g, x, base, larg, altParede, altTelhado, {
      telhado: 0x5a4a9c, telhadoFundo: 0x3a2f6e, parede: 0x8a7bd0,
      paredeSombra: 0x6e60b4, contorno: 0x2a2350,
    });
    // faixa dourada com um G em arco
    g.fillStyle(COR.ambar, 1);
    g.fillRect(x + 6, base - 20, larg - 12, 12);
    g.fillStyle(0x3a2f6e, 1);
    g.fillRect(x + 7.5, base - 18.5, larg - 15, 9);
    g.lineStyle(1.5, COR.ambar, 1);
    g.beginPath();
    g.arc(x + larg / 2, base - 14, 3.5, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(320), false);
    g.strokePath();
    g.lineBetween(x + larg / 2, base - 14, x + larg / 2 + 3.5, base - 14);
    g.fillStyle(0x2a3a47, 1);
    g.fillRect(x + larg / 2 - 4, base - 7, 8, 7);
    // mastro (a bandeira animada e um sprite a parte, ver cena.js)
    const topo = base - altParede - altTelhado - 3;
    g.lineStyle(1.5, 0x2a2350, 1);
    g.lineBetween(x + larg / 2, topo, x + larg / 2, topo - 15);
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

// Criaturas selvagens: tres cores, dois quadros (olhos abertos / fechados).
// Ficam paradas no mapa, o idle (bob + piscada) e feito na cena.
export const CORES_CRIATURA = [
  { corpo: 0x8a5cc4, barriga: 0xb894e6 },
  { corpo: 0xe0762a, barriga: 0xf6c28a },
  { corpo: 0x2fa6a0, barriga: 0x9be3d9 },
];

function gerarCriaturas(cena) {
  CORES_CRIATURA.forEach((cor, i) => {
    for (let q = 0; q < 2; q++) {
      textura(cena, `criatura_${i}_${q}`, 28, 30, (g) => {
        g.fillStyle(cor.corpo, 1);
        g.fillTriangle(5, 12, 9, 1, 13, 10);
        g.fillTriangle(23, 12, 19, 1, 15, 10);
        g.fillEllipse(14, 19, 24, 20);
        g.fillStyle(cor.barriga, 1);
        g.fillEllipse(14, 22, 14, 10);
        if (q === 0) {
          g.fillStyle(0x1b1030, 1);
          g.fillCircle(9, 17, 2);
          g.fillCircle(19, 17, 2);
          g.fillStyle(0xffffff, 1);
          g.fillCircle(9.6, 16.4, 0.8);
          g.fillCircle(19.6, 16.4, 0.8);
        } else {
          g.lineStyle(1.4, 0x1b1030, 1);
          g.lineBetween(7, 17.5, 11, 17.5);
          g.lineBetween(17, 17.5, 21, 17.5);
        }
      });
    }
  });
}

// Efeitos pequenos: poeira dos passos, tufo de grama, brilho da agua, luz.
function gerarEfeitos(cena) {
  textura(cena, "poeira", 8, 8, (g) => {
    g.fillStyle(0xe8e2d0, 0.9);
    g.fillCircle(4, 4, 3);
  });
  textura(cena, "tufo", 12, 12, (g) => {
    g.lineStyle(1.3, 0x2f6b3a, 1);
    g.lineBetween(6, 12, 3, 3);
    g.lineBetween(6, 12, 6, 1.5);
    g.lineBetween(6, 12, 9, 3);
    g.lineStyle(1.3, 0x86d377, 1);
    g.lineBetween(6, 12, 4.6, 4.5);
    g.lineBetween(6, 12, 7.6, 4);
  });
  textura(cena, "brilhoAgua", 14, 6, (g) => {
    g.lineStyle(1.5, 0xe6f6ff, 1);
    g.lineBetween(2, 3, 12, 3);
    g.lineStyle(1, 0xffffff, 0.7);
    g.lineBetween(5, 1, 9, 1);
  });
  // halo suave: discos concentricos de pouco alfa (vira gradiente radial)
  textura(cena, "luz", 40, 40, (g) => {
    for (let r = 20; r > 2; r -= 2) {
      g.fillStyle(0xbffcf0, 0.045);
      g.fillCircle(20, 20, r);
    }
  });
}

// Bandeira do ginasio: tres quadros de onda, trocados em loop pela cena.
function gerarBandeira(cena) {
  const ondas = [0, 1.6, -1.6];
  ondas.forEach((ond, q) => {
    textura(cena, `bandeira_${q}`, 16, 14, (g) => {
      g.fillStyle(COR.ambar, 1);
      g.beginPath();
      g.moveTo(0, 2);
      g.lineTo(8, 2.5 + ond * 0.5);
      g.lineTo(15, 4 + ond);
      g.lineTo(11, 7.5 + ond * 0.8);
      g.lineTo(15, 11 + ond * 0.4);
      g.lineTo(8, 11.5 - ond * 0.4);
      g.lineTo(0, 12);
      g.closePath();
      g.fillPath();
      g.fillStyle(0x3a2f6e, 1);
      g.fillRect(3, 5.5, 4, 3);
    });
  });
}

function gerarMarcador(cena) {
  // Seta/farol jade que flutua sobre o Centro mais proximo.
  textura(cena, "marcador", 18, 22, (g) => {
    g.fillStyle(0x04231f, 1);
    g.fillTriangle(1, 2, 17, 2, 9, 21);
    g.fillStyle(COR.jade, 1);
    g.fillTriangle(3.5, 4, 14.5, 4, 9, 17);
    g.fillStyle(COR.papel, 1);
    g.fillRect(7.5, 5.5, 3, 5);
    g.fillRect(6.2, 7, 5.6, 2.4);
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
  gerarEfeitos(cena);
  gerarBandeira(cena);
  gerarMarcador(cena);
}

export const NUM_VARIANTES = VARIANTES;
