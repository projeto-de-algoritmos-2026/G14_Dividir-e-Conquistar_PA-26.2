"""Motor de batalha: turno, ordem, PP, mochila, captura, fuga, XP e CPU."""
import random

import pytest

from batalha import cpu as cpu_mod
from batalha.combatente import Combatente
from batalha.motor import (AGUARDANDO, FIM, TROCA_FORCADA, AcaoInvalida, Batalha,
                           chance_captura, chance_fuga, xp_por_derrota)
from models import Pokemon


def comb(nome="A", tipo="Normal", nivel=30, hp=100, atk=60, dfs=60, vel=50,
         golpes=None):
    p = Pokemon(name=nome, type_of_pokemon=tipo,
                moves=golpes if golpes is not None else {"Slap": 40, "Body-slam": 85}, level=nivel)
    c = Combatente.de_pokemon(p)
    c.hp = c.hp_max = hp
    c.ataque, c.defesa, c.velocidade = atk, dfs, vel
    return c


class RngFalso:
    """random() devolve a sequencia dada (depois 0.5); uniform sempre o teto."""

    def __init__(self, valores=()):
        self.valores = list(valores)
        self._real = random.Random(0)

    def random(self):
        return self.valores.pop(0) if self.valores else 0.5

    def uniform(self, a, b):
        return b

    def choices(self, populacao, weights=None, k=1):
        return self._real.choices(populacao, weights=weights, k=k)


def batalha(tipo="selvagem", equipe=None, oponentes=None, rng=None, mochila=None, **kw):
    return Batalha(tipo, equipe or [comb("Eu")], oponentes or [comb("Ele")],
                   rng or random.Random(1), mochila if mochila is not None else
                   {"potion": 2, "pokeball": 2}, **kw)


def tipos(eventos):
    return [e["tipo"] for e in eventos]


class TestOrdem:
    def test_mais_rapido_age_primeiro(self):
        b = batalha(equipe=[comb("Eu", vel=90)], oponentes=[comb("Ele", vel=10)])
        ev = b.agir("lutar", golpe=0)
        golpes = [e for e in ev if e["tipo"] == "golpe"]
        assert [g["quem"] for g in golpes] == ["jogador", "oponente"]

    def test_mais_lento_age_depois(self):
        b = batalha(equipe=[comb("Eu", vel=10)], oponentes=[comb("Ele", vel=90)])
        ev = b.agir("lutar", golpe=0)
        golpes = [e for e in ev if e["tipo"] == "golpe"]
        assert [g["quem"] for g in golpes] == ["oponente", "jogador"]

    def test_empate_e_sorteado_e_os_dois_resultados_aparecem(self):
        primeiros = set()
        for seed in range(40):
            b = batalha(equipe=[comb("Eu", vel=50)], oponentes=[comb("Ele", vel=50)],
                        rng=random.Random(seed))
            ev = b.agir("lutar", golpe=0)
            primeiros.add(next(e["quem"] for e in ev if e["tipo"] in ("golpe", "errou")))
        assert primeiros == {"jogador", "oponente"}

    def test_empate_com_rng_fixo(self):
        # random() < 0.5 -> jogador primeiro; 0.9 -> oponente primeiro
        b = batalha(rng=RngFalso([0.1]), equipe=[comb(vel=50)], oponentes=[comb(vel=50)])
        assert b.agir("lutar", golpe=0)[0]["quem"] == "jogador"
        b = batalha(rng=RngFalso([0.9]), equipe=[comb(vel=50)], oponentes=[comb(vel=50)])
        assert b.agir("lutar", golpe=0)[0]["quem"] == "oponente"

    def test_derrubado_antes_perde_a_vez(self):
        eu = comb("Eu", vel=90, atk=500)
        ele = comb("Ele", vel=10, hp=5, golpes={"Slap": 40})
        b = batalha("treinador", equipe=[eu], oponentes=[ele, comb("Ele2")])
        ev = b.agir("lutar", golpe=1)
        assert [e["quem"] for e in ev if e["tipo"] == "golpe"] == ["jogador"]
        assert "desmaio" in tipos(ev)


