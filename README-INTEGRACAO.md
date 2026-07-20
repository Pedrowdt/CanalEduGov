# Integração Canal Gov — novos types

Esta entrega modifica **diretamente os 3 arquivos reais** enviados
(`app.js`, `data.js`, `grade_base.js`) e adiciona **1 arquivo novo**
(`emissora.js`, que faltava — `app.js`/`grade_base.js` já referenciavam
`window.Emissora`, mas o arquivo que deveria defini-lo não estava entre
os enviados). Todos os arquivos deste zip podem substituir diretamente
os do seu projeto.

## O que foi pedido

Criar, para o canal **Gov**, novos `types` equivalentes aos do canal
**Educação**, usando esta tabela:

| Categoria        | Educação | Gov    | Observação                    |
|-------------------|:--------:|:------:|--------------------------------|
| Programas         | `RPRO`   | `GPRO` | equivalência direta            |
| Chamadas          | `ECHE`   | `GCHE` | equivalência direta            |
| Chamadas manuts.  | `ECHM`   | `GCHM` | equivalência direta            |
| Vinhetas          | `EVNH`   | `GVNH` | equivalência direta            |
| Interprogramas    | `EINT`   | `GINT` | equivalência direta            |
| Governamentais    | —        | `GGV`  | **tipo novo**, sem equivalente |
| Institucionais    | —        | `GINS` | **tipo novo**, sem equivalente |
| Pílulas           | —        | `GPIL` | **tipo novo**, sem equivalente |

## Resumo das alterações por arquivo

### `app.js` (+261 / -76 linhas)

1. **Bloco novo no topo** (`MAPA_EQUIVALENCIA_TIPOS_EDU_GOV`, `TIPOS_GOV`,
   `isTipoPrograma()`, `isEmissoraGov()`, `chaveStorage()`,
   `tipoProgramaAtual()`, `tipoChamadaManutAtual()`, `tipoVinhetaAtual()`,
   `nomeEmissoraAtual()`, `slugEmissoraAtual()`) — os helpers que todo o
   resto do arquivo passou a usar.
2. **`REGRAS_DEFAULT.regrasTipos`**: adicionados os 5 types equivalentes
   (com a MESMA janela/intervalo/adjacência do type correspondente da
   Educação) + os 3 types novos (janela ampla, sem intervalo mínimo; GGV
   e GINS não ficam adjacentes entre si — mesma lógica hoje aplicada a
   ECHM/ECHE). **`REGRAS_DEFAULT.tiposChamada`** também estendido.
3. **`TIPOS_CONFIGURAVEIS`** virou duas listas
   (`TIPOS_CONFIGURAVEIS_EDUCACAO` / `TIPOS_CONFIGURAVEIS_GOV`) + a função
   `tiposConfiguraveisAtual()`, para o painel Admin nunca listar/editar
   types da emissora errada (**regra_1**).
4. **Isolamento de storage (regra_1 — a correção mais importante)**: TODAS
   as chamadas a `localStorage.getItem/setItem/removeItem('roteiroApp'` /
   `'roteiroRegras')` passaram a usar `chaveStorage(...)`, que devolve
   `roteiroApp__educacao` ou `roteiroApp__gov` conforme a emissora ativa.
   **Antes desta correção, as duas emissoras liam e gravavam na MESMA
   chave (`'roteiroApp'`) — ou seja, o Gov e a Educação ficariam
   sobrescrevendo o banco/roteiro um do outro.** Era o ponto mais crítico
   de risco para a regra_1 no código original.
5. **Bug corrigido**: em 3 pontos, o código forçava `type: 'RPRO'` (ou
   sobrescrevia com `{...p, type:'RPRO'}`) sempre que listava/mesclava um
   programa — o que faria um programa do Gov (`GPRO`) aparecer/gravar
   como se fosse da Educação. Corrigido para preservar o `type` real do
   registro.
