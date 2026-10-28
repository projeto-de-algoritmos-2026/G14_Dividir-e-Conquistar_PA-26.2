"""Trabalho 3: jogo com ginasios e batalha turno a turno (rotas /api/t3/*).

Funcoes puras, sem HTTP: `server.py` so as chama. Mesmo desenho do T2: o
servidor guarda a partida em memoria (sessao) porque quem resolve o passo e
game.mover() e quem resolve o turno e batalha.motor.Batalha.

Diferenca pro T2: aqui o movimento NAO resolve a batalha. Ao esbarrar em
selvagem, treinador ou ginasio, a resposta traz `encontro` e a celula fica
intacta; a pagina abre a batalha com /batalha/nova e joga com /batalha/acao.
Contrato e exemplos: docs/api-batalha-t3.md.

As rotas e as funcoes do T2 nao sao tocadas; as sessoes do T3 vivem num
dicionario proprio.
"""
import random
import secrets
import threading

import game
import grid as grid_mod
from bench.common import silencioso
from batalha import niveis
from batalha.combatente import Combatente
from batalha.motor import FIM, AcaoInvalida, Batalha
from batalha.previsao import N_PADRAO, prever
from grid import Grid
from models import Player

from . import api

# O conteudo "ginasio" so existe no T3; api.CONTEUDO (usado pelo T2) fica como esta.
CONTEUDO = {**api.CONTEUDO, grid_mod.GINASIO: "ginasio"}

NIVEL_INICIAL_PADRAO = 35
MAX_SESSOES = 20
MAX_BATALHAS = 50
MAX_PREVISAO = 5000


class ErroApi(Exception):
    """Erro de uso da API. `status` e o HTTP que o servidor devolve."""

    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status = status


_sessoes: dict[str, dict] = {}
_batalhas: dict[str, dict] = {}
_tranca = threading.Lock()


# ---------------- serializacao ----------------

def _extras_ginasio(mapa, linha, coluna):
    reg = niveis.regiao_da_celula(mapa, linha, coluna)
    lider = reg.lider
    return {
        "lider": lider.nome,
        "regiao": reg.indice,
        "percentil": lider.percentil,
        "nivel_time": lider.time[0].level,
    }


def serializar_celula(mapa, linha, coluna):
    celula = mapa.celula(linha, coluna)
    dados = {
        "terreno": celula.terrain,
        "conteudo": CONTEUDO.get(celula.occupied_with, "livre"),
        "pisavel_sem_surf": celula.pisavel(False),
        "pisavel_com_surf": celula.pisavel(True),
    }
    if celula.occupied_with == grid_mod.GINASIO:
        dados["ginasio"] = _extras_ginasio(mapa, linha, coluna)
    return dados


def serializar_grid(mapa):
    return {
        "size": mapa.size,
        "seed": mapa.seed,
        "posicao": list(mapa.posicao),
        "celulas": [[serializar_celula(mapa, r, c) for c in range(mapa.size)]
                    for r in range(mapa.size)],
    }


def _ficha(c, indice):
    return {"indice": indice, "nome": c.nome, "especie": c.especie, "tipo": c.tipo,
            "nivel": c.nivel, "hp": c.hp, "hp_max": c.hp_max, "vivo": c.vivo}


def _resumo_jogo(sessao):
    player = sessao["player"]
    total = sum(1 for reg in sessao["mapa"].regioes if reg.lider)
    derrotados = len(sessao["lideres_derrotados"])
    return {
        "situacao": sessao["situacao"],
        "motivo": sessao["motivo"],
        "dinheiro": player.money,
        "pokebolas": player.bag.get("pokeball", 0),
        "pocoes": player.bag.get("potion", 0),
        "time": [_ficha(c, i) for i, c in enumerate(sessao["equipe"])],
        "lideres": {"derrotados": derrotados, "total": total,
                    "regioes_derrotadas": sorted(sessao["lideres_derrotados"])},
        "em_batalha": sessao["batalha_id"],
    }


# ---------------- sessao ----------------

def _obter(identificador):
    with _tranca:
        sessao = _sessoes.get(identificador)
    if sessao is None:
        raise ErroApi("sessao desconhecida, comece uma partida nova", 404)
    return sessao


