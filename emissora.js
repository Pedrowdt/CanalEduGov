// =====================================================
// emissora.js — seleção de emissora ativa (Canal Educação / Canal Gov)
// =====================================================
// [MOD canal-gov] ARQUIVO NOVO desta entrega. app.js e grade_base.js já
// referenciavam `window.Emissora.get()` (havia um comentário "[MOD]
// Multi-emissora" em app.js), mas o arquivo que deveria implementar esse
// objeto não estava presente nos arquivos recebidos — então foi criado
// aqui, seguindo exatamente o contrato que app.js/grade_base.js esperam:
// `window.Emissora.get()` devolve 'educacao' (padrão) ou 'gov'.
//
// ORDEM DE CARGA em index.html: este script deve vir ANTES de
// grade_base.js e de app.js:
//   <script src="emissora.js"></script>
//   <script src="grade_base.js"></script>
//   <script src="data.js"></script>
//   <script src="parts-store.js"></script>
//   ... (demais scripts do projeto, na ordem já documentada)
//   <script src="app.js"></script>
//
// Persistência: a emissora escolhida fica em UMA chave de localStorage
// própria ('emissoraAtiva'), separada de 'roteiroApp__<emissora>' — ela
// não guarda peça/programa/roteiro nenhum, só a preferência de qual
// emissora está selecionada, então não é afetada pelo isolamento da
// regra_1 (não há o que vazar entre emissoras nesta chave).
(function (window) {
  'use strict';

  var CHAVE = 'emissoraAtiva';
  var VALIDAS = ['educacao', 'gov'];
  var atual = null;

  function normalizar(valor) {
    return VALIDAS.indexOf(valor) !== -1 ? valor : 'educacao';
  }

  function carregarInicial() {
    try {
      return normalizar(window.localStorage.getItem(CHAVE));
    } catch (_) {
      // localStorage bloqueado/indisponível (ex.: modo privado) — assume Educação.
      return 'educacao';
    }
  }

  atual = carregarInicial();

  /**
   * API pública, consumida por app.js/grade_base.js:
   *   Emissora.get()          → 'educacao' | 'gov'
   *   Emissora.set(nome)      → troca a emissora ativa e recarrega a página
   *                              (app.js guarda tudo em `state`/localStorage
   *                              carregado no init(), então trocar de
   *                              emissora em runtime sem recarregar
   *                              deixaria o state antigo misturado com a
   *                              nova emissora — por segurança, regra_1,
   *                              preferimos sempre recarregar).
   *   Emissora.list()         → ['educacao', 'gov']
   *   Emissora.nomeExibicao()  → 'Canal Educação' | 'Canal Gov'
   */
  window.Emissora = {
    get: function () {
      return atual;
    },
    set: function (nome, opts) {
      var normalizado = normalizar(nome);
      if (normalizado === atual) return;
      atual = normalizado;
      try { window.localStorage.setItem(CHAVE, atual); } catch (_) { /* silencioso */ }
      var semReload = opts && opts.semReload;
      if (!semReload && typeof window.location !== 'undefined' && window.location.reload) {
        window.location.reload();
      }
    },
    list: function () {
      return VALIDAS.slice();
    },
    nomeExibicao: function (nome) {
      var alvo = normalizar(nome || atual);
      return alvo === 'gov' ? 'Canal Gov' : 'Canal Educação';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
