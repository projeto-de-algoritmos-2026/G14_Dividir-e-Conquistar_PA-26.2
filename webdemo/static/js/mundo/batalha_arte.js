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
  Chamandrel: 0.95, Charzardo: 1.12, Squirtuga: 0.95, Geobruto: 1.0, Onixo: 1.1, Sonolax: 1.08, Miaupsi: 0.9,
};

export const ESPECIES = ["Chamandrel", "Charzardo", "Squirtuga", "Geobruto", "Onixo", "Sonolax", "Miaupsi"];

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
// Sete criaturas ORIGINAIS: silhuetas, cores e tracos proprios, uma por "ideia"
// do jogo (tartaruga d'agua, urso dorminhoco, salamandra de fogo, dragao de
// fogo, pedra com bracos, serpente de pedra, felino psiquico). Nenhuma
// reproduz personagem de outra obra.

// Squirtuga: tartaruga d'agua de casco azul-marinho com ranhura, nadadeiras
// coral e um tubo de bolhas no casco.
function squirtuga(p, vista, q) {
  const P = 0x5fd0d6, PS = 0x36a3b4, CASCO = 0x274b94, CL = 0x4f7fd0, BORDA = 0xf2dc9a, N = 0xff8f7a, NS = 0xd9644f;
  const frente = vista === "frente";
  const bolha = (x, y) => p.e(x, y, 5.5, 5.5, 0xdff4ff, 0.75).brilho(x - 1, y - 1.2, 1.8, 1.2, 0.8);
  // nadadeiras de tras (pes)
  p.p([[11, 60], [8, 66], [20, 67], [24, 60]], N).p([[53, 60], [56, 66], [44, 67], [40, 60]], N);
  p.l([[11, 66], [13, 62]], NS, 0.9).l([[15, 67], [17, 62]], NS, 0.9);
  p.l([[53, 66], [51, 62]], NS, 0.9).l([[49, 67], [47, 62]], NS, 0.9);
  if (frente) {
    // tubo de bolhas no casco
    p.r(28.5, 6, 7, 10, 0xe8b24a, 2.4);
    p.e(32, 6.4, 9, 3.6, 0xf6cf74);
    bolha(q ? 36 : 30, q ? 1.5 : 3.6);
    // casco aparecendo atras da cabeca
    p.e(32, 36, 48, 40, CASCO);
    p.e(32, 31, 36, 28, CL, 0.5, false);
    for (const [x, y] of [[16, 36], [48, 36], [32, 14]]) p.l([[x, y], [32, 33]], 0x1c3470, 1);
    // plastrao creme
    p.e(32, 50, 28, 22, BORDA);
    for (const y of [46, 51, 56]) p.l([[22, y], [42, y]], 0xc8b070, 0.9);
    p.l([[32, 42], [32, 60]], 0xc8b070, 0.9);
    // nadadeiras da frente
    p.p([[17, 38], [5, 50], [8, 58], [21, 49]], N).p([[47, 38], [59, 50], [56, 58], [43, 49]], N);
    p.l([[6, 54], [11, 50]], NS, 0.9).l([[58, 54], [53, 50]], NS, 0.9);
    // cabeca
    p.e(16.5, 27, 6, 11, PS).e(47.5, 27, 6, 11, PS); // nadadeiras de orelha
    p.e(32, 27, 30, 25, P);
    p.e(32, 33, 18, 12, 0xa8ece8, 1, false);
    p.e(24.5, 25, 9, 10, BRANCO).e(39.5, 25, 9, 10, BRANCO);
    p.e(25, 26, 5, 7, 0x16202e, 1, false).e(39, 26, 5, 7, 0x16202e, 1, false);
    p.e(26, 23.8, 2, 2.6, BRANCO, 1, false).e(40, 23.8, 2, 2.6, BRANCO, 1, false);
    p.l([[19.5, 19.5], [27, 21]], TINTA, 1.2).l([[44.5, 19.5], [37, 21]], TINTA, 1.2);
    p.e(30.4, 32, 1.2, 1.2, TINTA, 1, false).e(33.6, 32, 1.2, 1.2, TINTA, 1, false);
    p.e(19, 31, 4.6, 3, 0xff9fb0, 0.6, false).e(45, 31, 4.6, 3, 0xff9fb0, 0.6, false);
    if (q) p.e(32, 35.6, 8, 4, 0x6a2535).e(32, 36.6, 4, 1.8, 0xe96a7a, 1, false);
    else p.l([[27, 34.4], [29.6, 36.4], [34.4, 36.4], [37, 34.4]], TINTA, 1.2);
    p.brilho(24, 17, 10, 4.4);
  } else {
    p.e(32, 19, 18, 12, P); // nuca aparecendo
    p.e(32, 40, 50, 42, BORDA);
    p.e(32, 39, 46, 38, CASCO);
    p.e(32, 33, 34, 24, CL, 0.35, false);
    // aneis do casco, em ondas
    for (const [rx, ry] of [[10, 6], [18, 12], [26, 18]]) {
      p.l([[32 - rx, 40], [32 - rx * 0.6, 40 - ry], [32, 40 - ry - 2], [32 + rx * 0.6, 40 - ry], [32 + rx, 40]], 0x1c3470, 1);
    }
    p.l([[32, 18], [32, 58]], 0x1c3470, 1);
    // tubo de bolhas
    p.r(28.5, 8, 7, 12, 0xe8b24a, 2.4);
    p.e(32, 8.4, 9, 3.6, 0xf6cf74);
    bolha(q ? 36 : 30, q ? 2.5 : 5);
    p.p([[27, 62], [32, 68], [37, 62]], N); // cauda-nadadeira
    p.brilho(24, 28, 10, 5, 0.22);
  }
}

