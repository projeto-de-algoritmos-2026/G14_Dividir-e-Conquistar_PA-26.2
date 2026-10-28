"""Ginasios, lideres e populacoes por regiao (trabalho 3, fase 1: so o modelo).

Ideia do trabalho: cada regiao do mapa tem uma populacao grande de pokemon
selvagens, cada um com um nivel. O lider do ginasio da regiao monta o time com
nivel igual ao k-esimo da populacao (mediana no primeiro ginasio, percentis
mais altos nos seguintes). Achar o k-esimo e selecao: a fase 2 usa a mediana
das medianas O(n) (dc/mediana_medianas.py); o oraculo abaixo (sorted) fica so
como gabarito dos testes.

Regiao: o mapa e dividido em blocos de regiao_lado x regiao_lado celulas, em
ordem de linha (os blocos da borda ficam menores quando size nao e multiplo).
Cada bloco e uma regiao e recebe no maximo UM ginasio, sorteado entre as celulas
LIVRE que nao sao agua nem a origem. Bloco sem celula assim fica sem ginasio.

A populacao e uma lista de ints (so o nivel), nao de objetos Pokemon: 10^6
objetos estourariam a memoria, 10^6 ints nao.
"""
import math
import random
from dataclasses import dataclass, field

from dc.mediana_medianas import selecionar as selecionar_mediana_medianas
from models import Pokemon

NIVEL_MIN = 1
NIVEL_MAX = 100
TAMANHO_TIME = 3

# Percentis do primeiro ao ultimo ginasio: 0.5 (mediana) no primeiro, subindo
# ate PERCENTIL_MAX no ultimo. Com um ginasio so, e a mediana.
PERCENTIL_MIN = 0.5
PERCENTIL_MAX = 0.9

# Progressao por distancia (etapa 4). O nivel da populacao de cada regiao cresce
# com a distancia do bloco ate a origem (0, 0): a regiao da origem tem niveis
# em NIVEIS_ORIGEM, a mais distante em NIVEIS_FUNDO, e as do meio ficam numa
# interpolacao linear dos dois extremos (a meio caminho: ~27 a ~65). A distancia
# e a euclidiana do canto mais proximo da origem do bloco, dividida pela maior
# entre os blocos (t em [0, 1]); com um bloco so, t = 0.
NIVEIS_ORIGEM = (5, 30)
NIVEIS_FUNDO = (50, 100)
# Expoente da assimetria: nivel = piso + (teto - piso) * u**ASSIMETRIA, u uniforme.
# Acima de 1 a populacao tem mais fracos que fortes (o k-esimo menor de um
# percentil p fica em p**ASSIMETRIA da faixa). Com 1.0 a populacao e uniforme.
ASSIMETRIA_POPULACAO = 1.6

_ESPECIES = [
    ("Chamandrel", "Fire", {"Bite": 20, "Fire-blast": 25}),
    ("Squirtuga", "Water", {"Hydropump": 35, "Bite": 20}),
    ("Geobruto", "Rock", {"Rock-throw": 20, "head-butt": 15}),
    ("Sonolax", "Normal", {"Body-slam": 20, "Slap": 15}),
    ("Miaupsi", "Psychic", {"Mind-beam": 20, "Psychic-slam": 25}),
]


def selecionar_oraculo(niveis, k):
    """k-esimo menor nivel (k a partir de 0), por ordenacao completa.

    ORACULO da fase 1, O(n log n). Nao e mais o default: serve de gabarito
    nos testes da selecao O(n) (dc.mediana_medianas.selecionar).
    """
    return sorted(niveis)[k]


def indice_do_percentil(n, percentil):
    """Indice k (a partir de 0) do percentil numa populacao de tamanho n.

    percentil 0.5 em n impar cai exatamente na mediana.
    """
    return min(n - 1, int(percentil * (n - 1)))


@dataclass
class Lider:
    nome: str
    regiao: int
    posicao: tuple[int, int]
    percentil: float
    k: int
    time: list[Pokemon] = field(default_factory=list)
    # Ponto de injecao: funcao (niveis, k) -> nivel. Default: mediana das medianas.
    selecionar: callable = selecionar_mediana_medianas

    def montar_time(self, niveis, rng, tamanho=TAMANHO_TIME):
        """Monta o time com nivel = k-esimo da populacao (uma selecao so)."""
        nivel = self.selecionar(niveis, self.k)
        self.time = []
        for i in range(tamanho):
            especie, tipo, golpes = rng.choice(_ESPECIES)
            self.time.append(Pokemon(
                name=f"{especie}-{self.nome}-{i + 1}",
                gender=rng.choice(["Male", "Female"]),
                type_of_pokemon=tipo,
                moves=dict(golpes),
                level=nivel,
            ))
        return self.time


