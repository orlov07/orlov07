# Vision AI

Contrato inicial de inferência do SETRA. Sem um modelo e dataset validados, a rota real responde `503`. O modo de simulação só funciona quando `development_simulation=true` e identifica a versão como `development-simulation`.

```bash
python -m venv .venv
pip install -e ".[dev]"
uvicorn app.main:app --reload
pytest
```

## Treinar o detector de bola

O treinamento usa um arquivo de vídeo local autorizado. URLs do YouTube não são baixadas automaticamente.

```bash
pip install -e ".[dev,training]"
python tools/annotate_video.py --video videos/NJhf7IKOjKk.mp4 --output dataset --interval 10
python tools/tile_dataset.py --dataset dataset
python tools/train_ball_detector.py --dataset dataset/tiles --epochs 140 --image-size 1280
```

Para revisar as pseudo-anotações já extraídas deste vídeo:

```bash
python tools/review_labels.py --input dataset-bootstrap-v2 --output dataset-reviewed --video videos/NJhf7IKOjKk.mp4
```

Antes de cada decisão, o revisor exibe 12 quadros anteriores e posteriores em câmera lenta. Use `A` para aceitar uma bola correta, `R` para rejeitar, `C` para redesenhar a caixa e `Q` para encerrar. Não treine diretamente com `dataset-bootstrap-v2`: a auditoria encontrou munhequeiras, placas e detalhes amarelos entre os candidatos.

No anotador, desenhe uma caixa justa ao redor da bola e pressione `Enter`. Pressione `S` quando a bola não estiver visível e `Q` para encerrar. Os quadros são divididos de maneira determinística entre treino e validação. O modelo final será salvo em `runs/setra-ball/weights/best.pt`.

Fonte indicada para o primeiro conjunto, condicionada à autorização do titular: `https://youtu.be/G10iUwhYHmY`.

Um único vídeo não cobre iluminação, câmeras e bolas diferentes. Para uso real, reúna diversas partidas e revise todas as caixas antes de treinar.

### Ajustes para este vídeo

- `YOLO11s` em 1280px para preservar objetos muito pequenos.
- Tiles 704×448 com 20% de sobreposição para ampliar a bola sem cortá-la nas bordas.
- Pelo menos 800 quadros positivos e 250 negativos difíceis (refletores, placas e roupas coloridas).
- Augmentações moderadas: alterações fortes poderiam apagar ou deformar uma bola com poucos pixels.
- ByteTrack com limiar baixo e buffer de 45 quadros para atravessar oclusões curtas.
