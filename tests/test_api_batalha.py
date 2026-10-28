"""Rotas /api/t3/*: jogo com ginasios e batalha turno a turno.

Funcoes de webdemo/api_batalha.py direto, e a casca HTTP por socket de verdade.
"""
import http.client
import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

import game
import grid as grid_mod
from batalha.combatente import Combatente
from models import Pokemon
from webdemo import api, api_batalha, server
from webdemo.api_batalha import ErroApi

SEED, SIZE = 5, 16


@pytest.fixture
def jogo():
    dados = api_batalha.criar_jogo(SIZE, SEED)
    return dados["sessao"], api_batalha._sessoes[dados["sessao"]], dados


def colocar_ao_lado(sessao, conteudo, posicao=(5, 5)):
    """Poe `conteudo` em `posicao` e o jogador na casa a esquerda. Devolve a direcao."""
    mapa = sessao["mapa"]
    r, c = posicao
    for rr, cc in ((r, c - 1), (r, c)):
        mapa.grid[rr][cc].terrain = grid_mod.CONCRETO
    mapa.grid[r][c - 1].occupied_with = grid_mod.LIVRE
    mapa.grid[r][c].occupied_with = conteudo
    mapa.row_pos, mapa.col_pos = r, c - 1
    return "D"


def fortalecer(sessao, nivel=100, quantos=3):
    equipe = sessao["equipe"]
    equipe.clear()
    sessao["player"].pokemon_list.clear()
    for i, (esp, tipo, golpes) in enumerate([("Miaupsi", "Psychic", {"Mind-beam": 1, "Psychic-slam": 1}),
                                             ("Squirtuga", "Water", {"Hydropump": 1, "Bite": 1}),
                                             ("Sonolax", "Normal", {"Body-slam": 1, "Slap": 1})][:quantos]):
        p = Pokemon(name=f"{esp}-forte", type_of_pokemon=tipo, moves=golpes, level=nivel)
        sessao["player"].pokemon_list.append(p)
        equipe.append(Combatente.de_pokemon(p))


def jogar_ate_o_fim(batalha_id, limite=300):
    todos = []
    for _ in range(limite):
        r = api_batalha.estado_batalha(batalha_id)["estado"]
        if r["estado"] == "fim":
            return todos, r
        if r["estado"] == "troca_forcada":
            vivo = next(t["indice"] for t in r["jogador"]["time"] if t["vivo"])
            res = api_batalha.batalha_acao(batalha_id, "pokemon", alvo=vivo)
        else:
            golpe = next((g["indice"] for g in r["jogador"]["golpes"] if g["pp"] > 0), None)
            res = api_batalha.batalha_acao(batalha_id, "lutar", golpe=golpe)
        todos += res["eventos"]
    raise AssertionError("batalha nao terminou")


class TestMapa:
    def test_celula_de_ginasio_traz_conteudo_e_dados_do_lider(self, jogo):
        _, sessao, dados = jogo
        gs = dados["ginasios"]
        assert gs
        for g in gs:
            celula = dados["celulas"][g["posicao"][0]][g["posicao"][1]]
            assert celula["conteudo"] == "ginasio"
            assert set(celula["ginasio"]) == {"lider", "regiao", "percentil", "nivel_time"}
            assert celula["ginasio"]["nivel_time"] >= 1 and 0.5 <= celula["ginasio"]["percentil"] <= 0.9 + 1e-9

    def test_so_a_celula_de_ginasio_tem_o_campo(self, jogo):
        _, _, dados = jogo
        com_campo = sum("ginasio" in c for linha in dados["celulas"] for c in linha)
        assert com_campo == len(dados["ginasios"])

    def test_demais_chaves_da_celula_sao_as_do_t2(self, jogo):
        _, _, dados = jogo
        base = {"terreno", "conteudo", "pisavel_sem_surf", "pisavel_com_surf"}
        assert all(base <= set(c) for linha in dados["celulas"] for c in linha)

    def test_nivel_do_ginasio_e_o_do_time_do_lider(self, jogo):
        _, sessao, dados = jogo
        for g in dados["ginasios"]:
            reg = sessao["mapa"].regioes[g["regiao"]]
            assert g["nivel_time"] == reg.lider.time[0].level


