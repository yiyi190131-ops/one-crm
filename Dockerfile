FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/backend \
    DATA_DIR=/data \
    AI_PROVIDER=local \
    API_ONLY=1
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app ./backend/app
COPY deploy ./deploy
EXPOSE 8000
CMD ["python", "deploy/start.py"]
