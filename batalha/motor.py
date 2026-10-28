"""Motor de batalha por turnos (trabalho 3), sem HTTP e sem terminal.

Um turno: o jogador escolhe uma acao e `Batalha.agir` devolve a LISTA ORDENADA
de eventos que aconteceram, pro front animar. O estado vive no objeto.

Acoes:
- lutar(golpe): golpe e o indice na lista de golpes. A ordem entre jogador e
  CPU e por Velocidade (empate sorteado). Sem PP em nenhum golpe, vale o
  Esforco (nao gasta PP; o dono leva 1/4 do HP maximo de recuo, sem chegar a desmaiar).
- mochila(item="pocao"|"pokebola"): pocao cura POCAO_CURA de HP; pokebola so
  contra selvagem. Gastam o turno: a CPU ataca depois.
- pokemon(indice): troca, gasta o turno. Depois de desmaio e a troca forcada e
  NAO gasta turno.
- fugir: so de selvagem.

Captura: p = 0.15 + 0.65 * (1 - hp/hp_max) (15% com HP cheio, 80% com HP perto
de zero). Um sorteio r: r < p captura (3 balancadas); falha balanca
int(3 * p / r) vezes (0 a 2): quanto mais perto de pegar, mais balancadas.

Fuga: p = min(1, 0.5 * vel_jogador / vel_selvagem + 0.1 * tentativas_antes).

XP por Pokemon derrotado: 64 * nivel_dele // 7, vezes 1.5 contra treinador e
lider. Quem leva e o Pokemon do jogador em campo (e vivo) no momento do
desmaio. Dinheiro: treinador 100 * maior nivel do time, lider 300 *.

Tudo que e sorteio usa o `rng` recebido (random.Random): mesma seed, mesma
batalha. Ordem dos sorteios no turno: desempate de velocidade, escolha de
golpe da CPU, e por golpe: precisao, critico, variacao.
"""
from batalha import cpu as cpu_mod
from batalha.combatente import NIVEL_MAX, xp_do_nivel
from batalha.dano import calcular_dano, sortear_ataque
from batalha.tipos import multiplicador

SELVAGEM, TREINADOR, LIDER = "selvagem", "treinador", "lider"
TIPOS_DE_BATALHA = (SELVAGEM, TREINADOR, LIDER)

AGUARDANDO, TROCA_FORCADA, FIM = "aguardando_acao", "troca_forcada", "fim"

POCAO_CURA = 40
XP_BASE = 64
DINHEIRO_POR_NIVEL = {TREINADOR: 100, LIDER: 300}

JOGADOR, OPONENTE = "jogador", "oponente"


class AcaoInvalida(ValueError):
    """Acao que a regra nao permite agora. Nao consome turno."""


def chance_captura(hp, hp_max):
    return 0.15 + 0.65 * (1 - hp / max(1, hp_max))


def chance_fuga(vel_jogador, vel_selvagem, tentativas_antes):
    return min(1.0, 0.5 * vel_jogador / max(1, vel_selvagem) + 0.1 * tentativas_antes)


def xp_proximo(nivel):
    """XP total pra chegar ao nivel seguinte, ou None no nivel maximo."""
    return xp_do_nivel(nivel + 1) if nivel < NIVEL_MAX else None


def xp_por_derrota(nivel_derrotado, tipo):
    xp = XP_BASE * nivel_derrotado // 7
    return xp * 3 // 2 if tipo != SELVAGEM else xp


