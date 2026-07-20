# Prompt do que foi feito

**Tarefa:** criar, para o canal Gov, novos `types` que funcionam de forma
similar aos do canal Educação (repositório `Pedrowdt/CanalEduGov`),
usando esta equivalência:

```
PROGRAMAS         RPRO -> GPRO
CHAMADAS          ECHE -> GCHE
CHAMADAS MANUTS   ECHM -> GCHM
VINHETAS          EVNH -> GVNH
INTERPROGRAMAS    EINT -> GINT
GOVERNAMENTAIS           GGV   (sem equivalente — tipo novo)
INSTITUCIONAIS           GINS  (sem equivalente — tipo novo)
PILULAS                  GPIL  (sem equivalente — tipo novo)
```

com 4 regras: (1) nunca misturar types/peças/programas entre emissoras;
(2) testar todo o processo depois de mudar; (3) comentar em pt-br toda
alteração; (4) entregar o zip com um prompt do que foi feito.

## O que foi entregue

Nesta rodada o usuário enviou os 3 arquivos reais do projeto (`app.js`,
`data.js`, `grade_base.js`), que não haviam sido acessíveis via web na
entrega anterior. Com eles em mãos, as alterações foram feitas
**diretamente nos arquivos reais** (não mais num módulo à parte):

1. **`app.js`** — adicionados os 8 types do Gov em `REGRAS_DEFAULT.regrasTipos`
   (os 5 equivalentes herdando a regra exata do type correspondente da
   Educação; os 3 novos com regra própria documentada); `TIPOS_CONFIGURAVEIS`
   dividido por emissora para o Admin nunca mostrar type da emissora errada;
   `isTipoPrograma()` substituindo ~19 comparações hardcoded com `'RPRO'`
   para o Gov ter o mesmo tratamento de "é programa"; e, o mais importante
   para a regra_1, **todo o localStorage passou a ser isolado por emissora**
   (`chaveStorage()`) — antes, Educação e Gov gravavam no mesmo lugar e um
   sobrescreveria o banco do outro. Também corrigidos 3 bugs em que o `type`
   real de um programa era descartado e forçado para `'RPRO'`, e as
   exportações/títulos que estavam hardcoded como "CANAL EDUCAÇÃO" mesmo
   quando a emissora ativa fosse o Gov.

2. **`data.js`** — encontrei **15 peças** já cadastradas no catálogo da
   Educação com o type errado (`EINT`) mas descrição/categoria de conteúdo
   do Gov (`"GINS ..."`, `"GGV ..."`) — migradas para uma constante nova
   (`INITIAL_PECAS_GOV`) com o type corrigido e `emissora: 'gov'`, e
   removidas tanto do catálogo quanto das 36 ocorrências no roteiro
   semente da Educação (regra_1).

3. **`grade_base.js`** — `GRADE_BASE` virou `GRADE_BASE_EDUCACAO` (com
   alias de compatibilidade) + `GRADE_BASE_GOV` (novo, vazio) +
   `gradeBaseAtual()`, para o Gov nunca herdar a grade real da Educação
   como fallback.

4. **`emissora.js`** (arquivo NOVO) — `app.js`/`grade_base.js` já
   referenciavam `window.Emissora`, mas esse arquivo não estava entre os
   3 enviados; foi criado do zero com o contrato que os outros dois já
   esperavam.

5. **`tests/canal-gov.test.js`** — 19 testes automatizados (regra_2),
   rodando contra os arquivos REAIS (via `node:vm`, simulando `<script>`
   de browser), cobrindo mapeamento de types, regras herdadas,
   isolamento entre emissoras (inclusive um cenário completo de
   ir-e-voltar salvando dado em cada emissora), migração de dados,
   grade base por emissora e validação de adjacência do roteiro.
   Resultado: **19/19 passaram**.

**Comentários:** toda linha alterada tem `// [MOD canal-gov] ...`
explicando o motivo, em pt-br (regra_3).

**O que ficou para revisão humana** (documentado em detalhe no
`README-INTEGRACAO.md`): 2 títulos de slot dentro da grade da Educação
que citam "CANAL GOV" (pode ser reserva de horário legítima ou conteúdo
que vazou — não dá para saber com certeza só pelos dados); ausência de
`index.html`/CSS (badges visuais dos types novos podem precisar de
classe própria); e os arquivos `parts-store.js`/`banco-manager.js`/
`pecas_dia.js`/`api-sync.js`/`cloud-sync.js`, que não foram enviados e
por isso não puderam ser revisados ou testados diretamente (pela
documentação do projeto, eles só acessam dados via `state`/`saveState()`,
então a isolação por emissora deve valer para eles também, sem precisar
de alteração — mas isso não foi confirmado nesta sessão).

---

## Rodada 3 (esta entrega): index.html — bypass de login + seletor de emissora

O usuário enviou o `index.html` e pediu (1) um bypass de autenticação
para testar localmente antes de subir para o Supabase, e (2) continuar
os ajustes do Canal Gov nele — perguntando se eu precisaria de mais
algum arquivo.

**Descoberta importante:** o `index.html` não carrega `app.js`/`data.js`/
`grade_base.js` como `<script>` estático — é o `cloud-sync.js` (não
enviado) que faz login com Supabase e injeta esses arquivos
dinamicamente depois. Também não havia NENHUMA opção de escolher entre
Canal Educação e Canal Gov em lugar nenhum do HTML — perguntei ao
usuário onde ele queria esse seletor; ele escolheu **"seletor no
topbar, trocando sem sair"**.

**O que foi feito:**

1. **Seletor de emissora no topbar** (`#emissora-selector`) — chama
   `trocarEmissora()` (nova função em `app.js`), que usa
   `window.Emissora.set()` para trocar e recarregar a página.
2. **Botões de filtro por tipo duplicados** (sidebar do Roteiro + painel
   Banco de Peças) — os 8 types do Gov ao lado dos da Educação, com CSS
   que só mostra o grupo da emissora ativa (`sincronizarUIEmissora()`,
   nova função em `app.js`, chamada no início do `init()`).
3. Logo do topbar e título do Hub passaram a mostrar "CANAL EDUCAÇÃO" ou
   "CANAL GOV" dinamicamente.
4. **Bypass de autenticação** — bloco novo e isolado no `index.html`,
   desligado por padrão, ativado com `?dev=1` na URL. Não toca em
   `cloud-sync.js`/`supabase-config.js` (que não recebi): em vez disso,
   quando ativo, esconde o login e injeta os scripts do app manualmente
   e em ordem. Documentei que a lista de scripts pode estar incompleta
   (não recebi `parts-store.js`/`api-sync.js`/`banco-manager.js`/
   `pecas_dia.js` para confirmar os nomes).
5. Testes: mais 3 casos cobrindo `sincronizarUIEmissora()`/
   `trocarEmissora()`, todos rodando contra o `app.js` real —
   **22/22 passaram**.

**Ainda preciso, para fechar o que falta:** `cloud-sync.js` (essencial —
login real e a lista de injeção de scripts em produção) e,
idealmente, `supabase-config.js`.
