"""Trabalho 3, fase 2: selecao por mediana das medianas, contra o oraculo sorted()."""
import random

import pytest

import ginasio
from dc import mediana_medianas as mm


def _algoritmos():
    rng = random.Random(1)
    return [
        ("mm", mm.selecionar),
        ("ingenuo", mm.quickselect_ingenuo),
        ("aleatorio", lambda v, k: mm.quickselect_aleatorio(v, k, rng)),
    ]


ALGS = _algoritmos()
ids = [nome for nome, _ in ALGS]


@pytest.mark.parametrize("nome,sel", ALGS, ids=ids)
@pytest.mark.parametrize("n", [1, 2, 5, 6, 25, 1001])
def test_contra_sorted_em_listas_aleatorias(nome, sel, n):
    rng = random.Random(n)
    v = [rng.randint(-1000, 1000) for _ in range(n)]
    ordenada = sorted(v)
    ks = range(n) if n <= 25 else [0, 1, n // 4, n // 2, n - 2, n - 1] + [rng.randrange(n) for _ in range(20)]
    for k in ks:
        assert sel(v, k) == ordenada[k]


@pytest.mark.parametrize("nome,sel", ALGS, ids=ids)
def test_muitos_repetidos_como_os_niveis_do_jogo(nome, sel):
    rng = random.Random(5)
    v = ginasio.gerar_populacao(rng, 3000)
    ordenada = sorted(v)
    for k in [0, 10, 1000, 1499, 1500, 2999] + [rng.randrange(3000) for _ in range(30)]:
        assert sel(v, k) == ordenada[k]


@pytest.mark.parametrize("nome,sel", ALGS, ids=ids)
def test_poucos_valores_distintos(nome, sel):
    rng = random.Random(6)
    v = [rng.choice([3, 7]) for _ in range(200)]
    ordenada = sorted(v)
    for k in range(0, 200, 7):
        assert sel(v, k) == ordenada[k]


@pytest.mark.parametrize("nome,sel", ALGS, ids=ids)
def test_todos_iguais(nome, sel):
    v = [42] * 500
    for k in [0, 249, 499]:
        assert sel(v, k) == 42


@pytest.mark.parametrize("nome,sel", ALGS, ids=ids)
@pytest.mark.parametrize("forma", ["ordenada", "reversa"])
def test_ordenada_e_reversa(nome, sel, forma):
    v = list(range(300))
    if forma == "reversa":
        v.reverse()
    for k in [0, 1, 150, 298, 299]:
        assert sel(v, k) == k


@pytest.mark.parametrize("nome,sel", ALGS, ids=ids)
def test_todos_os_k_de_listas_pequenas(nome, sel):
    rng = random.Random(9)
    for n in range(1, 16):
        for _ in range(5):
            v = [rng.randint(1, 6) for _ in range(n)]
            ordenada = sorted(v)
            assert [sel(v, k) for k in range(n)] == ordenada


@pytest.mark.parametrize("nome,sel", ALGS, ids=ids)
def test_k_invalido_falha_claro(nome, sel):
    with pytest.raises(IndexError):
        sel([], 0)
    with pytest.raises(IndexError):
        sel([1, 2, 3], 3)
    with pytest.raises(IndexError):
        sel([1, 2, 3], -1)
    with pytest.raises(TypeError):
        sel([1, 2, 3], 1.0)


@pytest.mark.parametrize("nome,sel", ALGS, ids=ids)
def test_nao_muta_a_entrada(nome, sel):
    rng = random.Random(3)
    v = [rng.randint(1, 100) for _ in range(777)]
    copia = list(v)
    sel(v, 400)
    assert v == copia


def test_entrada_de_um_milhao_nao_estoura_recursao():
    rng = random.Random(11)
    v = ginasio.gerar_populacao(rng, 1_000_000)
    assert mm.selecionar(v, 500_000) == sorted(v)[500_000]


@pytest.mark.parametrize("n", [50, 51, 99, 100, 500, 1001, 5000])
@pytest.mark.parametrize("distintos", [True, False])
def test_pivo_deixa_pelo_menos_3n_10_de_cada_lado(n, distintos):
    rng = random.Random(n)
    v = rng.sample(range(10 * n), n) if distintos else [rng.randint(1, 100) for _ in range(n)]
    pivo = mm.escolher_pivo_mm(v)
    # Garantia da prova: >= 3n/10 - 6 de cada lado (contando iguais ao pivo).
    assert sum(1 for x in v if x <= pivo) >= 3 * n / 10 - 6
    assert sum(1 for x in v if x >= pivo) >= 3 * n / 10 - 6


def test_pivo_em_entrada_adversaria_tambem_e_bom():
    v = mm.gerar_adversario_ingenuo(1000)
    pivo = mm.escolher_pivo_mm(v)
    assert 290 <= pivo <= 710


def _comparacoes(alg, n):
    c = mm.Contador()
    v = mm.gerar_adversario_ingenuo(n)
    assert alg(v, n - 1, contador=c) == n - 1
    return c.comparacoes


def test_ingenuo_e_quadratico_no_adversario():
    n = 400
    assert _comparacoes(mm.quickselect_ingenuo, n) == n * (n + 1) // 2 - 1  # a ultima rodada (1 elemento) nao compara
    razao = _comparacoes(mm.quickselect_ingenuo, 2 * n) / _comparacoes(mm.quickselect_ingenuo, n)
    assert razao > 3.5  # quadratico: perto de 4


def test_mediana_das_medianas_e_linear_no_adversario():
    razoes = []
    for n in (1000, 4000, 16000):
        razoes.append(_comparacoes(mm.selecionar, 2 * n) / _comparacoes(mm.selecionar, n))
    assert all(r < 2.5 for r in razoes), razoes  # linear: perto de 2
    assert _comparacoes(mm.selecionar, 16000) < 40 * 16000


def test_contador_nao_altera_o_resultado():
    rng = random.Random(2)
    v = [rng.randint(1, 100) for _ in range(500)]
    assert mm.selecionar(v, 123, contador=mm.Contador()) == mm.selecionar(v, 123)


def test_jogo_resultado_identico_ao_oraculo():
    rng = random.Random(4)
    pop = ginasio.gerar_populacao(rng, 2001)
    for p in (0.5, 0.7, 0.9):
        k = ginasio.indice_do_percentil(len(pop), p)
        assert mm.selecionar(pop, k) == ginasio.selecionar_oraculo(pop, k)


def test_default_do_lider_e_a_mediana_das_medianas():
    lider = ginasio.Lider("X", 0, (1, 1), 0.5, 3)
    assert lider.selecionar is mm.selecionar