6. **`isTipoPrograma(tipo)`** substitui as ~19 comparações diretas
   `x.type === 'RPRO'` espalhadas pelo arquivo (validação de roteiro,
   contagem de intervalos, exportações, etc.), para que `GPRO` receba
   exatamente o mesmo tratamento que `RPRO` sempre teve.
7. **Defaults de cadastro sensíveis à emissora**: os modais de
   adicionar/editar peça e programa (chamada, vinheta, programa) usam
   `tipoChamadaManutAtual()`/`tipoVinhetaAtual()`/`tipoProgramaAtual()`
   em vez de sempre `'ECHM'`/`'EVNH'`/`'RPRO'` fixos — para que cadastrar
   uma peça nova no Gov já venha com o type certo por padrão.
8. **`renderStats()`** (badges de contagem por tipo) agora tem uma lista
   própria por emissora (`STAT_BADGES_EDUCACAO` / `STAT_BADGES_GOV`), em
   vez de badges fixos só da Educação.
9. **Exportações (CSV/XLSX/PDF)**: título e nome de arquivo eram
   hardcoded como `"CANAL EDUCAÇÃO"` sempre — agora usam
   `nomeEmissoraAtual()`/`slugEmissoraAtual()`, então o Gov exporta como
   `CANAL_GOV_...` e não `CANAL_EDUCAÇÃO_...`. A detecção de reimportação
   de CSV também passou a reconhecer o cabeçalho `"CANAL GOV"`.
10. **Grade de referência (`loadGrade`/`loadGradeOrder`)**: passaram a
    usar `gradeBaseAtual()` (ver `grade_base.js` abaixo) em vez do
    `GRADE_BASE` fixo — sem isso, o Gov cairia no fallback da grade real
    da Educação sempre que ainda não tivesse uma grade customizada salva.

Todas as linhas alteradas têm comentário `// [MOD canal-gov] ...`
explicando o motivo, em pt-br (regra_3).

### `data.js` (migração de dados)

Ao inspecionar o arquivo, encontrei **15 peças** já cadastradas no banco
da Educação com `type: 'EINT'`, mas com a descrição começando com
`"GINS "` ou `"GGV "` e `categoria: "INTERPROGRAMAS GOV"` — ou seja,
conteúdo que já era do Gov na prática, só cadastrado com o type errado
porque `GINS`/`GGV` ainda não existiam. Essas 15 peças:

1. Foram **removidas** de `INITIAL_PECAS` (banco da Educação);
2. Foram **movidas** para uma constante nova, `INITIAL_PECAS_GOV`, com o
   `type` corrigido (`GINS` ou `GGV`, conforme a descrição) e
   `emissora: 'gov'`;
3. Foram **removidas das 36 ocorrências** em que apareciam dentro do
   roteiro semente `INITIAL_ROTEIRO_QUI` (19/03/2026) — que é conteúdo da
   Educação e não deveria exibir peça do Gov (regra_1).

Outros 10 itens sob a mesma categoria `"INTERPROGRAMAS GOV"`
(`"INTPGM TODA MATEMATICA..."`, códigos `CE1366xx`) **não** foram
migrados — o conteúdo é claramente educativo; a categoria parece ter
sido reaproveitada por engano na planilha original. Fica como está.

Também adicionada `INITIAL_PROGRAMAS_GOV = []` (sem seed de programas do
Gov nesta entrega — não recebi planilha de programação do Gov) e
`emissora: 'educacao'` explícito em todos os itens de `INITIAL_PECAS` /
`INITIAL_PROGRAMAS` que restaram, por simetria com os itens do Gov.

`app.js` foi ajustado para usar `INITIAL_PECAS_GOV`/`INITIAL_PROGRAMAS_GOV`
como semente do Gov no `init()`, em vez de sempre começar vazio.

### `grade_base.js`

