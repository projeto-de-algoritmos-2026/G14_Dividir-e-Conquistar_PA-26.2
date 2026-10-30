"""Graficos do benchmark, em SVG escrito a mao.

Por que nao matplotlib: o projeto declara duas dependencias (rich e pytest) e
o grafico que o plano pede e uma linha por algoritmo contra tres tamanhos de
mapa. Isso cabe em SVG da biblioteca padrao, e o arquivo resultante abre no
navegador, entra no relatorio e sobe pro repositorio como texto versionavel.
Se em algum momento o relatorio precisar de escala log, barra de erro ou
regressao, ai sim vale trocar por matplotlib, e a troca e local a este modulo.
"""

import argparse
import math
from pathlib import Path

from .common import SAIDA_PADRAO, ler_csv

LARGURA, ALTURA = 720, 420
MARGEM = {"esquerda": 78, "direita": 150, "topo": 52, "baixo": 62}

CORES = {
    "dfs": "#d1495b",
    "bfs": "#2a9d8f",
    "dijkstra": "#3d5a80",
    # Estrategias de parada do trabalho 2.
    "guloso": "#0b8577",
    "todo_centro": "#6c757d",
    "limiar_10": "#c0392b",
    "limiar_25": "#e08e0b",
    "limiar_50": "#7b5ea7",
    # Selecao do k-esimo, trabalho 3 (paleta categorica validada, ordem fixa).
    "mediana_medianas": "#2a78d6",
    "ordenar": "#eb6834",
    "quickselect_aleatorio": "#1baf7a",
    "quickselect_ingenuo": "#eda100",
}
COR_PADRAO = "#6c757d"

ROTULOS = {
    "mediana_medianas": "mediana das medianas",
    "ordenar": "ordenar (sorted)",
    "quickselect_aleatorio": "quickselect aleatorio",
    "quickselect_ingenuo": "quickselect ingenuo",
}


def _escala(valor, minimo, maximo, inicio, fim):
    if maximo == minimo:
        return (inicio + fim) / 2
    return inicio + (valor - minimo) * (fim - inicio) / (maximo - minimo)


def _ticks(maximo, quantidade=4):
    if maximo <= 0:
        return [0]
    return [round(maximo * i / quantidade, 2) for i in range(quantidade + 1)]


