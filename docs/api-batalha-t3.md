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
| GET | `/api/t3/jogo/novo?size=16&seed=42&nivel_inicial=35` | Nova partida com ginasios ligados. |
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
    "lider": "Lider2",
    "regiao": 1,
    "percentil": 0.6333333333333333,
    "nivel_time": 62
  }
}
```

`nivel_time` e o nivel do time do lider (k-esimo da populacao da regiao, k pelo
`percentil`). O ginasio e predio: continua no mapa depois de vencido e, vencido, so
deixa passar (`ginasio_ja_vencido: true`, sem encontro).

## `GET /api/t3/jogo/novo`

```json
{
  "sessao": "c202f0419b392a20",
  "size": 16,
  "seed": 1,
  "posicao": [
    0,
    0
  ],
  "ginasios": [
    {
      "posicao": [
        2,
        12
      ],
      "lider": "Lider2",
      "regiao": 1,
      "percentil": 0.6333333333333333,
      "nivel_time": 62
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
        "nome": "Squirtle-inicial",
        "especie": "Squirtle",
        "tipo": "Water",
        "nivel": 35,
        "hp": 75,
        "hp_max": 75,
        "vivo": true
      }
    ],
    "lideres": {
      "derrotados": 0,
      "total": 4,
      "regioes_derrotadas": []
    },
    "em_batalha": null
  },
  "celulas": "... 16 linhas x 16 colunas, cada celula como o exemplo abaixo ..."
}
```

`nivel_inicial` (1 a 100, padrao 35) e o nivel do Pokemon inicial. O time comeca com
1 Pokemon, 5 pokebolas, 5 pocoes, 10000 de dinheiro. Pisar num Centro cura o time
inteiro (`curou: true`).

## `GET /api/t3/jogo/mover`

Resposta quando o passo termina num selvagem (a celula continua `pokemon` no mapa; ela
so vira `visitado` quando a batalha acaba sem derrota):

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
  "batalha_id": "d0a3570db245dd11",
  "adversario": {
    "percentil": 0.39617593199750467,
    "nivel": 40
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
      "nome": "Squirtle-inicial",
      "especie": "Squirtle",
      "tipo": "Water",
      "nivel": 35,
      "hp": 75,
      "hp_max": 75,
      "vivo": true,
      "xp": 42875,
      "xp_proximo_nivel": 46656
    },
    "time": [
      {
        "nome": "Squirtle-inicial",
        "especie": "Squirtle",
        "tipo": "Water",
        "nivel": 35,
        "hp": 75,
        "hp_max": 75,
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
      "nome": "Geodude-selvagem",
      "especie": "Geodude",
      "tipo": "Rock",
      "nivel": 40,
      "hp": 82,
      "hp_max": 82,
      "vivo": true
    },
    "restantes": 1,
    "tamanho_time": 1
  },
  "previsao": {
    "n": 1000,
    "vitoria": 0.872,
    "hp_restante": {
      "p10": 0.0,
      "p50": 0.52,
      "p90": 0.5866666666666667
    },
    "hp_restante_vitorias": {
      "p10": 0.08,
      "p50": 0.5333333333333333,
      "p90": 0.5866666666666667
    },
    "turnos": {
      "p10": 2,
      "p50": 2,
      "p90": 3
    },
    "tempo_ms": 35.8
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

Resposta a `lutar` (golpe 0, Hydropump super efetivo contra um Geodude; depois a CPU
revida):

```json
{
  "batalha_id": "d0a3570db245dd11",
  "eventos": [
    {
      "tipo": "golpe",
      "quem": "jogador",
      "pokemon": "Squirtle-inicial",
      "golpe": "Hydropump",
      "efetividade": 2.0,
      "critico": false,
      "dano": 46,
      "hp_antes": 82,
      "hp_depois": 36,
      "hp_max": 82,
      "alvo": "Geodude-selvagem",
      "pp_restante": 4
    },
    {
      "tipo": "golpe",
      "quem": "oponente",
      "pokemon": "Geodude-selvagem",
      "golpe": "Rock-throw",
      "efetividade": 1.0,
      "critico": false,
      "dano": 35,
      "hp_antes": 75,
      "hp_depois": 40,
      "hp_max": 75,
      "alvo": "Squirtle-inicial",
      "pp_restante": 14
    }
  ],
  "estado": {
    "tipo": "selvagem",
    "estado": "aguardando_acao",
    "turno": 1,
    "resultado": null,
    "acoes_validas": [
      "lutar",
      "mochila",
      "fugir"
    ],
    "jogador": {
      "ativo": {
        "nome": "Squirtle-inicial",
        "especie": "Squirtle",
        "tipo": "Water",
        "nivel": 35,
        "hp": 40,
        "hp_max": 75,
        "vivo": true,
        "xp": 42875,
        "xp_proximo_nivel": 46656
      },
      "time": [
        {
          "nome": "Squirtle-inicial",
          "especie": "Squirtle",
          "tipo": "Water",
          "nivel": 35,
          "hp": 40,
          "hp_max": 75,
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
        "nome": "Geodude-selvagem",
        "especie": "Geodude",
        "tipo": "Rock",
        "nivel": 40,
        "hp": 36,
        "hp_max": 82,
        "vivo": true
      },
      "restantes": 1,
      "tamanho_time": 1
    }
  },
  "jogo": "... resumo do jogo ..."
}
```

Resposta a `mochila`/`pocao` (cura e depois leva um golpe):

```json
{
  "batalha_id": "d0a3570db245dd11",
  "eventos": [
    {
      "tipo": "pocao",
      "quem": "jogador",
      "pokemon": "Squirtle-inicial",
      "cura": 35,
      "hp_antes": 40,
      "hp_depois": 75,
      "hp_max": 75
    },
    {
      "tipo": "golpe",
      "quem": "oponente",
      "pokemon": "Geodude-selvagem",
      "golpe": "head-butt",
      "efetividade": 1.0,
      "critico": false,
      "dano": 32,
      "hp_antes": 75,
      "hp_depois": 43,
      "hp_max": 75,
      "alvo": "Squirtle-inicial",
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
        "nome": "Squirtle-inicial",
        "especie": "Squirtle",
        "tipo": "Water",
        "nivel": 35,
        "hp": 43,
        "hp_max": 75,
        "vivo": true,
        "xp": 42875,
        "xp_proximo_nivel": 46656
      },
      "time": [
        {
          "nome": "Squirtle-inicial",
          "especie": "Squirtle",
          "tipo": "Water",
          "nivel": 35,
          "hp": 43,
          "hp_max": 75,
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
        "pocao": 4,
        "pokebola": 5
      }
    },
    "oponente": {
      "ativo": {
        "nome": "Geodude-selvagem",
        "especie": "Geodude",
        "tipo": "Rock",
        "nivel": 40,
        "hp": 36,
        "hp_max": 82,
        "vivo": true
      },
      "restantes": 1,
      "tamanho_time": 1
    }
  },
  "jogo": "... resumo do jogo ..."
}
```

Resposta a `mochila`/`pokebola` (captura que falha, a CPU ataca e derruba o Pokemon;
o time acabou, a batalha termina em derrota):

```json
{
  "batalha_id": "d0a3570db245dd11",
  "eventos": [
    {
      "tipo": "captura",
      "sucesso": false,
      "balancadas": 1,
      "pokemon": "Geodude-selvagem",
      "chance": 0.5146
    },
    {
      "tipo": "golpe",
      "quem": "oponente",
      "pokemon": "Geodude-selvagem",
      "golpe": "Rock-throw",
      "efetividade": 1.0,
      "critico": false,
      "dano": 13,
      "hp_antes": 13,
      "hp_depois": 0,
      "hp_max": 75,
      "alvo": "Squirtle-inicial",
      "pp_restante": 13
    },
    {
      "tipo": "desmaio",
      "quem": "jogador",
      "pokemon": "Squirtle-inicial"
    },
    {
      "tipo": "fim",
      "resultado": "derrota"
    }
  ],
  "estado": {
    "tipo": "selvagem",
    "estado": "fim",
    "turno": 4,
    "resultado": "derrota",
    "acoes_validas": [],
    "jogador": {
      "ativo": {
        "nome": "Squirtle-inicial",
        "especie": "Squirtle",
        "tipo": "Water",
        "nivel": 35,
        "hp": 0,
        "hp_max": 75,
        "vivo": false,
        "xp": 42875,
        "xp_proximo_nivel": 46656
      },
      "time": [
        {
          "nome": "Squirtle-inicial",
          "especie": "Squirtle",
          "tipo": "Water",
          "nivel": 35,
          "hp": 0,
          "hp_max": 75,
          "vivo": false,
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
        "pocao": 4,
        "pokebola": 3
      }
    },
    "oponente": {
      "ativo": {
        "nome": "Geodude-selvagem",
        "especie": "Geodude",
        "tipo": "Rock",
        "nivel": 40,
        "hp": 36,
        "hp_max": 82,
        "vivo": true
      },
      "restantes": 1,
      "tamanho_time": 1
    }
  },
  "jogo": {
    "situacao": "derrota",
    "motivo": "time inteiro desmaiou",
    "dinheiro": 10000,
    "pokebolas": 3,
    "pocoes": 4,
    "time": [
      {
        "indice": 0,
        "nome": "Squirtle-inicial",
        "especie": "Squirtle",
        "tipo": "Water",
        "nivel": 35,
        "hp": 0,
        "hp_max": 75,
        "vivo": false
      }
    ],
    "lideres": {
      "derrotados": 0,
      "total": 4,
      "regioes_derrotadas": []
    },
    "em_batalha": null
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
| `golpe` | `quem`, `pokemon`, `golpe`, `alvo`, `efetividade` (2.0, 1.0, 0.5), `critico`, `dano`, `hp_antes`, `hp_depois`, `hp_max`, `pp_restante` (null no Esforco) |
| `errou` | `quem`, `pokemon`, `golpe` |
| `recuo` | `quem`, `pokemon`, `dano`, `hp_antes`, `hp_depois`, `hp_max` (so do Esforco) |
| `pocao` | `quem`, `pokemon`, `cura`, `hp_antes`, `hp_depois`, `hp_max` |
| `troca` | `quem`, `de`, `para`, `indice`, `forcada` (a CPU manda o proximo com `forcada: true`) |
| `desmaio` | `quem`, `pokemon` |
| `xp` | `pokemon`, `ganho`, `xp_total`, `nivel_antes`, `nivel_depois`, `hp`, `hp_max` |
| `dinheiro` | `ganho` (treinador e lider) |
| `captura` | `sucesso`, `balancadas` (0 a 3), `pokemon`, `chance` |
| `fuga` | `sucesso`, `chance` |
| `fim` | `resultado`: `vitoria`, `derrota`, `fuga` ou `captura` |

### Estado resumido

`estado.estado` e `aguardando_acao`, `troca_forcada` (so a acao `pokemon` e valida) ou
`fim`. `estado.resultado` e `null` ate o fim. `estado.jogador` traz `ativo` (com `xp` e
`xp_proximo_nivel`), `time`, `golpes` (com `pp`) e `mochila`; `estado.oponente` traz
`ativo`, `restantes` e `tamanho_time`. `jogo` e o resumo da partida: `situacao`
(`jogando`, `derrota`, `vitoria`), dinheiro, time e `lideres.derrotados/total`.

Fim da partida: `derrota` quando o time inteiro desmaia; `vitoria` quando todos os
lideres do mapa caem.

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

- selvagem: `p` sorteado em [0.20, 0.50] a cada encontro;
- treinador: `p` fixo por treinador em [0.40, 0.70], derivado de (seed, posicao);
  time de 2 Pokemon;
- lider: o percentil do ginasio (fase 1), time de 3.

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
