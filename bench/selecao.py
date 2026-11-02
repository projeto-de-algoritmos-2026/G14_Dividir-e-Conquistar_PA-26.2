"""Experimento do trabalho 3: selecao do k-esimo menor.

Quatro jeitos de achar o k-esimo, todos de dc.mediana_medianas (menos o
`ordenar`, que e o sorted() do Python e serve de oraculo e de piso pratico):

- mediana_medianas: O(n) no pior caso. E o que o jogo usa.
- ordenar: sorted(valores)[k], O(n log n) sempre, mas em C.
- quickselect_aleatorio: O(n) esperado em qualquer entrada.
- quickselect_ingenuo: pivo = primeiro elemento, O(n^2) em entrada ordenada.

Tres entradas, porque a tese ("a mediana das medianas nao e a mais rapida na
media; e a unica das tres que e O(n) garantido") so aparece com as tres:

- aleatoria: inteiros distintos-na-pratica em [0, 10^9), k = mediana. E o caso
  medio, em que o quickselect e o sort ganham no relogio.
- niveis: niveis de 1 a 100, k = mediana. E a populacao real do jogo; quase
  tudo e repetido e a particao em tres resolve em poucas rodadas.
- adversaria: 0..n-1 ja ordenada, k = n - 1 (gerar_adversario_ingenuo). O
  pivo-primeiro descarta um elemento por rodada e faz n(n+1)/2 - 1
  comparacoes; a mediana das medianas continua linear.

Duas medidas por execucao, em execucoes separadas porque o contador pesa no
relogio:

- tempo_ms: o menor de `repeticoes` execucoes, com o coletor de lixo desligado
  (o mesmo que o timeit faz).
- comparacoes: comparacoes entre elementos (convencao no docstring de
  dc.mediana_medianas; no `ordenar`, as comparacoes reais do sorted()). Nao
  depende da maquina, e e o numero que sustenta o O(n) no relatorio.

Orcamento de tempo: o quickselect ingenuo na entrada adversaria e quadratico,
e em 10^6 levaria dias. Antes de cada medicao, o tempo e estimado a partir do
tamanho anterior supondo crescimento quadratico (o pior caso conhecido de
todos os quatro; nos lineares a estimativa so superestima). Se passar do
orcamento, a medicao nao roda e vai para `selecao_descartes.csv` com a
estimativa, em vez de sumir.
"""

import argparse
import gc
import random
import time
from functools import cmp_to_key
from pathlib import Path

from dc.mediana_medianas import (
    Contador,
    gerar_adversario_ingenuo,
    quickselect_aleatorio,
    quickselect_ingenuo,
    selecionar,
)

from .common import SAIDA_PADRAO, agrupar, escrever_csv, media

TAMANHOS_SELECAO = (1_000, 3_000, 10_000, 30_000, 100_000, 300_000, 1_000_000)
SEEDS_SELECAO = 3
ORCAMENTO_S = 10.0
NIVEL_MAX = 100
VALOR_MAX = 10**9


def _ordenar(valores, k, rng, contador=None):
    if contador is None:
        return sorted(valores)[k]

    def cmp(a, b):
        contador.comparacoes += 1
        return (a > b) - (a < b)

    return sorted(valores, key=cmp_to_key(cmp))[k]


# Mesma assinatura (valores, k, rng, contador) pros quatro. A ordem e a das
# series nos graficos e a das cores.
ALGORITMOS_SELECAO = {
    "mediana_medianas": lambda v, k, rng, c=None: selecionar(v, k, c),
    "ordenar": _ordenar,
    "quickselect_aleatorio": lambda v, k, rng, c=None: quickselect_aleatorio(v, k, rng, c),
    "quickselect_ingenuo": lambda v, k, rng, c=None: quickselect_ingenuo(v, k, c),
}


def gerar_entrada(distribuicao, n, seed):
    """(valores, k) de uma distribuicao. A adversaria nao depende da seed."""
    if distribuicao == "adversaria":
        return gerar_adversario_ingenuo(n), n - 1
    rng = random.Random(seed)
    if distribuicao == "aleatoria":
        valores = [rng.randrange(VALOR_MAX) for _ in range(n)]
    elif distribuicao == "niveis":
        valores = [rng.randint(1, NIVEL_MAX) for _ in range(n)]
    else:
        raise ValueError(f"distribuicao desconhecida: {distribuicao}")
    return valores, (n - 1) // 2


DISTRIBUICOES = ("aleatoria", "niveis", "adversaria")

CAMPOS = [
    "distribuicao", "n", "k", "seed", "algoritmo",
    "tempo_ms", "comparacoes", "comparacoes_por_n", "correto",
]

CAMPOS_RESUMO = [
    "distribuicao", "n", "algoritmo", "execucoes",
    "tempo_ms_medio", "comparacoes_medio", "comparacoes_por_n",
]

