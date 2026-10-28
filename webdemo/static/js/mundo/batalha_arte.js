// Arte da tela de batalha, toda gerada em codigo (Phaser Graphics ->
// generateTexture). Nenhum arquivo de imagem e nada copiado de terceiros:
// as criaturas, os efeitos, as plataformas e os fundos sao formas simples
// desenhadas aqui, na paleta propria do projeto.
//
// Cada criatura tem 4 texturas: frente e costas, em 2 quadros de idle
// (cauda, chama e boca mudam um pouco). Chave: "bt_<Especie>_<vista>_<q>".
// Desenhadas numa caixa de 72 x 68 unidades (pes em y = 66) com ESCB pixels
// por unidade, pra continuar nitidas quando a camera da batalha amplia.

export const ESCB = 6;
export const CAIXA_W = 72;
export const CAIXA_H = 68;
export const PES = 66; // y dos pes dentro da caixa (origem Y = PES / CAIXA_H)

const TINTA = 0x1a1424;
const BRANCO = 0xffffff;

// Cor de cada tipo (chips do menu, particulas, fallback das criaturas).
export const COR_TIPO = {
  Fire: 0xf06a2c, Water: 0x3f8fd6, Rock: 0x9a8f6a, Psychic: 0xc45fd0, Normal: 0xa9b0b8,
};

// Quanto cada especie ocupa na arena (cosmetico: so o tamanho do desenho).
export const TAMANHO_ESPECIE = {
  Charmander: 0.92, Charzard: 1.12, Squirtle: 0.92, Geodude: 0.98, Onyx: 1.15, Snorlax: 1.12, Mew: 0.86,
};

export const ESPECIES = ["Charmander", "Charzard", "Squirtle", "Geodude", "Onyx", "Snorlax", "Mew"];

// Pincel: cada forma sai preenchida e com contorno fino. `massa` desenha uma
// lista de elipses como uma silhueta so (contorno por baixo, cor por cima),
// pra caudas e corpos em cadeia nao ficarem com costura.
class Pincel {
  constructor(g) {
    this.g = g;
    this.lw = 1.25;
  }

  e(x, y, w, h, cor, a = 1, borda = true) {
    const g = this.g;
    g.fillStyle(cor, a);
    g.fillEllipse(x, y, w, h);
    if (borda) { g.lineStyle(this.lw, TINTA, 1); g.strokeEllipse(x, y, w, h); }
    return this;
  }

  r(x, y, w, h, cor, raio = 2, a = 1, borda = true) {
    const g = this.g;
    g.fillStyle(cor, a);
    g.fillRoundedRect(x, y, w, h, raio);
    if (borda) { g.lineStyle(this.lw, TINTA, 1); g.strokeRoundedRect(x, y, w, h, raio); }
    return this;
  }

  p(pts, cor, a = 1, borda = true) {
    const g = this.g;
    const P = pts.map(([x, y]) => ({ x, y }));
    g.fillStyle(cor, a);
    g.fillPoints(P, true);
    if (borda) { g.lineStyle(this.lw, TINTA, 1); g.strokePoints(P, true); }
    return this;
  }

  // linha solta (rugas, rachaduras, boca, sobrancelha)
  l(pts, cor = TINTA, esp = 1, a = 1) {
    const g = this.g;
    g.lineStyle(esp, cor, a);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokePath();
    return this;
  }

  // brilho / sombra sem contorno
  brilho(x, y, w, h, a = 0.28) { return this.e(x, y, w, h, BRANCO, a, false); }
  sombra(x, y, w, h, cor = 0x000000, a = 0.2) { return this.e(x, y, w, h, cor, a, false); }

  massa(elipses, cor) {
    const g = this.g;
    g.fillStyle(TINTA, 1);
    for (const [x, y, w, h] of elipses) g.fillEllipse(x, y, w + 2 * this.lw, h + 2 * this.lw);
    g.fillStyle(cor, 1);
    for (const [x, y, w, h] of elipses) g.fillEllipse(x, y, w, h);
    return this;
  }

  // Chama em gota: tres camadas, a ponta balanca com `q`.
  chama(x, y, s, q) {
    const ponta = q ? 1.8 : -1.8;
    const gota = (k, cor) => this.p([
      [x + ponta * k * s, y - 12 * k * s], [x + 4.2 * k * s, y - 5 * k * s], [x + 5.2 * k * s, y],
      [x + 3.2 * k * s, y + 4.4 * k * s], [x, y + 5.4 * k * s], [x - 3.2 * k * s, y + 4.4 * k * s],
      [x - 5.2 * k * s, y], [x - 4.2 * k * s, y - 5 * k * s],
    ], cor, 1, k === 1);
    gota(1, 0xff5a2a);
    gota(0.72, 0xffa63a);
    gota(0.4, 0xffe58a);
  }
}

// ---------------- criaturas ----------------

