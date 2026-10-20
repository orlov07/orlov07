# Progresso de desenvolvimento

Atualizado em 20/10/2026.

## Concluído

- Monorepo Next.js/TypeScript com landing, criação de partida e placar responsivo.
- Motor isolado: pontos tradicionais, No-Ad, vantagem, games, sets, tie-break, ordem básica de saque, pausa, retomada e reversão imutável.
- Estado e histórico retomáveis após recarregar, armazenados em IndexedDB.
- Captura real por `getUserMedia`, gravação curta por `MediaRecorder` e revisão local.
- PWA inicial com manifest, service worker, shell offline e exclusão de vídeos do cache.
- Schema PostgreSQL com tabelas de domínio, constraints, índices e RLS.
- Função transacional idempotente para confirmar eventos com bloqueio por versão.
- Contrato FastAPI que recusa inferência real enquanto não há modelo e identifica simulação de desenvolvimento.
- CI para web e serviço Python.

## Em andamento

- IndexedDB persiste snapshots locais; a fila explícita de eventos ainda será necessária para sincronização robusta.
- A calibração de câmera possui guia visual; coordenadas persistentes ainda não são capturadas.

## Pendente

- Supabase Auth, cliente Realtime e Storage privado.
- Aplicar migrations e executar testes reais de RLS em uma instância Supabase.
- Fluxos de dashboard, histórico, perfil, estatísticas e arenas.
- Upload autorizado e política automatizada de retenção dos clipes.
- Modelo de visão treinado, tracking e avaliação com dataset real.
- E2E Playwright em navegadores móveis reais.
- Acessibilidade e auditoria de segurança completas.

## Bloqueadores externos

- URL/chaves de um projeto Supabase.
- Dataset anotado e pesos de modelo adequados para Beach Tennis.
- Dispositivos iOS/Android para validar câmera, PWA e interrupções reais.

## Verificação atual

- `npm test`: 8 testes aprovados.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado, 5 rotas de produto estáticas mais a página de erro.
- `pytest`: 2 testes da API aprovados; há um aviso de depreciação vindo do TestClient do FastAPI/Starlette.
- SQL: criado e revisado estaticamente; ainda não aplicado a um banco Supabase.