class TestT2Intacto:
    def test_conteudo_do_t2_nao_ganhou_ginasio(self):
        assert grid_mod.GINASIO not in api.CONTEUDO

    def test_jogo_t2_continua_sem_ginasio(self):
        from webdemo import api_greedy
        dados = api_greedy.criar_jogo(16, SEED)
        assert all("ginasio" not in c for linha in dados["celulas"] for c in linha)
        assert all(c["conteudo"] != "ginasio" for linha in dados["celulas"] for c in linha)
        assert set(dados["celulas"][0][0]) == {"terreno", "conteudo", "pisavel_sem_surf",
                                               "pisavel_com_surf"}

    def test_mover_antigo_ainda_resolve_a_batalha(self):
        mapa = grid_mod.Grid(size=6, seed=1)
        mapa.grid[0][1].occupied_with = grid_mod.POKEMON
        mapa.grid[0][1].terrain = grid_mod.CONCRETO
        from bench.partidas import novo_jogador
        from bench.common import silencioso
        jogador = novo_jogador()
        with silencioso():
            mov = game.mover(mapa, jogador, "D", automatico=True)
        assert mov.batalhou and mov.encontro == ""
        assert mapa.grid[0][1].occupied_with == grid_mod.VISITADO


class TestMover:
    @pytest.mark.parametrize("conteudo,tipo", [(grid_mod.POKEMON, "selvagem"),
                                              (grid_mod.CPU, "treinador"),
                                              (grid_mod.GINASIO, "lider")])
    def test_encontro_sinalizado_sem_resolver(self, jogo, conteudo, tipo):
        sid, sessao, _ = jogo
        if conteudo == grid_mod.GINASIO:
            pos = sessao["mapa"].ginasios()[0]
            direcao = colocar_ao_lado(sessao, grid_mod.GINASIO, pos if pos[1] > 0 else (5, 5))
            pos = pos if pos[1] > 0 else (5, 5)
        else:
            pos = (5, 5)
            direcao = colocar_ao_lado(sessao, conteudo, pos)
        res = api_batalha.mover_jogo(sid, direcao)
        assert res["valido"] and res["encontro"]["tipo"] == tipo
        assert res["encontro"]["posicao"] == list(pos)
        assert "regiao" in res["encontro"]
        assert sessao["mapa"].celula(*pos).occupied_with == conteudo   # nao consumida
        assert sessao["player"].pokemon_list[0].level == api_batalha.NIVEL_INICIAL_PADRAO == 8            # nada de batalha oculta

    def test_encontro_de_lider_traz_os_dados_do_ginasio(self, jogo):
        sid, sessao, _ = jogo
        pos = next(p for p in sessao["mapa"].ginasios() if p[1] > 0)
        res = api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.GINASIO, pos))
        assert {"lider", "regiao", "percentil", "nivel_time"} <= set(res["encontro"])

    def test_nao_anda_com_batalha_pendente(self, jogo):
        sid, sessao, _ = jogo
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON))
        with pytest.raises(ErroApi) as e:
            api_batalha.mover_jogo(sid, "D")
        assert e.value.status == 409

    def test_movimento_comum_sem_encontro(self, jogo):
        sid, sessao, _ = jogo
        d = colocar_ao_lado(sessao, grid_mod.LIVRE)
        res = api_batalha.mover_jogo(sid, d)
        assert res["valido"] and res["encontro"] is None

    def test_centro_cura_o_time(self, jogo):
        sid, sessao, _ = jogo
        sessao["equipe"][0].hp = 1
        res = api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.CENTRO))
        assert res["em_centro"] and res["curou"]
        assert sessao["equipe"][0].hp == sessao["equipe"][0].hp_max

    def test_sessao_desconhecida(self):
        with pytest.raises(ErroApi) as e:
            api_batalha.mover_jogo("nao-existe", "D")
        assert e.value.status == 404