Renomeado `GRADE_BASE` → `GRADE_BASE_EDUCACAO` (com alias `GRADE_BASE`
mantido por compatibilidade). Adicionado `GRADE_BASE_GOV` (esqueleto
vazio — não recebi planilha de programação do Gov) e a função
`gradeBaseAtual()`, que escolhe a grade certa pela emissora ativa. As
duas funções internas do arquivo (`loadGradeWithBase`/
`loadGradeOrderWithBase`) também tiveram o mesmo isolamento de storage
(`chaveStorage`) aplicado.

**Ponto que ficou para decisão humana:** a grade da Educação contém 2
títulos de slot que citam o Gov (`"GINT SERIADOS CANAL GOV"`,
`"DOCUMENTARIOS TV SENADO GOV"`) — horários fixos reservados dentro da
grade linear da Educação. Não removi automaticamente porque não dá para
saber, só pelos dados, se é uma reserva de horário legítima (para a
Educação não agendar programa em cima) ou conteúdo que deveria pertencer
só ao Gov. Recomendo confirmar com a área de programação.

### `index.html` (modificado)

1. **Seletor de emissora no topbar** (`<select id="emissora-selector">`,
   ao lado do seletor de tema) — troca entre "📘 Canal Educação" e
   "🏛️ Canal Gov" chamando `trocarEmissora()` (nova função em `app.js`),
   que usa `window.Emissora.set()` e recarrega a página já na emissora
   escolhida.
2. **Botões de filtro por tipo duplicados** (sidebar do Roteiro e painel
   Banco de Peças): os botões da Educação ganharam a classe
   `filter-btn-educacao`, e os 7-8 equivalentes do Gov (`filter-btn-gov`)
   foram adicionados do lado. Uma regra de CSS
   (`body[data-emissora="gov"] .filter-btn-educacao { display:none }` e
   o inverso) faz só o grupo da emissora ativa aparecer — `<body
   data-emissora="...">` é mantido sincronizado por `sincronizarUIEmissora()`
   (nova função em `app.js`, chamada no início do `init()`).
3. Os textos fixos "CANAL EDUCAÇÃO" no logo do topbar e no título do Hub
   ganharam `id` (`logo-emissora-nome`, `hub-emissora-nome`) para serem
   atualizados dinamicamente pela mesma função.
4. **Bypass de autenticação para teste local** — bloco novo, isolado,
   logo depois do `#login-overlay`. Fica **desligado por padrão**; só
   ativa com `?dev=1` na URL (persiste em `localStorage.devBypassAuth`
   até você desligar com `?dev=0`). Quando ativo, pula o login e o Hub
   (que dependem de `cloud-sync.js`) e injeta os scripts do app
   diretamente, em ordem, via `<script>` criados dinamicamente. Ver a
   seção **"Testar localmente"** abaixo e o aviso sobre arquivos não
   confirmados.

**⚠ Não recebi `cloud-sync.js` nem `supabase-config.js` nesta entrega.**
Sem eles eu não consigo (e não deveria tentar adivinhar) alterar o fluxo
real de login com o Supabase — o bypass acima é um caminho PARALELO só
para desenvolvimento local, que não toca nesses dois arquivos. Também não
dá pra confirmar os nomes exatos de `parts-store.js`/`api-sync.js`/
`banco-manager.js`/`pecas_dia.js` (usei os nomes documentados em
`DOCUMENTACAO.md`, mas não pude conferir) — se precisar deles no
Console, é só ajustar a lista `SCRIPTS_LOCAIS` dentro do bloco de bypass.

## Testar localmente

1. Sirva a pasta com um servidor estático (não abra o `index.html` direto
   como `file://`, porque `fetch`/módulos podem falhar) — ex.:
   `npx serve .` ou a extensão "Live Server" do VS Code.
2. Acesse `http://localhost:<porta>/index.html?dev=1`.
3. Abra o Console (F12). Se aparecer algo como `"X is not defined"`,
   é sinal de que falta um arquivo na lista `SCRIPTS_LOCAIS` (ver bloco
   de bypass no `index.html`) — ajuste o nome do arquivo e recarregue.
