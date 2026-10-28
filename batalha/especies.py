"""Especies (stats base) e golpes (tipo, poder, precisao, PP) da batalha.

O modelo antigo guarda cada golpe como {nome: dano_fixo}. O motor novo precisa
de tipo, poder, precisao e PP, entao os golpes que o jogo ja tem ganham ficha
aqui. Golpe fora do catalogo vira Normal com poder = o valor antigo, precisao
100 e PP 20, pra nenhum Pokemon montado na mao quebrar o motor.

Os nomes de Pokemon e de golpe sao os do jogo atual; os numeros sao do jogo.
"""
from batalha.tipos import FIRE, NORMAL, PSYCHIC, ROCK, WATER

MAX_GOLPES = 4

# nome do golpe -> (tipo, poder, precisao em %, PP)
GOLPES = {
    "Flamethrower": (FIRE, 90, 100, 15),
    "Fire-blast": (FIRE, 110, 85, 5),
    "Hydropump": (WATER, 110, 80, 5),
    "Rock-throw": (ROCK, 50, 90, 15),
    "Mind-beam": (PSYCHIC, 65, 100, 20),
    "Psychic-slam": (PSYCHIC, 90, 100, 10),
    "Claw": (NORMAL, 40, 100, 35),
    "Slap": (NORMAL, 40, 100, 35),
    "Bite": (NORMAL, 60, 100, 25),
    "head-butt": (NORMAL, 70, 100, 15),
    "Body-slam": (NORMAL, 85, 100, 15),
}

# Golpe de ultimo recurso, quando todos os PP acabaram. Nao gasta PP e o dono
# leva um quarto do HP maximo de recuo.
ESFORCO = ("Esforco", NORMAL, 50, 100)

# especie -> (HP, Ataque, Defesa, Velocidade) base
BASE = {
    "Charmander": (39, 52, 43, 65),
    "Charzard": (78, 84, 78, 100),
    "Squirtle": (44, 48, 65, 43),
    "Geodude": (40, 80, 100, 20),
    "Onyx": (35, 45, 160, 70),
    "Snorlax": (160, 110, 65, 30),
    "Mew": (100, 100, 100, 100),
}
BASE_PADRAO = (50, 50, 50, 50)


def ficha_do_golpe(nome, valor_antigo=40):
    """(tipo, poder, precisao, pp) do golpe pelo nome."""
    if nome in GOLPES:
        return GOLPES[nome]
    return (NORMAL, max(1, int(valor_antigo)), 100, 20)