class TestBatalha:
    def _selvagem(self, jogo):
        sid, sessao, _ = jogo
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON))
        return sid, sessao, api_batalha.batalha_nova(sid, "selvagem")

    def test_nova_traz_estado_e_previsao(self, jogo):
        _, _, b = self._selvagem(jogo)
        assert b["estado"] == "aguardando_acao" and b["tipo"] == "selvagem"
        assert b["acoes_validas"] == ["lutar", "mochila", "fugir"]   # time de 1: sem troca
        assert b["previsao"]["n"] == 1000
        assert {"vitoria", "hp_restante", "turnos"} <= set(b["previsao"])
        assert 1 <= b["adversario"]["nivel"] <= 100
        assert api_batalha.niveis.FAIXA_SELVAGEM[0] <= b["adversario"]["percentil"] <= api_batalha.niveis.FAIXA_SELVAGEM[1]

    def test_nova_sem_encontro_ou_com_tipo_errado(self, jogo):
        sid, sessao, _ = jogo
        with pytest.raises(ErroApi) as e:
            api_batalha.batalha_nova(sid, "selvagem")
        assert e.value.status == 409
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON))
        with pytest.raises(ErroApi) as e:
            api_batalha.batalha_nova(sid, "lider")
        assert e.value.status == 409

    def test_nao_abre_duas_batalhas(self, jogo):
        sid, _, _ = self._selvagem(jogo)
        with pytest.raises(ErroApi) as e:
            api_batalha.batalha_nova(sid, "selvagem")
        assert e.value.status == 409

    def test_acao_devolve_eventos_ordenados_e_estado(self, jogo):
        _, _, b = self._selvagem(jogo)
        res = api_batalha.batalha_acao(b["batalha_id"], "lutar", golpe=0)
        assert set(res) == {"batalha_id", "eventos", "estado", "jogo"}
        ev = res["eventos"]
        assert ev and all("tipo" in e for e in ev)
        golpes = [e for e in ev if e["tipo"] == "golpe"]
        for g in golpes:
            assert {"quem", "golpe", "efetividade", "critico", "dano", "hp_antes", "hp_depois"} <= set(g)
        assert res["estado"]["turno"] == 1

    def test_erros_de_acao(self, jogo):
        _, _, b = self._selvagem(jogo)
        bid = b["batalha_id"]
        for kw in ({"acao": "dancar"}, {"acao": "lutar", "golpe": 9},
                   {"acao": "mochila", "item": "pokebola_dourada"}):
            with pytest.raises(ErroApi) as e:
                api_batalha.batalha_acao(bid, **kw)
            assert e.value.status == 400
        with pytest.raises(ErroApi) as e:
            api_batalha.batalha_acao("nao-existe", "lutar", golpe=0)
        assert e.value.status == 404

    def test_vitoria_consome_a_celula_e_libera_o_mapa(self, jogo):
        sid, sessao, b = self._selvagem(jogo)
        fortalecer(sessao)
        # o selvagem ja foi montado contra o time antigo; basta jogar
        eventos, final = jogar_ate_o_fim(b["batalha_id"])
        assert final["resultado"] == "vitoria"
        tipos = [e["tipo"] for e in eventos]
        assert "xp" in tipos and tipos[-1] == "fim"
        assert sessao["mapa"].celula(5, 5).occupied_with == grid_mod.VISITADO
        assert sessao["encontro"] is None and sessao["batalha_id"] is None
        assert api_batalha.mover_jogo(sid, "A")["valido"]

    def test_acao_depois_do_fim_e_recusada(self, jogo):
        sid, sessao, b = self._selvagem(jogo)
        fortalecer(sessao)
        jogar_ate_o_fim(b["batalha_id"])
        with pytest.raises(ErroApi) as e:
            api_batalha.batalha_acao(b["batalha_id"], "lutar", golpe=0)
        assert e.value.status == 400

    def test_treinador_paga_dinheiro(self, jogo):
        sid, sessao, _ = jogo
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.CPU))
        b = api_batalha.batalha_nova(sid, "treinador")
        assert b["oponente"]["tamanho_time"] == 2 and "fugir" not in b["acoes_validas"]
        fortalecer(sessao)
        dinheiro = sessao["player"].money
        _, final = jogar_ate_o_fim(b["batalha_id"])
        assert final["resultado"] == "vitoria"
        assert sessao["player"].money == dinheiro + 100 * b["adversario"]["nivel"]

    def test_captura_sincroniza_o_modelo_antigo(self, jogo):
        sid, sessao, b = self._selvagem(jogo)
        bid = b["batalha_id"]
        api_batalha._batalhas[bid]["batalha"].inimigo.hp = 1     # chance alta de captura
        for _ in range(5):
            res = api_batalha.batalha_acao(bid, "mochila", item="pokebola")
            if res["estado"]["estado"] == "fim":
                break
        cap = [e for e in res["eventos"] if e["tipo"] == "captura"]
        assert cap and set(cap[0]) >= {"sucesso", "balancadas"}
        if res["estado"]["resultado"] == "captura":
            assert len(sessao["player"].pokemon_list) == 2 == len(sessao["equipe"])

    def test_derrota_nao_encerra_e_volta_a_origem_sem_centro(self):
        dados = api_batalha.criar_jogo(SIZE, SEED, nivel_inicial=1)
        sid = dados["sessao"]
        sessao = api_batalha._sessoes[sid]
        pos = next(p for p in sessao["mapa"].ginasios() if p[1] > 0)
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.GINASIO, pos))
        b = api_batalha.batalha_nova(sid, "lider")
        assert b["previsao"]["vitoria"] == 0.0
        dinheiro = sessao["player"].money
        _, final = jogar_ate_o_fim(b["batalha_id"])
        assert final["resultado"] == "derrota"
        # o jogo segue: volta pra origem, time curado, metade do dinheiro
        assert sessao["situacao"] == "jogando"
        assert sessao["mapa"].posicao == (0, 0)
        assert all(c.hp == c.hp_max for c in sessao["equipe"])
        assert sessao["player"].money == dinheiro - dinheiro // 2
        ud = api_batalha.estado_jogo(sid)["jogador"]["ultima_derrota"]
        assert ud == {"n": 1, "para": [0, 0], "local": "origem", "adversario": "lider",
                      "dinheiro_perdido": dinheiro // 2, "dinheiro": sessao["player"].money}
        assert api_batalha.estado_jogo(sid)["jogador"]["derrotas"] == 1
        # o lider continua la e a sessao aceita andar de novo
        assert sessao["mapa"].celula(*pos).occupied_with == grid_mod.GINASIO
        assert sessao["encontro"] is None and sessao["batalha_id"] is None
        assert api_batalha.mover_jogo(sid, "D")["valido"] in (True, False)

    def test_derrota_volta_ao_ultimo_centro_visitado(self):
        dados = api_batalha.criar_jogo(SIZE, SEED, nivel_inicial=1)
        sid = dados["sessao"]
        sessao = api_batalha._sessoes[sid]
        res = api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.CENTRO, (3, 4)))
        assert res["em_centro"] and sessao["ultimo_centro"] == (3, 4)
        pos = next(p for p in sessao["mapa"].ginasios() if p[1] > 0)
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.GINASIO, pos))
        b = api_batalha.batalha_nova(sid, "lider")
        jogar_ate_o_fim(b["batalha_id"])
        assert sessao["mapa"].posicao == (3, 4)
        ud = api_batalha.estado_jogo(sid)["jogador"]["ultima_derrota"]
        assert ud["local"] == "centro" and ud["para"] == [3, 4]

    def test_segunda_derrota_conta_e_o_dinheiro_cai_de_novo(self):
        dados = api_batalha.criar_jogo(SIZE, SEED, nivel_inicial=1)
        sid = dados["sessao"]
        sessao = api_batalha._sessoes[sid]
        pos = next(p for p in sessao["mapa"].ginasios() if p[1] > 0)
        for _ in range(2):
            api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.GINASIO, pos))
            jogar_ate_o_fim(api_batalha.batalha_nova(sid, "lider")["batalha_id"])
        assert sessao["derrotas"] == 2 and sessao["player"].money == 10000 // 4

    def test_derrotar_o_lider_marca_o_ginasio_e_ele_vira_so_predio(self):
        dados = api_batalha.criar_jogo(SIZE, SEED)
        sid = dados["sessao"]
        sessao = api_batalha._sessoes[sid]
        pos = next(p for p in sessao["mapa"].ginasios() if p[1] > 0)
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.GINASIO, pos))
        b = api_batalha.batalha_nova(sid, "lider")
        fortalecer(sessao)
        _, final = jogar_ate_o_fim(b["batalha_id"])
        assert final["resultado"] == "vitoria"
        assert sessao["lideres_derrotados"] == {
            api_batalha.niveis.regiao_da_celula(sessao["mapa"], *pos).indice}
        assert sessao["mapa"].celula(*pos).occupied_with == grid_mod.GINASIO   # predio fica
        # voltar nele nao reabre a luta
        sessao["mapa"].row_pos, sessao["mapa"].col_pos = pos[0], pos[1] - 1
        res = api_batalha.mover_jogo(sid, "D")
        assert res["encontro"] is None and res["ginasio_ja_vencido"] is True

    def test_vitoria_do_jogo_quando_todos_os_lideres_caem(self):
        dados = api_batalha.criar_jogo(SIZE, SEED)
        sid = dados["sessao"]
        sessao = api_batalha._sessoes[sid]
        alvos = [p for p in sessao["mapa"].ginasios() if p[1] > 0]
        outros = {r.indice for r in sessao["mapa"].regioes if r.lider} - {
            api_batalha.niveis.regiao_da_celula(sessao["mapa"], *alvos[0]).indice}
        sessao["lideres_derrotados"] |= outros     # os demais ja caíram
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.GINASIO, alvos[0]))
        b = api_batalha.batalha_nova(sid, "lider")
        fortalecer(sessao)
        jogar_ate_o_fim(b["batalha_id"])
        assert sessao["situacao"] == "vitoria"

    def test_mesma_seed_mesmos_eventos(self):
        def rodar():
            dados = api_batalha.criar_jogo(SIZE, SEED)
            sid = dados["sessao"]
            sessao = api_batalha._sessoes[sid]
            api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON))
            b = api_batalha.batalha_nova(sid, "selvagem")
            previsao = {k: v for k, v in b["previsao"].items() if k != "tempo_ms"}
            eventos, _ = jogar_ate_o_fim(b["batalha_id"])
            return b["adversario"], previsao, eventos
        assert rodar() == rodar()