class TestDanoNoMotor:
    def test_evento_de_golpe_tem_o_contrato(self):
        b = batalha(rng=RngFalso(), equipe=[comb("Eu", vel=90)], oponentes=[comb("Ele", vel=1)])
        e = b.agir("lutar", golpe=0)[0]
        assert {"tipo", "quem", "golpe", "efetividade", "critico", "dano",
                "hp_antes", "hp_depois"} <= set(e)
        assert e["hp_antes"] - e["hp_depois"] == e["dano"]

    def test_valor_conferido_a_mao(self):
        # nivel 30, Slap poder 40, atk 60, def 60, tipo Normal x Normal (sem STAB:
        # atacante e Normal e o golpe e Normal, entao STAB 1.5).
        # base = (2*30//5 + 2) = 14; 14*40*60//60 = 560; 560//50 = 11; +2 = 13.
        # STAB: 13 * 1.5 = 19.5; variacao do RngFalso = 1.0 -> 19.
        b = batalha(rng=RngFalso(), equipe=[comb("Eu", vel=90)], oponentes=[comb("Ele", vel=1)])
        e = b.agir("lutar", golpe=0)[0]
        assert e["dano"] == 19 and e["efetividade"] == 1.0 and e["critico"] is False

    def test_golpe_que_erra_nao_causa_dano(self):
        # precisao 80 (Hydropump) com random() = 0.99 -> 99 >= 80 erra
        eu = comb("Eu", vel=90, golpes={"Hydropump": 1})
        b = batalha(rng=RngFalso([0.99]), equipe=[eu], oponentes=[comb("Ele", vel=1)])
        ev = b.agir("lutar", golpe=0)
        assert ev[0]["tipo"] == "errou"
        assert b.inimigo.hp == b.inimigo.hp_max


class TestPP:
    def test_pp_cai_um_por_uso(self):
        b = batalha()
        b.agir("lutar", golpe=0)
        assert b.jogador.golpes[0].pp == b.jogador.golpes[0].pp_max - 1

    def test_golpe_sem_pp_e_recusado_sem_gastar_turno(self):
        b = batalha()
        b.jogador.golpes[0].pp = 0
        with pytest.raises(AcaoInvalida):
            b.agir("lutar", golpe=0)
        assert b.turno == 0

    def test_indice_invalido(self):
        with pytest.raises(AcaoInvalida):
            batalha().agir("lutar", golpe=7)

    def test_esforco_quando_todos_os_pp_acabaram(self):
        eu = comb("Eu", hp=100, vel=90)
        for g in eu.golpes:
            g.pp = 0
        b = batalha(rng=RngFalso(), equipe=[eu], oponentes=[comb("Ele", hp=900, vel=1)])
        ev = b.agir("lutar", golpe=None)
        assert ev[0]["golpe"] == "Esforco"
        recuo = next(e for e in ev if e["tipo"] == "recuo")
        assert recuo["dano"] == 25 and recuo["hp_depois"] == 75     # 1/4 de 100
        assert all(g.pp == 0 for g in eu.golpes)

    def test_recuo_nao_derruba(self):
        eu = comb("Eu", hp=100, vel=90)
        eu.hp = 10
        for g in eu.golpes:
            g.pp = 0
        b = batalha(rng=RngFalso(), equipe=[eu], oponentes=[comb("Ele", hp=900, vel=1)])
        ev = b.agir("lutar", golpe=None)
        recuo = next(e for e in ev if e["tipo"] == "recuo")
        assert recuo["hp_depois"] == 1 and recuo["dano"] == 9   # 1/4 seria 25