// Sonolax: urso-ameixa dorminhoco, de gorro de dormir listrado.
function sonolax(p, vista, q) {
  const F = 0x8e70b8, FS = 0x6f5496, FL = 0xb99ddc, CR = 0xf6ead2, GA = 0x3b82c4, GL = 0xdcebfa;
  const frente = vista === "frente";
  const resp = q ? 0.9 : 0;
  // pes
  p.e(19, 60, 17, 9, FS).e(45, 60, 17, 9, FS);
  if (frente) {
    p.e(19, 61, 9, 5, CR, 1, false).e(45, 61, 9, 5, CR, 1, false);
    for (const x of [15, 19, 23, 41, 45, 49]) p.e(x, 57.4, 2.2, 2.2, CR, 1, false);
  }
  // corpo
  p.e(32, 42, 48 + resp, 40 + resp, F);
  if (frente) {
    p.e(32, 46, 32 + resp, 28 + resp, CR);
    // estrelinhas na barriga
    for (const [x, y, s] of [[26, 44, 1], [38, 49, 0.8], [30, 53, 0.7]]) {
      p.p([[x, y - 3 * s], [x + 1 * s, y - 1 * s], [x + 3 * s, y], [x + 1 * s, y + 1 * s], [x, y + 3 * s], [x - 1 * s, y + 1 * s], [x - 3 * s, y], [x - 1 * s, y - 1 * s]], 0xe8c9ff, 1, false);
    }
    // bracos cruzados na barriga
    p.e(20, 49, 15, 9, F).e(44, 49, 15, 9, F);
    p.e(24, 50, 6, 4, FL, 0.7, false).e(40, 50, 6, 4, FL, 0.7, false);
  } else {
    p.sombra(32, 46, 36, 26, FS, 0.3);
    p.e(10, 46, 10, 20, F).e(54, 46, 10, 20, F);
    p.e(32, 62 - 3, 11, 7, CR);
  }
  // orelhas
  p.e(14.5, 11, 11, 11, F).e(49.5, 11, 11, 11, F);
  p.e(14.5, 11.5, 5.6, 5.6, 0xd9a0c0, 1, false).e(49.5, 11.5, 5.6, 5.6, 0xd9a0c0, 1, false);
  // cabeca
  p.e(32, 22, 38, 28, F);
  if (frente) {
    p.e(32, 27, 18, 12, CR);
    p.e(32, 24, 4.4, 3.2, 0x3a2848, 1, false).brilho(31, 23.2, 1.6, 1, 0.7);
    // olhos fechados e sobrancelhas
    p.l([[19.5, 19], [23, 21], [27, 19]], TINTA, 1.6).l([[37, 19], [41, 21], [44.5, 19]], TINTA, 1.6);
    p.e(17.5, 25, 5, 3.2, 0xf09bb0, 0.55, false).e(46.5, 25, 5, 3.2, 0xf09bb0, 0.55, false);
    if (q) p.e(32, 30, 5.6, 4.4, 0x6a2535).e(32, 31, 3, 1.8, 0xe96a7a, 1, false);
    else p.l([[29, 28.8], [32, 30.4], [35, 28.8]], TINTA, 1.1);
  } else {
    p.sombra(32, 24, 28, 14, FS, 0.3);
  }
  // gorro de dormir (cai pro lado) com pompom
  p.p([[15, 14.5], [18, 5], [28, 0], [39, 1], [48, 6], [57, 13], [62, 21], [56, 21], [49, 17], [43, 14]], GA);
  p.l([[22, 6], [20, 14]], GL, 1.6).l([[31, 2], [29, 12]], GL, 1.6).l([[40, 3], [39, 13]], GL, 1.6).l([[50, 8], [49, 17]], GL, 1.6);
  p.r(14, 12.4, 32, 5, GL, 2.4);
  p.e(61.5 + (q ? 0.8 : 0), 23.4, 7.6, 7.6, BRANCO);
  // zzz
  if (frente) {
    const z = (x, y, s) => p.l([[x, y], [x + 4 * s, y], [x, y + 4 * s], [x + 4 * s, y + 4 * s]], 0x7a6cd0, 1.3);
    z(q ? 52 : 50, q ? 4 : 8, q ? 1 : 0.7);
    if (q) z(58, -2, 0.6);
  }
  p.brilho(24, 13, 10, 4.6, 0.22);
}