@pytest.fixture(scope="module")
def base():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Manipulador)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    httpd.server_close()


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.status, json.loads(r.read())


def post(url, corpo):
    req = urllib.request.Request(url, data=json.dumps(corpo).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


class TestHttp:
    def test_fluxo_completo_por_http(self, base):
        status, novo = get(f"{base}/api/t3/jogo/novo?size=16&seed=5")
        assert status == 200 and novo["ginasios"]
        sid = novo["sessao"]
        sessao = api_batalha._sessoes[sid]
        direcao = colocar_ao_lado(sessao, grid_mod.POKEMON)
        status, mov = get(f"{base}/api/t3/jogo/mover?sessao={sid}&direcao={direcao}")
        assert status == 200 and mov["encontro"]["tipo"] == "selvagem"
        status, b = post(f"{base}/api/t3/batalha/nova", {"sessao": sid, "tipo": "selvagem"})
        assert status == 200 and b["previsao"]["n"] == 1000
        status, r = post(f"{base}/api/t3/batalha/acao", {"batalha_id": b["batalha_id"],
                                                         "acao": "lutar", "golpe": 0})
        assert status == 200 and isinstance(r["eventos"], list)
        status, e = get(f"{base}/api/t3/batalha/estado?batalha_id={b['batalha_id']}")
        assert status == 200 and e["estado"]["turno"] == 1

    def test_erros_http(self, base):
        assert post(f"{base}/api/t3/batalha/nova", {"sessao": "x", "tipo": "selvagem"})[0] == 404
        assert post(f"{base}/api/t3/batalha/acao", {"batalha_id": "x", "acao": "lutar"})[0] == 404
        assert post(f"{base}/api/t3/rota-que-nao-existe", {})[0] == 404
        req = urllib.request.Request(f"{base}/api/t3/batalha/nova", data=b"{nao e json",
                                     method="POST")
        with pytest.raises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(req, timeout=10)
        assert e.value.code == 400
        with pytest.raises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(f"{base}/api/t3/jogo/estado?sessao=x", timeout=10)
        assert e.value.code == 404

    def test_acao_invalida_e_400(self, base):
        _, novo = get(f"{base}/api/t3/jogo/novo?size=16&seed=5")
        sid = novo["sessao"]
        d = colocar_ao_lado(api_batalha._sessoes[sid], grid_mod.POKEMON)
        get(f"{base}/api/t3/jogo/mover?sessao={sid}&direcao={d}")
        _, b = post(f"{base}/api/t3/batalha/nova", {"sessao": sid, "tipo": "selvagem"})
        status, r = post(f"{base}/api/t3/batalha/acao", {"batalha_id": b["batalha_id"],
                                                         "acao": "mochila", "item": "pocao"})
        assert status == 400 and "HP" in r["erro"]

    def test_rotas_t2_respondem_igual(self, base):
        status, dados = get(f"{base}/api/t2/jogo/novo?size=8&seed=3")
        assert status == 200 and "sessao" in dados
        assert all(c["conteudo"] != "ginasio" for linha in dados["celulas"] for c in linha)
        status, cfg = get(f"{base}/api/t2/config")
        assert status == 200 and "estrategias" in cfg


# ---------------- etapa 4: contrato aditivo, trocas e subida de nivel reais ----------------

# Seed e celula em que o primeiro selvagem pode ser capturado dentro de 14 turnos pelo
# fluxo `capturar_segundo` abaixo (golpe 0 ate o HP dele baixar de 35%, depois pokebola).
# Na seed 2 do mapa 12x12: o inicial e um Sonolax, o capturado e um Miaupsi nivel 5.
SEED_CAPTURA, TAMANHO_CAPTURA, CELULA_CAPTURA = 2, 12, (1, 3)


def capturar_segundo(seed=SEED_CAPTURA, size=TAMANHO_CAPTURA, pos=CELULA_CAPTURA):
    dados = api_batalha.criar_jogo(size, seed)
    sid = dados["sessao"]
    sessao = api_batalha._sessoes[sid]
    api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON, pos))
    b = api_batalha.batalha_nova(sid, "selvagem", previsao_n=50)
    est = b
    for _ in range(14):
        o = est["oponente"]["ativo"]
        if o["hp"] / o["hp_max"] > 0.35:
            r = api_batalha.batalha_acao(b["batalha_id"], "lutar", golpe=0)
        else:
            r = api_batalha.batalha_acao(b["batalha_id"], "mochila", item="pokebola")
        est = r["estado"]
        if est["estado"] == "fim":
            break
    return sid, sessao, est


