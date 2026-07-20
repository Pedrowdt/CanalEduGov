/**
 * canal-gov.test.js
 * ---------------------------------------------------------------------------
 * Testes de ponta a ponta (regra_2: "após as modificações testa todo o
 * processo") — rodando contra os ARQUIVOS REAIS entregues pelo usuário
 * (app.js, data.js, grade_base.js) mais o emissora.js criado nesta
 * entrega, carregados por tests/_load-app.js num contexto vm único (fiel
 * ao comportamento de <script> no browser — ver comentários nesse
 * arquivo para as duas adaptações necessárias para rodar em Node puro).
 *
 * Rodar com:  node --test tests/canal-gov.test.js
 * ---------------------------------------------------------------------------
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { carregarApp, initSeguro } = require('./_load-app.js');

const ORIGINAL_DIR = path.join(__dirname, '..');

function nova() {
  return carregarApp(ORIGINAL_DIR);
}

/**
 * assert.deepEqual (modo strict) falha entre objetos vindos do contexto vm
 * (outro "realm" do JS) e objetos literais deste arquivo, mesmo com
 * conteúdo idêntico — porque os construtores/protótipos de Object/Array
 * são diferentes entre realms. Serializar para JSON antes de comparar
 * contorna isso sem perder o valor do teste (mesmo conteúdo != mesma
 * instância de protótipo).
 */
function assertJsonEqual(valorDoSandbox, esperado, mensagem) {
  assert.deepEqual(JSON.parse(JSON.stringify(valorDoSandbox)), esperado, mensagem);
}

// ---------------------------------------------------------------------------
// 1. Tabela de equivalência Educação → Gov (dados fornecidos no pedido)
// ---------------------------------------------------------------------------
test('MAPA_EQUIVALENCIA_TIPOS_EDU_GOV mapeia exatamente os 5 types pedidos', () => {
  const { ctx } = nova();
  assertJsonEqual(ctx.MAPA_EQUIVALENCIA_TIPOS_EDU_GOV, {
    RPRO: 'GPRO', ECHE: 'GCHE', ECHM: 'GCHM', EVNH: 'GVNH', EINT: 'GINT',
  });
});

test('TIPOS_EXCLUSIVOS_GOV contém os 3 types sem equivalente (GGV, GINS, GPIL)', () => {
  const { ctx } = nova();
  assertJsonEqual(ctx.TIPOS_EXCLUSIVOS_GOV, ['GGV', 'GINS', 'GPIL']);
});

test('TIPOS_GOV reúne os 8 types pedidos, sem duplicar nem faltar nenhum', () => {
  const { ctx } = nova();
  const esperado = ['GPRO', 'GCHE', 'GCHM', 'GVNH', 'GINT', 'GGV', 'GINS', 'GPIL'];
  assert.equal(ctx.TIPOS_GOV.length, esperado.length);
  esperado.forEach((t) => assert.ok(ctx.TIPOS_GOV.includes(t), `faltou ${t}`));
});

// ---------------------------------------------------------------------------
// 2. regrasTipos — equivalentes herdam a MESMA regra do type da Educação
// ---------------------------------------------------------------------------
test('regrasTipos: types equivalentes do Gov espelham a regra do type correspondente na Educação', () => {
  const { ctx } = nova();
  const rt = ctx.REGRAS_DEFAULT.regrasTipos;
  const pares = [['ECHM', 'GCHM'], ['ECHE', 'GCHE'], ['EINT', 'GINT'], ['EVNH', 'GVNH']];
  pares.forEach(([edu, gov]) => {
    assert.ok(rt[edu], `regra de ${edu} deveria existir`);
    assert.ok(rt[gov], `regra de ${gov} deveria existir`);
    assert.equal(rt[gov].inicio, rt[edu].inicio, `${gov}.inicio deveria copiar ${edu}`);
    assert.equal(rt[gov].fim, rt[edu].fim, `${gov}.fim deveria copiar ${edu}`);
    assert.equal(rt[gov].intervaloMinMin, rt[edu].intervaloMinMin, `${gov}.intervaloMinMin deveria copiar ${edu}`);
    // naoAdjacenteA tem o MESMO tamanho/semântica, só com os códigos trocados por G-
    assert.equal(rt[gov].naoAdjacenteA.length, rt[edu].naoAdjacenteA.length);
  });
});

