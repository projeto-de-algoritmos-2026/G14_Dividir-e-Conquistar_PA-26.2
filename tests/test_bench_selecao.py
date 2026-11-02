"""Testes do benchmark da selecao (trabalho 3).

Grade minuscula de proposito: o que precisa ser garantido e o contrato (uma
linha por algoritmo, resposta conferida contra o oraculo, descarte registrado
em vez de sumido, graficos gerados), nao o tempo da grade real.
"""

import pytest

from bench import charts, common, selecao


@pytest.fixture(scope="module")
def grade():
    return selecao.rodar(tamanhos=(200, 600), seeds=2, repeticoes=1, orcamento_s=60)


def test_uma_linha_por_algoritmo_seed_tamanho_e_distribuicao(grade):
    linhas, descartes = grade

    assert descartes == []
    esperado = len(selecao.DISTRIBUICOES) * 2 * 2 * len(selecao.ALGORITMOS_SELECAO)
    assert len(linhas) == esperado
    assert set(linha["algoritmo"] for linha in linhas) == set(selecao.ALGORITMOS_SELECAO)


def test_todas_as_respostas_batem_com_o_oraculo(grade):
    linhas, _ = grade

    assert all(linha["correto"] == 1 for linha in linhas)


def test_adversaria_reproduz_o_pior_caso_do_ingenuo(grade):
    """0..n-1 com k = n-1: o pivo-primeiro descarta um por rodada e faz
    n + (n-1) + ... + 2 = n(n+1)/2 - 1 comparacoes."""
    linhas, _ = grade

    for linha in linhas:
        if linha["distribuicao"] == "adversaria" and linha["algoritmo"] == "quickselect_ingenuo":
            n = linha["n"]
            assert linha["k"] == n - 1
            assert linha["comparacoes"] == n * (n + 1) // 2 - 1


def test_mediana_das_medianas_fica_linear_na_adversaria(grade):
    """Por elemento, a mediana das medianas nao cresce com n na adversaria,
    enquanto o ingenuo cresce proporcional a n."""
    linhas, _ = grade
    por_n = {
        (linha["algoritmo"], linha["n"]): linha["comparacoes_por_n"]
        for linha in linhas if linha["distribuicao"] == "adversaria"
    }

    assert por_n[("mediana_medianas", 600)] < 2 * por_n[("mediana_medianas", 200)]
    assert por_n[("quickselect_ingenuo", 600)] > 2.5 * por_n[("quickselect_ingenuo", 200)]


def test_orcamento_descarta_e_registra_em_vez_de_sumir():
    linhas, descartes = selecao.rodar(tamanhos=(300, 3000), seeds=1, repeticoes=1,
                                      orcamento_s=1e-9, distribuicoes=("adversaria",))

    assert {linha["n"] for linha in linhas} == {300}
    assert {d["algoritmo"] for d in descartes} == set(selecao.ALGORITMOS_SELECAO)
    assert all(d["n"] == 3000 and d["tempo_estimado_s"] >= 0 for d in descartes)


def test_entradas_sao_reproduziveis_e_do_dominio_certo():
    assert selecao.gerar_entrada("aleatoria", 50, 3) == selecao.gerar_entrada("aleatoria", 50, 3)
    niveis, k = selecao.gerar_entrada("niveis", 101, 0)
    assert k == 50 and all(1 <= nivel <= selecao.NIVEL_MAX for nivel in niveis)
    assert selecao.gerar_entrada("adversaria", 5, 9) == ([0, 1, 2, 3, 4], 4)
    with pytest.raises(ValueError):
        selecao.gerar_entrada("inexistente", 5, 0)


def test_resumo_e_graficos(grade, tmp_path):
    linhas, descartes = grade
    resumo = selecao.resumir(linhas)

    assert len(resumo) == len(selecao.DISTRIBUICOES) * 2 * len(selecao.ALGORITMOS_SELECAO)
    assert all(linha["execucoes"] == 2 for linha in resumo)

    common.escrever_csv(tmp_path / "selecao_resumo.csv", selecao.CAMPOS_RESUMO, resumo)
    gerados = charts.gerar(tmp_path)

    nomes = {caminho.name for caminho in gerados}
    assert nomes == {arquivo for *_, arquivo, _ in charts.GRAFICOS_SELECAO}
    assert all(caminho.read_text(encoding="utf-8").startswith("<svg") for caminho in gerados)


def test_potencia_formata_os_rotulos_do_eixo():
    assert charts._potencia(1000) == "10³"
    assert charts._potencia(300_000) == "3·10⁵"
    assert charts._potencia(0.01) == "10⁻²"
