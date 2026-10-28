# API de batalha do Trabalho 3 (`/api/t3/*`)

Jogo com ginasios e batalha por turnos. Os exemplos abaixo foram gerados rodando o
servidor de verdade (`python -m webdemo`), mapa `size=16&seed=1`, sem edicao a mao
(so cortei listas longas, marcadas com `...`).

Motor sem HTTP: `batalha/` (`motor.py`, `dano.py`, `tipos.py`, `cpu.py`, `niveis.py`,
`previsao.py`). Casca HTTP: `webdemo/api_batalha.py` e `webdemo/server.py`. As rotas
`/api/t2/*` nao mudam.

## Rotas

| Metodo | Rota | O que faz |
|---|---|---|
| GET | `/api/t3/jogo/novo?size=16&seed=42&nivel_inicial=8` | Nova partida com ginasios ligados. |
| GET | `/api/t3/jogo/estado?sessao=ID` | Posicao, encontro pendente, resumo do jogo. |
| GET | `/api/t3/jogo/mover?sessao=ID&direcao=W/A/S/D` | Anda uma casa. Esbarrou em selvagem, treinador ou ginasio: devolve `encontro`, **nao luta**. |
| POST | `/api/t3/batalha/nova` | Abre a batalha do encontro pendente. Devolve estado inicial e previsao. |
| POST | `/api/t3/batalha/acao` | Uma acao do jogador. Devolve a lista ordenada de eventos e o estado. |
| GET | `/api/t3/batalha/estado?batalha_id=ID` | Estado atual (pra recarregar a pagina). |

Jogo e GET (como no T2). Batalha e POST com corpo JSON. A partida vive em memoria e
morre com o processo (ate 20 sessoes, 50 batalhas).

Erros: `{"erro": "texto"}` com status `400` (acao ou parametro invalido, nao gasta
turno), `404` (sessao ou batalha desconhecida, rota desconhecida), `409` (estado nao
permite: andar com batalha pendente, abrir batalha sem encontro ou de outro tipo,
partida encerrada).

## Mapa

A celula de ginasio vem com `conteudo: "ginasio"` e o campo opcional `ginasio` (so
nela). Nenhuma outra celula muda de forma.

```json
{
  "terreno": "concrete",
  "conteudo": "ginasio",
  "pisavel_sem_surf": true,
  "pisavel_com_surf": true,
  "ginasio": {
    "lider": "Lider1",
    "regiao": 0,
    "percentil": 0.5,
    "nivel_time": 13
  }
}
```

`nivel_time` e o nivel do time do lider (k-esimo da populacao da regiao, k pelo
`percentil`). O ginasio e predio: continua no mapa depois de vencido e, vencido, so
deixa passar (`ginasio_ja_vencido: true`, sem encontro).

## `GET /api/t3/jogo/novo`

```json
{
  "sessao": "2dc79e4ea739e271",
  "size": 16,
  "seed": 1,
  "posicao": [
    0,
    0
  ],
  "celulas": "... 16 linhas x 16 colunas, cada celula como o exemplo acima ...",
  "ginasios": [
    {
      "posicao": [
        4,
        3
      ],
      "lider": "Lider1",
      "regiao": 0,
      "percentil": 0.5,
      "nivel_time": 13
    },
    "..."
  ],
  "jogador": {
    "situacao": "jogando",
    "motivo": "",
    "dinheiro": 10000,
    "pokebolas": 5,
    "pocoes": 5,
    "time": [
      {
        "indice": 0,
        "nome": "Squirtuga-inicial",
        "especie": "Squirtuga",
        "tipo": "Water",
        "nivel": 8,
        "hp": 25,
        "hp_max": 25,
        "vivo": true
      }
    ],
    "lideres": {
      "derrotados": 0,
      "total": 4,
      "regioes_derrotadas": []
    },
    "em_batalha": null,
    "derrotas": 0,
    "ultima_derrota": null
  }
}
```

`nivel_inicial` (1 a 100, padrao 8) e o nivel do Pokemon inicial. O time comeca com
1 Pokemon, 5 pokebolas, 5 pocoes, 10000 de dinheiro. Pisar num Centro cura o time
inteiro (`curou: true`).

## `GET /api/t3/jogo/mover`

