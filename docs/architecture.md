# Arquitetura inicial

## Decisões

1. **Domínio independente:** `@setra/scoring-engine` não depende de React, banco ou rede. Toda transição retorna um novo estado e mantém snapshots para reversão.
2. **Confirmação humana obrigatória:** o futuro worker de visão cria apenas predições; somente a API transacional de confirmação poderá produzir `POINT_CONFIRMED`.
3. **Offline primeiro para o placar:** a aplicação web deverá persistir uma fila de eventos em IndexedDB e reconciliá-la por versão, sem sobrescrever eventos oficiais silenciosamente.
4. **Vídeo fora do banco:** clipes curtos serão enviados ao Storage privado; o PostgreSQL armazenará apenas metadados, retenção e relações.

## Próximas etapas

- Modelar eventos e schemas Zod compartilhados.
- Criar migrations, RLS e testes de políticas no Supabase.
- Implementar autenticação e modo convidado local.
- Adicionar IndexedDB, reconexão e sincronização otimista.
- Implementar captura com `getUserMedia`, calibração e clipes.
- Conectar o contrato FastAPI a um worker assíncrono e modelo validado.

## Segurança

Secrets de service role serão exclusivos do servidor. Uploads terão tipo, assinatura, tamanho e autorização validados. Consentimento de gravação, retenção e exclusão serão parte obrigatória do fluxo conforme a LGPD.
