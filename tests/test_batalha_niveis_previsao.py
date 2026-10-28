"""Niveis por mediana das medianas e previsao de balanceamento."""
import copy
import random

import pytest

from batalha import niveis, previsao
from batalha.combatente import Combatente
from ginasio import indice_do_percentil
from grid import Grid
from models import Pokemon


@pytest.fixture(scope="module")
def mapa():
    return Grid(size=16, seed=5, ginasios=True, populacao_tamanho=501)


def _comb(nome="X", tipo="Fire", nivel=40, golpes=None):
    return Combatente.de_pokemon(Pokemon(
        name=f"{nome}-t", type_of_pokemon=tipo, moves=golpes or {"Bite": 1, "Fire-blast": 1},
        level=nivel))


class TestNiveis:
    @pytest.mark.parametrize("p", [0.0, 0.2, 0.37, 0.5, 0.7, 1.0])
    def test_nivel_no_percentil_bate_com_sorted(self, mapa, p):
        pop = mapa.regioes[1].populacao
        esperado = sorted(pop)[indice_do_percentil(len(pop), p)]
        assert niveis.nivel_no_percentil(pop, p) == esperado

    def test_usa_selecionar_e_nao_sorted(self, mapa, monkeypatch):
        chamadas = []

        def espiao(valores, k):
            chamadas.append((len(valores), k))
            return sorted(valores)[k]

        pop = mapa.regioes[0].populacao
        niveis.nivel_no_percentil(pop, 0.5, espiao)
        assert chamadas == [(501, 250)]

    def test_selvagem_percentil_na_faixa_e_nivel_coerente(self, mapa):
        reg = mapa.regioes[0]
        ordenada = sorted(reg.populacao)
        rng = random.Random(9)
        for _ in range(200):
            c, p, nivel = niveis.montar_selvagem(reg, rng)
            assert niveis.FAIXA_SELVAGEM[0] <= p <= niveis.FAIXA_SELVAGEM[1]
            assert nivel == ordenada[indice_do_percentil(len(ordenada), p)]
            assert c.nivel == nivel == c.pokemon.level

    def test_selvagem_determinismo_por_rng(self, mapa):
        a = niveis.montar_selvagem(mapa.regioes[0], random.Random(3))
        b = niveis.montar_selvagem(mapa.regioes[0], random.Random(3))
        assert (a[0].especie, a[1], a[2]) == (b[0].especie, b[1], b[2])

    def test_treinador_percentil_fixo_por_seed_e_posicao(self, mapa):
        reg = mapa.regioes[0]
        a = niveis.montar_treinador(reg, 5, (3, 4))
        niveis.montar_treinador(reg, 5, (1, 1))     # visitar outro nao muda o primeiro
        b = niveis.montar_treinador(reg, 5, (3, 4))
        assert (a[0], a[2], a[3]) == (b[0], b[2], b[3])
        assert [c.especie for c in a[1]] == [c.especie for c in b[1]]
        assert a[2] == niveis.percentil_treinador(5, (3, 4))

    def test_treinador_percentil_na_faixa_e_varia_entre_celulas(self):
        ps = {niveis.percentil_treinador(5, (r, c)) for r in range(8) for c in range(8)}
        assert all(niveis.FAIXA_TREINADOR[0] <= p <= niveis.FAIXA_TREINADOR[1] for p in ps)
        assert len(ps) > 30

    def test_treinador_nivel_vem_da_populacao_da_regiao(self, mapa):
        reg = mapa.regioes[2]
        nome, time, p, nivel = niveis.montar_treinador(reg, 5, (2, 9))
        assert nivel == sorted(reg.populacao)[indice_do_percentil(len(reg.populacao), p)]
        assert len(time) == niveis.TAMANHO_TIME_TREINADOR
        assert all(c.nivel == nivel for c in time)

    def test_regiao_da_celula_cobre_o_mapa_inteiro(self, mapa):
        for r in range(mapa.size):
            for c in range(mapa.size):
                reg = niveis.regiao_da_celula(mapa, r, c)
                assert reg.linhas[0] <= r < reg.linhas[1] and reg.colunas[0] <= c < reg.colunas[1]

    def test_time_do_lider_tem_o_nivel_do_lider(self, mapa):
        for reg in mapa.regioes:
            if reg.lider:
                time = niveis.montar_time_lider(reg.lider)
                assert {c.nivel for c in time} == {reg.lider.time[0].level}
                assert all(c.hp == c.hp_max for c in time)