def criar_jogo(size, seed, nivel_inicial=NIVEL_INICIAL_PADRAO):
    mapa = Grid(size=size, seed=seed, ginasios=True)
    rng = random.Random(f"{seed}-inicial")
    inicial = niveis._pokemon(rng, "inicial", max(1, min(100, int(nivel_inicial))))
    player = Player(name="Jogador", pokemon_list=[inicial],
                    bag={"pokeball": 5, "potion": 5}, money=10000)
    sessao = {
        "mapa": mapa, "player": player,
        "equipe": [Combatente.de_pokemon(inicial)],
        "rng": random.Random(f"{seed}-sessao"),
        "tranca": threading.Lock(),
        "encontro": None, "batalha_id": None, "n_batalhas": 0,
        "lideres_derrotados": set(), "situacao": "jogando", "motivo": "",
    }
    identificador = secrets.token_hex(8)
    with _tranca:
        if len(_sessoes) >= MAX_SESSOES:
            _sessoes.pop(next(iter(_sessoes)))
        _sessoes[identificador] = sessao
    return {
        "sessao": identificador,
        **serializar_grid(mapa),
        "ginasios": [{"posicao": list(pos), **_extras_ginasio(mapa, *pos)}
                     for pos in mapa.ginasios()],
        "jogador": _resumo_jogo(sessao),
    }


def estado_jogo(identificador):
    sessao = _obter(identificador)
    return {"sessao": identificador, "posicao": list(sessao["mapa"].posicao),
            "encontro": sessao["encontro"], "jogador": _resumo_jogo(sessao)}


def _descrever_encontro(sessao, tipo, posicao):
    mapa = sessao["mapa"]
    reg = niveis.regiao_da_celula(mapa, *posicao)
    dados = {"tipo": tipo, "posicao": list(posicao), "regiao": reg.indice}
    if tipo == "lider":
        dados.update(_extras_ginasio(mapa, *posicao))
    return dados


def mover_jogo(identificador, direcao):
    sessao = _obter(identificador)
    direcao = (direcao or "").upper()
    with sessao["tranca"]:
        mapa, player = sessao["mapa"], sessao["player"]
        if sessao["situacao"] != "jogando":
            raise ErroApi(f"partida encerrada ({sessao['motivo']}), comece uma nova", 409)
        if sessao["batalha_id"] or sessao["encontro"]:
            raise ErroApi("ha uma batalha pendente: termine antes de andar", 409)

        destino = None
        if direcao in game.DIRECOES:
            d_linha, d_coluna = game.DIRECOES[direcao]
            if mapa.dentro(mapa.row_pos + d_linha, mapa.col_pos + d_coluna):
                destino = mapa.celula(mapa.row_pos + d_linha, mapa.col_pos + d_coluna)
        conteudo = CONTEUDO.get(destino.occupied_with, "livre") if destino else None

        with silencioso():
            mov = game.mover(mapa, player, direcao, adiar_batalha=True)

        linha, coluna = mov.posicao
        encontro = None
        ginasio_vencido = False
        if mov.valido and mov.encontro:
            reg = niveis.regiao_da_celula(mapa, linha, coluna)
            if mov.encontro == "lider" and reg.indice in sessao["lideres_derrotados"]:
                ginasio_vencido = True      # ginasio ja vencido e predio: so passa
            else:
                encontro = _descrever_encontro(sessao, mov.encontro, (linha, coluna))
                sessao["encontro"] = encontro
        curou = False
        if mov.valido and mov.em_centro:
            for c in sessao["equipe"]:
                c.curar_total()
            curou = True
        return {
            "valido": mov.valido,
            "motivo": mov.motivo,
            "posicao": [linha, coluna],
            "conteudo": conteudo,
            "pegou_pokebola": mov.pegou_pokebola,
            "pegou_surf": mov.pegou_surf,
            "em_centro": mov.em_centro,
            "curou": curou,
            "ginasio_ja_vencido": ginasio_vencido,
            "encontro": encontro,
            "celula": {"posicao": [linha, coluna], **serializar_celula(mapa, linha, coluna)},
            "jogador": _resumo_jogo(sessao),
        }


# ---------------- batalha ----------------

def _obter_batalha(batalha_id):
    with _tranca:
        registro = _batalhas.get(batalha_id)
    if registro is None:
        raise ErroApi("batalha desconhecida", 404)
    return registro


def _limitar_previsao(n):
    try:
        n = int(n)
    except (TypeError, ValueError):
        return N_PADRAO
    return max(1, min(MAX_PREVISAO, n))


