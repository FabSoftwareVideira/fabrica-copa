# Frontend - Arquitetura

Frontend em Vue 3 + Vite para o sistema Álbum Copa 2026.

## Objetivo desta organização

A estrutura foi dividida por domínio para melhorar:

- manutenção de código
- legibilidade
- reutilização
- testabilidade

## Estrutura atual

- `src/App.vue`: composição principal da interface e orquestração dos módulos
- `src/modules/app/`: constantes, ambiente e utilitários puros do app
- `src/composables/auth/`: persistência de autenticação no storage
- `src/composables/notifications/`: persistência/restauração de notificações
- `src/composables/trade/`: lógica de trocas (handlers e view model)
- `src/style.css`: estilos globais
- `js/data.js`: catálogo estático inicial de figurinhas

## Módulos em src/modules/app

- `env.js`: resolução de URLs, BASE path e variáveis de ambiente
- `constants.js`: chaves de storage, limites e constantes de UI
- `formatters.js`: funções puras de formatação e normalização

## Composables

### auth

- `useAuthStorage.js`

Responsabilidades:

- ler usuário persistido
- persistir e limpar tokens/usuário no localStorage

### notifications

- `useNotificationStorage.js`

Responsabilidades:

- gerar keys por usuário
- salvar lista de notificações e contador de não lidas
- restaurar estado persistido com saneamento básico

### trade

- `useTrade.js`
- `useTradeViewModel.js`

Responsabilidades:

- carregamento e ações de trocas via API
- regras de paginação, filtros, buscas e estados derivados da tela de trocas

## Convenções para novos módulos

- manter funções puras em `src/modules/app`
- manter regras de domínio em composables por contexto
- evitar lógica longa diretamente em `App.vue`
- expor APIs pequenas e focadas (objetos/funções com responsabilidade única)

## Próximos passos sugeridos

- extrair lógica de sistema/eventos para `src/composables/system`
- extrair lógica de álbum/pacotes para `src/composables/album`
- adicionar testes unitários para `src/modules/app` e `useTradeViewModel`
