# Rastreador tradicional de bola

O painel da câmera processa quadros reduzidos (largura de 480 px) em um Web Worker. OpenCV.js combina máscara HSV calibrada, diferença temporal, background subtraction MOG2, abertura/fechamento morfológico, contornos, circularidade, proporção, área e optical flow Lucas–Kanade. O thread principal associa candidatos à previsão de um filtro alpha-beta (modelo de Kalman simplificado), mantém os estados `SEARCHING`, `TRACKING`, `OCCLUDED`, `LOST` e `RECOVERING`, e desenha os últimos 30 pontos.

A calibração coleta a cor da bola, quatro cantos ordenados da quadra e duas extremidades da rede. Os pontos são normalizados, portanto sobrevivem a mudanças de resolução; uma homografia projeta a imagem no plano da quadra. Eventos só são candidatos quando uma trajetória consistente cruza os limites calibrados. Eles possuem deduplicação e sempre exigem confirmação/correção humana.

O índice técnico exibido combina cor, geometria, movimento, qualidade do contorno e proximidade da previsão. Ele não é uma probabilidade estatisticamente calibrada.

## Limitações

- Uma bola com poucos pixels, borrada, totalmente encoberta ou com cor indistinguível do fundo pode ser perdida.
- Mudanças extremas de iluminação exigem recalibração; o controle de sensibilidade troca recall por falsos positivos.
- A velocidade é estimada em pixels por segundo, não em km/h, pois uma única câmera não fornece profundidade física confiável.
- A sugestão de equipe usa o lado anterior da trajetória como heurística; situações ambíguas devem ser registradas manualmente.
- A calibração pressupõe que os quatro cantos sejam marcados na ordem indicada e que a quadra esteja visível.

## Verificação local

`npm run typecheck`, `npm test`, `npm run test --workspace @setra/web` e `npm run build` cobrem o motor existente, associação temporal, iluminação, objetos semelhantes, oclusão/recuperação, mudança de direção, homografia e deduplicação de eventos.

## Diagnóstico do pipeline

O processamento começa assim que vídeo, Worker e OpenCV estão prontos. A calibração não bloqueia a captura: antes de selecionar a bola, o Worker processa movimento para comprovar o pipeline; depois da seleção, acrescenta a máscara HSV e habilita a associação do rastreador.

O painel mostra separadamente resolução/estado do vídeo, Worker, OpenCV, transporte (`bitmap` ou fallback `pixels`), FPS de captura, FPS de processamento, duração do último frame, número de candidatos e último erro. Uma resposta pendente por mais de 2,5 segundos gera erro de timeout visível.

O transporte principal usa `ImageBitmap` quando `OffscreenCanvas` está disponível no Worker. Caso qualquer um deles não esteja disponível ou a criação do bitmap falhe, o canvas principal envia o buffer RGBA transferível. Erros de criação, execução e desserialização do Worker são observáveis.

Em 22/10/2026, o teste local do runtime OpenCV processou 120 frames sintéticos de 320×180 em 92,85 ms (1.292,38 FPS para diferença, threshold e contagem de pixels). Esse número comprova funcionamento do runtime local, mas não representa o desempenho completo do Worker em um celular. O vídeo autorizado local respondeu HTTP 206 a uma solicitação parcial. Não havia navegador gráfico conectado à sessão de automação para uma medição visual fim a fim; essa medição deve ser lida no painel durante o uso real.