def grafico_linhas(titulo, rotulo_x, rotulo_y, series, caminho: Path) -> Path:
    """Uma linha por serie. `series` e {nome: [(x, y), ...]} com x numerico."""
    pontos_todos = [ponto for pontos in series.values() for ponto in pontos]
    if not pontos_todos:
        raise ValueError("grafico sem nenhum ponto")

    xs = sorted({ponto[0] for ponto in pontos_todos})
    x_min, x_max = min(xs), max(xs)
    y_max = max(ponto[1] for ponto in pontos_todos) or 1
    y_max = y_max * 1.1

    esquerda = MARGEM["esquerda"]
    direita = LARGURA - MARGEM["direita"]
    topo = MARGEM["topo"]
    base = ALTURA - MARGEM["baixo"]

    partes = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{LARGURA}" height="{ALTURA}" '
        f'viewBox="0 0 {LARGURA} {ALTURA}" font-family="system-ui, sans-serif">',
        f'<rect width="{LARGURA}" height="{ALTURA}" fill="#ffffff"/>',
        f'<text x="{esquerda}" y="30" font-size="17" font-weight="600" fill="#1d2733">{titulo}</text>',
    ]

    for valor in _ticks(y_max):
        y = _escala(valor, 0, y_max, base, topo)
        partes.append(
            f'<line x1="{esquerda}" y1="{y:.1f}" x2="{direita}" y2="{y:.1f}" '
            f'stroke="#e4e8ee" stroke-width="1"/>'
        )
        partes.append(
            f'<text x="{esquerda - 10}" y="{y + 4:.1f}" font-size="11" '
            f'text-anchor="end" fill="#66707c">{valor:g}</text>'
        )

    partes.append(
        f'<line x1="{esquerda}" y1="{base}" x2="{direita}" y2="{base}" '
        f'stroke="#96a0ac" stroke-width="1"/>'
    )
    for valor in xs:
        x = _escala(valor, x_min, x_max, esquerda, direita)
        partes.append(
            f'<text x="{x:.1f}" y="{base + 22}" font-size="12" '
            f'text-anchor="middle" fill="#414b57">{valor:g}</text>'
        )

    partes.append(
        f'<text x="{(esquerda + direita) / 2:.0f}" y="{ALTURA - 16}" font-size="12" '
        f'text-anchor="middle" fill="#66707c">{rotulo_x}</text>'
    )
    partes.append(
        f'<text x="18" y="{(topo + base) / 2:.0f}" font-size="12" fill="#66707c" '
        f'text-anchor="middle" transform="rotate(-90 18 {(topo + base) / 2:.0f})">{rotulo_y}</text>'
    )

    for indice, (nome, pontos) in enumerate(series.items()):
        cor = CORES.get(nome, COR_PADRAO)
        coordenadas = [
            (_escala(x, x_min, x_max, esquerda, direita), _escala(y, 0, y_max, base, topo))
            for x, y in sorted(pontos)
        ]
        traco = " ".join(f"{x:.1f},{y:.1f}" for x, y in coordenadas)
        partes.append(
            f'<polyline points="{traco}" fill="none" stroke="{cor}" stroke-width="2.5" '
            f'stroke-linejoin="round" stroke-linecap="round"/>'
        )
        for x, y in coordenadas:
            partes.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="{cor}"/>')
        y_legenda = topo + 6 + indice * 22
        partes.append(
            f'<rect x="{direita + 22}" y="{y_legenda - 8}" width="12" height="12" rx="3" fill="{cor}"/>'
        )
        partes.append(
            f'<text x="{direita + 40}" y="{y_legenda + 2}" font-size="12" fill="#1d2733">{nome}</text>'
        )

    partes.append("</svg>")
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text("\n".join(partes), encoding="utf-8")
    return caminho


SUPERSCRITO = str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")


def _potencia(valor):
    """1000 -> '10³', 3000 -> '3·10³', 0.01 -> '10⁻²'."""
    expoente = math.floor(math.log10(valor) + 1e-9)
    mantissa = round(valor / 10**expoente, 2)
    base = "10" + str(expoente).translate(SUPERSCRITO)
    return base if mantissa == 1 else f"{mantissa:g}·{base}"


def _numero(valor):
    """Numero no formato brasileiro: 1.000.000 e 9,32."""
    if valor >= 100:
        return f"{valor:,.0f}".replace(",", ".")
    return f"{valor:.3g}".replace(".", ",")