Resposta quando o passo termina num selvagem (a celula continua `pokemon` no mapa; ela
so vira `visitado` quando a batalha termina em vitoria, fuga ou captura):

```json
{
  "valido": true,
  "motivo": "",
  "posicao": [
    1,
    2
  ],
  "conteudo": "pokemon",
  "pegou_pokebola": false,
  "pegou_surf": false,
  "em_centro": false,
  "curou": false,
  "ginasio_ja_vencido": false,
  "encontro": {
    "tipo": "selvagem",
    "posicao": [
      1,
      2
    ],
    "regiao": 0
  },
  "celula": {
    "posicao": [
      1,
      2
    ],
    "terreno": "grass",
    "conteudo": "pokemon",
    "pisavel_sem_surf": true,
    "pisavel_com_surf": true
  },
  "jogador": "... (mesmo resumo do jogo/novo) ..."
}
```

`encontro.tipo` e `selvagem`, `treinador` ou `lider`. Para `lider` o objeto traz tambem
`lider`, `percentil` e `nivel_time`. Enquanto houver encontro ou batalha pendente,
`mover` responde 409.

## `POST /api/t3/batalha/nova`

Corpo: `{"sessao": "ID", "tipo": "selvagem|treinador|lider", "previsao_n": 1000}`
(`previsao_n` opcional, 1 a 5000). `tipo` precisa ser o do encontro pendente.

```json
{
  "batalha_id": "196f31303741ffca",
  "adversario": {
    "percentil": 0.10668901644421219,
    "nivel": 5
  },
  "tipo": "selvagem",
  "estado": "aguardando_acao",
  "turno": 0,
  "resultado": null,
  "acoes_validas": [
    "lutar",
    "mochila",
    "fugir"
  ],
  "jogador": {
    "ativo": {
      "nome": "Squirtuga-inicial",
      "especie": "Squirtuga",
      "tipo": "Water",
      "nivel": 8,
      "hp": 25,
      "hp_max": 25,
      "vivo": true,
      "xp": 512,
      "xp_nivel_atual": 512,
      "xp_proximo_nivel": 729
    },
    "time": [
      {
        "nome": "Squirtuga-inicial",
        "especie": "Squirtuga",
        "tipo": "Water",
        "nivel": 8,
        "hp": 25,
        "hp_max": 25,
        "vivo": true,
        "indice": 0,
        "ativo": true
      }
    ],
    "golpes": [
      {
        "indice": 0,
        "nome": "Hydropump",
        "tipo": "Water",
        "poder": 110,
        "precisao": 80,
        "pp": 5,
        "pp_max": 5
      },
      {
        "indice": 1,
        "nome": "Bite",
        "tipo": "Normal",
        "poder": 60,
        "precisao": 100,
        "pp": 25,
        "pp_max": 25
      }
    ],
    "mochila": {
      "pocao": 5,
      "pokebola": 5
    }
  },
  "oponente": {
    "ativo": {
      "nome": "Geobruto-selvagem",
      "especie": "Geobruto",
      "tipo": "Rock",
      "nivel": 5,
      "hp": 19,
      "hp_max": 19,
      "vivo": true
    },
    "restantes": 1,
    "tamanho_time": 1
  },
  "previsao": {
    "n": 1000,
    "vitoria": 1.0,
    "hp_restante": {
      "p10": 0.76,
      "p50": 1.0,
      "p90": 1.0
    },
    "hp_restante_vitorias": {
      "p10": 0.76,
      "p50": 1.0,
      "p90": 1.0
    },
    "turnos": {
      "p10": 1,
      "p50": 1,
      "p90": 2
    },
    "tempo_ms": 23.8
  }
}
```

- `adversario`: `nivel` e `percentil` do sorteio (e `nome` em treinador e lider).
- `acoes_validas`: o que o botao pode oferecer agora (`fugir` so em selvagem, `pokemon`
  so com outro Pokemon vivo no time).
- `previsao`: simulacao de `n` batalhas (ver "Previsao" abaixo). `hp_restante` e a
  fracao do HP total do time; derrota conta 0.
- `jogador.golpes[].indice` e o numero que a acao `lutar` recebe.

## `POST /api/t3/batalha/acao`

Corpo: `{"batalha_id": "ID", "acao": "lutar|mochila|pokemon|fugir", ...}`

