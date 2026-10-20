# Vision AI

Contrato inicial de inferência do SETRA. Sem um modelo e dataset validados, a rota real responde `503`. O modo de simulação só funciona quando `development_simulation=true` e identifica a versão como `development-simulation`.

```bash
python -m venv .venv
pip install -e ".[dev]"
uvicorn app.main:app --reload
pytest
```
