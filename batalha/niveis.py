"""Niveis dos adversarios pela mediana das medianas (trabalho 3).

Cada regiao do mapa tem uma populacao de niveis (ginasio.Regiao.populacao). O
nivel de um adversario e o k-esimo menor dessa populacao, achado SEMPRE por
`selecionar(populacao, k)` (dc/mediana_medianas.py), nunca por sorted:

- selvagem: percentil sorteado a cada encontro (rng da sessao), numa faixa que
  sobe com a distancia da celula ate a origem (FAIXA_SELVAGEM_PERTO/LONGE).
- treinador CPU: percentil FIXO por treinador (faixa FAIXA_TREINADOR_PERTO/LONGE
  pela distancia da celula), derivado so de
  (seed do mapa, posicao da celula), entao o mesmo treinador tem sempre o mesmo
  nivel, em qualquer ordem de visita.
- lider: percentil do ginasio, ja calculado na fase 1 (Lider.k).

O percentil vira indice com ginasio.indice_do_percentil (0.5 em n impar e a
mediana exata).
"""
import math
import random

from batalha.combatente import Combatente
from dc.mediana_medianas import selecionar
from ginasio import _ESPECIES, indice_do_percentil
from models import Pokemon

# Etapa 4 (progressao). A populacao de cada regiao ja cresce com a distancia
# (ginasio.NIVEIS_ORIGEM/NIVEIS_FUNDO) e e assimetrica (mais fracos que fortes).
# Alem disso, a faixa de percentil de selvagens e treinadores sobe com a
# distancia da CELULA ate a origem: t = 0 na origem, t = 1 no canto oposto do
# mapa. Perto do inicio so saem os da ponta fraca da populacao, entao o primeiro
# encontro do jogador (nivel 8) e vencivel; longe, a faixa chega perto da
# mediana. Antes (fases anteriores) eram faixas fixas, (0.20, 0.50) e (0.40, 0.70).
FAIXA_SELVAGEM_PERTO = (0.0, 0.12)
FAIXA_SELVAGEM_LONGE = (0.15, 0.45)
FAIXA_TREINADOR_PERTO = (0.0, 0.10)
FAIXA_TREINADOR_LONGE = (0.30, 0.60)
# Sem t (chamadas que nao sabem a posicao), vale o envelope das duas pontas.
FAIXA_SELVAGEM = (FAIXA_SELVAGEM_PERTO[0], FAIXA_SELVAGEM_LONGE[1])
FAIXA_TREINADOR = (FAIXA_TREINADOR_PERTO[0], FAIXA_TREINADOR_LONGE[1])
TAMANHO_TIME_TREINADOR = 2

_NOMES_TREINADOR = ["Jenny", "James", "Jamal", "Drizzy", "Sam", "Rachel", "Bruna", "Caio"]


def nivel_no_percentil(populacao, percentil, selecionar_fn=selecionar):
    """Nivel no percentil dado (0..1) da populacao."""
    return selecionar_fn(populacao, indice_do_percentil(len(populacao), percentil))


def t_da_celula(mapa, linha, coluna):
    """Distancia relativa (0 a 1) da celula ate a origem (0, 0)."""
    maior = math.hypot(mapa.size - 1, mapa.size - 1)
    return min(1.0, math.hypot(linha, coluna) / maior) if maior else 0.0


def _faixa(perto, longe, t, envelope):
    """Faixa de percentil na distancia t; sem t, o envelope inteiro."""
    if t is None:
        return envelope
    return tuple(a + (b - a) * t for a, b in zip(perto, longe))


def percentil_selvagem(rng, t=None):
    return rng.uniform(*_faixa(FAIXA_SELVAGEM_PERTO, FAIXA_SELVAGEM_LONGE, t, FAIXA_SELVAGEM))


def rng_do_treinador(seed, posicao):
    return random.Random(f"treinador-{seed}-{posicao[0]}-{posicao[1]}")


def percentil_treinador(seed, posicao, t=None):
    """Percentil fixo do treinador daquela celula, na faixa da sua distancia."""
    return rng_do_treinador(seed, posicao).uniform(
        *_faixa(FAIXA_TREINADOR_PERTO, FAIXA_TREINADOR_LONGE, t, FAIXA_TREINADOR))


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


def montar_selvagem(regiao, rng, selecionar_fn=selecionar, t=None):
    """(combatente, percentil, nivel) de um selvagem da regiao (t: ver t_da_celula)."""
    percentil = percentil_selvagem(rng, t)
    nivel = nivel_no_percentil(regiao.populacao, percentil, selecionar_fn)
    return Combatente.de_pokemon(_pokemon(rng, "selvagem", nivel)), percentil, nivel


def montar_treinador(regiao, seed, posicao, selecionar_fn=selecionar, t=None):
    """(nome, time de combatentes, percentil, nivel) do treinador da celula."""
    rng = rng_do_treinador(seed, posicao)
    percentil = rng.uniform(*_faixa(FAIXA_TREINADOR_PERTO, FAIXA_TREINADOR_LONGE, t,
                                    FAIXA_TREINADOR))      # o mesmo de percentil_treinador
    nivel = nivel_no_percentil(regiao.populacao, percentil, selecionar_fn)
    nome = rng.choice(_NOMES_TREINADOR)
    time = [Combatente.de_pokemon(_pokemon(rng, f"{nome}-{i + 1}", nivel))
            for i in range(TAMANHO_TIME_TREINADOR)]
    return nome, time, percentil, nivel


def montar_time_lider(lider):
    """Time do lider como combatentes novos (HP e PP cheios a cada batalha)."""
    return [Combatente.de_pokemon(p) for p in lider.time]