| acao | campos | efeito |
|---|---|---|
| `lutar` | `golpe`: indice do golpe | Golpe; a ordem com a CPU e por Velocidade. Sem PP em nenhum golpe, o campo e ignorado e vale o Esforco. |
| `mochila` | `item`: `pocao` ou `pokebola` | Pocao cura 40 de HP. Pokebola so em selvagem. Gasta o turno. |
| `pokemon` | `alvo`: indice no time | Troca. Gasta o turno; apos desmaio e a troca forcada e nao gasta. |
| `fugir` | nenhum | So em selvagem. |

Resposta a `lutar` (golpe 0, Hydropump super efetivo contra um Geobruto; depois a CPU
revida):

```json
{
  "batalha_id": "196f31303741ffca",
  "eventos": [
    {
      "tipo": "golpe",
      "quem": "jogador",
      "pokemon": "Squirtuga-inicial",
      "golpe": "Hydropump",
      "tipo_golpe": "Water",
      "efetividade": 2.0,
      "critico": false,
      "dano": 19,
      "hp_antes": 19,
      "hp_depois": 0,
      "hp_max": 19,
      "alvo": "Geobruto-selvagem",
      "pp_restante": 4
    },
    {
      "tipo": "desmaio",
      "quem": "oponente",
      "pokemon": "Geobruto-selvagem"
    },
    {
      "tipo": "xp",
      "pokemon": "Squirtuga-inicial",
      "ganho": 45,
      "xp_total": 557,
      "nivel_antes": 8,
      "nivel_depois": 8,
      "hp": 25,
      "hp_max": 25,
      "xp_nivel_antes": 512,
      "xp_proximo_nivel_antes": 729,
      "xp_nivel_atual": 512,
      "xp_proximo_nivel": 729
    },
    {
      "tipo": "fim",
      "resultado": "vitoria"
    }
  ],
  "estado": {
    "tipo": "selvagem",
    "estado": "fim",
    "turno": 1,
    "resultado": "vitoria",
    "acoes_validas": [],
    "jogador": {
      "ativo": {
        "nome": "Squirtuga-inicial",
        "especie": "Squirtuga",
        "tipo": "Water",
        "nivel": 8,
        "hp": 25,
        "hp_max": 25,
        "vivo": true,
        "xp": 557,
        "xp_nivel_atual": 512,
        "xp_proximo_nivel": 729
      },
      "time": [
        {
          "nome": "Squirtuga-inicial",
          "especie": "Squirtuga",
          "tipo": "Water",
          "nivel": 8,
          "hp": 25,
          "hp_max": 25,
          "vivo": true,
          "indice": 0,
          "ativo": true
        }
      ],
      "golpes": [
        {
          "indice": 0,
          "nome": "Hydropump",
          "tipo": "Water",
          "poder": 110,
          "precisao": 80,
          "pp": 4,
          "pp_max": 5
        },
        {
          "indice": 1,
          "nome": "Bite",
          "tipo": "Normal",
          "poder": 60,
          "precisao": 100,
          "pp": 25,
          "pp_max": 25
        }
      ],
      "mochila": {
        "pocao": 5,
        "pokebola": 5
      }
    },
    "oponente": {
      "ativo": {
        "nome": "Geobruto-selvagem",
        "especie": "Geobruto",
        "tipo": "Rock",
        "nivel": 5,
        "hp": 0,
        "hp_max": 19,
        "vivo": false
      },
      "restantes": 0,
      "tamanho_time": 1
    }
  },
  "jogo": "... resumo do jogo ..."
}
```

Resposta a `mochila`/`pocao` (cura e depois leva um golpe):