4. Para voltar ao fluxo normal (login real), acesse com `?dev=0` uma vez
   (limpa o `localStorage`) — ou simplesmente não use `?dev=1`.



`app.js` e `grade_base.js` já tinham um comentário `"[MOD] Multi-emissora"`
e chamavam `window.Emissora.get()`, mas o arquivo que deveria implementar
esse objeto não estava entre os 3 enviados. Criado do zero, implementando
exatamente o contrato esperado: `Emissora.get()` / `Emissora.set(nome)` /
`Emissora.list()` / `Emissora.nomeExibicao()`, persistindo a escolha em
`localStorage['emissoraAtiva']`.

**Ação necessária, mas em `cloud-sync.js` (não recebido nesta entrega):**
o `index.html` real não carrega `app.js`/`data.js`/`grade_base.js` como
`<script>` estático — é o `cloud-sync.js` que injeta esses arquivos
dinamicamente depois do login (comentário no fim do `index.html`
original). Quando você me mandar `cloud-sync.js`, preciso adicionar
`emissora.js` **no início** dessa lista de injeção (antes de
`grade_base.js` e de `app.js`). Até lá, o bloco de bypass local (ver
seção `index.html` abaixo) já carrega `emissora.js` na ordem certa para
você testar sem precisar do `cloud-sync.js`.

## Testes (regra_2)

Os testes rodam contra os **arquivos reais** (não uma reimplementação),
carregando `app.js`, `data.js`, `grade_base.js` e `emissora.js` num único
contexto V8 (`node:vm`), do mesmo jeito que o browser executa `<script>`
soltos — ver comentários em `tests/_load-app.js` para as duas adaptações
necessárias para isso rodar em Node puro (fora do browser).

```bash
npm test
# ou:
node --test tests/canal-gov.test.js
```

**19/19 testes passaram** nesta sessão, cobrindo: a tabela de
equivalência, as regras herdadas por type, `isTipoPrograma`, a lista de
types configuráveis por emissora, a migração de dados (nenhum vazamento
de type em nenhuma direção), `init()` nas duas emissoras, um cenário
completo de ir-e-voltar entre emissoras salvando dado em cada uma
(regra_1 fim-a-fim), a grade base por emissora, os nomes de exportação, a
validação de adjacência do roteiro com types do Gov, e os badges de
estatística.

## Limitações desta entrega / próximos passos

- **Sem dados de programação do Gov**: `INITIAL_PROGRAMAS_GOV` e
  `GRADE_BASE_GOV` começam vazios — não recebi planilha de programação
  do Gov. Cadastre pelo app normalmente; os types já existem e já
  funcionam.
- **CSS/`index.html` não foram enviados**: os badges/classes visuais
  (`badge-GPRO`, `badge-GCHE` etc.) e os botões de filtro da sidebar
  provavelmente precisam de uma entrada equivalente no CSS/HTML — a
  lógica em JS já suporta qualquer type presente no HTML, mas não pude
  confirmar/ajustar o que não foi enviado.
- **`parts-store.js`, `banco-manager.js`, `pecas_dia.js`,
  `api-sync.js`, `cloud-sync.js` não foram enviados** — pelo que
  `DOCUMENTACAO.md` descreve, eles só leem/escrevem via `state`/
  `saveState()`, então devem continuar funcionando sem alteração (a
  isolação por emissora já acontece na chave de storage, um nível
  abaixo deles). Não pude testar isso diretamente.
- **VH assinatura/classificação automática** (`buildRoteiroFromPrograms`,
  vinhetas de assinatura infantil/jovem/adulto) continua sendo lógica
  exclusiva da Educação — o pedido era sobre os 8 types, não sobre esse
  motor específico, então não mexi nele.
- Ver a nota específica sobre os 2 slots "CANAL GOV" dentro da grade da
  Educação, na seção `grade_base.js` acima.