function charmander(p, vista, q) {
  const O = 0xf2893a, OS = 0xd96a26, CR = 0xf7dba2;
  const frente = vista === "frente";
  // cauda atras do corpo, com a chama na ponta
  p.massa([[46, 55, 10, 7], [51.5, 50.5, 9, 7], [55, 44, 8, 7], [56.5, 38, 7, 6]], O);
  p.chama(57, 31, frente ? 1 : 1.15, q);
  p.e(23, 58, 14, 7, OS).e(41, 58, 14, 7, OS);
  p.e(19.5, 61, 2.4, 2.4, CR, 1, false).e(23, 62, 2.4, 2.4, CR, 1, false).e(37.5, 62, 2.4, 2.4, CR, 1, false).e(41, 62, 2.4, 2.4, CR, 1, false);
  p.e(32, 44, frente ? 27 : 28, 27, O);
  if (frente) {
    p.e(32, 47, 17, 19, CR);
    for (const y of [42, 46, 50]) p.l([[25, y], [39, y]], 0xd2b072, 0.8);
  } else {
    p.sombra(32, 46, 7, 22, OS, 0.5);
    for (const y of [34, 40, 46, 52]) p.p([[29.5, y], [34.5, y], [32, y - 3.2]], OS, 1, false);
  }
  p.e(16.5, 43, 7, 12, O).e(47.5, 43, 7, 12, O);
  p.e(32, 22, 30, 25, O);
  if (frente) {
    p.e(32, 29, 15, 10, 0xf6a05a);
    p.e(24, 22, 9, 11, BRANCO).e(40, 22, 9, 11, BRANCO);
    p.e(25, 23, 5, 7, 0x16202e, 1, false).e(39, 23, 5, 7, 0x16202e, 1, false);
    p.e(26, 20.6, 2, 2.6, BRANCO, 1, false).e(40, 20.6, 2, 2.6, BRANCO, 1, false);
    p.e(29.6, 27.6, 1.3, 1.3, TINTA, 1, false).e(34.4, 27.6, 1.3, 1.3, TINTA, 1, false);
    if (q) p.e(32, 32.6, 6.5, 3.6, 0x7a2a2a).e(32, 33.4, 3.2, 1.8, 0xe96a7a, 1, false);
    else p.l([[28.5, 31.6], [30.5, 33], [33.5, 33], [35.5, 31.6]], TINTA, 1.1);
  } else {
    p.sombra(32, 30, 22, 8, OS, 0.35);
  }
  p.brilho(25, 13, 10, 5);
}

function charzard(p, vista, q) {
  const C = 0xe0522d, CS = 0xb73a22, BE = 0xf6c98a, AS = 0x4a3f8f, AM = 0x7a6cd0;
  const frente = vista === "frente";
  const asa = (esp) => {
    const m = esp ? (x) => 64 - x : (x) => x;
    const bate = q ? -2 : 1.5;
    const pts = [[20, 36], [7, 28 + bate], [1, 12 + bate], [9, 17 + bate], [11, 6 + bate], [17, 15 + bate], [21, 27]].map(([x, y]) => [m(x), y]);
    p.p(pts, AM);
    p.l([[m(20), 36], [m(9), 17 + bate]], AS, 1).l([[m(20), 36], [m(15), 15 + bate]], AS, 1);
  };
  if (frente) { asa(false); asa(true); }
  p.massa([[46, 57, 10, 7], [52, 53, 9, 7], [56, 47, 8, 7], [58, 41, 7, 6]], C);
  p.chama(58, 33, 1.1, q);
  p.e(22, 58, 15, 8, CS).e(42, 58, 15, 8, CS);
  p.e(32, 43, 29, 32, C);
  if (frente) {
    p.e(32, 46, 17, 25, BE);
    for (const y of [40, 45, 50, 55]) p.l([[25, y], [39, y]], 0xc89a58, 0.8);
  } else {
    p.sombra(32, 45, 8, 26, CS, 0.45);
    for (const y of [32, 39, 46, 53]) p.p([[29, y], [35, y], [32, y - 4]], CS, 1, false);
  }
  p.e(15.5, 43, 7, 14, C).e(48.5, 43, 7, 14, C);
  p.e(32, 20, 25, 22, C);
  if (frente) {
    p.e(32, 26, 15, 11, 0xee6b3f);
    p.p([[21, 14], [16, 4], [27, 9]], 0xf3e4c0).p([[43, 14], [48, 4], [37, 9]], 0xf3e4c0);
    p.e(25.5, 19, 7, 6.4, BRANCO).e(38.5, 19, 7, 6.4, BRANCO);
    p.e(26.2, 19.6, 3.2, 4.4, 0x16202e, 1, false).e(37.8, 19.6, 3.2, 4.4, 0x16202e, 1, false);
    p.l([[21.5, 15], [29, 17.4]], TINTA, 1.4).l([[42.5, 15], [35, 17.4]], TINTA, 1.4);
    p.e(30, 25.6, 1.2, 1.2, TINTA, 1, false).e(34, 25.6, 1.2, 1.2, TINTA, 1, false);
    if (q) p.e(32, 30, 7, 3.4, 0x6a2020).p([[29.5, 28.8], [30.7, 30.6], [31.9, 28.8]], BRANCO, 1, false);
    else p.l([[28, 29.6], [32, 31], [36, 29.6]], TINTA, 1.1);
  } else {
    p.p([[21, 14], [16, 4], [27, 9]], 0xf3e4c0).p([[43, 14], [48, 4], [37, 9]], 0xf3e4c0);
    p.sombra(32, 27, 20, 8, CS, 0.35);
  }
  p.brilho(25, 12, 9, 4.5);
  if (!frente) { asa(false); asa(true); }
}