```json
{
  "batalha_id": "015d28e86d5c8e89",
  "eventos": [
    {
      "tipo": "pocao",
      "quem": "jogador",
      "pokemon": "Squirtuga-inicial",
      "cura": 6,
      "hp_antes": 19,
      "hp_depois": 25,
      "hp_max": 25
    },
    {
      "tipo": "golpe",
      "quem": "oponente",
      "pokemon": "Geobruto-selvagem",
      "golpe": "head-butt",
      "tipo_golpe": "Normal",
      "efetividade": 1.0,
      "critico": false,
      "dano": 5,
      "hp_antes": 25,
      "hp_depois": 20,
      "hp_max": 25,
      "alvo": "Squirtuga-inicial",
      "pp_restante": 14
    }
  ],
  "estado": {
    "tipo": "selvagem",
    "estado": "aguardando_acao",
    "turno": 2,
    "resultado": null,
    "acoes_validas": [
      "lutar",
      "mochila",
      "fugir"
    ],
    "jogador": {
      "ativo": {
        "nome": "Squirtuga-inicial",
        "especie": "Squirtuga",
        "tipo": "Water",
        "nivel": 8,
        "hp": 20,
        "hp_max": 25,
        "vivo": true,
        "xp": 512,
        "xp_nivel_atual": 512,
        "xp_proximo_nivel": 729
      },
      "time": [
        {
          "nome": "Squirtuga-inicial",
          "especie": "Squirtuga",
          "tipo": "Water",
          "nivel": 8,
          "hp": 20,
          "hp_max": 25,
          "vivo": true,
          "indice": 0,
          "ativo": true
        }
      ],
      "golpes": [
        {
          "indice": 0,
          "nome": "Hydropump",
          "tipo": "Water",
          "poder": 110,
          "precisao": 80,
          "pp": 5,
          "pp_max": 5
        },
        {
          "indice": 1,
          "nome": "Bite",
          "tipo": "Normal",
          "poder": 60,
          "precisao": 100,
          "pp": 24,
          "pp_max": 25
        }
      ],
      "mochila": {
        "pocao": 4,
        "pokebola": 5
      }
    },
    "oponente": {
      "ativo": {
        "nome": "Geobruto-selvagem",
        "especie": "Geobruto",
        "tipo": "Rock",
        "nivel": 5,
        "hp": 17,
        "hp_max": 19,
        "vivo": true
      },
      "restantes": 1,
      "tamanho_time": 1
    }
  },
  "jogo": "... resumo do jogo ..."
}
```

Resposta quando o time acaba (o mesmo mapa, um treinador a 3 casas da origem; so os 3
ultimos eventos e o resumo do jogo, que ja traz a derrota aplicada):

```json
{
  "batalha_id": "1c9695258890d409",
  "eventos": [
    {
      "tipo": "golpe",
      "quem": "oponente",
      "pokemon": "Geobruto-Jenny-2",
      "golpe": "Rock-throw",
      "tipo_golpe": "Rock",
      "efetividade": 1.0,
      "critico": false,
      "dano": 1,
      "hp_antes": 1,
      "hp_depois": 0,
      "hp_max": 25,
      "alvo": "Squirtuga-inicial",
      "pp_restante": 13
    },
    {
      "tipo": "desmaio",
      "quem": "jogador",
      "pokemon": "Squirtuga-inicial"
    },
    {
      "tipo": "fim",
      "resultado": "derrota"
    }
  ],
  "estado": "... estado final, time curado ...",
  "jogo": {
    "situacao": "jogando",
    "motivo": "",
    "dinheiro": 5000,
    "pokebolas": 5,
    "pocoes": 5,
    "time": [
      {
        "indice": 0,
        "nome": "Squirtuga-inicial",
        "especie": "Squirtuga",
        "tipo": "Water",
        "nivel": 8,
        "hp": 25,
        "hp_max": 25,
        "vivo": true
      }
    ],
    "lideres": {
      "derrotados": 0,
      "total": 4,
      "regioes_derrotadas": []
    },
    "em_batalha": null,
    "derrotas": 1,
    "ultima_derrota": {
      "n": 1,
      "para": [
        0,
        0
      ],
      "local": "origem",
      "dinheiro_perdido": 5000,
      "dinheiro": 5000,
      "adversario": "treinador"
    }
  }
}
```

Depois do `fim`, qualquer acao responde 400:

```json
{
  "erro": "a batalha ja acabou"
}
```

### Eventos

`eventos` e a lista, na ordem em que aconteceu, pro front animar. Todo evento tem
`tipo`. `quem` e `"jogador"` ou `"oponente"`; nos eventos de dano, `hp_antes`,
`hp_depois` e `hp_max` sao de **quem apanhou** (`alvo`).