class TestContratoAditivo:
    def test_golpe_e_errou_trazem_tipo_golpe(self):
        dados = api_batalha.criar_jogo(SIZE, SEED)
        sid = dados["sessao"]
        sessao = api_batalha._sessoes[sid]
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON))
        b = api_batalha.batalha_nova(sid, "selvagem", previsao_n=20)
        eventos, _ = jogar_ate_o_fim(b["batalha_id"])
        com_golpe = [e for e in eventos if e["tipo"] in ("golpe", "errou")]
        assert com_golpe
        from batalha.tipos import TIPOS
        assert all(e["tipo_golpe"] in TIPOS for e in com_golpe)
        # o tipo bate com o do golpe no estado do jogador
        meus = {g["nome"]: g["tipo"] for g in b["jogador"]["golpes"]}
        assert all(e["tipo_golpe"] == meus[e["golpe"]] for e in com_golpe if e["quem"] == "jogador")

    def test_estado_traz_xp_nivel_atual_e_proximo(self):
        dados = api_batalha.criar_jogo(SIZE, SEED)
        sid = dados["sessao"]
        sessao = api_batalha._sessoes[sid]
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON))
        b = api_batalha.batalha_nova(sid, "selvagem", previsao_n=20)
        ativo = b["jogador"]["ativo"]
        assert ativo["nivel"] == 8
        assert ativo["xp"] == ativo["xp_nivel_atual"] == 8 ** 3
        assert ativo["xp_proximo_nivel"] == 9 ** 3

    def test_nivel_maximo_nao_tem_proximo(self):
        dados = api_batalha.criar_jogo(SIZE, SEED, nivel_inicial=100)
        sid = dados["sessao"]
        sessao = api_batalha._sessoes[sid]
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON))
        ativo = api_batalha.batalha_nova(sid, "selvagem", previsao_n=20)["jogador"]["ativo"]
        assert ativo["xp_nivel_atual"] == 100 ** 3 and ativo["xp_proximo_nivel"] is None