function squirtle(p, vista, q) {
  const B = 0x5bb4e6, BS = 0x3c8fc4, CR = 0xf3e3a3, SH = 0x9a5e34, SH2 = 0xe8c36a;
  const frente = vista === "frente";
  // cauda enrolada
  p.massa([[47, 57, 8, 6], [52, 53.5, 7, 6], [55, 48.5, 6, 6], [54, 44, 5, 5]], B);
  p.e(52.6 + (q ? 1 : 0), 41, 6, 6, B, 1);
  p.e(23, 58, 14, 7, BS).e(41, 58, 14, 7, BS);
  p.e(19.5, 61.4, 2.2, 2.2, CR, 1, false).e(23, 62, 2.2, 2.2, CR, 1, false).e(37, 62, 2.2, 2.2, CR, 1, false).e(40.5, 61.4, 2.2, 2.2, CR, 1, false);
  if (frente) {
    p.e(32, 43, 33, 30, SH); // beirada do casco aparecendo nos lados
    p.e(32, 44, 26, 27, B);
    p.e(32, 45, 21, 23, CR);
    p.l([[22, 45], [42, 45]], 0xd2b072, 0.9).l([[32, 34], [32, 56]], 0xd2b072, 0.9);
    p.e(15.5, 43, 8, 13, B).e(48.5, 43, 8, 13, B);
    p.e(32, 23, 28, 24, B);
    p.e(25, 23, 8, 10, BRANCO).e(39, 23, 8, 10, BRANCO);
    p.e(26, 24, 4.6, 6.6, 0x16202e, 1, false).e(38, 24, 4.6, 6.6, 0x16202e, 1, false);
    p.e(27, 21.6, 1.8, 2.4, BRANCO, 1, false).e(39, 21.6, 1.8, 2.4, BRANCO, 1, false);
    p.e(20, 30, 4.4, 3, 0xf7a8a8, 0.6, false).e(44, 30, 4.4, 3, 0xf7a8a8, 0.6, false);
    if (q) p.e(32, 31.4, 8, 4, 0x7a2a3a).e(32, 32.4, 4, 1.8, 0xe96a7a, 1, false);
    else p.l([[26, 30], [29, 32.4], [35, 32.4], [38, 30]], TINTA, 1.2);
    p.brilho(25, 14, 9, 4.5);
  } else {
    p.e(32, 22, 22, 18, B);
    p.e(32, 44, 35, 33, SH2);
    p.e(32, 43, 31, 29, SH);
    const hex = [[32, 29], [41, 34], [41, 44], [32, 49], [23, 44], [23, 34]];
    p.l([...hex, hex[0]], 0x6a3c20, 1.1);
    for (const [x, y] of hex) p.l([[x, y], [32 + (x - 32) * 1.5, 43 + (y - 43) * 1.4]], 0x6a3c20, 0.9);
    p.brilho(26, 33, 9, 5, 0.22);
    p.e(15.5, 44, 7, 11, B).e(48.5, 44, 7, 11, B);
  }
}

function geodude(p, vista, q) {
  const G = 0x8e939c, GS = 0x6a6f78, GL = 0xb4bac3;
  const frente = vista === "frente";
  const b = q ? 1.6 : 0; // os bracos sobem e descem
  // bracos atras
  p.massa([[13, 41 - b, 10, 15], [8.5, 49 - b, 13, 13]], G);
  p.massa([[51, 41 - b, 10, 15], [55.5, 49 - b, 13, 13]], G);
  p.p([[13, 46], [11, 31], [20, 17], [32, 12], [44, 17], [53, 31], [51, 46], [46, 56], [18, 56]], G);
  p.p([[14, 31], [20, 17], [32, 12], [38, 14], [28, 24], [22, 36]], GL, 0.55, false);
  p.p([[13, 46], [18, 56], [46, 56], [51, 46], [44, 50], [22, 50]], GS, 0.55, false);
  p.l([[40, 14], [37, 23], [41, 29]], GS, 1).l([[22, 51], [25, 47], [23, 43]], GS, 1);
  p.e(8.5, 49 - b, 13, 13, G).e(55.5, 49 - b, 13, 13, G);
  p.l([[4, 48 - b], [9, 52 - b]], GS, 1).l([[60, 48 - b], [55, 52 - b]], GS, 1);
  if (frente) {
    p.p([[20, 28], [30, 31], [30, 34.4], [20, 31.6]], 0x4a4f58).p([[44, 28], [34, 31], [34, 34.4], [44, 31.6]], 0x4a4f58);
    p.e(25.4, 37, 6, 6, BRANCO).e(38.6, 37, 6, 6, BRANCO);
    p.e(26, 37.6, 3, 3.6, 0x16202e, 1, false).e(38, 37.6, 3, 3.6, 0x16202e, 1, false);
    p.r(24, 45, 16, 5, BRANCO, 1.2);
    for (const x of [28, 32, 36]) p.l([[x, 45], [x, 50]], TINTA, 0.8);
    if (q) p.e(32, 52.4, 8, 2, 0x4a4f58, 1, false);
  } else {
    p.l([[26, 22], [30, 30], [27, 38]], GS, 1.1).l([[40, 28], [37, 36], [41, 44]], GS, 1.1);
    p.e(27, 25, 5, 3, 0x6f8f5a, 0.7, false);
  }
  p.brilho(24, 22, 10, 5, 0.18);
}