class TestMochila:
    def test_pocao_cura_e_gasta_o_turno(self):
        eu = comb("Eu", hp=100)
        eu.hp = 30
        b = batalha(equipe=[eu], rng=RngFalso())
        ev = b.agir("mochila", item="pocao")
        assert ev[0]["tipo"] == "pocao" and ev[0]["cura"] == 40
        assert b.mochila["potion"] == 1
        assert any(e["tipo"] in ("golpe", "errou") and e["quem"] == "oponente" for e in ev)

    def test_pocao_nao_passa_do_maximo(self):
        eu = comb("Eu", hp=100)
        eu.hp = 90
        b = batalha(equipe=[eu], oponentes=[comb("Ele", atk=1)], rng=RngFalso())
        assert b.agir("mochila", item="pocao")[0]["cura"] == 10

    def test_pocao_com_hp_cheio_ou_sem_estoque_recusa(self):
        b = batalha()
        with pytest.raises(AcaoInvalida):
            b.agir("mochila", item="pocao")
        eu = comb("Eu")
        eu.hp = 10
        b = batalha(equipe=[eu], mochila={})
        with pytest.raises(AcaoInvalida):
            b.agir("mochila", item="pocao")

    def test_pokebola_so_contra_selvagem(self):
        b = batalha("treinador")
        with pytest.raises(AcaoInvalida):
            b.agir("mochila", item="pokebola")

    def test_item_desconhecido(self):
        with pytest.raises(AcaoInvalida):
            batalha().agir("mochila", item="bicicleta")


class TestCaptura:
    def test_chance_cresce_com_hp_baixo(self):
        assert chance_captura(100, 100) == pytest.approx(0.15)
        assert chance_captura(50, 100) == pytest.approx(0.475)
        assert chance_captura(0, 100) == pytest.approx(0.80)
        assert chance_captura(10, 100) > chance_captura(90, 100)

    def test_sucesso_adiciona_ao_time_e_encerra(self):
        b = batalha(rng=RngFalso([0.01]))
        alvo = b.inimigo
        ev = b.agir("mochila", item="pokebola")
        assert ev[0] == {"tipo": "captura", "sucesso": True, "balancadas": 3,
                         "pokemon": alvo.nome, "chance": 0.15}
        assert ev[-1] == {"tipo": "fim", "resultado": "captura"}
        assert alvo in b.equipe and b.estado == FIM and b.mochila["pokeball"] == 1

    def test_falha_conta_balancadas_e_a_cpu_ataca(self):
        # p = 0.15, r = 0.3 -> int(3 * 0.15 / 0.3) = 1 balancada
        b = batalha(rng=RngFalso([0.3]))
        ev = b.agir("mochila", item="pokebola")
        assert ev[0]["sucesso"] is False and ev[0]["balancadas"] == 1
        assert ev[1]["quem"] == "oponente"
        assert b.estado == AGUARDANDO

    def test_balancadas_na_falha_ficam_entre_0_e_2(self):
        for r in (0.1501, 0.2, 0.5, 0.99):
            b = batalha(rng=RngFalso([r]))
            assert 0 <= b.agir("mochila", item="pokebola")[0]["balancadas"] <= 2

    def test_frequencia_bate_com_a_chance(self):
        n, ok = 4000, 0
        for seed in range(n):
            b = batalha(rng=random.Random(seed))
            b.inimigo.hp = 50     # chance 0.475
            ok += b.agir("mochila", item="pokebola")[0]["sucesso"]
        assert ok / n == pytest.approx(0.475, abs=0.03)


class TestFuga:
    def test_chance_por_velocidade(self):
        assert chance_fuga(50, 50, 0) == pytest.approx(0.5)
        assert chance_fuga(100, 50, 0) == 1.0
        assert chance_fuga(25, 50, 0) == pytest.approx(0.25)
        assert chance_fuga(25, 50, 2) == pytest.approx(0.45)   # +0.1 por tentativa

    def test_sucesso_encerra_com_fuga(self):
        b = batalha(rng=RngFalso([0.1]))
        ev = b.agir("fugir")
        assert ev[0]["sucesso"] is True and ev[-1] == {"tipo": "fim", "resultado": "fuga"}
        assert b.resultado == "fuga"

    def test_falha_leva_ataque_e_sobe_a_chance(self):
        b = batalha(rng=RngFalso([0.9]))
        ev = b.agir("fugir")
        assert ev[0]["sucesso"] is False and ev[1]["quem"] == "oponente"
        assert b.tentativas_fuga == 1

    @pytest.mark.parametrize("tipo", ["treinador", "lider"])
    def test_nao_foge_de_treinador_nem_lider(self, tipo):
        b = batalha(tipo)
        assert "fugir" not in b.acoes_validas()
        with pytest.raises(AcaoInvalida):
            b.agir("fugir")


