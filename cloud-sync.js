// =====================================================
// CLOUD SYNC — Login + sincronização em nuvem (Supabase)
// Roteiro Canal Educação
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// Este arquivo:
//  1) Mostra a tela de login e autentica via Supabase Auth.
//  2) Ao logar, baixa os dados da nuvem e os grava no
//     localStorage ANTES de carregar o resto do app —
//     assim app.js/pecas_dia.js/parts-store.js funcionam
//     exatamente como já funcionavam localmente, sem
//     precisar ser reescritos.
//  3) Depois disso, intercepta as gravações no localStorage
//     e replica em segundo plano para o Supabase:
//       - banco de peças/programas/grade/regras -> tabela
//         compartilhada (shared_data), visível a toda a equipe
//       - roteiro do dia e peças do dia -> tabela por usuário
//         (user_data), isolada por login
//  4) Escuta mudanças em tempo real na tabela compartilhada
//     para refletir edições de outros usuários sem precisar
//     recarregar a página.
//
// CONFIGURAÇÃO NECESSÁRIA: veja DEPLOY.md
// =====================================================

// SUPABASE_URL, SUPABASE_ANON_KEY e WORKSPACE_ID vêm de supabase-config.js
// (carregado antes deste arquivo no index.html) — preencha-os lá, uma vez só.
const PECAS_PROGRAMAS_PAGE = 'pecas-programas.html';

const SCRIPTS_TO_LOAD = [
  'api-sync.js',
  'grade_base.js',
  'data.js',
  'parts-store.js',
  'pecas_dia.js',
  'app.js',
  'banco-manager.js',
];

// =====================================================
// [MOD canal-gov] ISOLAMENTO ENTRE EMISSORAS (regra_1)
// =====================================================
// Antes desta entrega, TODA a sincronização em nuvem usava uma chave de
// localStorage fixa ('roteiroApp'/'roteiroRegras') e UMA linha única e
// compartilhada no Supabase (id = WORKSPACE_ID, sempre 'workspace') —
// ou seja, Canal Educação e Canal Gov cairiam no MESMO balde de dados na
// nuvem. Os dois helpers abaixo resolvem isso, e são usados em TODO
// lugar deste arquivo que antes lia/gravava 'roteiroApp'/'roteiroRegras'
// ou usava WORKSPACE_ID direto.
//
// Depende de window.Emissora (emissora.js) — que agora precisa ser
// carregado ESTATICAMENTE em index.html, ANTES deste arquivo, porque
// fetchAndMergeCloudData() usa isso antes mesmo de app.js (que teria
// chaveStorage()) ser carregado dinamicamente. Ver index.html.

/** Emissora ativa ('educacao' | 'gov'). Fallback seguro para 'educacao'. */
function emissoraAtualCloudSync() {
  return (typeof window !== 'undefined' && window.Emissora && window.Emissora.get)
    ? window.Emissora.get()
    : 'educacao';
}

/**
 * Mesma lógica de chaveStorage() em app.js (duplicada aqui de propósito —
 * ver nota acima sobre ordem de carregamento). Os dois PRECISAM produzir
 * exatamente a mesma chave para a mesma emissora, senão a sincronização
 * lê/grava num lugar e o app lê/grava em outro.
 */
function chaveStorageCloudSync(nomeBase) {
  return `${nomeBase}__${emissoraAtualCloudSync()}`;
}

/**
 * Id da linha compartilhada no Supabase (tabela shared_data) para a
 * emissora ativa — ex.: 'workspace_educacao' / 'workspace_gov'. Antes
 * era sempre WORKSPACE_ID puro ('workspace'), compartilhado entre as
 * duas emissoras. Não precisa de migração de schema: `id` já é texto
 * livre na tabela shared_data.
 */
function workspaceIdAtual() {
  return `${WORKSPACE_ID}_${emissoraAtualCloudSync()}`;
}

let supabaseClient = null;
let currentUser = null;
let scriptsLoaded = false;
let _origSetItem = null;
let _pushTimer = null;

function setSyncStatus(msg, show = true) {
  const el = document.getElementById('cloud-sync-status');
  if (!el) return;
  el.textContent = msg;
  el.style.display = show ? 'block' : 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) el.textContent = msg || '';
}

// =====================================================
// LOGIN
// =====================================================
async function cloudSyncLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-submit');
  showLoginError('');

  if (!email || !password) {
    showLoginError('Informe e-mail e senha.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showLoginError('E-mail ou senha inválidos.');
    btn.disabled = false;
    btn.textContent = 'Entrar';
    return;
  }

  await onAuthenticated(data.user);
}

