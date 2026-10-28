// Cliente da API. E a unica porta do front para o servidor: nenhuma tela faz
// fetch nem abre EventSource por conta propria, entao o contrato /api/t2/* vive
// num lugar so e a tela nunca precisa saber de URL.
//
// Nenhuma regra do jogo mora aqui ou em qualquer modulo do front: custo, desmaio,
// recarga e viabilidade do alcance vem prontos do servidor.

const BASE = "/api/t2";

function consulta(parametros) {
  const limpos = Object.entries(parametros).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return limpos.length ? "?" + new URLSearchParams(limpos).toString() : "";
}

async function pegar(caminho, parametros = {}) {
  const resposta = await fetch(BASE + caminho + consulta(parametros));
  let corpo = null;
  try {
    corpo = await resposta.json();
  } catch {
    // corpo nao e JSON: cai no erro de status abaixo
  }
  if (!resposta.ok) {
    throw new Error((corpo && corpo.erro) || `${caminho}: HTTP ${resposta.status}`);
  }
  return corpo;
}

export const api = {
  config: () => pegar("/config"),
  benchmark: () => pegar("/benchmark"),
  alcance: (size, seed, alcance) => pegar("/alcance", { size, seed, alcance }),
  comparar: (size, seed, energia, algoritmo) => pegar("/comparar", { size, seed, energia, algoritmo }),

  jogoNovo: (size, seed, energia) => pegar("/jogo/novo", { size, seed, energia }),
  jogoEstado: (sessao) => pegar("/jogo/estado", { sessao }),
  jogoMover: (sessao, direcao) => pegar("/jogo/mover", { sessao, direcao }),
  jogoRecarregar: (sessao) => pegar("/jogo/recarregar", { sessao }),
};

// Partida do bot ao vivo (SSE). Devolve um objeto com `fechar()`.
//
// Os eventos chegam na ordem em que o bot os produz, nao em replay: `inicio`,
// e por plano `plano`, `paradas`, varios `passo` e, se a estrategia mandou
// parar, uma `recarga`; por fim `fim`. `aoEvento(nome, dados)` recebe todos.
// Erro de rede ou do servidor vira `aoErro(mensagem)` e fecha a conexao: o
// EventSource reconectaria sozinho e repetiria a partida do zero.
export function partidaAoVivo({ size, seed, algoritmo, estrategia, energia }, aoEvento, aoErro) {
  const url = `${BASE}/partida` + consulta({ size, seed, algoritmo, estrategia, energia });
  const fonte = new EventSource(url);
  let encerrada = false;

  const fechar = () => {
    encerrada = true;
    fonte.close();
  };

  for (const nome of ["inicio", "plano", "paradas", "passo", "recarga", "fim"]) {
    fonte.addEventListener(nome, (evento) => {
      if (encerrada) return;
      aoEvento(nome, JSON.parse(evento.data));
      if (nome === "fim") fechar();
    });
  }
  fonte.onerror = () => {
    if (encerrada) return;
    fechar();
    if (aoErro) aoErro("a conexao com o servidor caiu no meio da partida");
  };
  return { fechar };
}

// Trabalho 3: jogo com ginasios e batalha turno a turno (/api/t3/*). Contrato em
// docs/api-batalha-t3.md. Aqui tambem nao mora regra nenhuma: dano, efetividade,
// ordem dos golpes, captura e fuga chegam prontos na lista de eventos.
async function pegar3(caminho, parametros = {}) {
  return chamar3("GET", caminho + consulta(parametros));
}

async function postar3(caminho, corpo) {
  return chamar3("POST", caminho, corpo);
}

async function chamar3(metodo, caminho, corpo) {
  const opcoes = { method: metodo };
  if (corpo !== undefined) {
    opcoes.headers = { "Content-Type": "application/json" };
    opcoes.body = JSON.stringify(corpo);
  }
  const resposta = await fetch("/api/t3" + caminho, opcoes);
  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    // corpo nao e JSON: cai no erro de status abaixo
  }
  if (!resposta.ok) {
    throw new Error((dados && dados.erro) || `${caminho}: HTTP ${resposta.status}`);
  }
  return dados;
}

export const api3 = {
  jogoNovo: (size, seed, nivelInicial) => pegar3("/jogo/novo", { size, seed, nivel_inicial: nivelInicial }),
  jogoEstado: (sessao) => pegar3("/jogo/estado", { sessao }),
  jogoMover: (sessao, direcao) => pegar3("/jogo/mover", { sessao, direcao }),
  batalhaNova: (sessao, tipo, previsaoN) => postar3("/batalha/nova", { sessao, tipo, previsao_n: previsaoN }),
  batalhaAcao: (batalhaId, acao, extra = {}) => postar3("/batalha/acao", { batalha_id: batalhaId, acao, ...extra }),
  batalhaEstado: (batalhaId) => pegar3("/batalha/estado", { batalha_id: batalhaId }),
};
