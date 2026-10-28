"""Trabalho 3, fase 1: level, ginasios, populacoes e Lider."""
import pytest

import ginasio
import grid as grid_mod
import models
from grid import Grid


def _foto(mapa):
    return [[(c.terrain, c.occupied_with) for c in linha] for linha in mapa.grid]


def test_level_default_e_1():
    assert models.Pokemon().level == 1
    assert models.generate_rand_pokemon().level == 1
    assert models.Pokemon(level=30).level == 30


def test_sem_flag_nao_ha_ginasio_nem_regiao():
    mapa = Grid(size=16, seed=7)
    assert mapa.regioes == []
    assert mapa.ginasios() == []


def test_sem_flag_grid_identico_ao_de_antes():
    # Gabarito: o grid antigo e o grid com a flag explicitamente desligada.
    # Fixa tambem uma amostra literal da seed 42 (geracao T1/T2).
    a = Grid(size=12, seed=42)
    b = Grid(size=12, seed=42, ginasios=False)
    assert _foto(a) == _foto(b)
    assert all(c.occupied_with != grid_mod.GINASIO for l in a.grid for c in l)


def test_com_flag_so_mudam_celulas_viram_ginasio():
    base = Grid(size=16, seed=3)
    com = Grid(size=16, seed=3, ginasios=True, regiao_lado=8, populacao_tamanho=50)
    gs = set(com.ginasios())
    assert gs
    for r in range(16):
        for c in range(16):
            if (r, c) in gs:
                assert base.grid[r][c].occupied_with == grid_mod.LIVRE
                assert com.grid[r][c].occupied_with == grid_mod.GINASIO
                assert com.grid[r][c].terrain == base.grid[r][c].terrain
            else:
                assert _foto(base)[r][c] == _foto(com)[r][c]


def test_determinismo_com_flag():
    a = Grid(size=16, seed=5, ginasios=True, populacao_tamanho=200)
    b = Grid(size=16, seed=5, ginasios=True, populacao_tamanho=200)
    assert _foto(a) == _foto(b)
    assert [r.populacao for r in a.regioes] == [r.populacao for r in b.regioes]
    assert [r.lider.time for r in a.regioes] == [r.lider.time for r in b.regioes]


def test_regioes_sao_blocos_com_um_ginasio_cada():
    mapa = Grid(size=20, seed=1, ginasios=True, regiao_lado=8, populacao_tamanho=10)
    assert len(mapa.regioes) == 9  # ceil(20/8)^2, blocos da borda menores
    for reg in mapa.regioes:
        if reg.lider:
            r, c = reg.lider.posicao
            assert reg.linhas[0] <= r < reg.linhas[1]
            assert reg.colunas[0] <= c < reg.colunas[1]
            assert mapa.grid[r][c].occupied_with == grid_mod.GINASIO
            assert mapa.grid[r][c].terrain != grid_mod.AGUA
            assert (r, c) != (0, 0)
    assert len(mapa.ginasios()) == sum(1 for r in mapa.regioes if r.lider)


@pytest.mark.parametrize("tamanho", [1, 7, 1000])
def test_tamanho_e_limites_da_populacao(tamanho):
    mapa = Grid(size=8, seed=2, ginasios=True, populacao_tamanho=tamanho)
    for reg in mapa.regioes:
        assert len(reg.populacao) == tamanho
        assert all(isinstance(n, int) for n in reg.populacao)
        assert all(ginasio.NIVEL_MIN <= n <= ginasio.NIVEL_MAX for n in reg.populacao)


def test_populacao_grande_e_so_ints():
    mapa = Grid(size=8, seed=2, ginasios=True, populacao_tamanho=10**6)
    assert len(mapa.regioes[0].populacao) == 10**6


def test_populacao_invalida():
    with pytest.raises(ValueError):
        Grid(size=8, seed=2, ginasios=True, populacao_tamanho=0)


