"""Motor de batalha (trabalho 3): tipos, stats, formula de dano, XP.

Os casos de dano foram conferidos a mao (a conta esta no comentario).
"""
import random

import pytest

from batalha import dano as dano_mod
from batalha.combatente import Combatente, especie_de, tipo_de, xp_do_nivel
from batalha.combatente import Golpe
from batalha.tipos import FIRE, NORMAL, PSYCHIC, ROCK, TABELA, TIPOS, WATER, multiplicador
from models import Pokemon


def _poke(nome="Charmander-x", tipo="Fire", golpes=None, nivel=50):
    return Pokemon(name=nome, type_of_pokemon=tipo,
                   moves=golpes or {"Bite": 20, "Fire-blast": 25}, level=nivel)


class TestTipos:
    def test_tabela_cobre_todos_os_pares_com_valores_validos(self):
        for atk in TIPOS:
            for dfs in TIPOS:
                assert TABELA[atk][dfs] in (0.5, 1.0, 2.0)

    @pytest.mark.parametrize("atk,dfs,esperado", [
        (WATER, FIRE, 2.0), (WATER, ROCK, 2.0), (WATER, WATER, 0.5),
        (FIRE, WATER, 0.5), (FIRE, FIRE, 0.5), (FIRE, PSYCHIC, 2.0),
        (ROCK, FIRE, 2.0), (NORMAL, ROCK, 0.5), (NORMAL, FIRE, 1.0),
        (PSYCHIC, PSYCHIC, 0.5), (PSYCHIC, NORMAL, 1.0),
    ])
    def test_pares_conhecidos(self, atk, dfs, esperado):
        assert multiplicador(atk, dfs) == esperado

    def test_tipo_desconhecido_vale_normal(self):
        assert multiplicador("Electric", ROCK) == 0.5
        assert multiplicador(WATER, "Electric") == 1.0


class TestStats:
    def test_stats_de_charmander_nivel_50(self):
        # HP: 2*39*50//100 = 39, + 50 + 10 = 99. Ataque: 2*52*50//100 = 52, + 5 = 57.
        # Velocidade: 2*65*50//100 = 65, + 5 = 70. Defesa: 2*43*50//100 = 43, + 5 = 48.
        c = Combatente.de_pokemon(_poke(nivel=50))
        assert (c.hp_max, c.hp, c.ataque, c.defesa, c.velocidade) == (99, 99, 57, 48, 70)

    def test_stats_nivel_1(self):
        # HP: 2*39*1//100 = 0, + 1 + 10 = 11.
        c = Combatente.de_pokemon(_poke(nivel=1))
        assert c.hp_max == 11

    def test_especie_e_tipo_dos_dois_formatos_do_modelo(self):
        # generate_rand_pokemon: especie em type_of_pokemon, tipo em nature.
        antigo = Pokemon("fuego", "female", "Charzard", "Fire", {"Claw": 15})
        assert (especie_de(antigo), tipo_de(antigo)) == ("Charzard", FIRE)
        # Lider: tipo em type_of_pokemon, especie no nome.
        novo = Pokemon(name="Squirtle-Lider1-1", type_of_pokemon="Water")
        assert (especie_de(novo), tipo_de(novo)) == ("Squirtle", WATER)

    def test_golpes_ate_quatro_e_ficha_do_catalogo(self):
        p = _poke(golpes={"Bite": 1, "Claw": 1, "Slap": 1, "Flamethrower": 1, "Hydropump": 1})
        c = Combatente.de_pokemon(p)
        assert len(c.golpes) == 4
        flame = next(g for g in c.golpes if g.nome == "Flamethrower")
        assert (flame.tipo, flame.poder, flame.precisao, flame.pp) == (FIRE, 90, 100, 15)

    def test_golpe_fora_do_catalogo_vira_normal_com_o_valor_antigo(self):
        c = Combatente.de_pokemon(_poke(golpes={"Inventado": 33}))
        g = c.golpes[0]
        assert (g.tipo, g.poder, g.precisao, g.pp) == (NORMAL, 33, 100, 20)


def _atacante(nivel=50, ataque=100, tipo=PSYCHIC):
    c = Combatente.de_pokemon(_poke(nivel=nivel))
    c.ataque, c.tipo = ataque, tipo
    return c


def _alvo(defesa=100, tipo=NORMAL):
    c = Combatente.de_pokemon(_poke(nivel=50))
    c.defesa, c.tipo = defesa, tipo
    return c


