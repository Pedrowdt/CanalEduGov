# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/).

Este arquivo é atualizado automaticamente por `npm run release` — não edite à mão
(exceto para corrigir algo pontual).

## [2.1.0] - 2026-07-09

### Adicionado
- Suporte a janelas horárias que cruzam a meia-noite em `regrasTipos`. Se `fim < inicio`, a janela é interpretada como wraparound (ex.: `06:00`–`05:59` cobre o ciclo completo do roteiro, incluindo madrugada).

### Alterado
- Padrões de `regrasTipos` de ECHM, ECHE, EINT, RCOM e EVNH agora terminam em `05:59` (madrugada). ECHE/RCOM/ECHM/EINT deixam de ser marcados como "fora da janela" quando inseridos entre 00:00 e 05:59.

### Notas de migração
- Usuários com regras customizadas mantêm suas configurações. Para cobrir madrugada, ajuste manualmente `fim` para `05:59` no painel Admin.


## [2.1.1] - 2026-07-20

### Fixed
- **parts-store.js**: chave `roteiroApp` agora é namespaced por emissora (`roteiroApp__educacao` / `roteiroApp__gov`), evitando que peças do Canal Educação apareçam no Canal Gov e vice-versa.
- **cloud-sync.js**: `patchLocalStorage`, `pushToCloud` e o handler realtime passam pela `chaveStorageCloudSync()` — antes ainda liam/gravavam `roteiroApp`/`roteiroRegras` puros, cruzando dados entre emissoras.
- **cloud-sync.js**: `setupRealtime` filtra por `workspaceIdAtual()` (era `WORKSPACE_ID` fixo).

### Added
- **emissora.js**: novos helpers `Emissora.raw()` (null quando não escolhida), `Emissora.label()` e `Emissora.clear()`.
- **cloud-sync.js**: bypass `?local=1` — pula login/hub e roda 100% local, útil para testes offline/dev.
