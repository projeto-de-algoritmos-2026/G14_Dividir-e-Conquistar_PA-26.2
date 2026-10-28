// Constantes do mundo 2.5D. Geometria da projecao e paleta propria.
//
// Projecao isometrica "2:1": a celula (r, c) do grid da API vira um losango de
// TW x TH. Os eixos do grid giram 45 graus na tela, entao as setas seguem as
// DIAGONAIS da tela (cima = W, direita = D, baixo = S, esquerda = A, ver TECLAS).

export const TW = 64; // largura do losango de uma celula
export const TH = 32; // altura do losango
export const FOLGA = 16; // espaco acima do losango no desenho do tile (cobre a maior altura)

// Altura do bloco por terreno, em pixels. Agua afunda, grama e o nivel mais alto.
export const ALTURA = { water: 6, concrete: 10, grass: 14 };

// Tipo reservado: a API ainda nao gera ginasio. Quando gerar, vai chegar como
// conteudo "ginasio" e a cena ja sabe desenhar (ver cena.js, tipoDoConteudo).
export const CONTEUDO_GINASIO = "ginasio";

// Paleta propria ("Costa Jade"): nada aqui vem de arte de terceiros.
export const COR = {
  grass: { topo: 0x5fae5a, esq: 0x3f7f45, dir: 0x34693b, detalhe: 0x82cf72, sombra: 0x45934a },
  concrete: { topo: 0x9aa3ad, esq: 0x6f7882, dir: 0x5c646e, detalhe: 0xb7bfc8, sombra: 0x848d97 },
  water: { topo: 0x3f8fd6, esq: 0x2a68a8, dir: 0x23578f, detalhe: 0xa9d8f7, sombra: 0x3580c4 },
  jade: 0x12b7a3,
  jadeEscuro: 0x0b8577,
  ambar: 0xf2b84b,
  tinta: 0x0b0f14,
  papel: 0xeef3f6,
};

// Tecla -> direcao que a API entende (W, A, S, D) e deslocamento (linha, coluna),
// o mesmo de game.DIRECOES. O deslocamento so serve pra animar e pra pre-checar;
// quem decide se o passo vale e sempre o servidor.
export const DIRECOES = {
  W: [-1, 0],
  D: [0, 1],
  S: [1, 0],
  A: [0, -1],
};

export const TECLAS = {
  UP: "W", W: "W",
  RIGHT: "D", D: "D",
  DOWN: "S", S: "S",
  LEFT: "A", A: "A",
};

export const TEMPO_PASSO = 150; // ms de animacao de um passo
export const ZOOM_INICIAL = 1.8;
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 3.2;

// Projecao: posicao do vertice de BAIXO do losango do chao da celula (r, c).
export function projetar(r, c) {
  return { x: (c - r) * (TW / 2), y: (c + r) * (TH / 2) + TH };
}

// Centro da face de topo (onde algo "pisa") dada a altura do bloco.
export function topoDe(r, c, altura) {
  const p = projetar(r, c);
  return { x: p.x, y: p.y - TH / 2 - altura };
}

// Profundidade: quem esta mais perto da camera (r + c maior) desenha por cima.
export function profundidade(r, c) {
  return r + c;
}