class Batalha:
    def __init__(self, tipo, equipe, oponentes, rng, mochila=None, recompensas=True):
        if tipo not in TIPOS_DE_BATALHA:
            raise ValueError(f"tipo de batalha desconhecido: {tipo}")
        if tipo == SELVAGEM and len(oponentes) != 1:
            raise ValueError("selvagem e um Pokemon so")
        if not any(c.vivo for c in equipe):
            raise ValueError("equipe sem Pokemon vivo")
        if not oponentes:
            raise ValueError("sem oponente")
        self.tipo = tipo
        self.equipe = equipe            # lista compartilhada com quem chamou
        self.oponentes = oponentes
        self.rng = rng
        self.mochila = mochila if mochila is not None else {}
        self.recompensas = recompensas
        self.modo_cpu = cpu_mod.LIDER if tipo == LIDER else cpu_mod.COMUM
        self.ativo = next(i for i, c in enumerate(equipe) if c.vivo)
        self.ativo_o = 0
        self.turno = 0
        self.estado = AGUARDANDO
        self.resultado = None           # vitoria | derrota | fuga | captura
        self.tentativas_fuga = 0
        self.dinheiro_ganho = 0
        self.capturado = None

    # ---------------- leitura ----------------

    @property
    def jogador(self):
        return self.equipe[self.ativo]

    @property
    def inimigo(self):
        return self.oponentes[self.ativo_o]

    def acoes_validas(self):
        if self.estado == FIM:
            return []
        if self.estado == TROCA_FORCADA:
            return ["pokemon"]
        acoes = ["lutar", "mochila"]
        if any(c.vivo and i != self.ativo for i, c in enumerate(self.equipe)):
            acoes.append("pokemon")
        if self.tipo == SELVAGEM:
            acoes.append("fugir")
        return acoes

    # ---------------- entrada ----------------

    def agir(self, acao, golpe=None, item=None, alvo=None):
        """Executa a acao do jogador e devolve a lista ordenada de eventos."""
        if self.estado == FIM:
            raise AcaoInvalida("a batalha ja acabou")
        if self.estado == TROCA_FORCADA and acao != "pokemon":
            raise AcaoInvalida("seu Pokemon desmaiou: escolha quem entra (acao pokemon)")
        if acao == "lutar":
            return self._lutar(golpe)
        if acao == "mochila":
            return self._mochila(item)
        if acao == "pokemon":
            return self._trocar(alvo)
        if acao == "fugir":
            return self._fugir()
        raise AcaoInvalida(f"acao desconhecida: {acao}")

    # ---------------- acoes ----------------

    def _lutar(self, indice):
        eu = self.jogador
        usaveis = eu.golpes_usaveis()
        if usaveis:
            if isinstance(indice, bool) or not isinstance(indice, int) or indice not in range(len(eu.golpes)):
                raise AcaoInvalida("golpe invalido")
            if eu.golpes[indice].pp <= 0:
                raise AcaoInvalida(f"{eu.golpes[indice].nome} esta sem PP")
            golpe_j = indice
        else:
            golpe_j = None      # Esforco
        self.turno += 1
        eventos = []
        inimigo = self.inimigo
        golpe_o = cpu_mod.escolher_golpe(inimigo, eu, self.rng, self.modo_cpu)

        # Velocidade decide; empate e sorteado. Quem esta em campo no INICIO do
        # turno e quem age: se for derrubado antes, perde a vez.
        if eu.velocidade != inimigo.velocidade:
            jogador_primeiro = eu.velocidade > inimigo.velocidade
        else:
            jogador_primeiro = self.rng.random() < 0.5
        ordem = [(JOGADOR, eu, golpe_j), (OPONENTE, inimigo, golpe_o)]
        if not jogador_primeiro:
            ordem.reverse()

        for lado, atacante, golpe in ordem:
            if self.estado == FIM or not atacante.vivo:
                continue
            if lado == JOGADOR and self.jogador is not atacante:
                continue
            if lado == OPONENTE and self.inimigo is not atacante:
                continue
            alvo = self.inimigo if lado == JOGADOR else self.jogador
            self._golpear(lado, atacante, golpe, alvo, eventos)
            if self.estado != AGUARDANDO:
                break
        return eventos

    def _mochila(self, item):
        eu = self.jogador
        if item == "pocao":
            if self.mochila.get("potion", 0) <= 0:
                raise AcaoInvalida("sem pocao na mochila")
            if eu.hp >= eu.hp_max:
                raise AcaoInvalida("HP ja esta cheio")
            self.turno += 1
            self.mochila["potion"] -= 1
            antes = eu.hp
            eu.hp = min(eu.hp_max, eu.hp + POCAO_CURA)
            eventos = [{"tipo": "pocao", "quem": JOGADOR, "pokemon": eu.nome,
                        "cura": eu.hp - antes, "hp_antes": antes, "hp_depois": eu.hp,
                        "hp_max": eu.hp_max}]
            self._vez_da_cpu(eventos)
            return eventos
        if item == "pokebola":
            if self.tipo != SELVAGEM:
                raise AcaoInvalida("pokebola so funciona contra Pokemon selvagem")
            if self.mochila.get("pokeball", 0) <= 0:
                raise AcaoInvalida("sem pokebola na mochila")
            self.turno += 1
            self.mochila["pokeball"] -= 1
            return self._lancar_pokebola()
        raise AcaoInvalida("item invalido (pocao ou pokebola)")

    def _lancar_pokebola(self):
        alvo = self.inimigo
        p = chance_captura(alvo.hp, alvo.hp_max)
        r = self.rng.random()
        if r < p:
            self.capturado = alvo
            self.equipe.append(alvo)
            self.estado, self.resultado = FIM, "captura"
            return [{"tipo": "captura", "sucesso": True, "balancadas": 3,
                     "pokemon": alvo.nome, "chance": round(p, 4)},
                    {"tipo": "fim", "resultado": "captura"}]
        eventos = [{"tipo": "captura", "sucesso": False, "balancadas": int(3 * p / r),
                    "pokemon": alvo.nome, "chance": round(p, 4)}]
        self._vez_da_cpu(eventos)
        return eventos

    def _trocar(self, indice):
        forcada = self.estado == TROCA_FORCADA
        if isinstance(indice, bool) or not isinstance(indice, int) or indice not in range(len(self.equipe)):
            raise AcaoInvalida("alvo da troca invalido")
        novo = self.equipe[indice]
        if indice == self.ativo and not forcada:
            raise AcaoInvalida("esse Pokemon ja esta em campo")
        if not novo.vivo:
            raise AcaoInvalida(f"{novo.nome} desmaiou")
        if not forcada:
            self.turno += 1
        antes = self.jogador
        self.ativo = indice
        eventos = [{"tipo": "troca", "quem": JOGADOR, "de": antes.nome, "para": novo.nome,
                    "indice": indice, "forcada": forcada}]
        if forcada:
            self.estado = AGUARDANDO
        else:
            self._vez_da_cpu(eventos)
        return eventos

    def _fugir(self):
        if self.tipo != SELVAGEM:
            raise AcaoInvalida("nao da pra fugir de batalha de treinador ou lider")
        self.turno += 1
        p = chance_fuga(self.jogador.velocidade, self.inimigo.velocidade, self.tentativas_fuga)
        self.tentativas_fuga += 1
        if self.rng.random() < p:
            self.estado, self.resultado = FIM, "fuga"
            return [{"tipo": "fuga", "sucesso": True, "chance": round(p, 4)},
                    {"tipo": "fim", "resultado": "fuga"}]
        eventos = [{"tipo": "fuga", "sucesso": False, "chance": round(p, 4)}]
        self._vez_da_cpu(eventos)
        return eventos

    # ---------------- nucleo ----------------

    def _vez_da_cpu(self, eventos):
        """A CPU ataca (acoes que nao sao golpe sempre dao a vez a ela)."""
        if self.estado != AGUARDANDO:
            return
        inimigo, eu = self.inimigo, self.jogador
        golpe = cpu_mod.escolher_golpe(inimigo, eu, self.rng, self.modo_cpu)
        self._golpear(OPONENTE, inimigo, golpe, eu, eventos)

    def _golpear(self, lado, atacante, indice, alvo, eventos):
        golpe = atacante.golpe_esforco() if indice is None else atacante.golpes[indice]
        if indice is not None:
            golpe.pp -= 1
        acertou, critico, variacao = sortear_ataque(self.rng, golpe)
        if not acertou:
            eventos.append({"tipo": "errou", "quem": lado, "pokemon": atacante.nome,
                            "golpe": golpe.nome, "tipo_golpe": golpe.tipo})
        else:
            dano = calcular_dano(atacante, golpe, alvo, critico, variacao)
            antes = alvo.hp
            alvo.hp = max(0, alvo.hp - dano)
            eventos.append({
                "tipo": "golpe", "quem": lado, "pokemon": atacante.nome, "golpe": golpe.nome,
                "tipo_golpe": golpe.tipo, "efetividade": multiplicador(golpe.tipo, alvo.tipo), "critico": critico,
                "dano": antes - alvo.hp, "hp_antes": antes, "hp_depois": alvo.hp,
                "hp_max": alvo.hp_max, "alvo": alvo.nome,
                "pp_restante": None if indice is None else golpe.pp,
            })
        if indice is None:
            # O recuo do Esforco nunca derruba o dono: deixa 1 de HP no minimo.
            recuo = min(max(1, atacante.hp_max // 4), max(0, atacante.hp - 1))
            antes = atacante.hp
            atacante.hp -= recuo
            eventos.append({"tipo": "recuo", "quem": lado, "pokemon": atacante.nome,
                            "dano": recuo, "hp_antes": antes,
                            "hp_depois": atacante.hp, "hp_max": atacante.hp_max})
        if not alvo.vivo:
            self._desmaiou(OPONENTE if lado == JOGADOR else JOGADOR, alvo, eventos)

    def _desmaiou(self, lado, combatente, eventos):
        eventos.append({"tipo": "desmaio", "quem": lado, "pokemon": combatente.nome})
        if lado == OPONENTE:
            self._oponente_caiu(combatente, eventos)
        else:
            self._jogador_caiu(eventos)

    def _oponente_caiu(self, caido, eventos):
        if self.recompensas:
            ativo = self.jogador
            if ativo.vivo:
                ganho = xp_por_derrota(caido.nivel, self.tipo)
                antes, depois = ativo.ganhar_xp(ganho)
                eventos.append({"tipo": "xp", "pokemon": ativo.nome, "ganho": ganho,
                                "xp_total": ativo.xp, "nivel_antes": antes,
                                "nivel_depois": depois, "hp": ativo.hp, "hp_max": ativo.hp_max,
                                # limites das barras: do nivel de antes e do de depois
                                "xp_nivel_antes": xp_do_nivel(antes),
                                "xp_proximo_nivel_antes": xp_proximo(antes),
                                "xp_nivel_atual": xp_do_nivel(depois),
                                "xp_proximo_nivel": xp_proximo(depois)})
        restantes = [(i, c) for i, c in enumerate(self.oponentes) if c.vivo]
        if not restantes:
            if self.recompensas and self.tipo != SELVAGEM:
                nivel = max(c.nivel for c in self.oponentes)
                self.dinheiro_ganho = DINHEIRO_POR_NIVEL[self.tipo] * nivel
                eventos.append({"tipo": "dinheiro", "ganho": self.dinheiro_ganho})
            self.estado, self.resultado = FIM, "vitoria"
            eventos.append({"tipo": "fim", "resultado": "vitoria"})
            return
        escolhido = cpu_mod.escolher_proximo([c for _, c in restantes], self.jogador, self.modo_cpu)
        self.ativo_o = self.oponentes.index(escolhido)
        eventos.append({"tipo": "troca", "quem": OPONENTE, "de": caido.nome,
                        "para": escolhido.nome, "indice": self.ativo_o, "forcada": True})

    def _jogador_caiu(self, eventos):
        if any(c.vivo for c in self.equipe):
            self.estado = TROCA_FORCADA
        else:
            self.estado, self.resultado = FIM, "derrota"
            eventos.append({"tipo": "fim", "resultado": "derrota"})

    # ---------------- resumo pro front ----------------

    def resumo(self):
        def ficha(c, indice=None, ativo=False):
            d = {"nome": c.nome, "especie": c.especie, "tipo": c.tipo, "nivel": c.nivel,
                 "hp": c.hp, "hp_max": c.hp_max, "vivo": c.vivo}
            if indice is not None:
                d.update(indice=indice, ativo=ativo)
            return d

        eu = self.jogador
        return {
            "tipo": self.tipo,
            "estado": self.estado,
            "turno": self.turno,
            "resultado": self.resultado,
            "acoes_validas": self.acoes_validas(),
            "jogador": {
                "ativo": {**ficha(eu), "xp": eu.xp, "xp_nivel_atual": xp_do_nivel(eu.nivel),
                          "xp_proximo_nivel": xp_proximo(eu.nivel)},
                "time": [ficha(c, i, i == self.ativo) for i, c in enumerate(self.equipe)],
                "golpes": [{"indice": i, "nome": g.nome, "tipo": g.tipo, "poder": g.poder,
                            "precisao": g.precisao, "pp": g.pp, "pp_max": g.pp_max}
                           for i, g in enumerate(eu.golpes)],
                "mochila": {"pocao": self.mochila.get("potion", 0),
                            "pokebola": self.mochila.get("pokeball", 0)},
            },
            "oponente": {
                "ativo": ficha(self.inimigo),
                "restantes": sum(1 for c in self.oponentes if c.vivo),
                "tamanho_time": len(self.oponentes),
            },
        }