class TestTroca:
    def test_troca_gasta_o_turno_e_a_cpu_ataca(self):
        b = batalha(equipe=[comb("A"), comb("B")], rng=RngFalso())
        ev = b.agir("pokemon", alvo=1)
        assert ev[0]["tipo"] == "troca" and ev[0]["para"] == "B" and ev[0]["forcada"] is False
        assert ev[1]["quem"] == "oponente" and b.ativo == 1

    def test_troca_para_o_mesmo_ou_desmaiado_recusa(self):
        eq = [comb("A"), comb("B")]
        eq[1].hp = 0
        b = batalha(equipe=eq)
        with pytest.raises(AcaoInvalida):
            b.agir("pokemon", alvo=0)
        with pytest.raises(AcaoInvalida):
            b.agir("pokemon", alvo=1)

    def test_desmaio_forca_troca_que_nao_gasta_turno(self):
        a = comb("A", hp=1, vel=1)
        b2 = comb("B")
        forte = comb("Ele", vel=99, atk=400)
        b = batalha(equipe=[a, b2], oponentes=[forte], rng=RngFalso())
        ev = b.agir("lutar", golpe=0)
        assert b.estado == TROCA_FORCADA and "desmaio" in tipos(ev)
        assert b.acoes_validas() == ["pokemon"]
        with pytest.raises(AcaoInvalida):
            b.agir("lutar", golpe=0)
        turno = b.turno
        hp_ele = forte.hp
        ev = b.agir("pokemon", alvo=1)
        assert ev == [{"tipo": "troca", "quem": "jogador", "de": "A", "para": "B",
                       "indice": 1, "forcada": True}]
        assert b.turno == turno and forte.hp == hp_ele and b.estado == AGUARDANDO

    def test_sem_vivos_e_derrota(self):
        a = comb("A", hp=1, vel=1)
        forte = comb("Ele", vel=99, atk=400)
        b = batalha("treinador", equipe=[a], oponentes=[forte], rng=RngFalso())
        ev = b.agir("lutar", golpe=0)
        assert ev[-1] == {"tipo": "fim", "resultado": "derrota"}
        assert b.estado == FIM
        with pytest.raises(AcaoInvalida):
            b.agir("lutar", golpe=0)


class TestRecompensas:
    def _vencer(self, tipo, nivel_inimigo):
        eu = comb("Eu", nivel=30, vel=99, atk=999)
        ele = comb("Ele", nivel=nivel_inimigo, hp=1, vel=1)
        b = batalha(tipo, equipe=[eu], oponentes=[ele], rng=RngFalso())
        return b, b.agir("lutar", golpe=1)

    def test_xp_selvagem(self):
        b, ev = self._vencer("selvagem", 35)
        xp = next(e for e in ev if e["tipo"] == "xp")
        assert xp["ganho"] == 64 * 35 // 7 == xp_por_derrota(35, "selvagem") == 320
        assert b.dinheiro_ganho == 0 and "dinheiro" not in tipos(ev)

    def test_xp_e_dinheiro_de_treinador_e_lider(self):
        b, ev = self._vencer("treinador", 35)
        assert next(e for e in ev if e["tipo"] == "xp")["ganho"] == 480     # 320 * 1.5
        assert b.dinheiro_ganho == 3500
        b, ev = self._vencer("lider", 35)
        assert b.dinheiro_ganho == 10500
        assert tipos(ev)[-2:] == ["dinheiro", "fim"]

    def test_sobe_de_nivel_no_evento(self):
        eu = comb("Eu", nivel=30, vel=99, atk=999)
        eu.xp = 30 ** 3
        ele = comb("Ele", nivel=60, hp=1, vel=1)
        b = batalha(equipe=[eu], oponentes=[ele], rng=RngFalso())
        xp = next(e for e in b.agir("lutar", golpe=1) if e["tipo"] == "xp")
        # 64 * 60 // 7 = 548; 27000 + 548 = 27548 < 31**3 = 29791: nao sobe
        assert (xp["nivel_antes"], xp["nivel_depois"]) == (30, 30)
        eu2 = comb("Eu", nivel=30, vel=99, atk=999)
        eu2.xp = 31 ** 3 - 10
        ele2 = comb("Ele", nivel=60, hp=1, vel=1)
        b = batalha(equipe=[eu2], oponentes=[ele2], rng=RngFalso())
        xp = next(e for e in b.agir("lutar", golpe=1) if e["tipo"] == "xp")
        assert (xp["nivel_antes"], xp["nivel_depois"]) == (30, 31)
        assert eu2.pokemon.level == 31

    def test_sem_recompensas_nao_da_xp_nem_dinheiro(self):
        eu = comb("Eu", nivel=30, vel=99, atk=999)
        b = batalha("lider", equipe=[eu], oponentes=[comb("Ele", hp=1, vel=1)],
                    rng=RngFalso(), recompensas=False)
        ev = b.agir("lutar", golpe=1)
        assert "xp" not in tipos(ev) and b.dinheiro_ganho == 0 and eu.xp == 30 ** 3