// Chamandrel: salamandra de fogo, de corpo comprido, brasas no dorso e
// brânquias em chamas.
function chamandrel(p, vista, q) {
  const C = 0xc2432b, CS = 0x9a2f20, CR = 0xf7d9a0, MA = 0xffc15a, LA = 0xff8a2a;
  const frente = vista === "frente";
  const frill = (x, y, dx, dy, k) => {
    p.p([[x, y], [x + dx, y + dy - 3 * k], [x + dx * 0.55, y + dy * 0.2], [x + dx * 1.1, y + dy + 1.5 * k]], LA);
    p.p([[x + dx * 0.15, y + 0.5], [x + dx * 0.7, y + dy * 0.7 - 1.5 * k], [x + dx * 0.4, y + dy * 0.5]], 0xffd25a, 1, false);
  };
  // cauda grossa terminando em chama
  p.massa([[44, 58, 14, 7], [52, 55.5, 12, 6.4], [58, 51, 10, 6], [61, 45, 8, 6]], C);
  p.chama(61.5, 38, 0.85, q);
  // patas de tras
  p.e(11, 59, 13, 7, CS).e(53, 59, 13, 7, CS);
  for (const x of [5.6, 8.8, 12, 48, 51.2, 54.4]) p.e(x, 62.6, 2.2, 2.2, CR, 1, false);
  if (frente) {
    // chamas do dorso, atras da cabeca
    p.chama(21, 33, 0.7, q);
    p.chama(43, 33, 0.7, !q);
    p.chama(32, 29, 0.82, q);
    // corpo
    p.e(32, 46, 42, 24, C);
    for (const [x, y, w] of [[18, 42, 4], [46, 43, 4.4], [24, 50, 3.4], [41, 51, 3.8]]) p.e(x, y, w, w * 0.8, MA, 1, false);
    p.e(32, 54, 22, 10, CR);
    p.l([[24, 53], [40, 53]], 0xd2b072, 0.8).l([[26, 56.4], [38, 56.4]], 0xd2b072, 0.8);
    // patas da frente abertas
    p.e(11, 52, 13, 8, C).e(53, 52, 13, 8, C);
    for (const x of [5.4, 8.6, 11.8, 52.2, 55.4, 58.6]) p.e(x, 56.6, 2.2, 2.2, CR, 1, false);
    // brânquias em chama
    for (const k of [0, 1, 2]) {
      frill(17.5, 33 + k * 4.4, -9 - k * 0.6, -4 + k * 4, 1);
      frill(46.5, 33 + k * 4.4, 9 + k * 0.6, -4 + k * 4, 1);
    }
    // cabeca larga e baixa
    p.e(32, 37, 31, 22, C);
    p.e(32, 42, 22, 11, 0xe56a45, 1, false);
    p.e(23, 32, 9.4, 9.4, MA).e(41, 32, 9.4, 9.4, MA);
    p.e(23.4, 32.4, 3.4, 7, 0x16202e, 1, false).e(40.6, 32.4, 3.4, 7, 0x16202e, 1, false);
    p.e(24.4, 29.8, 1.6, 2, BRANCO, 1, false).e(41.6, 29.8, 1.6, 2, BRANCO, 1, false);
    p.l([[17.5, 27], [26, 29.6]], TINTA, 1.4).l([[46.5, 27], [38, 29.6]], TINTA, 1.4);
    p.e(30, 39, 1.2, 1.2, TINTA, 1, false).e(34, 39, 1.2, 1.2, TINTA, 1, false);
    if (q) p.e(32, 44, 10, 4.6, 0x6a2020).p([[28, 42.4], [29.4, 44.6], [30.8, 42.4]], BRANCO, 1, false);
    else p.l([[24, 43], [28, 45.4], [36, 45.4], [40, 43]], TINTA, 1.2);
    p.brilho(25, 28, 10, 4.2, 0.3);
  } else {
    // costas: cauda pra frente da camera, crista de chamas no meio
    p.e(32, 44, 40, 28, C);
    p.e(32, 44, 9, 28, CS, 0.7, false);
    for (const [x, y, w] of [[19, 40, 4.4], [46, 41, 4], [22, 50, 3.6], [43, 51, 4], [32, 56, 4]]) p.e(x, y, w, w * 0.8, MA, 1, false);
    p.e(11, 50, 13, 8, C).e(53, 50, 13, 8, C);
    for (const [x, y] of [[32, 55], [32, 46], [32, 38], [32, 30]]) {
      p.chama(x + (y % 2 ? 1 : -1) * (q ? 1.6 : 0), y, 0.55 + (55 - y) / 120, q);
    }
    p.e(32, 22, 22, 16, C);
    for (const k of [0, 1, 2]) {
      frill(21.5, 19 + k * 3.6, -8 - k * 0.6, -4 + k * 3.6, 0.9);
      frill(42.5, 19 + k * 3.6, 8 + k * 0.6, -4 + k * 3.6, 0.9);
    }
    p.sombra(32, 24, 16, 6, CS, 0.4);
    p.brilho(26, 17, 8, 3.6, 0.3);
  }
}