function onyx(p, vista, q) {
  const G = 0x8d8f99, GS = 0x676973, GL = 0xb6b8c2;
  const frente = vista === "frente";
  const s = q ? 1.6 : -1.6; // o corpo ondula
  const seg = (x, y, w, h) => {
    p.e(x, y, w, h, G).brilho(x - w * 0.18, y - h * 0.22, w * 0.45, h * 0.28, 0.24);
    p.l([[x + w * 0.1, y - h * 0.5], [x + w * 0.02, y - h * 0.05], [x + w * 0.2, y + h * 0.2]], GS, 0.9, 0.9);
  };
  // da base pra cima, as de baixo maiores
  seg(34, 56, 40, 18);
  seg(27 + s * 0.4, 43.5, 31, 16);
  seg(35 + s * 0.8, 32.5, 25, 14);
  // espinhos nas costas
  for (const [x, y, k] of [[48, 54, 1], [41 + s * 0.4, 42, 0.9], [46 + s * 0.8, 31.5, 0.8]]) {
    p.p([[x, y], [x + 7 * k, y - 4 * k], [x + 1.5 * k, y - 8 * k]], GS);
  }
  const hx = 29 + s * 1.2;
  // cabeca
  p.p([[hx - 12, 20], [hx - 9, 8], [hx - 2, 5], [hx + 8, 8], [hx + 12, 18], [hx + 9, 27], [hx - 8, 27]], G);
  p.p([[hx - 9, 8], [hx - 4, -1], [hx, 6]], GS).p([[hx + 8, 8], [hx + 14, 1], [hx + 4, 6]], GS);
  p.brilho(hx - 5, 12, 10, 5, 0.22);
  if (frente) {
    p.p([[hx - 9, 13], [hx - 1, 15.4], [hx - 1, 18], [hx - 9, 16]], 0x3f434c).p([[hx + 9, 13], [hx + 1, 15.4], [hx + 1, 18], [hx + 9, 16]], 0x3f434c);
    p.e(hx - 5, 20.4, 4.6, 4.6, BRANCO).e(hx + 5, 20.4, 4.6, 4.6, BRANCO);
    p.e(hx - 4.6, 20.8, 2.4, 2.8, 0x16202e, 1, false).e(hx + 4.6, 20.8, 2.4, 2.8, 0x16202e, 1, false);
    p.l([[hx - 6, 25], [hx, 26], [hx + 6, 25]], TINTA, 1);
  } else {
    p.l([[hx - 3, 9], [hx - 5, 17], [hx - 2, 24]], GS, 1).l([[hx + 4, 10], [hx + 6, 18], [hx + 3, 24]], GS, 1);
  }
  p.e(10, 62, 3, 2, GL, 0.9, false).e(60, 58, 3.4, 2.2, GL, 0.9, false);
}

function snorlax(p, vista, q) {
  const SB = 0x3a6b86, SS = 0x2a5068, CR = 0xf0e3c4;
  const frente = vista === "frente";
  const resp = q ? 0.8 : 0;
  p.e(18, 59, 18, 9, frente ? CR : SS).e(46, 59, 18, 9, frente ? CR : SS);
  if (frente) {
    for (const x of [13.5, 18, 22.5, 41.5, 46, 50.5]) p.e(x, 62.6, 2.4, 2.4, BRANCO, 1, false);
  }
  p.e(32, 42, 50 + resp, 40 + resp, SB);
  if (frente) p.e(32, 47, 33 + resp, 29 + resp, CR);
  else p.sombra(32, 52, 36, 20, SS, 0.35);
  p.e(9.5, 45, 12, 19, SB).e(54.5, 45, 12, 19, SB);
  if (frente) p.e(9.5, 54, 11, 8, CR).e(54.5, 54, 11, 8, CR);
  p.p([[17, 13], [13, 2], [25, 8]], SB).p([[47, 13], [51, 2], [39, 8]], SB);
  p.p([[17.6, 11], [15.4, 5], [22, 8.6]], 0xd98fa0, 1, false).p([[46.4, 11], [48.6, 5], [42, 8.6]], 0xd98fa0, 1, false);
  p.e(32, 20, 36, 26, SB);
  if (frente) {
    p.e(32, 24, 27, 18, CR);
    p.l([[22, 21.6], [25, 23.4], [28.4, 21.6]], TINTA, 1.5).l([[35.6, 21.6], [39, 23.4], [42, 21.6]], TINTA, 1.5);
    p.e(30, 26.2, 1.2, 1.2, TINTA, 1, false).e(34, 26.2, 1.2, 1.2, TINTA, 1, false);
    p.l([[27, 29.4], [32, 31.4], [37, 29.4]], TINTA, 1.1);
    p.p([[28.6, 29.8], [29.8, 32], [31, 30.4]], BRANCO, 1, false).p([[33, 30.4], [34.2, 32], [35.4, 29.8]], BRANCO, 1, false);
    p.e(32, 4.6, 5, 2, SS, 0.6, false);
  } else {
    p.sombra(32, 24, 28, 14, SS, 0.3);
    p.e(32, 66 - 6, 7, 4, CR, 1, false);
  }
  p.brilho(24, 11, 12, 5, 0.22);
}

