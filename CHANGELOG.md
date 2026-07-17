# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/).

Este arquivo é atualizado automaticamente por `npm run release` — não edite à mão
(exceto para corrigir algo pontual).

## [2.0.0] — 2026-07-17

### Added
- **Suporte a múltiplas emissoras (Canal Educação e Canal GOV).** Nova tela inicial `home.html` com seletor de emissora.
- Módulo `emissora.js` que isola os dados por emissora no `localStorage` via namespace (`roteiroApp::educacao`, `roteiroApp::gov`, etc.). Nenhuma peça, programa, roteiro ou regra é compartilhada entre os dois canais.
- Rótulo dinâmico da emissora ativa no topbar de `index.html` e `pecas-programas.html`, além de botão "⇆ Trocar emissora" que retorna à home.
- Migração automática one-shot: dados existentes (pré-v2.0.0) são preservados sob o namespace do Canal Educação.

### Changed
- **BREAKING (organização de dados):** chaves `roteiroApp`, `roteiroRegras`, `roteiroBackupEnabled` e `roteiroProgramColors` passam a ser namespaced por emissora. Chaves globais preservadas: `roteiroUsuario`, `roteiroTheme`, `emissoraAtiva`.
- `index.html` e `pecas-programas.html` redirecionam para `home.html` quando nenhuma emissora está selecionada.
- Canal GOV inicia com bancos vazios (peças, programas, grade, roteiros).