// Charzardo: dragao oriental, sem asas, de escamas de carvao rachadas por brasas
// e uma juba de fogo.
function charzardo(p, vista, q) {
  const D = 0x3a3340, DS = 0x262029, DL = 0x5a5062, OURO = 0xf2b04a, BR = 0xff6b2a, OSSO = 0xe8dcc0;
  const frente = vista === "frente";
  const o = q ? 1.2 : -1.2; // o corpo ondula
  const rachaduras = (x, y) => p.l([[x - 3, y - 2], [x, y], [x + 1.4, y + 3], [x + 4, y + 4.6]], BR, 1.1);
  // anel de base
  p.massa([[34, 60, 44, 11], [47, 54.5, 26, 10]], D);
  p.massa([[22 + o * 0.4, 47, 28, 10], [30 + o * 0.6, 40, 22, 10], [36 + o * 0.5, 31.5, 18, 9.4]], D);
  // placas da barriga
  if (frente) {
    for (const [x, y, w, h] of [[34, 62, 28, 5], [47, 55.6, 15, 4.6], [24 + o * 0.4, 48.6, 16, 4.4], [31 + o * 0.6, 41.6, 12, 4.2], [36 + o * 0.5, 33.4, 10, 3.8]]) {
      p.e(x, y, w, h, OURO, 1, false);
    }
  } else {
    // crista de espinhos de fogo ao longo do dorso
    for (const [x, y, k] of [[40, 57, 1], [53, 52, 0.9], [26 + o * 0.4, 44, 0.9], [34 + o * 0.6, 37, 0.8], [39 + o * 0.5, 28.5, 0.7]]) {
      p.p([[x - 3 * k, y], [x, y - 8 * k + (q ? -1 : 1)], [x + 3 * k, y]], BR);
    }
  }
  rachaduras(20, 61); rachaduras(54, 55); rachaduras(21 + o * 0.4, 46); rachaduras(34 + o * 0.6, 38);
  // ponta da cauda
  p.chama(60, 61, 0.7, q);
  // bracinhos
  if (frente) {
    p.e(18 + o * 0.5, 37, 7, 9, D).e(52, 38, 7, 9, D);
    for (const [x, y] of [[16, 41.6], [18.4, 42.4], [20.6, 41.6], [50, 42.6], [52.4, 43.4], [54.6, 42.6]]) p.e(x, y, 1.6, 2.6, OSSO, 1, false);
  }
  // juba de fogo atras da cabeca
  const hx = 33 + o * 0.5;
  p.chama(hx - 15, 19, 0.95, q);
  p.chama(hx + 15, 19, 0.95, !q);
  p.chama(hx, 11, 0.95, q);
  // chifres
  p.p([[hx - 8, 14], [hx - 15, 4], [hx - 12, 14.6]], OSSO).p([[hx + 8, 14], [hx + 15, 4], [hx + 12, 14.6]], OSSO);
  // cabeca
  p.e(hx, 19, 22, 19, D);
  p.e(hx, 24, 16, 11, DL);
  p.brilho(hx - 4, 12, 9, 3.6, 0.2);
  if (frente) {
    p.e(hx - 6.4, 17.4, 6.4, 5, 0xffb020).e(hx + 6.4, 17.4, 6.4, 5, 0xffb020);
    p.e(hx - 6.2, 17.4, 1.6, 4.4, TINTA, 1, false).e(hx + 6.2, 17.4, 1.6, 4.4, TINTA, 1, false);
    p.l([[hx - 11, 13.4], [hx - 3, 15.6]], TINTA, 1.5).l([[hx + 11, 13.4], [hx + 3, 15.6]], TINTA, 1.5);
    p.e(hx - 2, 23.4, 1.6, 1.3, BR, 1, false).e(hx + 2, 23.4, 1.6, 1.3, BR, 1, false);
    // bigodes de brasa
    p.l([[hx - 6, 26], [hx - 14, 29], [hx - 21, 27.4]], BR, 1.1).l([[hx + 6, 26], [hx + 14, 29], [hx + 21, 27.4]], BR, 1.1);
    if (q) p.e(hx, 28, 8, 4, 0x6a2020).p([[hx - 2.4, 26.4], [hx - 1, 28.6], [hx + 0.4, 26.4]], BRANCO, 1, false).p([[hx + 1.4, 26.4], [hx + 2.8, 28.6], [hx + 4.2, 26.4]], BRANCO, 1, false);
    else p.l([[hx - 5, 27.6], [hx, 29], [hx + 5, 27.6]], TINTA, 1.1);
    p.chama(hx, 33, 0.5, q); // barba de fogo
  } else {
    p.sombra(hx, 22, 18, 9, DS, 0.4);
    rachaduras(hx + 3, 17);
  }
}