def grafico_log(titulo, subtitulo, rotulo_x, rotulo_y, series, caminho: Path,
                log_y=True) -> Path:
    """Linhas com eixo x em escala log (e y tambem, se `log_y`).

    Feito pro trabalho 3, em que n vai de 10^3 a 10^6: na escala linear os
    quatro primeiros tamanhos ficariam empilhados no canto. Em log-log, uma
    reta de inclinacao 1 e O(n) e de inclinacao 2 e O(n^2), que e exatamente o
    que o grafico precisa mostrar. A legenda fica numa linha acima do grafico
    e cada ponto tem <title>, que o navegador mostra ao passar o mouse.
    """
    pontos_todos = [p for pontos in series.values() for p in pontos if p[1] > 0 or not log_y]
    if not pontos_todos:
        raise ValueError("grafico sem nenhum ponto")

    largura, altura = 760, 460
    esquerda, direita, topo, base = 78, largura - 28, 104, altura - 62

    xs = sorted({p[0] for p in pontos_todos})
    lx_min, lx_max = math.log10(xs[0]), math.log10(xs[-1])

    ys = [p[1] for p in pontos_todos]
    if log_y:
        ly_min = math.floor(math.log10(min(ys)))
        ly_max = math.ceil(math.log10(max(ys)))
        if ly_max == ly_min:
            ly_max += 1
        ticks_y = [10**e for e in range(ly_min, ly_max + 1)]

        def py(y):
            return _escala(math.log10(y), ly_min, ly_max, base, topo)
    else:
        bruto = (max(ys) or 1) / 4
        passo = min(m * 10**math.floor(math.log10(bruto)) for m in (1, 2, 2.5, 5, 10)
                    if m * 10**math.floor(math.log10(bruto)) >= bruto)
        ticks_y = [passo * i for i in range(5)]
        y_max = ticks_y[-1]

        def py(y):
            return _escala(y, 0, y_max, base, topo)

    def px(x):
        return _escala(math.log10(x), lx_min, lx_max, esquerda, direita)

    partes = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{largura}" height="{altura}" '
        f'viewBox="0 0 {largura} {altura}" font-family="system-ui, sans-serif">',
        f'<rect width="{largura}" height="{altura}" fill="#ffffff"/>',
        f'<text x="{esquerda}" y="30" font-size="17" font-weight="600" fill="#1d2733">{titulo}</text>',
        f'<text x="{esquerda}" y="50" font-size="12" fill="#66707c">{subtitulo}</text>',
    ]

    x_legenda = esquerda
    for nome in series:
        cor = CORES.get(nome, COR_PADRAO)
        rotulo = ROTULOS.get(nome, nome)
        partes.append(
            f'<line x1="{x_legenda}" y1="76" x2="{x_legenda + 18}" y2="76" '
            f'stroke="{cor}" stroke-width="2" stroke-linecap="round"/>'
            f'<circle cx="{x_legenda + 9}" cy="76" r="4" fill="{cor}"/>'
        )
        partes.append(
            f'<text x="{x_legenda + 24}" y="80" font-size="12" fill="#1d2733">{rotulo}</text>'
        )
        x_legenda += 34 + 6.6 * len(rotulo)

    for valor in ticks_y:
        y = py(valor)
        texto = _potencia(valor) if log_y else f"{valor:g}"
        partes.append(
            f'<line x1="{esquerda}" y1="{y:.1f}" x2="{direita}" y2="{y:.1f}" '
            f'stroke="#e4e8ee" stroke-width="1"/>'
            f'<text x="{esquerda - 10}" y="{y + 4:.1f}" font-size="11" '
            f'text-anchor="end" fill="#66707c">{texto}</text>'
        )

    partes.append(
        f'<line x1="{esquerda}" y1="{base}" x2="{direita}" y2="{base}" '
        f'stroke="#96a0ac" stroke-width="1"/>'
    )
    for valor in xs:
        partes.append(
            f'<text x="{px(valor):.1f}" y="{base + 22}" font-size="12" '
            f'text-anchor="middle" fill="#414b57">{_potencia(valor)}</text>'
        )
    partes.append(
        f'<text x="{(esquerda + direita) / 2:.0f}" y="{altura - 16}" font-size="12" '
        f'text-anchor="middle" fill="#66707c">{rotulo_x}</text>'
    )
    partes.append(
        f'<text x="18" y="{(topo + base) / 2:.0f}" font-size="12" fill="#66707c" '
        f'text-anchor="middle" transform="rotate(-90 18 {(topo + base) / 2:.0f})">{rotulo_y}</text>'
    )

    for nome, pontos in series.items():
        cor = CORES.get(nome, COR_PADRAO)
        validos = sorted(p for p in pontos if p[1] > 0 or not log_y)
        coordenadas = [(px(x), py(y), x, y) for x, y in validos]
        traco = " ".join(f"{cx:.1f},{cy:.1f}" for cx, cy, _, _ in coordenadas)
        partes.append(
            f'<polyline points="{traco}" fill="none" stroke="{cor}" stroke-width="2" '
            f'stroke-linejoin="round" stroke-linecap="round"/>'
        )
        for cx, cy, x, y in coordenadas:
            partes.append(
                f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="4" fill="{cor}" '
                f'stroke="#ffffff" stroke-width="2"><title>{ROTULOS.get(nome, nome)}: '
                f'n = {_numero(x)}: {_numero(y)}</title></circle>'
            )

    partes.append("</svg>")
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text("\n".join(partes), encoding="utf-8")
    return caminho


