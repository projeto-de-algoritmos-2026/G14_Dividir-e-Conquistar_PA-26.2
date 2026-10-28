"""Previsao de balanceamento: simula o confronto N vezes antes de lutar.

Roda `N` batalhas completas (CPU contra uma politica simples do jogador) em
copias do estado atual e resume o resultado:

- vitoria: fracao das N em que o jogador ganha.
- hp_restante: p10/p50/p90 da fracao de HP que o TIME do jogador ainda tem no
  fim (soma dos HP / soma dos HP maximos; derrota conta 0).
- hp_restante_vitorias: o mesmo so nas vitorias (None se nao houve nenhuma).
- turnos: p10/p50/p90 do numero de turnos.

Os percentis saem de `selecionar` (mediana das medianas), nao de sorted.

Politica do jogador: golpe de maior dano esperado; ao ter o Pokemon derrubado,
manda o de maior vantagem. Nao usa pocao, pokebola nem troca voluntaria, entao
a previsao e um piso do que um jogador atento consegue. Nao da XP durante a
simulacao (o nivel fica o do inicio). O RNG e proprio (seed), nunca o da
batalha real.

Custo medido: ver docs/api-batalha-t3.md.
"""
import random
import time

from batalha import cpu as cpu_mod
from batalha.motor import FIM, TROCA_FORCADA, Batalha
from dc.mediana_medianas import selecionar
from ginasio import indice_do_percentil

N_PADRAO = 1000
LIMITE_TURNOS = 500
PERCENTIS = (("p10", 0.10), ("p50", 0.50), ("p90", 0.90))


def percentis(valores, selecionar_fn=selecionar):
    """{p10, p50, p90} por selecao. Lista vazia devolve None."""
    if not valores:
        return None
    n = len(valores)
    return {nome: selecionar_fn(valores, indice_do_percentil(n, p)) for nome, p in PERCENTIS}


def _jogar(batalha):
    """Joga a batalha ate o fim com a politica simples. Devolve a Batalha."""
    for _ in range(LIMITE_TURNOS * 2):
        if batalha.estado == FIM:
            break
        if batalha.estado == TROCA_FORCADA:
            vivos = [c for c in batalha.equipe if c.vivo]
            melhor = cpu_mod.escolher_proximo(vivos, batalha.inimigo, cpu_mod.LIDER)
            batalha.agir("pokemon", alvo=batalha.equipe.index(melhor))
        else:
            golpe = cpu_mod.escolher_golpe(batalha.jogador, batalha.inimigo, batalha.rng,
                                           cpu_mod.LIDER)
            batalha.agir("lutar", golpe=golpe)
            if batalha.turno >= LIMITE_TURNOS:
                break
    return batalha


def prever(equipe, oponentes, tipo, n=N_PADRAO, seed=0, selecionar_fn=selecionar):
    """Simula `n` batalhas e resume. Nao altera `equipe` nem `oponentes`."""
    if n < 1:
        raise ValueError("n deve ser positivo")
    inicio = time.perf_counter()
    rng = random.Random(seed)
    vitorias = 0
    fracoes, fracoes_vit, turnos = [], [], []
    soma_max = sum(c.hp_max for c in equipe)
    for _ in range(n):
        b = _jogar(Batalha(tipo, [c.clonar() for c in equipe],
                           [c.clonar() for c in oponentes], rng, {}, recompensas=False))
        ganhou = b.resultado == "vitoria"
        fracao = sum(c.hp for c in b.equipe) / soma_max if ganhou else 0.0
        vitorias += ganhou
        fracoes.append(fracao)
        if ganhou:
            fracoes_vit.append(fracao)
        turnos.append(b.turno)
    return {
        "n": n,
        "vitoria": vitorias / n,
        "hp_restante": percentis(fracoes, selecionar_fn),
        "hp_restante_vitorias": percentis(fracoes_vit, selecionar_fn),
        "turnos": percentis(turnos, selecionar_fn),
        "tempo_ms": round((time.perf_counter() - inicio) * 1000, 1),
    }