function mew(p, vista, q) {
  const M = 0xf6b3d4, MS = 0xe58db8, ML = 0xfbe0ee;
  const frente = vista === "frente";
  // brilho em volta (aura leve; o resto da aura e animado na cena)
  p.e(32, 40, 56, 56, 0xffd0ec, 0.14, false);
  const o = q ? 1.4 : -1.4;
  // cauda comprida terminando em bulbo
  p.massa([[40, 52, 8, 6], [46, 55.5, 8, 6], [52, 53, 7, 6], [55.5, 47, 6, 6], [55 + o * 0.4, 40.5, 5, 5]], M);
  p.e(53 + o, 35, 9, 9, M);
  p.e(26, 58, 10, 8, MS).e(38, 58, 10, 8, MS);
  p.e(32, 45, 19, 21, M);
  if (frente) p.e(32, 47.5, 11.5, 14, ML, 1, false);
  else p.sombra(32, 47, 6, 17, MS, 0.4);
  p.e(21.5, 43, 5.6, 10, M).e(42.5, 43, 5.6, 10, M);
  p.p([[20, 17], [16, 2], [28, 11]], M).p([[44, 17], [48, 2], [36, 11]], M);
  p.p([[20.6, 14.6], [18.4, 6.6], [25, 11.4]], MS, 1, false).p([[43.4, 14.6], [45.6, 6.6], [39, 11.4]], MS, 1, false);
  p.e(32, 25, 27, 23, M);
  if (frente) {
    p.e(25.6, 26, 8.6, 10.6, 0x2f7fd6).e(38.4, 26, 8.6, 10.6, 0x2f7fd6);
    p.e(26, 26.4, 5, 7, 0x10224a, 1, false).e(38, 26.4, 5, 7, 0x10224a, 1, false);
    p.e(27, 23.4, 2.4, 3.2, BRANCO, 1, false).e(39, 23.4, 2.4, 3.2, BRANCO, 1, false);
    p.e(32, 31.4, 3, 1.8, MS, 1, false);
    if (q) p.l([[29.4, 33.4], [32, 34.6], [34.6, 33.4]], TINTA, 1);
  } else {
    p.sombra(32, 27, 20, 10, MS, 0.35);
  }
  p.brilho(25, 17, 10, 4.5, 0.32);
}

// Criatura de uma especie que a arte nao conhece: blob na cor do tipo.
function generica(p, vista, q, tipo) {
  const c = COR_TIPO[tipo] ?? 0xa9b0b8;
  p.e(24, 59, 14, 7, c).e(40, 59, 14, 7, c);
  p.e(32, 42, 38, 34, c);
  p.e(32, 24, 28, 22, c);
  if (vista === "frente") {
    p.e(25, 24, 7, 8, BRANCO).e(39, 24, 7, 8, BRANCO);
    p.e(25.5, 24.6, 3.6, 5, 0x16202e, 1, false).e(38.5, 24.6, 3.6, 5, 0x16202e, 1, false);
    p.l([[28, 32], [32, q ? 34 : 33], [36, 32]], TINTA, 1.1);
  }
  p.brilho(25, 15, 10, 5);
}

const DESENHOS = { Charmander: charmander, Charzard: charzard, Squirtle: squirtle, Geodude: geodude, Onyx: onyx, Snorlax: snorlax, Mew: mew };

export function chaveCriatura(especie, tipo, vista, q) {
  return `bt_${DESENHOS[especie] ? especie : "g_" + tipo}_${vista}_${q}`;
}

function textura(cena, chave, w, h, desenhar, esc = ESCB) {
  const g = cena.make.graphics({ x: 0, y: 0, add: false });
  g.scaleCanvas(esc, esc);
  desenhar(g);
  g.generateTexture(chave, Math.ceil(w * esc), Math.ceil(h * esc));
  g.destroy();
}

// Gera so o que a batalha precisa (uma criatura por vez, sob demanda).
export function garantirCriatura(cena, especie, tipo) {
  const conhecida = !!DESENHOS[especie];
  for (const vista of ["frente", "costas"]) {
    for (const q of [0, 1]) {
      const chave = chaveCriatura(especie, tipo, vista, q);
      if (cena.textures.exists(chave)) continue;
      textura(cena, chave, CAIXA_W, CAIXA_H, (g) => {
        g.translateCanvas(4, 2);
        const p = new Pincel(g);
        if (conhecida) DESENHOS[especie](p, vista, q);
        else generica(p, vista, q, tipo);
      });
    }
  }
}

// ---------------- particulas e efeitos ----------------

