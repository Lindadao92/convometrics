FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
ENV WORKER=false

CMD if [ "$WORKER" = "true" ]; then \
      celery -A workers.analyze worker --loglevel=info --concurrency=4; \
    else \
      uvicorn main:app --host 0.0.0.0 --port $PORT; \
    fi
