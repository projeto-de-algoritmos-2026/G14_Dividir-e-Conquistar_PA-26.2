// Constantes do mundo 2.5D. Geometria da projecao e paleta propria.
//
// Visao OBLIQUA 3/4 (estilo RPG de mao classico): o grid fica reto na tela,
// linhas horizontais e colunas verticais. Cada celula (r, c) e um bloco com
// face de topo (TW x TH) e face frontal (a altura do terreno). As setas seguem
// o grid sem rotacao: cima = linha -1, direita = coluna +1, baixo = linha +1,
// esquerda = coluna -1 (igual game.DIRECOES, ver DIRECOES e TECLAS).

export const TW = 48; // largura de uma celula
export const TH = 30; // altura da face de topo da celula
export const FOLGA = 14; // espaco acima da face de topo no desenho do tile (cobre a maior altura)

// Resolucao das texturas geradas: tudo e desenhado em ESC vezes o tamanho do
// mundo e exibido com setScale(1/ESC). Assim o canvas HiDPI (que amplia a
// camera) amostra uma textura com pixels de sobra e a borda nao borra.
export const ESC = 4;

// Altura do bloco por terreno, em pixels. Agua afunda, grama e o nivel mais alto.
export const ALTURA = { water: 6, concrete: 10, grass: 14 };

// Tipo reservado: a API ainda nao gera ginasio. Quando gerar, vai chegar como
// conteudo "ginasio" e a cena ja sabe desenhar (ver cena.js, tipoDoConteudo).
export const CONTEUDO_GINASIO = "ginasio";

// Paleta propria ("Costa Jade"): nada aqui vem de arte de terceiros.
export const COR = {
  grass: { topo: 0x5fae5a, frente: 0x35703d, borda: 0x4a9a4c, detalhe: 0x86d377, sombra: 0x47974b },
  concrete: { topo: 0x9aa3ad, frente: 0x626b75, borda: 0x818a94, detalhe: 0xb9c1ca, sombra: 0x858e98 },
  water: { topo: 0x3f8fd6, frente: 0x255d98, borda: 0x3079bd, detalhe: 0xb1dcf8, sombra: 0x3580c4 },
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

export const TEMPO_PASSO = 180; // ms de animacao de um passo
// Zoom em multiplos do "enquadra o mapa inteiro" (cena.js, calcularZoomBase).
export const ZOOM_MIN_REL = 0.7;
export const ZOOM_MAX_REL = 4;
export const MARGEM_MAPA = 56; // folga em volta do mapa no enquadramento, em px de CSS

// Chao da celula (r, c): canto inferior esquerdo da face frontal, onde o
// tile ancora (origem 0, 1).
export function projetar(r, c) {
  return { x: c * TW, y: (r + 1) * TH };
}

// Ponto onde algo "pisa" na celula (pouco abaixo do centro da face de topo).
export function topoDe(r, c, altura) {
  return { x: c * TW + TW / 2, y: (r + 1) * TH - altura - TH * 0.3 };
}

// Profundidade: quem esta numa linha maior (mais perto da camera) desenha por cima.
export function profundidade(r) {
  return r;
}