export function gerarEfeitos(cena) {
  if (cena.textures.exists("bt_ponto")) return;
  // ponto macio (usado em ADD): circulos concentricos de alfa baixo
  textura(cena, "bt_ponto", 32, 32, (g) => {
    for (let i = 12; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.085);
      g.fillCircle(16, 16, (i / 12) * 15);
    }
  });
  textura(cena, "bt_disco", 16, 16, (g) => { g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 7.5); });
  textura(cena, "bt_anel", 48, 48, (g) => {
    g.lineStyle(2.2, 0xffffff, 1); g.strokeCircle(24, 24, 21);
    g.lineStyle(1, 0xffffff, 0.5); g.strokeCircle(24, 24, 18);
  });
  textura(cena, "bt_chama", 20, 28, (g) => {
    const gota = (k, cor) => {
      g.fillStyle(cor, 1);
      const P = [[0, -12], [4, -5], [5, 0], [3, 4.4], [0, 5.4], [-3, 4.4], [-5, 0], [-4, -5]].map(([x, y]) => ({ x: 10 + x * k, y: 14 + y * k }));
      g.fillPoints(P, true);
    };
    gota(1.1, 0xff5a2a); gota(0.78, 0xffa63a); gota(0.44, 0xffe58a);
  });
  textura(cena, "bt_gota", 14, 20, (g) => {
    g.fillStyle(0x7cc4ff, 1);
    g.fillPoints([{ x: 7, y: 1 }, { x: 11.5, y: 10 }, { x: 11, y: 14 }, { x: 7, y: 18 }, { x: 3, y: 14 }, { x: 2.5, y: 10 }], true);
    g.fillStyle(0xe6f6ff, 0.9); g.fillEllipse(5, 11, 2.4, 5);
  });
  textura(cena, "bt_bolha", 20, 20, (g) => {
    g.lineStyle(1.3, 0xd8f0ff, 1); g.strokeCircle(10, 10, 8);
    g.fillStyle(0x9ad4ff, 0.22); g.fillCircle(10, 10, 8);
    g.fillStyle(0xffffff, 0.9); g.fillEllipse(7, 6.6, 3.2, 2);
  });
  textura(cena, "bt_pedra", 24, 24, (g) => {
    const P = [{ x: 3, y: 14 }, { x: 5, y: 5 }, { x: 13, y: 2 }, { x: 21, y: 8 }, { x: 20, y: 18 }, { x: 11, y: 22 }];
    g.fillStyle(0x8e939c, 1); g.fillPoints(P, true);
    g.fillStyle(0xb4bac3, 1); g.fillPoints([P[1], P[2], { x: 12, y: 11 }, P[0]], true);
    g.fillStyle(0x5d626b, 1); g.fillPoints([P[3], P[4], P[5], { x: 12, y: 12 }], true);
    g.lineStyle(1, 0x2b2f36, 1); g.strokePoints(P, true);
  });
  textura(cena, "bt_estrela", 24, 24, (g) => {
    const P = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const r = i % 2 ? 3.4 : 11;
      P.push({ x: 12 + Math.cos(a) * r, y: 12 + Math.sin(a) * r });
    }
    g.fillStyle(0xfff2a8, 1); g.fillPoints(P, true);
    g.fillStyle(0xffffff, 1); g.fillCircle(12, 12, 2.6);
  });
  textura(cena, "bt_raio", 24, 4, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillPoints([{ x: 0, y: 2 }, { x: 22, y: 0.4 }, { x: 24, y: 2 }, { x: 22, y: 3.6 }], true);
  });
  textura(cena, "bt_cruz", 16, 16, (g) => {
    g.fillStyle(0x6df0a0, 1);
    g.fillRoundedRect(6, 1, 4, 14, 1.5); g.fillRoundedRect(1, 6, 14, 4, 1.5);
  });
  textura(cena, "bt_onda", 64, 64, (g) => {
    g.lineStyle(3, 0xffffff, 1); g.strokeCircle(32, 32, 28);
    g.lineStyle(1.4, 0xffffff, 0.7); g.strokeCircle(32, 32, 22);
  });
  textura(cena, "bt_sombra", 64, 20, (g) => {
    for (let i = 8; i >= 1; i--) { g.fillStyle(0x000000, 0.07); g.fillEllipse(32, 10, (i / 8) * 62, (i / 8) * 18); }
  });
  // pokebola de batalha (desenho proprio: capsula indigo e branca)
  textura(cena, "bt_bola", 24, 24, (g) => {
    g.fillStyle(0x3b3f8c, 1); g.slice(12, 12, 10.5, Math.PI, 0, false); g.fillPath();
    g.fillStyle(0xf4f6fb, 1); g.slice(12, 12, 10.5, 0, Math.PI, false); g.fillPath();
    g.fillStyle(0x24285e, 1); g.fillRect(1.5, 11, 21, 2);
    g.fillStyle(0xf4f6fb, 1); g.fillCircle(12, 12, 3.8);
    g.lineStyle(1.2, 0x24285e, 1); g.strokeCircle(12, 12, 3.8); g.strokeCircle(12, 12, 10.5);
    g.fillStyle(0xffffff, 0.55); g.fillEllipse(8, 7, 4, 2.4);
  });
  textura(cena, "bt_bola_aberta", 24, 24, (g) => {
    g.fillStyle(0x3b3f8c, 1); g.slice(12, 9, 10.5, Math.PI, 0, false); g.fillPath();
    g.fillStyle(0xf4f6fb, 1); g.slice(12, 15, 10.5, 0, Math.PI, false); g.fillPath();
    g.lineStyle(1.2, 0x24285e, 1); g.strokeCircle(12, 12, 10.5);
  });
}

// ---------------- cenario ----------------

// Faixas horizontais pra simular gradiente (o canvas do generateTexture nao aceita
// preenchimento em degrade).
function degrade(g, x, y, w, h, c1, c2, passos = 36) {
  const a = Phaser.Display.Color.IntegerToColor(c1);
  const b = Phaser.Display.Color.IntegerToColor(c2);
  for (let i = 0; i < passos; i++) {
    const t = i / (passos - 1);
    const cor = Phaser.Display.Color.GetColor(
      a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t,
    );
    g.fillStyle(cor, 1);
    g.fillRect(x, y + (h * i) / passos, w, h / passos + 0.6);
  }
}

