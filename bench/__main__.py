"""Roda a grade inteira: os quatro experimentos e os graficos.

    python -m bench
    python -m bench --so rotas --tamanhos 8 15 --seeds 10
    python -m bench --so selecao      # trabalho 3, grade propria (n de 10^3 a 10^6)
"""

import argparse
from pathlib import Path

from . import charts, paradas, partidas, rotas, selecao
from .common import SAIDA_PADRAO, SEEDS, TAMANHOS


def main(argv=None):
    parser = argparse.ArgumentParser(description="Benchmark da fase 6")
    parser.add_argument("--tamanhos", type=int, nargs="+", default=list(TAMANHOS))
    parser.add_argument("--seeds", type=int, default=SEEDS)
    parser.add_argument("--repeticoes", type=int, default=3,
                        help="execucoes por medicao de rota; vale a menor")
    parser.add_argument("--saida", type=Path, default=SAIDA_PADRAO)
    parser.add_argument("--so", choices=["rotas", "partidas", "paradas", "selecao", "graficos"],
                        default=None, help="roda so uma etapa, em vez de todas")
    args = parser.parse_args(argv)

    if args.so in (None, "rotas"):
        rotas.main(["--tamanhos", *map(str, args.tamanhos),
                    "--seeds", str(args.seeds),
                    "--repeticoes", str(args.repeticoes),
                    "--saida", str(args.saida)])

    if args.so in (None, "partidas"):
        partidas.main(["--tamanhos", *map(str, args.tamanhos),
                       "--seeds", str(args.seeds),
                       "--saida", str(args.saida)])

    if args.so in (None, "paradas"):
        paradas.main(["--tamanhos", *map(str, args.tamanhos),
                      "--seeds", str(args.seeds),
                      "--saida", str(args.saida)])

    # A selecao tem grade propria (n de 10^3 a 10^6, em bench.selecao): os
    # --tamanhos daqui sao tamanhos de mapa e nao se aplicam a ela.
    if args.so in (None, "selecao"):
        selecao.main(["--saida", str(args.saida)])

    if args.so in (None, "graficos"):
        for caminho in charts.gerar(args.saida):
            print(f"grafico: {caminho}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