test('regrasTipos: types novos do Gov (GGV, GINS, GPIL) têm regra própria e ativa', () => {
  const { ctx } = nova();
  const rt = ctx.REGRAS_DEFAULT.regrasTipos;
  ['GGV', 'GINS', 'GPIL'].forEach((t) => {
    assert.ok(rt[t], `regra de ${t} deveria existir`);
    assert.equal(rt[t].ativo, true);
  });
});

// ---------------------------------------------------------------------------
// 3. isTipoPrograma — RPRO (Educação) e GPRO (Gov) tratados como "programa"
// ---------------------------------------------------------------------------
test('isTipoPrograma reconhece RPRO e GPRO como programa, e mais nada', () => {
  const { ctx } = nova();
  assert.equal(ctx.isTipoPrograma('RPRO'), true);
  assert.equal(ctx.isTipoPrograma('GPRO'), true);
  ['ECHE', 'ECHM', 'EINT', 'EVNH', 'GCHE', 'GCHM', 'GINT', 'GVNH', 'GGV', 'GINS', 'GPIL', undefined, null]
    .forEach((t) => assert.equal(ctx.isTipoPrograma(t), false, `${t} não deveria ser programa`));
});

// ---------------------------------------------------------------------------
// 4. TIPOS_CONFIGURAVEIS por emissora — Admin nunca mistura as duas listas (regra_1)
// ---------------------------------------------------------------------------
test('tiposConfiguraveisAtual() nunca mistura types de emissoras diferentes', () => {
  const { ctx } = nova();
  const edu = ctx.TIPOS_CONFIGURAVEIS_EDUCACAO;
  const gov = ctx.TIPOS_CONFIGURAVEIS_GOV;
  assert.ok(edu.every((t) => !gov.includes(t)), 'lista da Educação não deve conter type do Gov');
  assert.ok(gov.every((t) => !edu.includes(t)), 'lista do Gov não deve conter type da Educação');

  ctx.Emissora.set('educacao', { semReload: true });
  assert.deepEqual(ctx.tiposConfiguraveisAtual(), edu);

  ctx.Emissora.set('gov', { semReload: true });
  assert.deepEqual(ctx.tiposConfiguraveisAtual(), gov);
});

// ---------------------------------------------------------------------------
// 5. Migração de dados (data.js): nenhuma peça do Gov sobra no banco da
//    Educação, e o roteiro semente da Educação não referencia peça do Gov.
// ---------------------------------------------------------------------------
test('migração: INITIAL_PECAS (Educação) não contém nenhum type do Gov', () => {
  const { ctx } = nova();
  const tiposGov = new Set(ctx.TIPOS_GOV);
  const contaminadas = ctx.INITIAL_PECAS.filter((p) => tiposGov.has(p.type));
  assert.equal(contaminadas.length, 0, `peças com type do Gov no banco da Educação: ${JSON.stringify(contaminadas)}`);
});

test('migração: os 15 itens GINS/GGV foram movidos para INITIAL_PECAS_GOV com emissora "gov"', () => {
  const { ctx } = nova();
  assert.equal(ctx.INITIAL_PECAS_GOV.length, 15);
  assert.ok(ctx.INITIAL_PECAS_GOV.every((p) => p.emissora === 'gov'));
  assert.ok(ctx.INITIAL_PECAS_GOV.every((p) => p.type === 'GINS' || p.type === 'GGV'));
  assert.equal(ctx.INITIAL_PECAS_GOV.filter((p) => p.type === 'GINS').length, 7);
  assert.equal(ctx.INITIAL_PECAS_GOV.filter((p) => p.type === 'GGV').length, 8);
});

test('migração: nenhum code de INITIAL_PECAS_GOV aparece mais em INITIAL_PECAS nem em INITIAL_ROTEIRO_QUI', () => {
  const { ctx } = nova();
  const codesGov = new Set(ctx.INITIAL_PECAS_GOV.map((p) => p.code));
  assert.equal(ctx.INITIAL_PECAS.filter((p) => codesGov.has(p.code)).length, 0);
  assert.equal(ctx.INITIAL_ROTEIRO_QUI.filter((i) => codesGov.has(i.code)).length, 0);
});

