# Álbum Copa 2026

Sistema web de álbum de figurinhas da Copa 2026, com frontend em Vue + Vite e backend em Node.js + Express + SQLite.

O projeto oferece autenticação com Google, gerenciamento de coleção, abertura de pacotes, cupons, trocas entre usuários e ferramentas administrativas.

## Visão Geral

- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Banco: SQLite
- Infra local/prod: Docker + Docker Compose
- Autenticação: Google OAuth

## Principais Funcionalidades

- Login com Google OAuth
- Perfis de acesso: admin, servidor e jogador
- Coleção de figurinhas com progresso por usuário
- Abertura de pacotes e histórico recente
- Resgate e geração de cupons
- Troca de figurinhas entre usuários
- Painel administrativo para gerenciamento de usuários
- Cadastro e remoção de figurinhas personalizadas
- Persistência local com SQLite
- Backup e restore do banco via scripts

## Estrutura Backend (Modular)

O backend foi organizado em estrutura por camadas para facilitar manutenção:

- `backend/server.js`: entrypoint enxuto (bootstrap)
- `backend/src/app.js`: composição da aplicação e bootstrap dos módulos
- `backend/src/routes/`: definição das rotas
- `backend/src/controllers/`: handlers/controladores HTTP
- `backend/src/middlewares/`: middlewares reutilizáveis

## Como Rodar em Modo Dev

### Pré-requisitos

- Node.js 20+ (recomendado 22)
- npm
- Docker e Docker Compose (opcional, mas recomendado)

### 1) Configurar variáveis de ambiente

Crie os arquivos de ambiente:

- backend/.env
- frontend/.env

Exemplo mínimo para frontend/.env:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_BASE_PATH=/
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
```

Exemplo mínimo para backend/.env:

```env
NODE_ENV=development
PORT=3001
JWT_SECRET=troque-este-segredo
CORS_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com

# Auth
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30

# Logging
LOG_LEVEL=info
LOG_ROTATION_ENABLED=true
LOG_DIR=/app/logs
LOG_ROTATION_INTERVAL=1d
LOG_ROTATION_MAX_FILES=14

<!-- Apenas para modo production -->
HOST_BACKUP_DIR=/caminho/no/host/para/backups
HOST_DB_DIR=/caminho/no/host/para/data
HOST_LOG_DIR=/caminho/no/host/para/logs
```

### 2) Rodar com Docker (recomendado)

Na raiz do projeto:

```bash
docker compose --profile dev up -d --build
```

Acessos:

- Frontend: http://localhost:5173
- Backend (health): http://localhost:3001/api/health

### 3) Rodar sem Docker (alternativa)

Terminal 1 (backend):

```bash
npm --prefix backend install
npm --prefix backend run dev
```

Terminal 2 (frontend):

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

## Persistência e Banco de Dados

- O banco SQLite é persistido no diretório data do host quando executado via Docker Compose.
- Caminho padrão no container: /app/data/album.db
- Mapeamento para host: ./data

## Backup e Restore

Scripts disponíveis no projeto:

- scripts/db-backup.sh
- scripts/db-restore.sh

Também é possível usar scripts npm já configurados no backend para rotina de backup.

## Como Contribuir

1. Faça um fork do repositório.
2. Crie uma branch para sua feature ou correção.
3. Implemente as mudanças com commits pequenos e descritivos.
4. Rode testes e validações locais.
5. Abra um Pull Request com contexto, motivação e evidências (prints/logs quando necessário).

Boas práticas recomendadas:

- Manter compatibilidade com os fluxos de Docker dev/prod
- Não commitar segredos em arquivos .env
- Documentar mudanças de comportamento no README quando aplicável

## Desenvolvimento com GitHub Copilot

Este projeto contou com apoio do GitHub Copilot durante a implementação de código, ajustes de infraestrutura e documentação técnica.

## Disclaimer

Este sistema é uma ferramenta exclusivamente educacional.

Não possui fins comerciais e não deve ser utilizado como produto comercial.

Teste