def batalha_nova(identificador, tipo, previsao_n=None):
    sessao = _obter(identificador)
    with sessao["tranca"]:
        encontro = sessao["encontro"]
        if sessao["batalha_id"]:
            raise ErroApi("ja ha uma batalha em andamento nesta sessao", 409)
        if encontro is None:
            raise ErroApi("nao ha encontro pendente: ande ate um selvagem, treinador ou ginasio", 409)
        if tipo != encontro["tipo"]:
            raise ErroApi(f"o encontro pendente e do tipo {encontro['tipo']}, nao {tipo}", 409)
        if not any(c.vivo for c in sessao["equipe"]):
            raise ErroApi("nenhum Pokemon vivo no time", 409)

        mapa, player = sessao["mapa"], sessao["player"]
        posicao = tuple(encontro["posicao"])
        reg = niveis.regiao_da_celula(mapa, *posicao)
        sessao["n_batalhas"] += 1
        extra = {}
        if tipo == "selvagem":
            rng_enc = random.Random(f"{mapa.seed}-selvagem-{sessao['n_batalhas']}")
            c, percentil, nivel = niveis.montar_selvagem(reg, rng_enc)
            oponentes = [c]
            extra = {"percentil": percentil, "nivel": nivel}
        elif tipo == "treinador":
            nome, oponentes, percentil, nivel = niveis.montar_treinador(reg, mapa.seed, posicao)
            extra = {"nome": nome, "percentil": percentil, "nivel": nivel}
        else:
            oponentes = niveis.montar_time_lider(reg.lider)
            extra = {"nome": reg.lider.nome, "percentil": reg.lider.percentil,
                     "nivel": oponentes[0].nivel}

        rng = random.Random(f"{mapa.seed}-batalha-{sessao['n_batalhas']}")
        batalha = Batalha(tipo, sessao["equipe"], oponentes, rng, player.bag)
        previsao = prever(sessao["equipe"], oponentes, tipo, n=_limitar_previsao(previsao_n),
                          seed=sessao["n_batalhas"])
        batalha_id = secrets.token_hex(8)
        with _tranca:
            if len(_batalhas) >= MAX_BATALHAS:
                _batalhas.pop(next(iter(_batalhas)))
            _batalhas[batalha_id] = {"batalha": batalha, "sessao": sessao, "posicao": posicao,
                                     "regiao": reg.indice, "encerrada": False}
        sessao["batalha_id"] = batalha_id
        return {"batalha_id": batalha_id, "adversario": extra, **batalha.resumo(),
                "previsao": previsao}


def estado_batalha(batalha_id):
    registro = _obter_batalha(batalha_id)
    return {"batalha_id": batalha_id, "estado": registro["batalha"].resumo()}


def _encerrar(registro):
    """Aplica no jogo o que a batalha decidiu. Roda uma vez, quando ela chega ao fim."""
    batalha, sessao = registro["batalha"], registro["sessao"]
    mapa, player = sessao["mapa"], sessao["player"]
    player.money += batalha.dinheiro_ganho
    if batalha.capturado is not None:
        player.pokemon_list.append(batalha.capturado.pokemon)
    resultado = batalha.resultado
    linha, coluna = registro["posicao"]
    celula = mapa.celula(linha, coluna)
    if resultado in ("vitoria", "fuga", "captura") and batalha.tipo != "lider":
        celula.occupied_with = grid_mod.VISITADO      # o selvagem/treinador saiu de cena
    if resultado == "vitoria" and batalha.tipo == "lider":
        sessao["lideres_derrotados"].add(registro["regiao"])
    if resultado == "derrota":
        sessao["situacao"], sessao["motivo"] = "derrota", "time inteiro desmaiou"
    elif batalha.tipo == "lider" and resultado == "vitoria":
        total = {r.indice for r in mapa.regioes if r.lider}
        if total and sessao["lideres_derrotados"] >= total:
            sessao["situacao"], sessao["motivo"] = "vitoria", "todos os lideres derrotados"
    sessao["encontro"] = None
    sessao["batalha_id"] = None
    registro["encerrada"] = True


def batalha_acao(batalha_id, acao, golpe=None, item=None, alvo=None):
    registro = _obter_batalha(batalha_id)
    sessao = registro["sessao"]
    with sessao["tranca"]:
        batalha = registro["batalha"]
        try:
            eventos = batalha.agir(acao, golpe=golpe, item=item, alvo=alvo)
        except AcaoInvalida as erro:
            raise ErroApi(str(erro), 400)
        if batalha.estado == FIM and not registro["encerrada"]:
            _encerrar(registro)
        return {
            "batalha_id": batalha_id,
            "eventos": eventos,
            "estado": batalha.resumo(),
            "jogo": _resumo_jogo(sessao),
        }
