# SETRA

Plataforma SportsTech para pontuação e análise assistida de partidas de Beach Tennis. O produto adota confirmação humana: previsões de IA nunca alteram o placar oficial diretamente.

## Estado atual

- Landing page responsiva e identidade visual SETRA.
- Criação local de partida e placar ao vivo funcional.
- Motor de pontuação isolado, imutável e testado (No-Ad, games, sets, tie-break, saque e reversão).
- PWA inicial com shell offline e placar retomável no dispositivo.
- Captura de câmera e gravação/revisão local de clipes curtos.
- Schema Supabase e confirmação transacional idempotente preparados para aplicação.
- Contrato inicial do serviço de visão em FastAPI, com simulação explicitamente limitada ao ambiente de desenvolvimento.

## Executar

Requisitos: Node.js 20+ e npm 10+.

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. Para validar:

```bash
npm test
npm run typecheck
npm run build
```

O serviço de visão é opcional nesta fase e está documentado em `services/vision-ai/README.md`.

## Organização

```text
apps/web                  Aplicação Next.js
packages/scoring-engine   Regras de domínio puras
services/vision-ai        Contrato FastAPI para análise assíncrona
supabase/migrations       Migrations versionadas (próxima fase)
docs                      Decisões e roadmap técnico
```

## Limites atuais

Autenticação, Realtime, persistência remota, upload de clipes e detecção real por visão computacional ainda não estão conectados. Câmera e PWA exigem HTTPS fora de `localhost`. O fluxo atual é local e não apresenta dados simulados como produção.