| tipo | campos alem de `tipo` |
|---|---|
| `golpe` | `quem`, `pokemon`, `golpe`, `tipo_golpe`, `alvo`, `efetividade` (2.0, 1.0, 0.5), `critico`, `dano`, `hp_antes`, `hp_depois`, `hp_max`, `pp_restante` (null no Esforco) |
| `errou` | `quem`, `pokemon`, `golpe`, `tipo_golpe` |
| `recuo` | `quem`, `pokemon`, `dano`, `hp_antes`, `hp_depois`, `hp_max` (so do Esforco) |
| `pocao` | `quem`, `pokemon`, `cura`, `hp_antes`, `hp_depois`, `hp_max` |
| `troca` | `quem`, `de`, `para`, `indice`, `forcada` (a CPU manda o proximo com `forcada: true`) |
| `desmaio` | `quem`, `pokemon` |
| `xp` | `pokemon`, `ganho`, `xp_total`, `nivel_antes`, `nivel_depois`, `hp`, `hp_max`, `xp_nivel_antes`, `xp_proximo_nivel_antes`, `xp_nivel_atual`, `xp_proximo_nivel` |
| `dinheiro` | `ganho` (treinador e lider) |
| `captura` | `sucesso`, `balancadas` (0 a 3), `pokemon`, `chance` |
| `fuga` | `sucesso`, `chance` |
| `fim` | `resultado`: `vitoria`, `derrota`, `fuga` ou `captura` |

### Estado resumido

`estado.estado` e `aguardando_acao`, `troca_forcada` (so a acao `pokemon` e valida) ou
`fim`. `estado.resultado` e `null` ate o fim. `estado.jogador` traz `ativo` (com `xp`,
`xp_nivel_atual` e `xp_proximo_nivel`), `time`, `golpes` (com `pp`) e `mochila`; `estado.oponente` traz
`ativo`, `restantes` e `tamanho_time`. `jogo` e o resumo da partida: `situacao`
(`jogando` ou `vitoria`), dinheiro, time, `lideres.derrotados/total`, `derrotas` (quantas vezes
o time caiu) e `ultima_derrota` (`null` ate a primeira).

Fim da partida: so `vitoria`, quando todos os lideres do mapa caem. Derrota nao encerra
o jogo (ver "Derrota" abaixo).

## Etapa 4: progressao, derrota sem fim de jogo e contrato aditivo

### Progressao por distancia

O mapa continua dividido em regioes (blocos de 8 x 8). A populacao de niveis de cada
regiao agora cresce com a distancia do bloco ate a origem (0, 0): `t` = distancia
euclidiana do canto do bloco mais proximo da origem, dividida pela maior entre os blocos.
Piso e teto interpolam linearmente de (5, 30) em `t = 0` ate (50, 100) em `t = 1`
(a meio caminho, cerca de 27 a 65). A populacao e assimetrica: `nivel = piso + (teto - piso) *
u**1.6`, `u` uniforme, entao ha mais fracos que fortes. Os lideres seguem a mediana
(primeiro) ate o percentil 0.9 (ultimo), e agora a ordem dos percentis e dos nomes
(`Lider1`, `Lider2`...) e a da distancia da regiao, nao a da linha do bloco. O nivel
sempre sai de `selecionar` (mediana das medianas). O jogador nasce no nivel 8.

### Derrota nao encerra o jogo

Quando o time inteiro desmaia a batalha termina em `derrota` e a API ja aplica o que
acontece depois: o jogador volta ao **ultimo Centro pisado** (ou a origem, se nao pisou em
nenhum), o time inteiro e curado (HP e PP) e o dinheiro cai pela metade. O adversario que
venceu continua no mapa. `situacao` segue `jogando`. O resumo do jogo traz:

```json
"derrotas": 1,
"ultima_derrota": {"n": 1, "para": [0, 0], "local": "origem", "dinheiro_perdido": 5000, "dinheiro": 5000, "adversario": "treinador"}
```

`para` e a celula onde o jogador reaparece, `local` e `centro` ou `origem`. A posicao ja vem
atualizada em `jogo/estado`.

### Subida de nivel e barra de XP

