/*
 * emissora.js — Suporte multi-emissora (Canal Educação / Canal GOV)
 *
 * Estratégia: monkey-patch em localStorage para namespace por emissora.
 * Este arquivo DEVE ser carregado ANTES de qualquer outro script que leia/grave
 * dados do app (app.js, parts-store.js, pecas_dia.js, grade_base.js, cloud-sync.js, etc.).
 *
 * Chaves POR emissora (isoladas):
 *   roteiroApp, roteiroRegras, roteiroBackupEnabled, roteiroProgramColors
 *
 * Chaves GLOBAIS (compartilhadas entre emissoras):
 *   emissoraAtiva, roteiroUsuario, roteiroTheme
 *
 * API pública:
 *   window.Emissora.get()             -> "educacao" | "gov" | null
 *   window.Emissora.set(id)           -> define e recarrega
 *   window.Emissora.clear()           -> remove seleção (volta à home)
 *   window.Emissora.label()           -> "Canal Educação" | "Canal GOV"
 *   window.Emissora.requireOrRedirect(url) -> se não houver, redireciona
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'emissoraAtiva';
  var VALIDAS = ['educacao', 'gov'];
  var LABELS  = { educacao: 'Canal Educação', gov: 'Canal GOV' };

  // Chaves que devem ser namespaced por emissora.
  var PER_EMISSORA = [
    'roteiroApp',
    'roteiroRegras',
    'roteiroBackupEnabled',
    'roteiroProgramColors'
  ];

  function getEmissora() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return VALIDAS.indexOf(v) >= 0 ? v : null;
    } catch (_) { return null; }
  }

  function prefixed(key) {
    var e = getEmissora();
    // Sem emissora definida, mantém a chave original (fluxo pré-multiemissora
    // e páginas globais como home.html).
    if (!e) return key;
    if (PER_EMISSORA.indexOf(key) === -1) return key;
    return key + '::' + e;
  }

  // Referências originais antes de qualquer outro wrapper.
  var proto = Object.getPrototypeOf(window.localStorage) || Storage.prototype;
  var origGet    = proto.getItem.bind(window.localStorage);
  var origSet    = proto.setItem.bind(window.localStorage);
  var origRemove = proto.removeItem.bind(window.localStorage);

  // Migração one-shot: se a chave namespaced ainda não existir e a chave
  // legada existir, copia para o namespace "educacao" (dados existentes
  // pertencem ao Canal Educação).
  function migrarLegado() {
    try {
      PER_EMISSORA.forEach(function (k) {
        var legado = origGet(k);
        if (legado == null) return;
        var alvo = k + '::educacao';
        if (origGet(alvo) == null) origSet(alvo, legado);
        // Mantemos a chave legada por compatibilidade retroativa; será
        // sobrescrita naturalmente na primeira gravação sob namespace.
      });
    } catch (_) { /* silencioso */ }
  }
  migrarLegado();

  // Sobrescreve na INSTÂNCIA localStorage (não no protótipo) para que
  // wrappers posteriores (ex.: cloud-sync.js) enxerguem o método patcheado.
  Object.defineProperty(window.localStorage, 'getItem', {
    configurable: true, writable: true,
    value: function (key) { return origGet(prefixed(key)); }
  });
  Object.defineProperty(window.localStorage, 'setItem', {
    configurable: true, writable: true,
    value: function (key, value) { return origSet(prefixed(key), value); }
  });
  Object.defineProperty(window.localStorage, 'removeItem', {
    configurable: true, writable: true,
    value: function (key) { return origRemove(prefixed(key)); }
  });

  window.Emissora = {
    get: getEmissora,
    set: function (id) {
      if (VALIDAS.indexOf(id) === -1) return;
      try { origSet(STORAGE_KEY, id); } catch (_) {}
    },
    clear: function () {
      try { origRemove(STORAGE_KEY); } catch (_) {}
    },
    label: function () {
      var e = getEmissora();
      return e ? LABELS[e] : '';
    },
    requireOrRedirect: function (url) {
      if (!getEmissora()) {
        try { window.location.replace(url || 'home.html'); } catch (_) {}
      }
    }
  };
})();