def series_por_algoritmo(linhas, coluna, filtro=None, serie="algoritmo"):
    """{serie: [(tamanho, valor)]} a partir de um CSV de resumo.

    `serie` e a coluna que separa as linhas do grafico: o algoritmo nos
    experimentos do trabalho 1, a estrategia de parada no do trabalho 2.
    """
    series: dict[str, list] = {}
    for linha in linhas:
        if filtro and any(linha[chave] != valor for chave, valor in filtro.items()):
            continue
        series.setdefault(linha[serie], []).append(
            (int(linha["tamanho"]), float(linha[coluna]))
        )
    return series


GRAFICOS_ROTAS = [
    ("custo_medio", "Custo medio da rota por tamanho de mapa", "custo medio", "rotas-custo.svg"),
    ("passos_medio", "Passos medios da rota por tamanho de mapa", "passos medios", "rotas-passos.svg"),
    ("nos_expandidos_medio", "Nos expandidos por tamanho de mapa", "nos expandidos", "rotas-nos.svg"),
]

GRAFICOS_PARTIDAS = [
    ("batalhas_medio", "Batalhas forcadas por partida", "batalhas", "partidas-batalhas.svg"),
    ("hp_perdido_medio", "HP perdido por partida", "HP perdido", "partidas-hp.svg"),
    ("objetivos_medio", "Objetivos concluidos por partida", "objetivos", "partidas-objetivos.svg"),
]

# (coluna, titulo, rotulo, arquivo, filtro, serie). Todos no tanque medio. O
# otimo fica fora dos graficos de estrategia: tem as mesmas paradas do guloso
# (e o que a fase 3 prova) e a linha dele so esconderia a do guloso.
FILTRO_ESTRATEGIAS = {"alcance": "medio", "algoritmo": "dijkstra"}
FILTRO_ALGORITMOS = {"alcance": "medio", "estrategia": "guloso"}
GRAFICOS_PARADAS = [
    ("paradas_medio", "Paradas por estrategia na rota do Dijkstra", "paradas",
     "paradas-estrategias.svg", FILTRO_ESTRATEGIAS, "estrategia"),
    ("taxa_desmaio", "Desmaios por estrategia na rota do Dijkstra", "fracao que desmaia",
     "paradas-desmaios.svg", FILTRO_ESTRATEGIAS, "estrategia"),
    ("energia_desperdicada_medio", "Energia desperdicada por estrategia", "energia no tanque ao recarregar",
     "paradas-desperdicio.svg", FILTRO_ESTRATEGIAS, "estrategia"),
    ("paradas_medio", "Paradas do guloso por algoritmo de rota", "paradas",
     "paradas-algoritmos.svg", FILTRO_ALGORITMOS, "algoritmo"),
    ("taxa_inviavel", "Rotas sem recarga possivel por algoritmo", "fracao inviavel",
     "paradas-inviaveis.svg", FILTRO_ALGORITMOS, "algoritmo"),
]


