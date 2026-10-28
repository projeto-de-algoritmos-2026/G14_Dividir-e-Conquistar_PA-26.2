"""Decisoes da CPU, todas por selecao (k-esimo menor) e nao por ordenacao.

Dois modos:
- "comum" (selvagem e treinador): golpe sorteado com peso = dano esperado; ao
  trocar de Pokemon, o k-esimo da vantagem com k = mediana (nivel facil).
- "lider": golpe de MAIOR dano esperado; ao trocar, k = topo (o de maior
  vantagem).

O k-esimo e achado por dc.mediana_medianas.selecionar, o mesmo algoritmo O(n)
que monta o nivel dos Pokemon. Os testes conferem contra sorted().
"""
from batalha.dano import dano_esperado
from dc.mediana_medianas import selecionar

COMUM = "comum"
LIDER = "lider"


def danos_esperados(atacante, alvo, indices):
    return [dano_esperado(atacante, atacante.golpes[i], alvo) for i in indices]


def melhor_dano(atacante, alvo):
    """Maior dano esperado entre os golpes com PP (o Esforco se nao ha nenhum)."""
    usaveis = atacante.golpes_usaveis()
    if not usaveis:
        return dano_esperado(atacante, atacante.golpe_esforco(), alvo)
    return selecionar(danos_esperados(atacante, alvo, usaveis), len(usaveis) - 1)


def escolher_golpe(atacante, alvo, rng, modo):
    """Indice do golpe a usar, ou None pro Esforco (sem PP em nenhum)."""
    usaveis = atacante.golpes_usaveis()
    if not usaveis:
        return None
    danos = danos_esperados(atacante, alvo, usaveis)
    if modo == LIDER:
        topo = selecionar(danos, len(danos) - 1)
        return usaveis[danos.index(topo)]
    return rng.choices(usaveis, weights=danos)[0]


def vantagem(candidato, alvo):
    """Quanto o candidato leva de melhor contra o alvo do que o alvo contra ele.

    Dano esperado do melhor golpe de cada lado, em fracao do HP de quem apanha.
    Positivo: o candidato esta na frente.
    """
    return (melhor_dano(candidato, alvo) / max(1, alvo.hp)
            - melhor_dano(alvo, candidato) / max(1, candidato.hp))


def indice_k(n, modo):
    """k do modo: mediana (inferior) no comum, topo no lider."""
    return n - 1 if modo == LIDER else (n - 1) // 2


def escolher_proximo(candidatos, alvo, modo):
    """Entre os candidatos vivos, o k-esimo por vantagem contra o alvo."""
    pontos = [vantagem(c, alvo) for c in candidatos]
    k = indice_k(len(pontos), modo)
    return candidatos[pontos.index(selecionar(pontos, k))]
