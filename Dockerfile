FROM node:22-bookworm-slim AS frontend
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production PYTHONPATH=/app/backend DATA_DIR=/data AI_PROVIDER=local
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY --from=frontend /app/.next ./.next
COPY --from=frontend /app/node_modules ./node_modules
COPY --from=frontend /app/public ./public
COPY --from=frontend /app/package.json /app/next.config.ts ./
COPY backend/app ./backend/app
COPY deploy ./deploy
EXPOSE 3000
CMD ["python", "deploy/start.py"]