function lcg(semente) {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const FUNDO_W = 480;
export const FUNDO_H = 270;
export const HORIZONTE = 112;

// Cor do ceu no topo e do chao no fundo, pra estender o cenario alem do palco
// quando a janela nao e 16:9.
export const BORDA_FUNDO = {
  grass: { ceu: 0x6ec6f2, chao: 0x4e9c46 },
  water: { ceu: 0x6fb7ee, chao: 0x1f6aa8 },
  concrete: { ceu: 0x2b3f6b, chao: 0x3d434b },
  ginasio: { ceu: 0x1c1535, chao: 0x2e2552 },
};

const FUNDOS = {
  grass(g) {
    const rnd = lcg(11);
    degrade(g, 0, 0, FUNDO_W, HORIZONTE, 0x6ec6f2, 0xd6f1ff);
    for (const [x, y, w] of [[70, 26, 70], [210, 40, 90], [380, 22, 80], [450, 56, 60]]) {
      g.fillStyle(0xffffff, 0.88);
      g.fillEllipse(x, y, w, w * 0.32); g.fillEllipse(x - w * 0.25, y + 3, w * 0.55, w * 0.26); g.fillEllipse(x + w * 0.28, y + 2, w * 0.5, w * 0.24);
    }
    g.fillStyle(0x76b86a, 1); g.fillEllipse(110, HORIZONTE + 6, 330, 64);
    g.fillStyle(0x62a85c, 1); g.fillEllipse(390, HORIZONTE + 8, 360, 70);
    for (const x of [30, 62, 150, 330, 410, 452]) {
      g.fillStyle(0x3e7f43, 1); g.fillRect(x - 1.5, HORIZONTE - 4, 3, 12);
      g.fillStyle(0x2f6d3a, 1); g.fillEllipse(x, HORIZONTE - 10, 16, 20);
      g.fillStyle(0x4f9a4f, 1); g.fillEllipse(x - 2, HORIZONTE - 13, 8, 10);
    }
    degrade(g, 0, HORIZONTE, FUNDO_W, FUNDO_H - HORIZONTE, 0x86cf72, 0x4a9a45, 40);
    // listras de corte do gramado, em perspectiva
    for (let i = -8; i < 14; i++) {
      if (i % 2) continue;
      g.fillStyle(0x000000, 0.06);
      g.fillPoints([
        { x: 240 + (i - 0.5) * 12, y: HORIZONTE }, { x: 240 + (i + 0.5) * 12, y: HORIZONTE },
        { x: 240 + (i + 0.5) * 70, y: FUNDO_H }, { x: 240 + (i - 0.5) * 70, y: FUNDO_H },
      ], true);
    }
    for (let i = 0; i < 90; i++) {
      const y = HORIZONTE + 6 + rnd() * (FUNDO_H - HORIZONTE - 8);
      const x = rnd() * FUNDO_W;
      const k = 0.6 + (y - HORIZONTE) / 120;
      g.lineStyle(1, i % 2 ? 0xa6e68c : 0x3c8a3c, 0.8);
      g.lineBetween(x, y, x - 1 * k, y - 4 * k); g.lineBetween(x + 2 * k, y, x + 3 * k, y - 3 * k);
    }
    for (let i = 0; i < 16; i++) {
      const x = rnd() * FUNDO_W, y = HORIZONTE + 14 + rnd() * 130;
      g.fillStyle(i % 3 ? 0xfff2a8 : 0xffffff, 1); g.fillCircle(x, y, 1.1);
    }
  },
  water(g) {
    const rnd = lcg(23);
    degrade(g, 0, 0, FUNDO_W, HORIZONTE, 0x6fb7ee, 0xfff0d0);
    g.fillStyle(0xfff6d8, 0.85); g.fillCircle(360, HORIZONTE - 16, 22);
    g.fillStyle(0xffffff, 0.4); g.fillCircle(360, HORIZONTE - 16, 30);
    for (const [x, y, w] of [[90, 30, 80], [250, 52, 100]]) {
      g.fillStyle(0xffffff, 0.8); g.fillEllipse(x, y, w, w * 0.3); g.fillEllipse(x + w * 0.2, y - 4, w * 0.5, w * 0.28);
    }
    g.fillStyle(0x4f7aa6, 1); g.fillPoints([{ x: 0, y: HORIZONTE }, { x: 0, y: HORIZONTE - 14 }, { x: 40, y: HORIZONTE - 26 }, { x: 88, y: HORIZONTE - 12 }, { x: 120, y: HORIZONTE }], true);
    degrade(g, 0, HORIZONTE, FUNDO_W, FUNDO_H - HORIZONTE, 0x7cc4f2, 0x1f6aa8, 40);
    for (let i = 0; i < 70; i++) {
      const y = HORIZONTE + 4 + rnd() * (FUNDO_H - HORIZONTE - 6);
      const k = 0.5 + (y - HORIZONTE) / 80;
      const x = rnd() * FUNDO_W;
      g.lineStyle(1, 0xffffff, 0.35 + 0.3 * rnd());
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7 * k, y - 1.2 * k); g.lineTo(x + 14 * k, y); g.strokePath();
    }
    g.fillStyle(0xffffff, 0.2);
    g.fillPoints([{ x: 350, y: HORIZONTE + 2 }, { x: 370, y: HORIZONTE + 2 }, { x: 410, y: FUNDO_H }, { x: 320, y: FUNDO_H }], true);
  },
  concrete(g) {
    const rnd = lcg(31);
    degrade(g, 0, 0, FUNDO_W, HORIZONTE, 0x2b3f6b, 0xf0a87a);
    for (let i = 0; i < 22; i++) { g.fillStyle(0xffffff, 0.7); g.fillCircle(rnd() * FUNDO_W, rnd() * 50, 0.7); }
    let x = -6;
    while (x < FUNDO_W + 10) {
      const w = 22 + rnd() * 30;
      const h = 30 + rnd() * 70;
      g.fillStyle(0x232c45, 1); g.fillRect(x, HORIZONTE - h, w, h + 4);
      g.fillStyle(0x2d3857, 1); g.fillRect(x + w * 0.62, HORIZONTE - h, w * 0.38, h + 4);
      for (let yy = HORIZONTE - h + 5; yy < HORIZONTE - 3; yy += 7) {
        for (let xx = x + 3; xx < x + w - 4; xx += 6) {
          if (rnd() < 0.42) { g.fillStyle(0xffd98a, 0.9); g.fillRect(xx, yy, 2.6, 3.2); }
        }
      }
      x += w + 2;
    }
    degrade(g, 0, HORIZONTE, FUNDO_W, FUNDO_H - HORIZONTE, 0x6d747d, 0x3d434b, 40);
    g.fillStyle(0x8c949e, 1); g.fillRect(0, HORIZONTE, FUNDO_W, 3);
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      g.fillStyle(0xffffff, 0.16);
      g.fillPoints([
        { x: 240 + i * 14 - 0.8, y: HORIZONTE + 3 }, { x: 240 + i * 14 + 0.8, y: HORIZONTE + 3 },
        { x: 240 + i * 90 + 3, y: FUNDO_H }, { x: 240 + i * 90 - 3, y: FUNDO_H },
      ], true);
    }
    for (const px of [34, 438]) {
      g.fillStyle(0x1b2236, 1); g.fillRect(px - 1.2, HORIZONTE - 38, 2.4, 40);
      g.fillStyle(0xffe6a8, 1); g.fillCircle(px, HORIZONTE - 40, 3);
      g.fillStyle(0xffe6a8, 0.18); g.fillCircle(px, HORIZONTE - 40, 12);
    }
  },
  ginasio(g) {
    degrade(g, 0, 0, FUNDO_W, HORIZONTE + 6, 0x1c1535, 0x3a2f6e);
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 80;
      g.fillStyle(0x2b2250, 1); g.fillRect(x - 9, 0, 18, HORIZONTE + 6);
      g.fillStyle(0x4a3d86, 1); g.fillRect(x - 9, 0, 3, HORIZONTE + 6);
      g.fillStyle(0xf2b84b, 1); g.fillRect(x - 5, 8, 10, 4);
    }
    for (const x of [100, 240, 380]) {
      g.fillStyle(0x5a4a9c, 1); g.fillRect(x - 15, 14, 30, 50);
      g.fillStyle(0xf2b84b, 1); g.fillPoints([{ x: x - 15, y: 64 }, { x: x, y: 74 }, { x: x + 15, y: 64 }], true);
      g.fillStyle(0xf2b84b, 1); g.fillCircle(x, 36, 8);
      g.fillStyle(0x3a2f6e, 1); g.fillCircle(x, 36, 5.4);
    }
    degrade(g, 0, HORIZONTE + 6, FUNDO_W, FUNDO_H - HORIZONTE - 6, 0x4a3d7c, 0x2a2150, 40);
    // ladrilhos em perspectiva
    for (let i = -12; i <= 12; i++) {
      g.lineStyle(1, 0x7a6cd0, 0.35);
      g.lineBetween(240 + i * 12, HORIZONTE + 6, 240 + i * 62, FUNDO_H);
    }
    for (let k = 1; k <= 6; k++) {
      const y = HORIZONTE + 6 + (FUNDO_H - HORIZONTE - 6) * (k / 6) ** 1.7;
      g.lineStyle(1, 0x7a6cd0, 0.35); g.lineBetween(0, y, FUNDO_W, y);
    }
    g.lineStyle(2, 0xf2b84b, 0.5); g.strokeEllipse(240, 196, 360, 66);
    g.lineStyle(1, 0xf2b84b, 0.35); g.strokeEllipse(240, 196, 300, 52);
  },
};

