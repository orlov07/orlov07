# Continuação

## Estado atual

O MVP local cria partidas, calcula o placar, persiste o estado no navegador, pausa/retoma/desfaz, mantém dashboard/histórico e abre uma câmera real para gravar e revisar clipes locais. O backend Supabase está modelado em migrations, mas não conectado.

## Última tarefa concluída

Implementação da câmera/PWA e criação da transação SQL idempotente `confirm_match_event`.

## Próxima tarefa

1. Criar `packages/event-schemas` com schemas Zod para eventos e estado.
2. Implementar IndexedDB com fila de eventos e estratégia explícita de conflitos.
3. Conectar Supabase Auth/Realtime quando as variáveis estiverem disponíveis.
4. Implementar dashboard e histórico a partir do repositório local, depois trocar por adapter Supabase.

## Decisões importantes

- A IA somente cria hipóteses; nunca escreve o placar.
- O motor de pontuação é a fonte das transições válidas.
- Confirmações remotas exigem versão esperada e chave de idempotência.
- Vídeos não entram no cache do service worker nem no PostgreSQL.
- Sem credenciais, o aplicativo permanece funcional localmente e declara integrações indisponíveis.

## Comandos

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Para o serviço de visão, dentro de `services/vision-ai`: `pip install -e ".[dev]" && pytest`.

## Cuidados

- Não aplicar migrations em produção sem revisar backup e ambiente.
- Não incluir `SUPABASE_SERVICE_ROLE_KEY` em código cliente.
- Ao trocar o formato de `MatchState`, criar migração do estado salvo no navegador.
- Validar câmera em HTTPS e dispositivos físicos.