// Geobruto: golem de arenito empilhado, de olho unico, punhos de pedra e um
// cristal ambar na cabeca.
function geobruto(p, vista, q) {
  const G = 0xb59a72, GS = 0x84694a, GL = 0xd5bd92, MU = 0x6f9a52, AM = 0xff9a2e, AL = 0xffd27a;
  const frente = vista === "frente";
  const b = q ? 1.8 : 0; // os punhos sobem e descem
  // braços atras do tronco
  p.massa([[11, 38 - b * 0.4, 9, 13]], G);
  p.massa([[53, 38 - b * 0.4, 9, 13]], G);
  // tronco: bloco angular
  p.p([[12, 44], [15, 31], [26, 27], [38, 27], [49, 31], [52, 44], [48, 57], [37, 62], [26, 62], [16, 57]], G);
  p.p([[15, 31], [26, 27], [31, 28], [22, 38], [18, 46]], GL, 0.55, false);
  p.p([[52, 44], [48, 57], [37, 62], [41, 52]], GS, 0.5, false);
  p.l([[22, 62], [24, 54], [21, 48]], GS, 1).l([[40, 31], [38, 38], [43, 43]], GS, 1);
  p.e(44, 33, 8, 4, MU, 0.9, false).e(20, 56, 6, 3, MU, 0.8, false);
  // cabeca de pedra
  p.p([[22, 28], [22, 15], [28, 9], [37, 9], [43, 15], [42, 28]], G);
  p.p([[22, 15], [28, 9], [33, 10], [26, 20], [24, 27]], GL, 0.5, false);
  // cristais
  p.p([[29, 11], [31, 0], [35, 11]], AM).p([[35, 11], [39.5, 3.6], [40, 12]], 0xe0801a);
  p.p([[30.4, 9], [31.4, 3], [33, 9]], AL, 0.9, false);
  if (frente) {
    // olho unico
    p.e(32, 20, 14, 10, BRANCO);
    p.e(32, 20.4, 7.6, 7.6, AM);
    p.e(32, 20.4, 3, 6.4, 0x2a1a0a, 1, false);
    p.e(30.6, 17.8, 2, 2.4, BRANCO, 1, false);
    p.p([[22.4, 15.4], [32, 12.2], [41.6, 15.4], [41.6, 17.2], [32, 14.4], [22.4, 17.2]], GS);
    // boca em zigue-zague
    p.l([[22, 34], [26, 37], [30, 34], [34, 37], [38, 34], [42, 37]], TINTA, 1.4);
    p.l([[27, 37.4], [27, 39.6]], BRANCO, 1).l([[37, 37.4], [37, 39.6]], BRANCO, 1);
    if (q) p.e(32, 40, 9, 2, 0x4a3320, 1, false);
  } else {
    // costas: cristais brotando
    p.p([[24, 40], [20, 28], [29, 36]], AM).p([[34, 38], [38, 24], [44, 38]], 0xe0801a).p([[30, 46], [34, 34], [38, 46]], AM);
    p.p([[34.6, 36], [38, 28], [40, 36]], AL, 0.8, false);
    p.l([[26, 18], [30, 24], [27, 29]], GS, 1.1);
  }
  // punhos
  p.e(8, 49 - b, 15, 15, G).e(56, 49 - b, 15, 15, G);
  p.p([[3, 44 - b], [8, 40 - b], [11, 46 - b]], GL, 0.6, false);
  for (const x of [4.6, 8, 11.4]) p.l([[x, 50 - b], [x, 55 - b]], GS, 0.9);
  for (const x of [52.6, 56, 59.4]) p.l([[x, 50 - b], [x, 55 - b]], GS, 0.9);
  p.brilho(24, 22, 9, 4, 0.18);
}