def test_lider_usa_nivel_k_e_percentis_crescem():
    mapa = Grid(size=24, seed=9, ginasios=True, regiao_lado=8, populacao_tamanho=101)
    # etapa 4: os percentis sobem com a distancia da regiao ate a origem
    # (desempate pelo indice), nao mais na ordem de linha dos blocos
    com_lider = [r for r in mapa.regioes if r.lider]
    por_distancia = sorted(com_lider, key=lambda r: (ginasio._distancia_origem(r.linhas[0], r.colunas[0]), r.indice))
    lideres = [r.lider for r in por_distancia]
    assert lideres[0].percentil == ginasio.PERCENTIL_MIN
    assert [l.percentil for l in lideres] == sorted(l.percentil for l in lideres)
    assert [l.nome for l in lideres] == [f"Lider{i + 1}" for i in range(len(lideres))]
    for reg in mapa.regioes:
        if reg.lider:
            esperado = sorted(reg.populacao)[reg.lider.k]
            assert len(reg.lider.time) == ginasio.TAMANHO_TIME
            assert all(p.level == esperado for p in reg.lider.time)


def test_primeiro_lider_e_a_mediana_em_populacao_impar():
    mapa = Grid(size=8, seed=4, ginasios=True, populacao_tamanho=101)
    reg = mapa.regioes[0]
    assert reg.lider.k == 50
    assert reg.lider.time[0].level == sorted(reg.populacao)[50]


def test_lider_com_selecao_injetada():
    chamadas = []

    def falsa(niveis, k):
        chamadas.append((len(niveis), k))
        return 77

    lider = ginasio.Lider("X", 0, (1, 1), 0.5, 3, selecionar=falsa)
    import random
    time = lider.montar_time([1, 2, 3, 4, 5], random.Random(0), tamanho=2)
    assert chamadas == [(5, 3)]
    assert [p.level for p in time] == [77, 77]


def test_gerar_regioes_aceita_selecao_injetada():
    mapa = Grid(size=8, seed=4)
    regioes = ginasio.gerar_regioes(mapa, 8, 11, selecionar=lambda n, k: 42)
    assert all(p.level == 42 for p in regioes[0].lider.time)


def test_pisar_no_ginasio_nao_quebra_e_ele_continua(jogador, capsys):
    import game
    mapa = Grid(size=8, seed=4, ginasios=True, populacao_tamanho=11)
    r, c = mapa.ginasios()[0]
    # Teleporta ao lado e anda ate o G, forcando terreno sem custo de agua.
    mapa.grid[r][c].terrain = grid_mod.CONCRETO
    if c > 0:
        mapa.row_pos, mapa.col_pos, d = r, c - 1, "d"
    else:
        mapa.row_pos, mapa.col_pos, d = r, c + 1, "a"
    mov = game.mover(mapa, jogador, d)
    assert mov.valido and mov.posicao == (r, c)
    assert "construcao" in capsys.readouterr().out
    assert mapa.grid[r][c].occupied_with == grid_mod.GINASIO


def test_faixa_de_niveis_cresce_da_origem_ao_fundo():
    assert ginasio.faixa_de_niveis(0) == ginasio.NIVEIS_ORIGEM == (5, 30)
    assert ginasio.faixa_de_niveis(1) == ginasio.NIVEIS_FUNDO == (50, 100)
    meio = ginasio.faixa_de_niveis(0.5)
    assert 25 <= meio[0] <= 30 and 60 <= meio[1] <= 65
    pisos = [ginasio.faixa_de_niveis(t / 10)[0] for t in range(11)]
    assert pisos == sorted(pisos)


def test_populacao_da_regiao_cresce_com_a_distancia_da_origem():
    mapa = Grid(size=32, seed=3, ginasios=True, regiao_lado=8, populacao_tamanho=501)
    for reg in mapa.regioes:
        dist = ginasio._distancia_origem(reg.linhas[0], reg.colunas[0])
        t = dist / ginasio._distancia_origem(24, 24)
        piso, teto = ginasio.faixa_de_niveis(t)
        assert min(reg.populacao) >= piso and max(reg.populacao) <= teto
    origem = mapa.regioes[0]
    fundo = mapa.regioes[-1]
    assert max(origem.populacao) <= 30 and min(fundo.populacao) >= 50


def test_populacao_assimetrica_tem_mais_fracos_que_fortes():
    import random
    pop = ginasio.gerar_populacao(random.Random(1), 4000, 1, 100, assimetria=1.6)
    assert sum(n <= 50 for n in pop) > 0.6 * len(pop)
    uniforme = ginasio.gerar_populacao(random.Random(1), 4000, 1, 100)
    assert abs(sum(n <= 50 for n in uniforme) / 4000 - 0.5) < 0.05