class TestSubidaDeNivelReal:
    def test_xp_de_batalhas_reais_sobe_o_nivel_do_inicial(self):
        """Sem fortalecer nada e sem mexer em xp: o nivel 8 vira 9 jogando selvagens da seed."""
        dados = api_batalha.criar_jogo(SIZE, SEED)
        sid = dados["sessao"]
        sessao = api_batalha._sessoes[sid]
        subiu = None
        for n in range(8):
            api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON, (5, 5 + (n % 2))))
            b = api_batalha.batalha_nova(sid, "selvagem", previsao_n=20)
            eventos, final = jogar_ate_o_fim(b["batalha_id"])
            if final["resultado"] == "derrota":
                continue
            xps = [e for e in eventos if e["tipo"] == "xp"]
            for e in xps:
                assert e["xp_total"] - e["ganho"] >= e["xp_nivel_antes"]
                assert e["xp_nivel_atual"] <= e["xp_total"] < e["xp_proximo_nivel"]
                if e["nivel_depois"] > e["nivel_antes"]:
                    subiu = e
            if subiu:
                break
        assert subiu, "nenhuma subida de nivel em 8 selvagens"
        assert subiu["nivel_depois"] == subiu["nivel_antes"] + 1
        assert sessao["equipe"][0].nivel == subiu["nivel_depois"]
        assert sessao["player"].pokemon_list[0].level == subiu["nivel_depois"]


