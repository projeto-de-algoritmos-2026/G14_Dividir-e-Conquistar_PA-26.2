# Prova: a mediana das medianas seleciona em O(n)

Codigo: `dc/mediana_medianas.py`. O pivo sai de `escolher_pivo_mm`; o laco que
particiona e recursa de um lado so e `_laco_selecao`; a entrada publica e
`selecionar`. O teste da garantia do pivo e
`tests/test_mediana_medianas.py::test_pivo_deixa_pelo_menos_3n_10_de_cada_lado`.

## O algoritmo

Para achar o k-esimo menor de uma lista de tamanho n:

1. Divide em grupos de 5 (o ultimo pode ter menos) e ordena cada grupo, o que
   custa O(1) por grupo, O(n) no total (`escolher_pivo_mm`).
2. Pega a mediana de cada grupo: sao ceil(n/5) medianas.
3. O pivo p e a mediana dessas medianas, achada pela propria selecao, recursiva
   sobre ceil(n/5) elementos (`_selecionar_interno`).
4. Particiona em menores, iguais e maiores que p, em O(n)
   (`_particionar`).
5. Recursa so no lado onde o k-esimo cai, ou devolve p se cai entre os iguais
   (`_laco_selecao`).

## O pivo e bom: pelo menos 3n/10 - 6 de cada lado

Seja g = ceil(n/5) o numero de grupos e p a mediana das g medianas. Pelo menos
metade das medianas, ou seja, ao menos ceil(g/2) delas, e <= p.

Cada grupo cuja mediana e <= p tem 3 elementos <= p (a mediana e os 2 menores
que ela no grupo), exceto o ultimo grupo (pode ser incompleto) e o grupo do
proprio p (que ja conta p). Descontando esses dois grupos:

    #{x <= p} >= 3 * (ceil(g/2) - 2) >= 3 * (n/10 - 2) = 3n/10 - 6.

O argumento e simetrico para #{x >= p}. Com valores repetidos a conta vale do
mesmo jeito, porque contamos <= e >=; os iguais ao pivo sao descartados juntos
na particao em tres (por isso a particao em tres e a certa para niveis 1..100).

Consequencia: o lado que sobra tem no maximo n - (3n/10 - 6) = 7n/10 + 6
elementos.

## Recorrencia

    T(n) <= T(n/5) + T(7n/10 + 6) + c*n

- T(n/5) (aprox., ceil(n/5)): achar o pivo.
- T(7n/10 + 6): a recursao no lado escolhido, no pior caso o maior.
- c*n: ordenar grupos e particionar.

Para n pequeno (n <= 5 no codigo, ou qualquer constante n0) T(n) = O(1).

## Por que fecha: 1/5 + 7/10 < 1

Hipotese: T(m) <= a*m para m < n. Entao

    T(n) <= a*n/5 + a*(7n/10 + 6) + c*n
          = a*(9n/10) + 6a + c*n
          = a*n - (a*n/10 - 6a - c*n).

Basta o parentese ser >= 0: a*n/10 >= 6a + c*n, isto e, a*(n/10 - 6) >= c*n.
Para n >= 120, n/10 - 6 >= n/20, e com a = 20c vale a*n/20 = c*n. Os n < 120
cabem na constante (base). Logo T(n) <= a*n, ou seja, T(n) = O(n).

A condicao essencial e a soma das fracoes dos subproblemas ser menor que 1:
1/5 + 7/10 = 9/10 < 1. Cada nivel da recursao paga so 9/10 do anterior, entao o
trabalho total e uma serie geometrica: c*n*(1 + 9/10 + (9/10)^2 + ...) = 10*c*n.

## Por que grupos de 3 nao funcionam

Com grupos de 3, ao menos metade das ceil(n/3) medianas e <= p, e cada grupo
cuja mediana e <= p tem 2 elementos <= p (a mediana e o menor). Dai:

    #{x <= p} >= 2 * (n/6) = n/3, lado que sobra <= 2n/3 (+ constante).

A recorrencia vira

    T(n) <= T(n/3) + T(2n/3) + c*n,

e 1/3 + 2/3 = 1, nao menor que 1. Cada nivel da recursao paga n inteiro, e ha
log n niveis, entao T(n) = Theta(n log n): perde o ganho sobre ordenar. (Grupos de 5 sao o menor tamanho impar para o qual a soma fecha abaixo de 1; 7 ou mais tambem funcionam, so com constante pior na ordenacao dos grupos.)

## Medido

Na entrada adversaria do quickselect ingenuo (lista ordenada, k = n - 1,
`gerar_adversario_ingenuo`), contagem de comparacoes:

| n    | pivo primeiro | mediana das medianas |
|------|---------------|----------------------|
| 1000 | 500499        | 5447                 |
| 2000 | 2000999       | 11159                |

Dobrar n multiplica por quase 4 o ingenuo (quadratico) e por pouco mais de 2 a
mediana das medianas (linear). Os testes
`test_ingenuo_e_quadratico_no_adversario` e
`test_mediana_das_medianas_e_linear_no_adversario` fixam isso.

Na pratica a constante da mediana das medianas e grande; o quickselect
aleatorio costuma ganhar em tempo de relogio, e a vantagem do O(n) e a garantia
de pior caso.
