"""Tabela de tipos da batalha (trabalho 3).

Cinco tipos, os que o jogo ja tinha: Fire, Water, Rock, Psychic, Normal.
Multiplicador de dano = TABELA[tipo do golpe][tipo de quem apanha]:
2.0 super efetivo, 1.0 neutro, 0.5 pouco efetivo.

         defensor ->  Fire  Water  Rock  Psychic  Normal
    golpe Fire         0.5   0.5   0.5    2.0      1.0
    golpe Water        2.0   0.5   2.0    1.0      1.0
    golpe Rock         2.0   1.0   1.0    1.0      1.0
    golpe Psychic      1.0   1.0   1.0    0.5      1.0
    golpe Normal       1.0   1.0   0.5    1.0      1.0

Inspirada na tabela da serie. Os valores existentes seguem o genero (agua
vence fogo e pedra, pedra vence fogo, fogo resiste a fogo, agua e pedra,
psiquico resiste a psiquico, normal e fraco contra pedra). Um desvio, marcado:
Fire x Psychic = 2.0. Na serie o fogo vence grama, gelo, inseto e aco, que nao
existem aqui; sem um alvo super efetivo o tipo Fire seria so desvantagem.
Psychic nao tem alvo 2.0 (os tipos que o vencem na serie nao existem aqui) e se
sustenta pelos golpes fortes e pela Mew.
"""

FIRE, WATER, ROCK, PSYCHIC, NORMAL = "Fire", "Water", "Rock", "Psychic", "Normal"
TIPOS = (FIRE, WATER, ROCK, PSYCHIC, NORMAL)

# So as entradas diferentes de 1.0; o resto e neutro.
_ESPECIAIS = {
    (FIRE, FIRE): 0.5, (FIRE, WATER): 0.5, (FIRE, ROCK): 0.5, (FIRE, PSYCHIC): 2.0,
    (WATER, FIRE): 2.0, (WATER, WATER): 0.5, (WATER, ROCK): 2.0,
    (ROCK, FIRE): 2.0,
    (PSYCHIC, PSYCHIC): 0.5,
    (NORMAL, ROCK): 0.5,
}

TABELA = {
    atk: {dfs: _ESPECIAIS.get((atk, dfs), 1.0) for dfs in TIPOS}
    for atk in TIPOS
}


def multiplicador(tipo_golpe, tipo_alvo):
    """Efetividade do golpe sobre o alvo. Tipo desconhecido conta como Normal."""
    tipo_golpe = tipo_golpe if tipo_golpe in TABELA else NORMAL
    tipo_alvo = tipo_alvo if tipo_alvo in TABELA else NORMAL
    return TABELA[tipo_golpe][tipo_alvo]
