**Vídeo de apresentação:** (em breve)

# Pokémon CLI: o Ginásio (Trabalho 3, Dividir e Conquistar)

Projeto de Algoritmos (FGA0124) | Grupo 14 | Módulo 3: Dividir e Conquistar

| Matrícula | Aluno |
| --- | --- |
| 190091681 | Lucas Gabriel Antunes |
| 202045965 | Augusto Campos Duarte |

## Proposta

O líder de ginásio monta o time calibrado pelo k-ésimo nível da população
selvagem da região: em vez de escolher um nível na mão, ele seleciona o
k-ésimo elemento dos níveis dos Pokémon selvagens. A seleção roda em O(n)
garantido pela mediana das medianas. O benchmark compara essa seleção contra
ordenar tudo e contra o quickselect, incluindo uma entrada adversária em que o
quickselect de pivô ingênuo degrada para n². A interface 2.5D em Phaser fica
no `webdemo`.

## Trabalhos anteriores

- Trabalho 1 (Grafos): [`docs/README-trabalho-1.md`](docs/README-trabalho-1.md)
- Trabalho 2 (Algoritmos Ambiciosos): [`docs/README-trabalho-2.md`](docs/README-trabalho-2.md)

## Como rodar

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m pytest                  # testes
python -m webdemo                 # interface web (abre o navegador)
```

A interface sobe em `http://127.0.0.1:<porta>/`. Use `--porta N` para escolher
a porta e `--sem-navegador` para não abrir o navegador.

Terminal (jogo dos Trabalhos 1 e 2):

```bash
python main.py --bot --size 8 --seed 4 --energia 64 --estrategia guloso
```

Benchmark dos trabalhos anteriores:

```bash
python -m bench                   # rotas, partidas, paradas e gráficos
```