export const TERRENOS_BATALHA = ["grass", "water", "concrete", "ginasio"];

export function garantirFundo(cena, terreno) {
  const chave = `bt_fundo_${terreno}`;
  if (!cena.textures.exists(chave)) textura(cena, chave, FUNDO_W, FUNDO_H, (g) => FUNDOS[terreno](g), 3);
  return chave;
}

// Plataforma elipsoidal onde cada criatura pisa.
const PLATAFORMAS = {
  grass: { rim: 0x3c7f3e, topo: 0x8bd47a, aro: 0xa6e68c, sombra: 0x2c5c30 },
  water: { rim: 0x6c7a8e, topo: 0xaab7c8, aro: 0xd2dce8, sombra: 0x3a4658 },
  concrete: { rim: 0x555c66, topo: 0xa9b1bb, aro: 0xf2f4f8, sombra: 0x2e333b },
  ginasio: { rim: 0x2a2150, topo: 0x5a4a9c, aro: 0xf2b84b, sombra: 0x1a1432 },
};

export const PLAT_W = 150;
export const PLAT_H = 40;

export function garantirPlataforma(cena, terreno) {
  const chave = `bt_plat_${terreno}`;
  if (cena.textures.exists(chave)) return chave;
  const c = PLATAFORMAS[terreno];
  textura(cena, chave, PLAT_W, PLAT_H, (g) => {
    g.fillStyle(0x000000, 0.18); g.fillEllipse(PLAT_W / 2, PLAT_H / 2 + 6, PLAT_W - 6, PLAT_H - 6);
    g.fillStyle(c.sombra, 1); g.fillEllipse(PLAT_W / 2, PLAT_H / 2 + 3, PLAT_W - 8, PLAT_H - 10);
    g.fillStyle(c.rim, 1); g.fillEllipse(PLAT_W / 2, PLAT_H / 2, PLAT_W - 8, PLAT_H - 10);
    g.fillStyle(c.topo, 1); g.fillEllipse(PLAT_W / 2, PLAT_H / 2 - 2, PLAT_W - 14, PLAT_H - 16);
    g.lineStyle(1.4, c.aro, 0.9); g.strokeEllipse(PLAT_W / 2, PLAT_H / 2 - 2, PLAT_W - 34, PLAT_H - 24);
    g.fillStyle(0xffffff, 0.14); g.fillEllipse(PLAT_W / 2 - 12, PLAT_H / 2 - 7, PLAT_W - 70, 8);
  });
  return chave;
}