class TestDano:
    G = Golpe("Teste", NORMAL, 40, 100, 10, 10)

    def test_base_conferida_a_mao(self):
        # (2*50//5 + 2) = 22; 22*40*100//100 = 880; 880//50 = 17; + 2 = 19.
        assert dano_mod.dano_base(50, 40, 100, 100) == 19
        assert dano_mod.calcular_dano(_atacante(), self.G, _alvo()) == 19

    def test_stab(self):
        # 19 * 1.5 = 28.5 -> 28
        g = Golpe("Teste", FIRE, 40, 100, 10, 10)
        assert dano_mod.calcular_dano(_atacante(tipo=FIRE), g, _alvo(tipo=NORMAL)) == 28

    def test_super_efetivo_e_pouco_efetivo(self):
        g = Golpe("Teste", WATER, 40, 100, 10, 10)
        assert dano_mod.calcular_dano(_atacante(), g, _alvo(tipo=FIRE)) == 38     # 19 * 2
        assert dano_mod.calcular_dano(_atacante(), g, _alvo(tipo=WATER)) == 9     # 19 * 0.5 = 9.5

    def test_stab_mais_super_efetivo(self):
        g = Golpe("Teste", WATER, 40, 100, 10, 10)
        assert dano_mod.calcular_dano(_atacante(tipo=WATER), g, _alvo(tipo=ROCK)) == 57  # 19 * 3

    def test_critico_e_variacao(self):
        assert dano_mod.calcular_dano(_atacante(), self.G, _alvo(), critico=True) == 28   # 19 * 1.5
        assert dano_mod.calcular_dano(_atacante(), self.G, _alvo(), variacao=0.85) == 16  # 16.15

    def test_ataque_e_defesa_entram_na_razao(self):
        # (22*40*200//100) = 1760; //50 = 35; + 2 = 37
        assert dano_mod.dano_base(50, 40, 200, 100) == 37
        # 22*40*100//200 = 440; //50 = 8; + 2 = 10
        assert dano_mod.dano_base(50, 40, 100, 200) == 10

    def test_dano_minimo_e_1(self):
        g = Golpe("Fraco", NORMAL, 1, 100, 10, 10)
        assert dano_mod.calcular_dano(_atacante(nivel=1, ataque=1), g, _alvo(defesa=500, tipo=ROCK)) >= 1

    def test_esperado_bate_com_a_media_de_muitos_sorteios(self):
        rng = random.Random(7)
        atk, alvo = _atacante(), _alvo(tipo=FIRE)
        g = Golpe("Agua", WATER, 80, 90, 10, 10)
        total, n = 0, 40000
        for _ in range(n):
            acertou, crit, var = dano_mod.sortear_ataque(rng, g)
            if acertou:
                total += dano_mod.calcular_dano(atk, g, alvo, crit, var)
        assert total / n == pytest.approx(dano_mod.dano_esperado(atk, g, alvo), rel=0.03)

    def test_precisao_100_nunca_erra_e_precisao_baixa_erra(self):
        rng = random.Random(1)
        sempre = Golpe("a", NORMAL, 40, 100, 1, 1)
        raro = Golpe("b", NORMAL, 40, 10, 1, 1)
        assert all(dano_mod.sortear_ataque(rng, sempre)[0] for _ in range(500))
        acertos = sum(dano_mod.sortear_ataque(rng, raro)[0] for _ in range(2000))
        assert 100 < acertos < 300

    def test_frequencia_de_critico_perto_de_1_16(self):
        rng = random.Random(3)
        g = Golpe("a", NORMAL, 40, 100, 1, 1)
        crits = sum(dano_mod.sortear_ataque(rng, g)[1] for _ in range(32000))
        assert crits / 32000 == pytest.approx(1 / 16, abs=0.006)


class TestXp:
    def test_curva_cubica(self):
        assert xp_do_nivel(20) == 8000
        assert xp_do_nivel(21) == 9261

    def test_sobe_de_nivel_e_ganha_hp(self):
        c = Combatente.de_pokemon(_poke(nivel=20))
        c.hp = c.hp_max - 5
        hp_max_antes = c.hp_max
        antes, depois = c.ganhar_xp(9261 - 8000)
        assert (antes, depois) == (20, 21)
        assert c.pokemon.level == 21
        assert c.hp_max > hp_max_antes
        assert c.hp == c.hp_max - 5   # ganha a diferenca do HP maximo

    def test_pode_subir_varios_niveis_de_uma_vez(self):
        c = Combatente.de_pokemon(_poke(nivel=10))
        antes, depois = c.ganhar_xp(xp_do_nivel(14) - c.xp)
        assert (antes, depois) == (10, 14)

    def test_xp_insuficiente_nao_sobe(self):
        c = Combatente.de_pokemon(_poke(nivel=10))
        assert c.ganhar_xp(10) == (10, 10)

    def test_teto_no_nivel_100(self):
        c = Combatente.de_pokemon(_poke(nivel=100))
        assert c.ganhar_xp(10 ** 9) == (100, 100)

    def test_desmaiado_nao_ganha_hp_ao_subir(self):
        c = Combatente.de_pokemon(_poke(nivel=20))
        c.hp = 0
        c.ganhar_xp(2000)
        assert c.hp == 0