O evento `xp` e o estado do Pokemon ativo agora trazem os limites da barra, entao o front
nao precisa conhecer a curva (`L**3`) nem o nivel maximo: fracao da barra =
`(xp - xp_nivel_atual) / (xp_proximo_nivel - xp_nivel_atual)`. `xp_proximo_nivel` e `null`
no nivel 100. No evento, `xp_nivel_antes`/`xp_proximo_nivel_antes` sao os limites do nivel
de ANTES (de onde a barra parte) e `xp_nivel_atual`/`xp_proximo_nivel` os do nivel de
DEPOIS (onde ela termina; se subiu varios niveis, a barra enche e recomeca a cada um).

Subida real, sem tocar em XP: mapa `size=16&seed=1`, o inicial (nivel 8) vence os selvagens
de (1, 2) e (2, 1) e depois o de (4, 2):

```json
{
  "eventos": [
    {
      "tipo": "xp",
      "pokemon": "Squirtuga-inicial",
      "ganho": 54,
      "xp_total": 746,
      "nivel_antes": 8,
      "nivel_depois": 9,
      "hp": 17,
      "hp_max": 26,
      "xp_nivel_antes": 512,
      "xp_proximo_nivel_antes": 729,
      "xp_nivel_atual": 729,
      "xp_proximo_nivel": 1000
    }
  ],
  "estado.jogador.ativo": {
    "nome": "Squirtuga-inicial",
    "especie": "Squirtuga",
    "tipo": "Water",
    "nivel": 9,
    "hp": 17,
    "hp_max": 26,
    "vivo": true,
    "xp": 746,
    "xp_nivel_atual": 729,
    "xp_proximo_nivel": 1000
  }
}
```

### Troca de Pokemon

Para ter dois Pokemon e preciso capturar. Na `size=12&seed=1` o inicial e um Squirtuga
nivel 8 e o selvagem de (3, 3) (Squirtuga nivel 7) cai na pokebola depois de baixar o HP dele
abaixo de 35%. Nos testes automatizados a captura roda em `size=12&seed=2`, selvagem posto
em (1, 3): o inicial e um Sonolax e o capturado um Miaupsi nivel 5
(`tests/test_api_batalha.py::capturar_segundo`).

Troca voluntaria (`acao: "pokemon"`, `alvo: 1`) gasta o turno: o evento `troca` vem com
`forcada: false` e a CPU ataca em seguida, no Pokemon que acabou de entrar:

```json
[
  {
    "tipo": "troca",
    "quem": "jogador",
    "de": "Squirtuga-inicial",
    "para": "Squirtuga-selvagem",
    "indice": 1,
    "forcada": false
  },
  {
    "tipo": "golpe",
    "quem": "oponente",
    "pokemon": "Chamandrel-selvagem",
    "golpe": "Bite",
    "tipo_golpe": "Normal",
    "efetividade": 1.0,
    "critico": false,
    "dano": 6,
    "hp_antes": 23,
    "hp_depois": 17,
    "hp_max": 23,
    "alvo": "Squirtuga-selvagem",
    "pp_restante": 24
  }
]
```

Troca forcada: quando o Pokemon em campo desmaia e ha outro vivo, o estado vira
`troca_forcada`, `acoes_validas` fica so `["pokemon"]` e qualquer outra acao responde 400.
A troca escolhida vem com `forcada: true` e **nao gasta turno** (o `turno` do estado nao
muda; a CPU nao ataca):

```json
[
  {
    "tipo": "troca",
    "quem": "jogador",
    "de": "Squirtuga-inicial",
    "para": "Squirtuga-selvagem",
    "indice": 1,
    "forcada": true
  }
]
```

## Regras (o que o motor faz)

Stats, com `B` = base da especie e `L` = nivel (sem IV nem EV):

```
HP         = (2*B*L)//100 + L + 10
Ataque, Defesa, Velocidade = (2*B*L)//100 + 5
```

Dano, estilo classico, inteiros:

```
base  = ((2*L//5 + 2) * poder * Ataque // Defesa) // 50 + 2
dano  = int(base * STAB * tipo * critico * variacao), minimo 1
```

STAB 1.5 (golpe do mesmo tipo de quem ataca), tipo 2.0/1.0/0.5, critico 1.5 com chance
1/16, variacao uniforme em [0.85, 1.0]. Ordem dos sorteios: precisao, critico,
variacao. Todo sorteio vem de um `random.Random` por batalha, semeado por
`(seed do mapa, numero da batalha)`: mesma seed e mesmas acoes, mesmos eventos.

