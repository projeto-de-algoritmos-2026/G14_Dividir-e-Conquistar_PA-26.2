"""Selecao do k-esimo menor elemento (trabalho 3, fase 2).

Tres algoritmos com o mesmo contrato (valores, k) -> k-esimo menor, k a partir
de 0, sem mutar a entrada:

- selecionar: mediana das medianas, O(n) no pior caso. E o que o jogo usa.
- quickselect_ingenuo: pivo = primeiro elemento. O(n) esperado, O(n^2) no
  pior caso (entrada ordenada). Existe pro benchmark.
- quickselect_aleatorio: pivo sorteado. O(n) esperado em qualquer entrada.

Todos particionam em TRES (menores / iguais / maiores que o pivo). As
populacoes do jogo tem niveis de 1 a 100 com ate 10^6 pokemon, ou seja, quase
tudo e repetido; com particao em dois, muitos iguais degradariam a recursao.
Todos sao iterativos no laco principal (recursao so de um lado vira laco), pra
nao estourar o limite de recursao em 10^6 elementos.

Contagem de comparacoes: o parametro opcional `contador` (um Contador) conta
as comparacoes feitas entre elementos, pra o benchmark medir o crescimento sem
depender so de tempo de relogio. Convencao: classificar um elemento contra o
pivo (menor/igual/maior) conta 1 comparacao; ordenar um grupo conta as
comparacoes reais do sorted().
"""
from functools import cmp_to_key

TAM_GRUPO = 5


class Contador:
    """Acumula o numero de comparacoes entre elementos."""

    def __init__(self):
        self.comparacoes = 0


def _validar(valores, k):
    n = len(valores)
    if isinstance(k, bool) or not isinstance(k, int):
        raise TypeError(f"k deve ser inteiro, veio {type(k).__name__}")
    if n == 0:
        raise IndexError("selecao em lista vazia")
    if not 0 <= k < n:
        raise IndexError(f"k={k} fora do intervalo [0, {n - 1}]")


def _ordenar_grupo(grupo, contador):
    """sorted() do grupo, contando as comparacoes quando ha contador."""
    if contador is None:
        return sorted(grupo)

    def cmp(a, b):
        contador.comparacoes += 1
        return (a > b) - (a < b)

    return sorted(grupo, key=cmp_to_key(cmp))


def _particionar(valores, pivo, contador):
    """Particao em tres: (menores, quantidade de iguais, maiores).

    Os iguais nao precisam ser guardados, so contados: se o k-esimo cai entre
    eles, a resposta e o proprio pivo.
    """
    menores = [x for x in valores if x < pivo]
    maiores = [x for x in valores if x > pivo]
    if contador is not None:
        contador.comparacoes += len(valores)
    return menores, len(valores) - len(menores) - len(maiores), maiores


def _laco_selecao(valores, k, escolher_pivo, contador):
    """Laco comum aos tres algoritmos; so muda como o pivo e escolhido.

    `valores` aqui ja e uma copia nossa (a entrada do usuario nunca e tocada).
    """
    while True:
        if len(valores) == 1:
            return valores[0]
        pivo = escolher_pivo(valores, contador)
        menores, iguais, maiores = _particionar(valores, pivo, contador)
        if k < len(menores):
            valores = menores
        elif k < len(menores) + iguais:
            return pivo
        else:
            k -= len(menores) + iguais
            valores = maiores


def escolher_pivo_mm(valores, contador=None):
    """Pivo da mediana das medianas.

    Divide em grupos de 5, toma a mediana de cada grupo (ordenando o grupo, 5
    elementos sao O(1)) e devolve a mediana (inferior) das medianas, achada
    recursivamente com o proprio `selecionar`. Garante ao menos 3n/10 - 6
    elementos <= pivo e ao menos 3n/10 - 6 >= pivo (ver
    docs/prova-mediana-medianas.md).
    """
    medianas = []
    for i in range(0, len(valores), TAM_GRUPO):
        grupo = _ordenar_grupo(valores[i:i + TAM_GRUPO], contador)
        medianas.append(grupo[(len(grupo) - 1) // 2])
    return _selecionar_interno(medianas, (len(medianas) - 1) // 2, contador)


def _selecionar_interno(valores, k, contador):
    """Mediana das medianas sobre uma lista que ja podemos consumir."""
    if len(valores) <= TAM_GRUPO:
        return _ordenar_grupo(valores, contador)[k]
    return _laco_selecao(valores, k, escolher_pivo_mm, contador)


def selecionar(valores, k, contador=None):
    """k-esimo menor (k a partir de 0) em O(n) no pior caso."""
    _validar(valores, k)
    return _selecionar_interno(list(valores), k, contador)


def _pivo_primeiro(valores, contador):
    return valores[0]


def quickselect_ingenuo(valores, k, contador=None):
    """Quickselect com pivo = primeiro elemento. O(n^2) em entrada ordenada."""
    _validar(valores, k)
    return _laco_selecao(list(valores), k, _pivo_primeiro, contador)


def quickselect_aleatorio(valores, k, rng, contador=None):
    """Quickselect com pivo sorteado por `rng` (random.Random)."""
    _validar(valores, k)

    def pivo_aleatorio(vs, _contador):
        return vs[rng.randrange(len(vs))]

    return _laco_selecao(list(valores), k, pivo_aleatorio, contador)


def gerar_adversario_ingenuo(n):
    """Entrada que leva o pivo-primeiro a O(n^2): 0..n-1 ja ordenada.

    Use com k = n - 1 (o maior): cada rodada o pivo e o minimo e descarta so
    ele, dando n + (n-1) + ... + 1 comparacoes. Pra mediana das medianas e uma
    entrada comum, continua linear.
    """
    return list(range(n))