CAMPOS_DESCARTE = ["distribuicao", "n", "algoritmo", "tempo_estimado_s", "motivo"]


def _cronometrar(funcao, repeticoes):
    """Menor tempo (s) de `repeticoes` chamadas, com o gc desligado."""
    melhor = float("inf")
    estava_ligado = gc.isenabled()
    gc.disable()
    try:
        for _ in range(repeticoes):
            inicio = time.perf_counter()
            resultado = funcao()
            melhor = min(melhor, time.perf_counter() - inicio)
    finally:
        if estava_ligado:
            gc.enable()
    return melhor, resultado


def rodar(tamanhos=TAMANHOS_SELECAO, seeds=SEEDS_SELECAO, repeticoes=3,
          orcamento_s=ORCAMENTO_S, distribuicoes=DISTRIBUICOES, progresso=None):
    linhas, descartes = [], []
    for distribuicao in distribuicoes:
        # (n, segundos) da ultima medicao de cada algoritmo, pra estimar a proxima.
        ultimo = {}
        for n in sorted(tamanhos):
            entradas = [gerar_entrada(distribuicao, n, seed) for seed in range(seeds)]
            gabaritos = [sorted(valores)[k] for valores, k in entradas]
            for nome, algoritmo in ALGORITMOS_SELECAO.items():
                if nome in ultimo:
                    n_antes, s_antes = ultimo[nome]
                    estimado = s_antes * (n / n_antes) ** 2
                    if estimado > orcamento_s:
                        descartes.append({
                            "distribuicao": distribuicao, "n": n, "algoritmo": nome,
                            "tempo_estimado_s": round(estimado, 1),
                            "motivo": f"estimativa quadratica acima do orcamento de {orcamento_s:g} s",
                        })
                        continue
                maior = 0.0
                for seed, ((valores, k), gabarito) in enumerate(zip(entradas, gabaritos)):
                    segundos, resposta = _cronometrar(
                        lambda: algoritmo(valores, k, random.Random(seed)), repeticoes
                    )
                    contador = Contador()
                    algoritmo(valores, k, random.Random(seed), contador)
                    maior = max(maior, segundos)
                    linhas.append({
                        "distribuicao": distribuicao, "n": n, "k": k, "seed": seed,
                        "algoritmo": nome,
                        "tempo_ms": round(segundos * 1000, 4),
                        "comparacoes": contador.comparacoes,
                        "comparacoes_por_n": round(contador.comparacoes / n, 4),
                        "correto": int(resposta == gabarito),
                    })
                ultimo[nome] = (n, maior)
                if progresso:
                    progresso(f"  {distribuicao:>10} n={n:>9} {nome:<22} {maior * 1000:10.1f} ms")
    return linhas, descartes


def resumir(linhas):
    """Media por (distribuicao, n, algoritmo). E o que alimenta os graficos."""
    resumo = []
    for (distribuicao, n, algoritmo), grupo in agrupar(
        linhas, ["distribuicao", "n", "algoritmo"]
    ).items():
        comparacoes = media(grupo, "comparacoes")
        resumo.append({
            "distribuicao": distribuicao,
            "n": n,
            "algoritmo": algoritmo,
            "execucoes": len(grupo),
            "tempo_ms_medio": media(grupo, "tempo_ms"),
            "comparacoes_medio": comparacoes,
            "comparacoes_por_n": round(comparacoes / int(n), 4),
        })
    return resumo


def main(argv=None):
    parser = argparse.ArgumentParser(description="Benchmark da selecao do k-esimo (trabalho 3)")
    parser.add_argument("--tamanhos", type=int, nargs="+", default=list(TAMANHOS_SELECAO))
    parser.add_argument("--seeds", type=int, default=SEEDS_SELECAO)
    parser.add_argument("--repeticoes", type=int, default=3,
                        help="execucoes por medicao de tempo; vale a menor")
    parser.add_argument("--orcamento", type=float, default=ORCAMENTO_S,
                        help="segundos maximos estimados por execucao")
    parser.add_argument("--saida", type=Path, default=SAIDA_PADRAO)
    args = parser.parse_args(argv)

    linhas, descartes = rodar(args.tamanhos, args.seeds, args.repeticoes,
                              args.orcamento, progresso=print)
    erradas = [linha for linha in linhas if not linha["correto"]]
    escrever_csv(args.saida / "selecao.csv", CAMPOS, linhas)
    escrever_csv(args.saida / "selecao_resumo.csv", CAMPOS_RESUMO, resumir(linhas))
    escrever_csv(args.saida / "selecao_descartes.csv", CAMPOS_DESCARTE, descartes)
    print(f"selecao: {len(linhas)} medicoes, {len(descartes)} descartadas pelo orcamento, "
          f"{len(erradas)} respostas erradas -> {args.saida}")
    return 1 if erradas else 0


if __name__ == "__main__":
    raise SystemExit(main())