class TestTrocas:
    def test_captura_na_seed_documentada_entrega_o_segundo_pokemon(self):
        sid, sessao, est = capturar_segundo()
        assert est["resultado"] == "captura"
        assert [c.especie for c in sessao["equipe"]] == ["Sonolax", "Miaupsi"]
        assert len(sessao["player"].pokemon_list) == 2

    def _batalha_com_dois(self):
        sid, sessao, _ = capturar_segundo()
        api_batalha.mover_jogo(sid, colocar_ao_lado(sessao, grid_mod.POKEMON, (5, 5)))
        b = api_batalha.batalha_nova(sid, "selvagem", previsao_n=20)
        return sid, sessao, b

    def test_troca_voluntaria_gasta_o_turno_e_a_cpu_ataca(self):
        sid, sessao, b = self._batalha_com_dois()
        assert "pokemon" in b["acoes_validas"]
        res = api_batalha.batalha_acao(b["batalha_id"], "pokemon", alvo=1)
        troca, *resto = res["eventos"]
        assert troca["tipo"] == "troca" and troca["forcada"] is False and troca["indice"] == 1
        assert troca["de"].startswith("Sonolax") and troca["para"].startswith("Miaupsi")
        assert resto and resto[0]["quem"] == "oponente"           # o turno foi gasto
        assert res["estado"]["turno"] == 1
        ativo = res["estado"]["jogador"]["ativo"]
        assert ativo["especie"] == "Miaupsi"
        assert [m["ativo"] for m in res["estado"]["jogador"]["time"]] == [False, True]

    def test_troca_pro_que_ja_esta_em_campo_e_recusada(self):
        _, _, b = self._batalha_com_dois()
        with pytest.raises(ErroApi) as e:
            api_batalha.batalha_acao(b["batalha_id"], "pokemon", alvo=0)
        assert e.value.status == 400

    def test_troca_forcada_apos_desmaio_nao_gasta_turno(self):
        sid, sessao, b = self._batalha_com_dois()
        sessao["equipe"][0].hp = 1                      # o proximo golpe do selvagem derruba
        for _ in range(12):
            res = api_batalha.batalha_acao(b["batalha_id"], "lutar", golpe=0)
            if res["estado"]["estado"] == "troca_forcada":
                break
        assert res["estado"]["estado"] == "troca_forcada"
        assert res["estado"]["acoes_validas"] == ["pokemon"]
        assert any(e["tipo"] == "desmaio" and e["quem"] == "jogador" for e in res["eventos"])
        with pytest.raises(ErroApi):                     # so troca e aceita
            api_batalha.batalha_acao(b["batalha_id"], "lutar", golpe=0)
        turno = res["estado"]["turno"]
        res = api_batalha.batalha_acao(b["batalha_id"], "pokemon", alvo=1)
        assert res["eventos"] == [{"tipo": "troca", "quem": "jogador", "de": res["eventos"][0]["de"],
                                   "para": res["eventos"][0]["para"], "indice": 1, "forcada": True}]
        assert res["estado"]["turno"] == turno           # nao gastou turno
        assert res["estado"]["estado"] == "aguardando_acao"
        assert res["estado"]["jogador"]["ativo"]["especie"] == "Miaupsi"