// Onixo: serpente de pedra azul-ardosia, enrolada, de capuz e runas ambar.
function onixo(p, vista, q) {
  const S = 0x5b6b8e, SL = 0x8696b8, SD = 0x3d4966, RU = 0xffc857;
  const frente = vista === "frente";
  const s = q ? 1.5 : -1.5; // o pescoco balanca
  const anel = (x, y, w, h) => {
    p.e(x, y, w, h, S);
    p.brilho(x - w * 0.18, y - h * 0.22, w * 0.46, h * 0.26, 0.22);
    p.l([[x - w * 0.34, y + h * 0.1], [x - w * 0.34, y + h * 0.38]], SD, 0.9).l([[x + w * 0.34, y - h * 0.1], [x + w * 0.34, y + h * 0.3]], SD, 0.9);
    p.l([[x - 1.6, y + h * 0.05], [x, y + h * 0.3], [x + 1.6, y + h * 0.05]], RU, 1.1);
  };
  // aneis da base enrolada ao pescoco
  anel(34, 60, 54, 14);
  anel(39, 52, 40, 12);
  anel(27 + s * 0.2, 45, 34, 11);
  anel(31 + s * 0.5, 38.4, 24, 9.6);
  anel(32 + s * 0.8, 32, 18, 8);
  const hx = 32 + s * 1.2;
  // capuz
  p.p([[hx - 19, 12], [hx - 13, 3], [hx - 4, 0], [hx + 4, 0], [hx + 13, 3], [hx + 19, 12], [hx + 13, 26], [hx + 6, 31], [hx - 6, 31], [hx - 13, 26]], S);
  p.p([[hx - 13, 3], [hx - 4, 0], [hx - 3, 8], [hx - 12, 14]], SL, 0.55, false);
  if (frente) {
    p.p([[hx - 12, 12], [hx, 4], [hx + 12, 12], [hx + 7, 24], [hx - 7, 24]], SL, 0.35, false);
    // marca de runa no capuz
    p.p([[hx, 5.4], [hx + 3.4, 9], [hx, 12.6], [hx - 3.4, 9]], RU);
    p.l([[hx, 12.6], [hx, 17]], RU, 1.2);
    // cabeca
    p.e(hx, 22, 17, 12, S);
    p.e(hx - 5.2, 20, 5.6, 4.2, RU).e(hx + 5.2, 20, 5.6, 4.2, RU);
    p.e(hx - 5.2, 20, 1.4, 3.6, TINTA, 1, false).e(hx + 5.2, 20, 1.4, 3.6, TINTA, 1, false);
    p.l([[hx - 9.4, 16.4], [hx - 2, 18]], TINTA, 1.4).l([[hx + 9.4, 16.4], [hx + 2, 18]], TINTA, 1.4);
    p.p([[hx - 4, 25.4], [hx - 2.6, 29.6], [hx - 1.2, 25.4]], BRANCO, 1, false).p([[hx + 1.2, 25.4], [hx + 2.6, 29.6], [hx + 4, 25.4]], BRANCO, 1, false);
    p.l([[hx - 4.6, 25], [hx + 4.6, 25]], TINTA, 1);
    if (q) p.l([[hx, 26], [hx, 31], [hx - 1.6, 33.4]], 0xd0556a, 1.1).l([[hx, 31], [hx + 1.6, 33.4]], 0xd0556a, 1.1);
  } else {
    // costas do capuz: losango de runas grande
    p.p([[hx, 6], [hx + 7, 15], [hx, 24], [hx - 7, 15]], SD);
    p.p([[hx, 9], [hx + 4, 15], [hx, 21], [hx - 4, 15]], RU, q ? 1 : 0.8);
    p.l([[hx - 14, 14], [hx - 9, 18]], SD, 1).l([[hx + 14, 14], [hx + 9, 18]], SD, 1);
  }
  p.e(8, 66, 3, 2, SL, 0.9, false).e(62, 63, 3.4, 2.2, SL, 0.9, false);
}