@dataclass
class Regiao:
    indice: int
    linhas: tuple[int, int]    # [inicio, fim) em linhas do grid
    colunas: tuple[int, int]   # [inicio, fim) em colunas do grid
    populacao: list[int]       # nivel de cada pokemon selvagem
    lider: Lider | None = None


def gerar_populacao(rng, tamanho, nivel_min=NIVEL_MIN, nivel_max=NIVEL_MAX, assimetria=1.0):
    """Lista de `tamanho` niveis em [nivel_min, nivel_max].

    Com assimetria 1.0 e uniforme (o comportamento da fase 1). Acima de 1, os
    niveis baixos aparecem mais (ver ASSIMETRIA_POPULACAO). Sorteia sempre
    `tamanho` numeros do rng, entao trocar a assimetria nao muda o resto do mapa.
    """
    if tamanho < 1:
        raise ValueError("populacao precisa de ao menos 1 pokemon")
    if assimetria == 1.0:
        return rng.choices(range(nivel_min, nivel_max + 1), k=tamanho)
    largura = nivel_max - nivel_min + 1
    return [nivel_min + min(largura - 1, int(largura * rng.random() ** assimetria))
            for _ in range(tamanho)]


def faixa_de_niveis(t):
    """(piso, teto) dos niveis de uma regiao a distancia relativa t (0 a 1)."""
    piso = round(NIVEIS_ORIGEM[0] + (NIVEIS_FUNDO[0] - NIVEIS_ORIGEM[0]) * t)
    teto = round(NIVEIS_ORIGEM[1] + (NIVEIS_FUNDO[1] - NIVEIS_ORIGEM[1]) * t)
    return piso, teto


def _distancia_origem(l0, c0):
    """Distancia do canto do bloco mais proximo da origem (0, 0)."""
    return math.hypot(l0, c0)


def gerar_regioes(mapa, regiao_lado, populacao_tamanho,
                   selecionar=selecionar_mediana_medianas):
    """Divide o mapa em regioes, planta um G por regiao e monta os lideres.

    Chamada pelo Grid DEPOIS de gerar celulas e centros, consumindo so o rng
    do proprio Grid: determinismo por seed. Devolve a lista de Regiao.
    """
    if regiao_lado < 1:
        raise ValueError("regiao_lado deve ser positivo")
    # Import local: grid.py importa este modulo.
    import grid as grid_mod

    rng = mapa.rng
    blocos = math.ceil(mapa.size / regiao_lado)
    maior = _distancia_origem((blocos - 1) * regiao_lado, (blocos - 1) * regiao_lado)
    regioes = []
    distancias = {}
    for br in range(blocos):
        for bc in range(blocos):
            l0, l1 = br * regiao_lado, min(mapa.size, (br + 1) * regiao_lado)
            c0, c1 = bc * regiao_lado, min(mapa.size, (bc + 1) * regiao_lado)
            dist = _distancia_origem(l0, c0)
            t = dist / maior if maior else 0.0
            piso, teto = faixa_de_niveis(t)
            populacao = gerar_populacao(rng, populacao_tamanho, piso, teto, ASSIMETRIA_POPULACAO)
            regioes.append(Regiao(len(regioes), (l0, l1), (c0, c1), populacao))
            distancias[len(regioes) - 1] = dist

    # Um ginasio por regiao, na ordem das regioes.
    com_ginasio = []
    for reg in regioes:
        candidatas = [
            (r, c)
            for r in range(*reg.linhas)
            for c in range(*reg.colunas)
            if (r, c) != (0, 0)
            and mapa.grid[r][c].occupied_with == grid_mod.LIVRE
            and mapa.grid[r][c].terrain != grid_mod.AGUA
        ]
        if candidatas:
            pos = rng.choice(candidatas)
            mapa.grid[pos[0]][pos[1]].occupied_with = grid_mod.GINASIO
            com_ginasio.append((reg, pos))

    # Os percentis (e os nomes) sobem com a distancia da origem: o primeiro
    # lider e o da regiao mais perto, o ultimo o da mais funda. Empate de
    # distancia desempata pelo indice da regiao.
    com_ginasio.sort(key=lambda rp: (distancias[rp[0].indice], rp[0].indice))
    n = len(com_ginasio)
    for i, (reg, pos) in enumerate(com_ginasio):
        percentil = PERCENTIL_MIN if n == 1 else (
            PERCENTIL_MIN + (PERCENTIL_MAX - PERCENTIL_MIN) * i / (n - 1))
        k = indice_do_percentil(len(reg.populacao), percentil)
        lider = Lider(f"Lider{i + 1}", reg.indice, pos, percentil, k, selecionar=selecionar)
        lider.montar_time(reg.populacao, rng)
        reg.lider = lider
    return regioes
