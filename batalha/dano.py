"""Formula de dano no estilo classico.

    base  = ((2*L//5 + 2) * poder * Ataque // Defesa) // 50 + 2     (inteiros)
    dano  = int(base * STAB * tipo * critico * variacao), minimo 1

- L: nivel de quem ataca.
- STAB: 1.5 se o tipo do golpe e o tipo de quem ataca.
- tipo: 2.0, 1.0 ou 0.5 da tabela (batalha/tipos.py).
- critico: 1.5 com chance 1/16.
- variacao: sorteio uniforme em [0.85, 1.0].

Ordem dos sorteios (importa pro determinismo por seed): precisao, critico,
variacao. Golpe que erra nao sorteia critico nem variacao.
"""
from batalha.tipos import multiplicador

CHANCE_CRITICO = 1 / 16
MULT_CRITICO = 1.5
MULT_STAB = 1.5
VARIACAO_MIN, VARIACAO_MAX = 0.85, 1.0


def dano_base(nivel, poder, ataque, defesa):
    return ((2 * nivel // 5 + 2) * poder * ataque // max(1, defesa)) // 50 + 2


def multiplicador_fixo(atacante, golpe, alvo):
    """STAB * efetividade: a parte do dano que nao depende de sorteio."""
    stab = MULT_STAB if golpe.tipo == atacante.tipo else 1.0
    return stab * multiplicador(golpe.tipo, alvo.tipo)


def calcular_dano(atacante, golpe, alvo, critico=False, variacao=1.0):
    """Dano deterministico dado o critico e a variacao ja sorteados."""
    base = dano_base(atacante.nivel, golpe.poder, atacante.ataque, alvo.defesa)
    mult = multiplicador_fixo(atacante, golpe, alvo)
    if critico:
        mult *= MULT_CRITICO
    return max(1, int(base * mult * variacao))


def dano_esperado(atacante, golpe, alvo):
    """Esperanca do dano: media da variacao, critico e chance de acertar.

    E o numero com que a CPU compara golpes e candidatos. Nao sorteia nada.
    """
    base = dano_base(atacante.nivel, golpe.poder, atacante.ataque, alvo.defesa)
    mult = multiplicador_fixo(atacante, golpe, alvo)
    media_var = (VARIACAO_MIN + VARIACAO_MAX) / 2
    media_crit = 1 + (MULT_CRITICO - 1) * CHANCE_CRITICO
    return base * mult * media_var * media_crit * golpe.precisao / 100


def sortear_ataque(rng, golpe):
    """(acertou, critico, variacao) na ordem documentada."""
    if rng.random() * 100 >= golpe.precisao:
        return False, False, 1.0
    critico = rng.random() < CHANCE_CRITICO
    variacao = rng.uniform(VARIACAO_MIN, VARIACAO_MAX)
    return True, critico, variacao