class TestDeterminismo:
    def _rodar(self, seed):
        eu = [comb("A", tipo="Water", nivel=30, golpes={"Hydropump": 1, "Bite": 1}),
              comb("B", tipo="Fire", nivel=30, golpes={"Flamethrower": 1, "Claw": 1})]
        ele = [comb("X", tipo="Rock", nivel=32, hp=140, golpes={"Rock-throw": 1, "Slap": 1}),
               comb("Y", tipo="Psychic", nivel=32, hp=140, golpes={"Mind-beam": 1, "Slap": 1})]
        b = Batalha("treinador", eu, ele, random.Random(seed), {"potion": 2, "pokeball": 0})
        todos = []
        for _ in range(200):
            if b.estado == FIM:
                break
            if b.estado == TROCA_FORCADA:
                vivo = next(i for i, c in enumerate(b.equipe) if c.vivo)
                todos += b.agir("pokemon", alvo=vivo)
            else:
                usaveis = b.jogador.golpes_usaveis()
                todos += b.agir("lutar", golpe=usaveis[0] if usaveis else None)
        return todos, b

    def test_mesma_seed_mesma_batalha(self):
        a, _ = self._rodar(5)
        b, _ = self._rodar(5)
        assert a == b

    def test_seeds_diferentes_divergem(self):
        assert self._rodar(1)[0] != self._rodar(2)[0]

    @pytest.mark.parametrize("seed", range(15))
    def test_toda_batalha_termina(self, seed):
        _, b = self._rodar(seed)
        assert b.estado == FIM and b.resultado in ("vitoria", "derrota")