Tabela de tipos (golpe nas linhas, defensor nas colunas):

| golpe \ defensor | Fire | Water | Rock | Psychic | Normal |
|---|---|---|---|---|---|
| Fire | 0.5 | 0.5 | 0.5 | 2.0 | 1.0 |
| Water | 2.0 | 0.5 | 2.0 | 1.0 | 1.0 |
| Rock | 2.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| Psychic | 1.0 | 1.0 | 1.0 | 0.5 | 1.0 |
| Normal | 1.0 | 1.0 | 0.5 | 1.0 | 1.0 |

Segue a serie, com um desvio: Fire x Psychic = 2.0 (os alvos do fogo na serie, grama,
gelo, inseto e aco, nao existem aqui; sem isso o fogo so teria desvantagem).

Catalogo de golpes (tipo, poder, precisao, PP): Flamethrower (Fire, 90, 100, 15),
Fire-blast (Fire, 110, 85, 5), Hydropump (Water, 110, 80, 5), Rock-throw (Rock, 50, 90,
15), Mind-beam (Psychic, 65, 100, 20), Psychic-slam (Psychic, 90, 100, 10), Claw e Slap
(Normal, 40, 100, 35), Bite (Normal, 60, 100, 25), head-butt (Normal, 70, 100, 15),
Body-slam (Normal, 85, 100, 15). Golpe fora do catalogo vira Normal, poder igual ao
valor antigo, precisao 100, PP 20. Ate 4 golpes por Pokemon. Sem PP em nenhum golpe: Esforco
(Normal, poder 50, recuo de 1/4 do HP maximo que nunca derruba o dono).

Captura: `p = 0.15 + 0.65 * (1 - hp/hp_max)`; um sorteio `r`: `r < p` captura; falha
balanca `int(3*p/r)` vezes.

Fuga (so selvagem): `p = min(1, 0.5 * vel_jogador / vel_selvagem + 0.1 * tentativas_antes)`.

XP por Pokemon derrotado: `64 * nivel // 7`, vezes 1.5 contra treinador e lider; vai
para o Pokemon do jogador em campo e vivo. Curva: XP total do nivel `L` = `L**3`.
Dinheiro: treinador `100 * nivel`, lider `300 * nivel` (maior nivel do time).

### Niveis (mediana das medianas)

Sempre `selecionar(populacao_da_regiao, k)` com `k = indice_do_percentil(n, p)`:

- selvagem: `p` sorteado a cada encontro numa faixa que sobe com a distancia da celula
  ate a origem, de [0.00, 0.12] (colado na origem) a [0.15, 0.45] (canto oposto);
- treinador: `p` fixo por treinador, derivado de (seed, posicao), na faixa de
  [0.00, 0.10] (origem) a [0.30, 0.60] (canto oposto); time de 2 Pokemon;
- lider: o percentil do ginasio (de 0.5 a 0.9, subindo com a distancia da regiao), time de 3.

### CPU

- Golpe: selvagem e treinador sorteiam com peso igual ao dano esperado; o lider usa o
  de maior dano esperado (achado por `selecionar` com k = topo).
- Proximo Pokemon (quando o atual desmaia): candidatos vivos ordenados por vantagem
  contra o Pokemon do jogador, escolhido por `selecionar`; treinador k = mediana, lider
  k = topo. Vantagem = (melhor dano esperado do candidato / HP do alvo) menos (melhor
  dano esperado do alvo / HP do candidato).

### Previsao

`batalha/previsao.py::prever(equipe, oponentes, tipo, n=1000, seed)` simula `n` batalhas
em copias do estado, com o jogador numa politica simples (golpe de maior dano esperado,
sem pocao, pokebola nem troca voluntaria; XP desligado) e resume com `selecionar`:
`vitoria`, `hp_restante` (p10/p50/p90, derrota conta 0), `hp_restante_vitorias`
(`null` sem vitorias), `turnos` (p10/p50/p90) e `tempo_ms`.

Tempo medido com N=1000 nesta maquina: 1 contra 1, cerca de 30 a 40 ms; time de 3
contra lider de 3 entre 90 e 250 ms (as batalhas longas custam mais). Cabe por
requisicao; `previsao_n` permite baixar.
