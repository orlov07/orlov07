# Prompt de implementação — câmera sem IA

Use este prompt para continuar ou recriar o módulo:

> Desenvolva no SETRA, um projeto Next.js 16 + React 19 + TypeScript, um modo de apoio à pontuação de beach tennis usando somente APIs nativas do navegador e visão computacional tradicional, sem modelos de IA e sem enviar vídeo para servidores. Permita selecionar entre câmera com `getUserMedia` e compartilhamento de tela com `getDisplayMedia`, para testar usando um vídeo ou transmissão aberta no computador. Use `CanvasRenderingContext2D` para comparar quadros reduzidos e exibir um indicador de movimento, e `MediaRecorder` para gravar, revisar e baixar lances localmente. Dentro do painel, adicione controles grandes “+ Ponto” para as equipes A e B, botão “Desfazer” e atalhos A, B e U. Encaminhe cada confirmação ao motor de regras existente, que deve calcular pontos, games e sets. Desabilite pontuação quando a partida estiver pausada ou encerrada. Trate permissão negada, fonte encerrada, câmera ausente e navegador sem MediaRecorder. Interrompa todas as tracks e revogue URLs de objeto ao desmontar. Garanta acessibilidade, mensagens de status, layout responsivo e nenhuma pontuação simulada. Não afirme que diferença entre quadros identifica automaticamente o vencedor; ela serve apenas como indicador de atividade. Execute testes, typecheck e build ao concluir.

## Critérios aplicados

- Todo o processamento visual acontece no dispositivo.
- A pontuação só muda após confirmação humana.
- O indicador de movimento não é apresentado como detector de pontos.
- Os clipes permanecem locais e podem ser revisados ou baixados.
- A mesma análise pode receber a câmera ou uma tela compartilhada para testes.
- O código procura automaticamente pequenos componentes amarelos em movimento, prioriza a proximidade da última posição e desenha um alvo sobre a trajetória. O usuário ainda pode clicar sobre a bola para substituir a detecção automática por uma cor calibrada.
- No modo experimental, uma bola que atravessa a margem esquerda concede ponto à equipe B, e uma bola que atravessa a margem direita concede ponto à equipe A.
- Se a partida estiver pausada, o painel deve oferecer uma ação explícita para retomá-la antes de pontuar.
- O motor existente continua sendo a única fonte das regras da partida.
