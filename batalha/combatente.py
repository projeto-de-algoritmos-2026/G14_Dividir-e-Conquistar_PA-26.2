"""Combatente: um Pokemon do modelo antigo visto pelo motor de batalha.

Guarda o que a batalha precisa e o modelo antigo nao tem: stats derivados do
nivel, HP atual, PP por golpe e XP. O Pokemon original fica referenciado e
recebe o nivel de volta quando sobe (a API e o resto do jogo leem
`pokemon.level`).

Stats (formula simples, sem IV nem EV), B = stat base da especie, L = nivel:

    HP         = (2*B*L)//100 + L + 10
    outro stat = (2*B*L)//100 + 5      (Ataque, Defesa, Velocidade)

XP: curva "media rapida", XP total do nivel L = L**3. Sobe de nivel quando o XP
total chega a (L+1)**3. Nivel maximo 100. Ao subir, o HP atual ganha a mesma
diferenca que o HP maximo ganhou (como na serie).
"""
from dataclasses import dataclass, field

from batalha.especies import BASE, BASE_PADRAO, ESFORCO, MAX_GOLPES, ficha_do_golpe
from batalha.tipos import NORMAL, TIPOS
from models import Pokemon

NIVEL_MAX = 100


def stat_hp(base, nivel):
    return (2 * base * nivel) // 100 + nivel + 10


def stat_outro(base, nivel):
    return (2 * base * nivel) // 100 + 5


def xp_do_nivel(nivel):
    """XP total acumulado necessario pra estar no nivel `nivel`."""
    return nivel ** 3


def especie_de(pokemon):
    """Especie pelo nome ou por type_of_pokemon (o modelo antigo mistura os dois)."""
    for texto in (pokemon.type_of_pokemon, pokemon.name):
        baixo = (texto or "").lower()
        for especie in BASE:
            if baixo.startswith(especie.lower()):
                return especie
    return pokemon.type_of_pokemon or pokemon.name


def tipo_de(pokemon):
    """Tipo elemental. O modelo antigo ora poe em type_of_pokemon, ora em nature."""
    for texto in (pokemon.type_of_pokemon, pokemon.nature):
        if texto in TIPOS:
            return texto
    return NORMAL


@dataclass
class Golpe:
    nome: str
    tipo: str
    poder: int
    precisao: int
    pp: int
    pp_max: int


@dataclass
class Combatente:
    pokemon: Pokemon
    especie: str
    tipo: str
    nivel: int
    xp: int
    hp_max: int
    hp: int
    ataque: int
    defesa: int
    velocidade: int
    golpes: list[Golpe] = field(default_factory=list)

    @classmethod
    def de_pokemon(cls, pokemon, nivel=None):
        """Monta o combatente com HP cheio e PP cheio."""
        nivel = max(1, min(NIVEL_MAX, int(nivel if nivel is not None else pokemon.level)))
        pokemon.level = nivel
        especie = especie_de(pokemon)
        b_hp, b_atk, b_def, b_vel = BASE.get(especie, BASE_PADRAO)
        hp_max = stat_hp(b_hp, nivel)
        golpes = []
        for nome, valor in list(pokemon.moves.items())[:MAX_GOLPES]:
            tipo, poder, precisao, pp = ficha_do_golpe(nome, valor)
            golpes.append(Golpe(nome, tipo, poder, precisao, pp, pp))
        return cls(
            pokemon=pokemon, especie=especie, tipo=tipo_de(pokemon), nivel=nivel,
            xp=xp_do_nivel(nivel), hp_max=hp_max, hp=hp_max,
            ataque=stat_outro(b_atk, nivel), defesa=stat_outro(b_def, nivel),
            velocidade=stat_outro(b_vel, nivel), golpes=golpes,
        )

    @property
    def nome(self):
        return self.pokemon.name

    @property
    def vivo(self):
        return self.hp > 0

    def golpes_usaveis(self):
        """Indices dos golpes com PP. Vazio quando so resta o Esforco."""
        return [i for i, g in enumerate(self.golpes) if g.pp > 0]

    def golpe_esforco(self):
        nome, tipo, poder, precisao = ESFORCO
        return Golpe(nome, tipo, poder, precisao, 0, 0)

    def curar_total(self):
        self.hp = self.hp_max
        for g in self.golpes:
            g.pp = g.pp_max

    def ganhar_xp(self, ganho):
        """Soma XP e sobe de nivel quantas vezes couber. Devolve (antes, depois)."""
        antes = self.nivel
        self.xp += max(0, int(ganho))
        while self.nivel < NIVEL_MAX and self.xp >= xp_do_nivel(self.nivel + 1):
            self._subir()
        return antes, self.nivel

    def _subir(self):
        b_hp, b_atk, b_def, b_vel = BASE.get(self.especie, BASE_PADRAO)
        self.nivel += 1
        novo_hp_max = stat_hp(b_hp, self.nivel)
        if self.hp > 0:
            self.hp += novo_hp_max - self.hp_max
        self.hp_max = novo_hp_max
        self.ataque = stat_outro(b_atk, self.nivel)
        self.defesa = stat_outro(b_def, self.nivel)
        self.velocidade = stat_outro(b_vel, self.nivel)
        self.pokemon.level = self.nivel

    def clonar(self):
        """Copia barata pra simulacao (previsao): o Pokemon original e compartilhado
        e nunca e escrito, porque a simulacao nao da XP."""
        return Combatente(
            self.pokemon, self.especie, self.tipo, self.nivel, self.xp,
            self.hp_max, self.hp, self.ataque, self.defesa, self.velocidade,
            [Golpe(g.nome, g.tipo, g.poder, g.precisao, g.pp, g.pp_max) for g in self.golpes],
        )