function addLogoutUI(email) {
  const status = document.getElementById('cloud-sync-status');
  if (!status) return;
  status.style.display = 'block';
  status.innerHTML = '';

  const span = document.createElement('span');
  span.textContent = email + ' · ';

  const link = document.createElement('a');
  link.href = '#';
  link.textContent = 'Sair';
  link.style.color = 'inherit';
  link.onclick = async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    location.reload();
  };

  status.appendChild(span);
  status.appendChild(link);
}

// =====================================================
// CARREGA OS SCRIPTS DO APP NA ORDEM ORIGINAL
// (só depois que os dados da nuvem já estão no localStorage)
// =====================================================
function loadScriptsSequentially() {
  return SCRIPTS_TO_LOAD.reduce(
    (promise, src) =>
      promise.then(
        () =>
          new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Falha ao carregar ' + src));
            document.body.appendChild(s);
          })
      ),
    Promise.resolve()
  );
}

// =====================================================
// BUSCA DADOS DA NUVEM E MESCLA NO localStorage
// =====================================================
async function fetchAndMergeCloudData(user) {
  // [MOD canal-gov] workspaceIdAtual() em vez de WORKSPACE_ID puro — cada
  // emissora lê/grava sua PRÓPRIA linha em shared_data (regra_1).
  const { data: shared } = await supabaseClient
    .from('shared_data')
    .select('*')
    .eq('id', workspaceIdAtual())
    .maybeSingle();

  // [MOD canal-gov] filtra também por emissora — precisa da coluna
  // "emissora" em user_data (ver migration-canal-gov.sql desta entrega).
  // Sem isso, roteiros/peças do dia da Educação e do Gov do MESMO login
  // cairiam na mesma linha (regra_1).
  const { data: userRow } = await supabaseClient
    .from('user_data')
    .select('*')
    .eq('user_id', user.id)
    .eq('emissora', emissoraAtualCloudSync())
    .maybeSingle();

  // [MOD canal-gov] chave de storage isolada por emissora.
  const localRaw    = JSON.parse(localStorage.getItem(chaveStorageCloudSync('roteiroApp')) || '{}');
  const localRegras = JSON.parse(localStorage.getItem(chaveStorageCloudSync('roteiroRegras')) || '{}');

  const sharedEmpty  = !shared || (!(shared.pecas || []).length && !(shared.programas || []).length);
  const localHasData = (localRaw.pecas && localRaw.pecas.length) || (localRaw.programas && localRaw.programas.length);

  const merged = {};

  if (sharedEmpty && localHasData) {
    // Primeiro acesso: este navegador já tinha dados locais (uso anterior
    // sem login) e a nuvem ainda está vazia -> usamos os dados locais como
    // ponto de partida do banco compartilhado da equipe (da emissora ativa).
    merged.pecas           = localRaw.pecas || [];
    merged.programas       = localRaw.programas || [];
    merged.grade           = localRaw.grade || {};
    merged.gradeByDay      = localRaw.gradeByDay || {};
    merged.gradeOrder      = localRaw.gradeOrder || {};
    merged.gradeOrderByDay = localRaw.gradeOrderByDay || {};

    await supabaseClient.from('shared_data').upsert({
      id: workspaceIdAtual(), // [MOD canal-gov]
      pecas: merged.pecas,
      programas: merged.programas,
      grade: merged.grade,
      grade_by_day: merged.gradeByDay,
      grade_order: merged.gradeOrder,
      grade_order_by_day: merged.gradeOrderByDay,
      regras: localRegras,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });

    localStorage.setItem(chaveStorageCloudSync('roteiroRegras'), JSON.stringify(localRegras)); // [MOD canal-gov]
  } else {
    merged.pecas           = shared?.pecas || [];
    merged.programas       = shared?.programas || [];
    merged.grade           = shared?.grade || {};
    merged.gradeByDay      = shared?.grade_by_day || {};
    merged.gradeOrder      = shared?.grade_order || {};
    merged.gradeOrderByDay = shared?.grade_order_by_day || {};

    localStorage.setItem(chaveStorageCloudSync('roteiroRegras'), JSON.stringify(shared?.regras || {})); // [MOD canal-gov]
  }

  merged.roteiros   = userRow?.roteiros   || localRaw.roteiros   || {};
  merged.pecasDia   = userRow?.pecas_dia  || localRaw.pecasDia   || {};
  merged.pecasFixas = localRaw.pecasFixas || [];

  _origSetItem.call(localStorage, chaveStorageCloudSync('roteiroApp'), JSON.stringify(merged)); // [MOD canal-gov]

  if (!userRow) {
    // [MOD canal-gov] onConflict explícito porque a chave única de
    // user_data passa a ser (user_id, emissora) — não só user_id.
    await supabaseClient.from('user_data').upsert({
      user_id: user.id,
      emissora: emissoraAtualCloudSync(), // [MOD canal-gov]
      roteiros: merged.roteiros,
      pecas_dia: merged.pecasDia,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,emissora' }); // [MOD canal-gov]
  }
}

// =====================================================
// INTERCEPTA GRAVAÇÕES NO localStorage E REPLICA NA NUVEM
// =====================================================
function patchLocalStorage() {
  localStorage.setItem = function (key, value) {
    _origSetItem.call(localStorage, key, value);
    if (key === 'roteiroApp' || key === 'roteiroRegras') {
      clearTimeout(_pushTimer);
      _pushTimer = setTimeout(pushToCloud, 900);
    }
  };
}

async function pushToCloud() {
  if (!currentUser) return;
  const app    = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  const regras = JSON.parse(localStorage.getItem('roteiroRegras') || '{}');

  setSyncStatus('Sincronizando...');
  try {
    await supabaseClient
      .from('shared_data')
      .update({
        pecas: app.pecas || [],
        programas: app.programas || [],
        grade: app.grade || {},
        grade_by_day: app.gradeByDay || {},
        grade_order: app.gradeOrder || {},
        grade_order_by_day: app.gradeOrderByDay || {},
        regras: regras,
        updated_by: currentUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', WORKSPACE_ID);

    await supabaseClient
      .from('user_data')
      .update({
        roteiros: app.roteiros || {},
        pecas_dia: app.pecasDia || {},
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', currentUser.id);

    setSyncStatus('Sincronizado ✓ · ' + currentUser.email);
  } catch (e) {
    console.warn('cloud-sync: falha ao sincronizar', e);
    setSyncStatus('Falha ao sincronizar (verifique a internet)');
  }
}

// =====================================================
// TEMPO REAL — reflete edições de outros usuários no
// banco compartilhado (peças, programas, grade, regras)
// =====================================================
function setupRealtime() {
  supabaseClient
    .channel('shared_data_changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'shared_data', filter: `id=eq.${WORKSPACE_ID}` },
      (payload) => {
        if (!payload.new || payload.new.updated_by === currentUser.id) return; // ignora a própria escrita

        const app = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
        app.pecas           = payload.new.pecas || [];
        app.programas       = payload.new.programas || [];
        app.grade           = payload.new.grade || {};
        app.gradeByDay      = payload.new.grade_by_day || {};
        app.gradeOrder      = payload.new.grade_order || {};
        app.gradeOrderByDay = payload.new.grade_order_by_day || {};
        _origSetItem.call(localStorage, 'roteiroApp', JSON.stringify(app));
        _origSetItem.call(localStorage, 'roteiroRegras', JSON.stringify(payload.new.regras || {}));

        if (typeof state !== 'undefined') {
          state.pecas     = app.pecas;
          state.programas = app.programas;
        }
        if (typeof REGRAS !== 'undefined') {
          Object.assign(REGRAS, payload.new.regras || {});
        }
        if (typeof renderAll === 'function') renderAll();

        setSyncStatus('Atualizado por outro usuário ✓');
      }
    )
    .subscribe();
}

// =====================================================
// FLUXO PRINCIPAL
// =====================================================
async function onAuthenticated(user) {
  currentUser = user;
  document.getElementById('login-overlay').style.display = 'none';
  addLogoutUI(user.email);
  document.getElementById('hub-overlay').style.display = 'flex';
}

async function cloudSyncOpenRoteiro() {
  document.getElementById('hub-overlay').style.display = 'none';

  if (scriptsLoaded) {
    // Já entramos no Roteiro antes nesta sessão — só reexibe, sem recarregar nada.
    document.querySelector('.app').style.display = '';
    document.getElementById('switch-app-link').style.display = 'inline-block';
    return;
  }

  setSyncStatus('Carregando dados da equipe...');
  try {
    await fetchAndMergeCloudData(currentUser);
    await loadScriptsSequentially();
    scriptsLoaded = true;
    document.querySelector('.app').style.display = '';
    document.getElementById('switch-app-link').style.display = 'inline-block';
    patchLocalStorage();
    setupRealtime();
    setSyncStatus('Sincronizado ✓ · ' + currentUser.email);
  } catch (e) {
    console.error(e);
    setSyncStatus('Erro ao carregar dados. Recarregue a página.');
  }
}

function cloudSyncBackToHub(e) {
  if (e) e.preventDefault();
  document.querySelector('.app').style.display = 'none';
  document.getElementById('switch-app-link').style.display = 'none';
  document.getElementById('hub-overlay').style.display = 'flex';
}

function cloudSyncOpenPecasProgramas() {
  location.href = PECAS_PROGRAMAS_PAGE;
}

(function boot() {
  _origSetItem = localStorage.setItem.bind(localStorage);

  if (!isSupabaseConfigured()) {
    showLoginError('Configuração pendente: preencha SUPABASE_URL e SUPABASE_ANON_KEY em cloud-sync.js (veja DEPLOY.md).');
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') cloudSyncLogin();
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data?.session?.user) {
      onAuthenticated(data.session.user);
    }
  });
})();
