"""Ginasios, lideres e populacoes por regiao (trabalho 3, fase 1: so o modelo).

Ideia do trabalho: cada regiao do mapa tem uma populacao grande de pokemon
selvagens, cada um com um nivel. O lider do ginasio da regiao monta o time com
nivel igual ao k-esimo da populacao (mediana no primeiro ginasio, percentis
mais altos nos seguintes). Achar o k-esimo e selecao; a fase 2 troca o
oraculo abaixo pela selecao O(n) (mediana das medianas).

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

from models import Pokemon

NIVEL_MIN = 1
NIVEL_MAX = 100
TAMANHO_TIME = 3

# Percentis do primeiro ao ultimo ginasio: 0.5 (mediana) no primeiro, subindo
# ate PERCENTIL_MAX no ultimo. Com um ginasio so, e a mediana.
PERCENTIL_MIN = 0.5
PERCENTIL_MAX = 0.9

_ESPECIES = [
    ("Charmander", "Fire", {"Bite": 20, "Fire-blast": 25}),
    ("Squirtle", "Water", {"Hydropump": 35, "Bite": 20}),
    ("Geodude", "Rock", {"Rock-throw": 20, "head-butt": 15}),
    ("Snorlax", "Normal", {"Body-slam": 20, "Slap": 15}),
    ("Mew", "Psychic", {"Mind-beam": 20, "Psychic-slam": 25}),
]


def selecionar_oraculo(niveis, k):
    """k-esimo menor nivel (k a partir de 0), por ordenacao completa.

    PROVISORIO: e o ORACULO da fase 1, O(n log n). Existe so pra fixar o
    contrato (niveis, k) -> nivel e servir de gabarito. A fase 2 injeta a
    selecao O(n) no lugar dele.
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
    # Ponto de injecao: funcao (niveis, k) -> nivel. Provisoria ate a fase 2.
    selecionar: callable = selecionar_oraculo

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


def gerar_populacao(rng, tamanho, nivel_min=NIVEL_MIN, nivel_max=NIVEL_MAX):
    """Lista de `tamanho` niveis uniformes em [nivel_min, nivel_max]."""
    if tamanho < 1:
        raise ValueError("populacao precisa de ao menos 1 pokemon")
    return rng.choices(range(nivel_min, nivel_max + 1), k=tamanho)


def gerar_regioes(mapa, regiao_lado, populacao_tamanho, selecionar=selecionar_oraculo):
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
    regioes = []
    for br in range(blocos):
        for bc in range(blocos):
            l0, l1 = br * regiao_lado, min(mapa.size, (br + 1) * regiao_lado)
            c0, c1 = bc * regiao_lado, min(mapa.size, (bc + 1) * regiao_lado)
            populacao = gerar_populacao(rng, populacao_tamanho)
            regioes.append(Regiao(len(regioes), (l0, l1), (c0, c1), populacao))

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

    n = len(com_ginasio)
    for i, (reg, pos) in enumerate(com_ginasio):
        percentil = PERCENTIL_MIN if n == 1 else (
            PERCENTIL_MIN + (PERCENTIL_MAX - PERCENTIL_MIN) * i / (n - 1))
        k = indice_do_percentil(len(reg.populacao), percentil)
        lider = Lider(f"Lider{i + 1}", reg.indice, pos, percentil, k, selecionar=selecionar)
        lider.montar_time(reg.populacao, rng)
        reg.lider = lider
    return regioes
