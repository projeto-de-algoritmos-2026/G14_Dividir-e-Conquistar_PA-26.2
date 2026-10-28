"""Niveis dos adversarios pela mediana das medianas (trabalho 3).

Cada regiao do mapa tem uma populacao de niveis (ginasio.Regiao.populacao). O
nivel de um adversario e o k-esimo menor dessa populacao, achado SEMPRE por
`selecionar(populacao, k)` (dc/mediana_medianas.py), nunca por sorted:

- selvagem: percentil sorteado em [0.20, 0.50] a cada encontro (rng da sessao).
- treinador CPU: percentil FIXO por treinador em [0.40, 0.70], derivado so de
  (seed do mapa, posicao da celula), entao o mesmo treinador tem sempre o mesmo
  nivel, em qualquer ordem de visita.
- lider: percentil do ginasio, ja calculado na fase 1 (Lider.k).

O percentil vira indice com ginasio.indice_do_percentil (0.5 em n impar e a
mediana exata).
"""
import random

from batalha.combatente import Combatente
from dc.mediana_medianas import selecionar
from ginasio import _ESPECIES, indice_do_percentil
from models import Pokemon

FAIXA_SELVAGEM = (0.20, 0.50)
FAIXA_TREINADOR = (0.40, 0.70)
TAMANHO_TIME_TREINADOR = 2

_NOMES_TREINADOR = ["Jenny", "James", "Jamal", "Drizzy", "Sam", "Rachel", "Bruna", "Caio"]


def nivel_no_percentil(populacao, percentil, selecionar_fn=selecionar):
    """Nivel no percentil dado (0..1) da populacao."""
    return selecionar_fn(populacao, indice_do_percentil(len(populacao), percentil))


def percentil_selvagem(rng):
    return rng.uniform(*FAIXA_SELVAGEM)


def rng_do_treinador(seed, posicao):
    return random.Random(f"treinador-{seed}-{posicao[0]}-{posicao[1]}")


def percentil_treinador(seed, posicao):
    """Percentil fixo do treinador daquela celula, em [0.40, 0.70]."""
    return rng_do_treinador(seed, posicao).uniform(*FAIXA_TREINADOR)


def regiao_da_celula(mapa, linha, coluna):
    for reg in mapa.regioes:
        if (reg.linhas[0] <= linha < reg.linhas[1]
                and reg.colunas[0] <= coluna < reg.colunas[1]):
            return reg
    raise ValueError(f"celula {(linha, coluna)} fora de toda regiao")


def _pokemon(rng, rotulo, nivel):
    especie, tipo, golpes = rng.choice(_ESPECIES)
    return Pokemon(name=f"{especie}-{rotulo}", gender=rng.choice(["Male", "Female"]),
                   type_of_pokemon=tipo, moves=dict(golpes), level=nivel)


def montar_selvagem(regiao, rng, selecionar_fn=selecionar):
    """(combatente, percentil, nivel) de um selvagem da regiao."""
    percentil = percentil_selvagem(rng)
    nivel = nivel_no_percentil(regiao.populacao, percentil, selecionar_fn)
    return Combatente.de_pokemon(_pokemon(rng, "selvagem", nivel)), percentil, nivel


def montar_treinador(regiao, seed, posicao, selecionar_fn=selecionar):
    """(nome, time de combatentes, percentil, nivel) do treinador da celula."""
    rng = rng_do_treinador(seed, posicao)
    percentil = rng.uniform(*FAIXA_TREINADOR)      # o mesmo de percentil_treinador
    nivel = nivel_no_percentil(regiao.populacao, percentil, selecionar_fn)
    nome = rng.choice(_NOMES_TREINADOR)
    time = [Combatente.de_pokemon(_pokemon(rng, f"{nome}-{i + 1}", nivel))
            for i in range(TAMANHO_TIME_TREINADOR)]
    return nome, time, percentil, nivel


def montar_time_lider(lider):
    """Time do lider como combatentes novos (HP e PP cheios a cada batalha)."""
    return [Combatente.de_pokemon(p) for p in lider.time]
