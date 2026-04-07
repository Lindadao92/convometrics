# ConvoMetrics Backend

Voice agent analytics API. Receives call transcripts from Vapi/Retell, analyzes them with Claude, pushes structured events to PostHog/Mixpanel, and sends weekly Slack briefings.

## Local development

```bash
cp .env.example .env
# Fill in your ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload
```

## API docs

http://localhost:8000/docs

## Your webhook URLs (after signup)

```
Vapi:   POST https://your-domain.com/webhook/{your_secret}/vapi
Retell: POST https://your-domain.com/webhook/{your_secret}/retell
Custom: POST https://your-domain.com/webhook/{your_secret}/custom
```

Point your Vapi or Retell "call ended" webhook to the corresponding URL. Your `webhook_secret` is returned when you sign up via `POST /auth/signup`.

## Deploy to Railway

1. Push to GitHub
2. Connect repo to Railway
3. Add environment variables (`ANTHROPIC_API_KEY`, `SECRET_KEY`)
4. Deploy

Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
