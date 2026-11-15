# Diraya - one container serves the API and the frontend.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend backend
COPY data data
COPY models models
COPY frontend/public frontend/public

WORKDIR /app/backend
# If the installed scikit-learn differs from the one used in the notebook, rebuild the
# bundle now (same data, same settings) so the container starts instantly.
RUN python -m scripts.build_models --if-needed

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