class TestCpu:
    def test_golpe_do_lider_e_o_de_maior_dano_esperado(self):
        atk = comb("L", tipo="Water", golpes={"Hydropump": 1, "Bite": 1, "Claw": 1, "Slap": 1})
        alvo = comb("J", tipo="Fire")
        danos = [cpu_mod.dano_esperado(atk, g, alvo) for g in atk.golpes]
        esperado = danos.index(sorted(danos)[-1])
        assert cpu_mod.escolher_golpe(atk, alvo, random.Random(0), "lider") == esperado

    def test_golpe_ignora_os_sem_pp(self):
        atk = comb("L", tipo="Water", golpes={"Hydropump": 1, "Bite": 1})
        atk.golpes[0].pp = 0
        assert cpu_mod.escolher_golpe(atk, comb("J"), random.Random(0), "lider") == 1
        atk.golpes[1].pp = 0
        assert cpu_mod.escolher_golpe(atk, comb("J"), random.Random(0), "lider") is None

    def test_golpe_comum_e_ponderado_pelo_dano(self):
        atk = comb("L", tipo="Water", golpes={"Hydropump": 1, "Slap": 1})
        alvo = comb("J", tipo="Fire")
        rng = random.Random(4)
        cont = [0, 0]
        for _ in range(4000):
            cont[cpu_mod.escolher_golpe(atk, alvo, rng, "comum")] += 1
        d = [cpu_mod.dano_esperado(atk, g, alvo) for g in atk.golpes]
        assert cont[0] / 4000 == pytest.approx(d[0] / sum(d), abs=0.03)
        assert cont[1] > 0

    def _time_e_alvo(self, seed=0):
        rng = random.Random(seed)
        tipos_ = ["Fire", "Water", "Rock", "Psychic", "Normal"]
        golpes = [{"Flamethrower": 1}, {"Hydropump": 1}, {"Rock-throw": 1},
                  {"Mind-beam": 1}, {"Slap": 1}]
        time = []
        for i in range(7):
            j = rng.randrange(5)
            time.append(comb(f"C{i}", tipo=tipos_[j], nivel=rng.randint(10, 60),
                             hp=rng.randint(30, 200), golpes=golpes[j]))
        return time, comb("J", tipo=rng.choice(tipos_), hp=rng.randint(30, 200))

    @pytest.mark.parametrize("seed", range(12))
    def test_proximo_e_o_k_esimo_por_vantagem_contra_o_oraculo(self, seed):
        time, alvo = self._time_e_alvo(seed)
        pontos = sorted(cpu_mod.vantagem(c, alvo) for c in time)
        comum = cpu_mod.escolher_proximo(time, alvo, "comum")
        lider = cpu_mod.escolher_proximo(time, alvo, "lider")
        assert cpu_mod.vantagem(comum, alvo) == pontos[(len(time) - 1) // 2]   # mediana
        assert cpu_mod.vantagem(lider, alvo) == pontos[-1]                      # topo

    def test_proximo_usa_selecionar_com_k_certo(self, monkeypatch):
        chamadas = []
        real = cpu_mod.selecionar

        def espiao(valores, k, *a, **kw):
            chamadas.append((len(valores), k))
            return real(valores, k, *a, **kw)

        monkeypatch.setattr(cpu_mod, "selecionar", espiao)
        time, alvo = self._time_e_alvo(3)
        cpu_mod.escolher_proximo(time, alvo, "comum")
        cpu_mod.escolher_proximo(time, alvo, "lider")
        ultimas = [c for c in chamadas if c[0] == 7]
        assert ultimas[-2:] == [(7, 3), (7, 6)]

    def test_lider_manda_o_melhor_no_lugar_do_caido(self):
        time = [comb("Primeiro", hp=1, vel=1),
                comb("Mal", tipo="Fire", golpes={"Slap": 1}),
                comb("Bom", tipo="Water", golpes={"Hydropump": 1})]
        j = comb("J", tipo="Fire", vel=99, atk=999, golpes={"Slap": 1})
        b = Batalha("lider", [j], time, RngFalso(), {})
        ev = b.agir("lutar", golpe=0)
        troca = next(e for e in ev if e["tipo"] == "troca" and e["quem"] == "oponente")
        assert troca["para"] == "Bom"      # agua vence fogo: maior vantagem


class TestResumo:
    def test_formato(self):
        b = batalha("treinador", equipe=[comb("A"), comb("B")], oponentes=[comb("X"), comb("Y")])
        r = b.resumo()
        assert r["estado"] == AGUARDANDO and r["acoes_validas"] == ["lutar", "mochila", "pokemon"]
        assert r["oponente"]["restantes"] == 2 and r["oponente"]["tamanho_time"] == 2
        assert [t["nome"] for t in r["jogador"]["time"]] == ["A", "B"]
        assert r["jogador"]["time"][0]["ativo"] is True
        assert r["jogador"]["mochila"] == {"pocao": 2, "pokebola": 2}
        assert {"indice", "nome", "tipo", "poder", "precisao", "pp", "pp_max"} <= set(r["jogador"]["golpes"][0])