// Miaupsi: gato-lince violeta que flutua, com uma gema na testa e duas
// caudas terminadas em orbes.
function miaupsi(p, vista, q) {
  const V = 0x7c63c9, VS = 0x5e49a8, CR = 0xf2ebff, OR = 0xc9a5ff, CI = 0x45e6d8, OU = 0xffd447;
  const frente = vista === "frente";
  const o = q ? 1.6 : -1.6;
  // brilho em volta (o resto da aura e animado na cena)
  p.e(32, 40, 58, 58, 0xc9a5ff, 0.12, false);
  const orbe = (x, y) => {
    p.e(x, y, 11, 11, CI, 0.28, false);
    p.e(x, y, 7, 7, CI);
    p.brilho(x - 1.2, y - 1.4, 3, 2, 0.8);
  };
  // caudas gemeas
  p.massa([[22, 53, 7, 5.4], [15, 50, 7, 5.4], [11, 44, 6.4, 5.4], [11 + o * 0.3, 38, 5.6, 5.4]], V);
  orbe(11.4 + o * 0.5, 30.4);
  p.massa([[42, 53, 7, 5.4], [49, 51, 7, 5.4], [53.5, 46, 6.4, 5.4], [54 - o * 0.3, 40, 5.6, 5.4]], V);
  orbe(54 - o * 0.5, 32.6);
  // patas
  p.e(25, 59, 9, 8, V).e(39, 59, 9, 8, V);
  if (frente) p.e(25, 61.6, 6, 3.6, CR, 1, false).e(39, 61.6, 6, 3.6, CR, 1, false);
  // corpo esguio
  p.e(32, 46, 22, 26, V);
  if (frente) {
    p.e(32, 49, 12, 17, CR, 1, false);
    // lua crescente no peito
    p.e(32, 46, 6.4, 6.4, VS, 1, false);
    p.e(33.6, 45.4, 5.4, 5.8, CR, 1, false);
  } else {
    p.sombra(32, 47, 7, 20, VS, 0.45);
  }
  // orelhas de lince com tufo
  p.p([[18, 19], [13, -1], [28, 11]], V).p([[46, 19], [51, -1], [36, 11]], V);
  p.p([[19.6, 16], [16.4, 4.4], [25, 11]], OR, 1, false).p([[44.4, 16], [47.6, 4.4], [39, 11]], OR, 1, false);
  p.l([[13, -1], [11.6, -3.4]], TINTA, 1.2).l([[51, -1], [52.4, -3.4]], TINTA, 1.2);
  // cabeca com bochechas de lince
  p.p([[19, 29], [9, 31], [18, 34]], V).p([[45, 29], [55, 31], [46, 34]], V);
  p.e(32, 25, 29, 22, V);
  if (frente) {
    p.e(32, 29, 17, 11, CR, 1, false);
    // gema na testa
    p.p([[32, 12.4], [35, 16.6], [32, 20.8], [29, 16.6]], CI);
    p.brilho(31, 14.8, 1.8, 2.2, 0.9);
    // olhos amendoados dourados
    p.e(25, 24.4, 8.4, 6.8, OU).e(39, 24.4, 8.4, 6.8, OU);
    p.e(25, 24.6, 2.2, 6, TINTA, 1, false).e(39, 24.6, 2.2, 6, TINTA, 1, false);
    p.e(26.4, 22.4, 1.6, 1.8, BRANCO, 1, false).e(40.4, 22.4, 1.6, 1.8, BRANCO, 1, false);
    p.l([[19.6, 21.4], [27.4, 22.6]], TINTA, 1.3).l([[44.4, 21.4], [36.6, 22.6]], TINTA, 1.3);
    p.p([[30.6, 28.6], [33.4, 28.6], [32, 30.4]], 0xf08aa8, 1, false);
    if (q) p.l([[32, 30.4], [32, 32.4]], TINTA, 1).l([[28.6, 33.4], [32, 32.4], [35.4, 33.4]], TINTA, 1);
    else p.l([[29, 31.4], [32, 32.6], [35, 31.4]], TINTA, 1);
    for (const y of [28.6, 30.8]) { p.l([[22, y], [12, y - 1.6]], TINTA, 0.7, 0.8); p.l([[42, y], [52, y - 1.6]], TINTA, 0.7, 0.8); }
  } else {
    p.sombra(32, 27, 20, 10, VS, 0.4);
  }
  p.brilho(25, 17, 10, 4.4, 0.3);
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

const DESENHOS = { Chamandrel: chamandrel, Charzardo: charzardo, Squirtuga: squirtuga, Geobruto: geobruto, Onixo: onixo, Sonolax: sonolax, Miaupsi: miaupsi };

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
