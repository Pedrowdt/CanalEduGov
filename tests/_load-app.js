/**
 * _load-app.js
 * ---------------------------------------------------------------------------
 * Helper de teste (não faz parte do projeto original): carrega emissora.js,
 * grade_base.js, data.js e app.js num ÚNICO contexto vm com escopo léxico
 * compartilhado — simulando fielmente como o browser executa <script> tags
 * soltas (sem módulos), que é como o projeto original funciona.
 *
 * Duas adaptações necessárias para rodar em Node puro (sem browser/index.html):
 *
 * 1) `const`/`let` de top-level não viram propriedades do objeto de
 *    contexto quando rodados via vm.runInContext (só `var`/`function`
 *    viram) — por isso concatenamos os 4 arquivos num ÚNICO script e, ao
 *    final, expomos explicitamente no objeto global os identificadores que
 *    os testes desta suíte usam (lista `EXPOR` abaixo).
 *
 * 2) app.js termina com uma chamada automática a `init()`, que por sua vez
 *    chama `renderAll()` → funções definidas em OUTROS arquivos do projeto
 *    (parts-store.js, banco-manager.js, pecas_dia.js, api-sync.js, cloud-
 *    sync.js) que não foram enviados nesta entrega, e depende de um
 *    index.html real (elementos do DOM). Sem esses dois, `init()` sempre
 *    lançaria um erro no meio do caminho, impedindo o restante do arquivo
 *    (e o epílogo de exposição) de rodar. Por isso removemos SÓ a linha
 *    final `init();` ao montar o bundle de teste — todo o resto do
 *    arquivo roda 100% inalterado. Os testes chamam `ctx.init()`
 *    manualmente quando precisam (com um DOM fake suficiente para os
 *    caminhos exercitados nesta suíte).
 * ---------------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function criarLocalStorageFake() {
  let store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
    _dump: () => ({ ...store }),
  };
}

function criarElementoFake() {
  const el = {
    style: {},
    classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } },
    dataset: {},
    children: [],
    _value: '',
    get value() { return this._value; },
    set value(v) { this._value = v; },
    get textContent() { return this._text || ''; },
    set textContent(v) { this._text = v; },
    get innerHTML() { return this._html || ''; },
    set innerHTML(v) { this._html = v; },
    appendChild: () => {},
    insertAdjacentHTML: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    click: () => {},
    focus: () => {},
    remove: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
  };
  return el;
}

function criarDocumentoFake() {
  return {
    getElementById: () => criarElementoFake(),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => criarElementoFake(),
    addEventListener: () => {},
    body: criarElementoFake(),
  };
}

const EXPOR = [
  'state', 'REGRAS_DEFAULT', 'REGRAS', 'loadRegras',
  'MAPA_EQUIVALENCIA_TIPOS_EDU_GOV', 'TIPOS_EXCLUSIVOS_GOV', 'TIPOS_GOV_EQUIVALENTES', 'TIPOS_GOV',
  'emissoraAtual', 'isEmissoraGov', 'isTipoPrograma', 'tipoProgramaAtual',
  'tipoChamadaManutAtual', 'tipoVinhetaAtual', 'chaveStorage',
  'nomeEmissoraAtual', 'slugEmissoraAtual',
  'TIPOS_CONFIGURAVEIS_EDUCACAO', 'TIPOS_CONFIGURAVEIS_GOV', 'tiposConfiguraveisAtual',
  'validateRoteiroRegras', 'init', 'saveState', 'loadGrade', 'loadGradeOrder',
  'INITIAL_PECAS', 'INITIAL_PROGRAMAS', 'INITIAL_ROTEIRO_QUI',
  'INITIAL_PECAS_GOV', 'INITIAL_PROGRAMAS_GOV',
  'GRADE_BASE', 'GRADE_BASE_EDUCACAO', 'GRADE_BASE_GOV', 'gradeBaseAtual',
  'mergeBancoFromRoteiro', 'renderStats', 'STAT_BADGES_EDUCACAO', 'STAT_BADGES_GOV',
];

/**
 * Carrega os 4 arquivos reais do projeto num contexto vm compartilhado e
 * devolve o contexto — de onde os testes podem chamar qualquer
 * função/constante top-level exatamente como o browser enxergaria.
 */
function carregarApp(originalDir) {
  const localStorage = criarLocalStorageFake();
  const sandbox = {
    console,
    localStorage,
    document: criarDocumentoFake(),
    addEventListener: () => {},
    navigator: { userAgent: 'node-test' },
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout,
    clearTimeout,
    alert: () => {},
    confirm: () => true,
    URL: { createObjectURL: () => 'blob:fake' },
  };
  sandbox.window = sandbox; // window === globalThis, como no browser
  const ctx = vm.createContext(sandbox);

  const arquivos = ['emissora.js', 'grade_base.js', 'data.js', 'app.js'];
  const codigoCompleto = arquivos.map((nome) => {
    let codigo = fs.readFileSync(path.join(originalDir, nome), 'utf8');
    if (nome === 'app.js') {
      // Remove SÓ a chamada automática final `init();` (ver nota no topo
      // do arquivo) — o resto de app.js roda 100% inalterado.
      const alvo = codigo.replace(/\ninit\(\);\s*$/, '\n// [harness de teste] init() automático removido — chamar ctx.init() manualmente.\n');
      if (alvo === codigo) {
        throw new Error('Harness de teste: não encontrei a chamada final "init();" em app.js para remover — o arquivo original pode ter mudado.');
      }
      codigo = alvo;
    }
    return `// ===== ${nome} =====\n` + codigo;
  }).join('\n\n');

  const epilogo = '\n\n// ===== epílogo do harness de teste =====\n' +
    EXPOR.map((n) => `try { this.${n} = ${n}; } catch (_) {}`).join('\n');

  vm.runInContext(codigoCompleto + epilogo, ctx, { filename: 'app-bundle.js' });
  return { ctx, localStorage };
}

/**
 * Chama ctx.init() tolerando erros vindos de renderAll() — que depende de
 * funções definidas em outros arquivos do projeto (parts-store.js,
 * banco-manager.js, pecas_dia.js etc.), não enviados nesta entrega. Como
 * dentro de init() o `state` (pecas/programas/roteiro) é montado ANTES de
 * chamar renderAll(), o estado já está correto quando o erro acontece —
 * só o efeito colateral de renderização em tela é que não roda.
 */
function initSeguro(ctx) {
  try {
    ctx.init();
  } catch (e) {
    // Esperado neste ambiente de teste — ver nota no topo do arquivo.
  }
}

module.exports = { carregarApp, initSeguro };