// ---------------------------------------------------------------------------
// 6. init() — isolamento completo entre emissoras (regra_1), fluxo real
// ---------------------------------------------------------------------------
test('init() na Educação: carrega o banco/roteiro da Educação, chave de storage própria', () => {
  const { ctx } = nova();
  initSeguro(ctx);
  assert.equal(ctx.emissoraAtual(), 'educacao');
  assert.equal(ctx.state.pecas.length, ctx.INITIAL_PECAS.length);
  assert.equal(ctx.state.programas.length, ctx.INITIAL_PROGRAMAS.length);
  assert.ok(!ctx.state.pecas.some((p) => p.type === 'GINS' || p.type === 'GGV'));
  assert.equal(ctx.chaveStorage('roteiroApp'), 'roteiroApp__educacao');
});

test('init() no Gov: carrega o banco próprio do Gov (não herda nada da Educação), chave de storage própria', () => {
  const { ctx } = nova();
  ctx.Emissora.set('gov', { semReload: true });
  initSeguro(ctx);
  assert.equal(ctx.emissoraAtual(), 'gov');
  assert.equal(ctx.state.pecas.length, ctx.INITIAL_PECAS_GOV.length);
  assert.equal(ctx.state.programas.length, 0); // nenhuma semente de programa do Gov nesta entrega
  assert.ok(ctx.state.pecas.every((p) => p.emissora === 'gov'));
  assert.equal(ctx.state.roteiro.length, 0); // não herda o roteiro semente da Educação (19/03)
  assert.equal(ctx.chaveStorage('roteiroApp'), 'roteiroApp__gov');
});

test('regra_1 fim-a-fim: gravar dado na emissora Gov não aparece depois na Educação, e vice-versa', () => {
  // Um único par (localStorage, ctx) é reaproveitado entre as duas cargas de
  // init() para simular trocar de emissora no MESMO navegador/perfil.
  const { ctx, localStorage } = nova();

  // 1) Usuário está na Educação, adiciona uma peça nova e salva.
  initSeguro(ctx);
  ctx.state.pecas.push({ code: 'ECHE-TESTE-1', descricao: 'teste educação', tempo: '00:00:30', midia: '0OMN', type: 'ECHE', emissora: 'educacao' });
  ctx.saveState();

  // 2) Usuário troca para o Gov — precisa "recarregar" (init() de novo),
  // simulando o reload real que Emissora.set() faz no browser.
  ctx.Emissora.set('gov', { semReload: true });
  initSeguro(ctx);
  assert.ok(!ctx.state.pecas.some((p) => p.code === 'ECHE-TESTE-1'), 'peça da Educação vazou para o Gov');

  // 3) No Gov, adiciona uma peça e salva.
  ctx.state.pecas.push({ code: 'GGV-TESTE-1', descricao: 'teste gov', tempo: '00:00:20', midia: '0OMN', type: 'GGV', emissora: 'gov' });
  ctx.saveState();

  // 4) Volta para a Educação — não pode ver a peça do Gov, e a peça da
  // Educação salva no passo 1 continua lá (não foi apagada pela troca).
  ctx.Emissora.set('educacao', { semReload: true });
  initSeguro(ctx);
  assert.ok(!ctx.state.pecas.some((p) => p.code === 'GGV-TESTE-1'), 'peça do Gov vazou para a Educação');
  assert.ok(ctx.state.pecas.some((p) => p.code === 'ECHE-TESTE-1'), 'peça da própria Educação sumiu depois de ir e voltar');

  // 5) Confere as duas chaves de storage devidamente separadas.
  const chaves = Object.keys(localStorage._dump());
  assert.ok(chaves.includes('roteiroApp__educacao'));
  assert.ok(chaves.includes('roteiroApp__gov'));
});