# (coluna, distribuicao, titulo, subtitulo, rotulo, arquivo, log_y). Os dois
# primeiros sao os da tese: comparacoes nao dependem da maquina.
GRAFICOS_SELECAO = [
    ("comparacoes_medio", "adversaria", "Comparacoes na entrada adversaria",
     "0..n-1 ordenada, k = n-1. Em log-log, inclinacao 1 e O(n); inclinacao 2 e O(n²).",
     "comparacoes (escala log)", "selecao-comparacoes-adversaria.svg", True),
    ("comparacoes_por_n", "aleatoria", "Comparacoes por elemento na entrada aleatoria",
     "k = mediana. Linha reta = O(n); subindo com n = mais que linear.",
     "comparacoes / n", "selecao-comparacoes-por-n.svg", False),
    ("tempo_ms_medio", "aleatoria", "Tempo na entrada aleatoria",
     "Inteiros em [0, 10⁹), k = mediana. Menor tempo de cada seed, media das seeds.",
     "tempo em ms (escala log)", "selecao-tempo-aleatoria.svg", True),
    ("tempo_ms_medio", "niveis", "Tempo na populacao do jogo",
     "Niveis de 1 a 100, k = mediana. Menor tempo de cada seed, media das seeds.",
     "tempo em ms (escala log)", "selecao-tempo-niveis.svg", True),
    ("tempo_ms_medio", "adversaria", "Tempo na entrada adversaria",
     "0..n-1 ordenada, k = n-1. O ingenuo para quando passaria do orcamento.",
     "tempo em ms (escala log)", "selecao-tempo-adversaria.svg", True),
]


def gerar(saida: Path = SAIDA_PADRAO, estado="hp100") -> list[Path]:
    """Le os resumos ja gravados e escreve os SVGs ao lado deles."""
    gerados = []
    resumo_rotas = saida / "rotas_resumo.csv"
    if resumo_rotas.exists():
        linhas = ler_csv(resumo_rotas)
        for coluna, titulo, rotulo, arquivo in GRAFICOS_ROTAS:
            series = series_por_algoritmo(linhas, coluna, filtro={"estado": estado})
            if series:
                gerados.append(grafico_linhas(
                    f"{titulo} ({estado})", "tamanho do mapa", rotulo, series, saida / arquivo
                ))

    resumo_partidas = saida / "partidas_resumo.csv"
    if resumo_partidas.exists():
        linhas = ler_csv(resumo_partidas)
        for coluna, titulo, rotulo, arquivo in GRAFICOS_PARTIDAS:
            series = series_por_algoritmo(linhas, coluna)
            if series:
                gerados.append(grafico_linhas(
                    titulo, "tamanho do mapa", rotulo, series, saida / arquivo
                ))

    resumo_paradas = saida / "paradas_resumo.csv"
    if resumo_paradas.exists():
        linhas = ler_csv(resumo_paradas)
        for coluna, titulo, rotulo, arquivo, filtro, serie in GRAFICOS_PARADAS:
            series = series_por_algoritmo(linhas, coluna, filtro=filtro, serie=serie)
            series.pop("otimo", None)
            if series:
                gerados.append(grafico_linhas(
                    f"{titulo} (tanque medio)", "tamanho do mapa", rotulo, series,
                    saida / arquivo,
                ))

    resumo_selecao = saida / "selecao_resumo.csv"
    if resumo_selecao.exists():
        linhas = ler_csv(resumo_selecao)
        for coluna, distribuicao, titulo, subtitulo, rotulo, arquivo, log_y in GRAFICOS_SELECAO:
            series: dict[str, list] = {}
            for linha in linhas:
                if linha["distribuicao"] == distribuicao:
                    series.setdefault(linha["algoritmo"], []).append(
                        (int(linha["n"]), float(linha[coluna]))
                    )
            if series:
                gerados.append(grafico_log(
                    titulo, subtitulo, "n (tamanho da populacao, escala log)", rotulo,
                    series, saida / arquivo, log_y=log_y,
                ))
    return gerados


def main(argv=None):
    parser = argparse.ArgumentParser(description="Graficos do benchmark (fase 6)")
    parser.add_argument("--saida", type=Path, default=SAIDA_PADRAO)
    parser.add_argument("--estado", default="hp100", help="estado usado nos graficos de rota")
    args = parser.parse_args(argv)

    gerados = gerar(args.saida, args.estado)
    for caminho in gerados:
        print(f"grafico: {caminho}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