class TestPrevisao:
    def test_percentis_batem_com_sorted_em_amostra(self):
        rng = random.Random(2)
        for n in (1, 2, 7, 100, 1001):
            valores = [rng.randint(0, 50) for _ in range(n)]
            ordenado = sorted(valores)
            esperado = {nome: ordenado[indice_do_percentil(n, p)] for nome, p in previsao.PERCENTIS}
            assert previsao.percentis(valores) == esperado

    def test_percentis_vazio(self):
        assert previsao.percentis([]) is None

    def test_prever_usa_selecionar(self):
        chamadas = []

        def espiao(valores, k):
            chamadas.append(len(valores))
            return sorted(valores)[k]

        previsao.prever([_comb(nivel=60)], [_comb("Y", nivel=30)], "treinador", n=50,
                        selecionar_fn=espiao)
        assert chamadas and set(chamadas) == {50}

    def test_vantagem_enorme_ganha_sempre_e_desvantagem_enorme_perde(self):
        forte = [_comb(nivel=80, tipo="Water", golpes={"Hydropump": 1, "Bite": 1})]
        fraco = [_comb("Y", nivel=10, tipo="Fire")]
        r = previsao.prever(forte, fraco, "selvagem", n=100)
        assert r["vitoria"] == 1.0 and r["hp_restante"]["p50"] > 0.5
        r = previsao.prever(fraco, forte, "selvagem", n=100)
        assert r["vitoria"] == 0.0
        assert r["hp_restante"] == {"p10": 0.0, "p50": 0.0, "p90": 0.0}
        assert r["hp_restante_vitorias"] is None

    def test_forma_do_resultado(self):
        r = previsao.prever([_comb()], [_comb("Y")], "treinador", n=40)
        assert set(r) == {"n", "vitoria", "hp_restante", "hp_restante_vitorias", "turnos", "tempo_ms"}
        assert r["n"] == 40 and 0.0 <= r["vitoria"] <= 1.0
        for chave in ("hp_restante", "turnos"):
            assert set(r[chave]) == {"p10", "p50", "p90"}
            assert r[chave]["p10"] <= r[chave]["p50"] <= r[chave]["p90"]
        assert all(0.0 <= v <= 1.0 for v in r["hp_restante"].values())

    def test_determinismo_por_seed(self):
        a = previsao.prever([_comb()], [_comb("Y")], "lider", n=60, seed=4)
        b = previsao.prever([_comb()], [_comb("Y")], "lider", n=60, seed=4)
        a.pop("tempo_ms"), b.pop("tempo_ms")
        assert a == b

    def test_nao_altera_os_combatentes(self):
        eq, op = [_comb()], [_comb("Y")]
        antes = copy.deepcopy([(c.hp, c.xp, [g.pp for g in c.golpes]) for c in eq + op])
        previsao.prever(eq, op, "treinador", n=30)
        assert antes == [(c.hp, c.xp, [g.pp for g in c.golpes]) for c in eq + op]

    def test_n1000_com_time_de_3_cabe_em_um_segundo(self, mapa):
        reg = next(r for r in mapa.regioes if r.lider)
        eq = [_comb("A", "Water", 60, {"Hydropump": 1, "Bite": 1}),
              _comb("B", "Psychic", 60, {"Mind-beam": 1, "Psychic-slam": 1}),
              _comb("C", "Normal", 60, {"Body-slam": 1, "Slap": 1})]
        r = previsao.prever(eq, niveis.montar_time_lider(reg.lider), "lider")
        assert r["n"] == 1000
        assert r["tempo_ms"] < 1000

    def test_n_invalido(self):
        with pytest.raises(ValueError):
            previsao.prever([_comb()], [_comb()], "selvagem", n=0)


class TestTreinadorPerto:
    def test_colado_na_origem_leva_um_pokemon_so(self, mapa):
        reg = mapa.regioes[0]
        _, perto, _, _ = niveis.montar_treinador(reg, 3, (1, 1), t=0.1)
        _, longe, _, _ = niveis.montar_treinador(reg, 3, (1, 1), t=0.6)
        _, sem_t, _, _ = niveis.montar_treinador(reg, 3, (1, 1))
        assert len(perto) == 1 and len(longe) == 2 and len(sem_t) == 2

    def test_faixa_de_percentil_sobe_com_a_distancia(self):
        rng = random.Random(5)
        perto = [niveis.percentil_selvagem(rng, 0.0) for _ in range(200)]
        longe = [niveis.percentil_selvagem(rng, 1.0) for _ in range(200)]
        assert max(perto) <= niveis.FAIXA_SELVAGEM_PERTO[1] and min(longe) >= niveis.FAIXA_SELVAGEM_LONGE[0]