// ---------------------------------------------------------------------------
// 7. Grade base por emissora (loadGrade / gradeBaseAtual) — regra_1
// ---------------------------------------------------------------------------
test('gradeBaseAtual() devolve a grade da emissora certa, e a grade do Gov começa vazia', () => {
  const { ctx } = nova();
  ctx.Emissora.set('educacao', { semReload: true });
  assert.equal(ctx.gradeBaseAtual(), ctx.GRADE_BASE_EDUCACAO);

  ctx.Emissora.set('gov', { semReload: true });
  assert.equal(ctx.gradeBaseAtual(), ctx.GRADE_BASE_GOV);
  assert.equal(Object.keys(ctx.GRADE_BASE_GOV.gradeByDay['1']).length, 0);
});

test('loadGrade() no Gov nunca cai no fallback da grade da Educação', () => {
  const { ctx } = nova();
  ctx.Emissora.set('gov', { semReload: true });
  initSeguro(ctx);
  const grade = ctx.loadGrade(1); // segunda-feira
  assert.equal(Object.keys(grade).length, 0, 'Gov não deveria herdar a grade da Educação (segunda-feira tem vários programas na Educação)');
});

// ---------------------------------------------------------------------------
// 8. Nomes de exibição / exportação por emissora
// ---------------------------------------------------------------------------
test('nomeEmissoraAtual()/slugEmissoraAtual() refletem a emissora ativa', () => {
  const { ctx } = nova();
  ctx.Emissora.set('educacao', { semReload: true });
  assert.equal(ctx.nomeEmissoraAtual(), 'CANAL EDUCAÇÃO');
  assert.equal(ctx.slugEmissoraAtual(), 'CANAL_EDUCAÇÃO');

  ctx.Emissora.set('gov', { semReload: true });
  assert.equal(ctx.nomeEmissoraAtual(), 'CANAL GOV');
  assert.equal(ctx.slugEmissoraAtual(), 'CANAL_GOV');
});

// ---------------------------------------------------------------------------
// 9. Validação de adjacência do roteiro (validateRoteiroRegras) com types do Gov
// ---------------------------------------------------------------------------
test('validateRoteiroRegras acusa GCHE adjacente a GCHM (mesma regra herdada de ECHE/ECHM)', () => {
  const { ctx } = nova();
  ctx.Emissora.set('gov', { semReload: true });
  initSeguro(ctx);
  ctx.state.roteiro = [
    { code: 'GCHE-0001', type: 'GCHE', IN: '10:00:00', tempo: '00:00:30' },
    { code: 'GCHM-0001', type: 'GCHM', IN: '10:00:30', tempo: '00:00:15' },
  ];
  const warns = ctx.validateRoteiroRegras();
  assert.equal(Object.keys(warns).length, 2, 'as duas linhas adjacentes deveriam acusar violação');
});

test('validateRoteiroRegras não acusa nada para uma sequência válida de types do Gov', () => {
  const { ctx } = nova();
  ctx.Emissora.set('gov', { semReload: true });
  initSeguro(ctx);
  ctx.state.roteiro = [
    { code: 'GPRO-0001', type: 'GPRO', IN: '10:00:00', tempo: '00:26:30' },
    { code: 'GVNH-0001', type: 'GVNH', IN: '10:26:30', tempo: '00:00:10' },
    { code: 'GINT-0001', type: 'GINT', IN: '10:26:40', tempo: '00:01:00' },
  ];
  const warns = ctx.validateRoteiroRegras();
  assert.equal(Object.keys(warns).length, 0, JSON.stringify(warns));
});

// ---------------------------------------------------------------------------
// 10. renderStats — badges por emissora não se misturam (regra_1 na UI)
// ---------------------------------------------------------------------------
test('badges de estatística: Gov e Educação têm listas próprias, sem overlap de type', () => {
  const { ctx } = nova();
  const tiposEdu = ctx.STAT_BADGES_EDUCACAO.map((b) => b.type);
  const tiposGov = ctx.STAT_BADGES_GOV.map((b) => b.type);
  assert.ok(tiposEdu.every((t) => !tiposGov.includes(t)));
  assert.equal(tiposGov.length, 8); // GPRO, GCHM, GCHE, GINT, GVNH, GGV, GINS, GPIL
});
