# Shopify Tag → SMS Webhook

Production-ready Express webhook that listens to Shopify Flow tag events, sends Twilio SMS updates, and records a metafield log to prevent duplicates.

## Features
- ✅ POST `/webhook/sms` endpoint built with Express and modern ES modules.
- 📬 Message templates loaded from `src/messages/templates.json` with `{{variable}}` placeholders.
- 🛑 Duplicate prevention via Shopify metafield `sms.sent_log`.
- 📲 Twilio SMS integration with robust logging and error handling.
- 🧾 Detailed request validation and structured logs for observability.

## Prerequisites
- Node.js 18+ and npm.
- Shopify private app access token with Orders + Metafields scope.
- Twilio account SID, auth token, and a sending number.

## Setup

```bash
git clone <repo>
cd Shopify-webhook
npm install
cp .env.example .env
```

Edit `.env` with your real credentials:

```
PORT=4000
NODE_ENV=development
SHOP_DOMAIN=YOUR_SHOP.myshopify.com
SHOPIFY_TOKEN=shpat_xxx
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_FROM=+15551234567
```

## Local Development
- `npm run dev` – start with Nodemon, auto-reloads on change.
- `npm start` – run in production mode.

Health probe: GET `http://localhost:4000/health`

## Message Templates
Edit `src/messages/templates.json` to tweak copy or add new tags:

```json
{
  "packed": "Your order {{order_number}} is ready!"
}
```

New tags automatically become available once added to this file.

## Shopify Flow Integration
1. Create a Flow that triggers when an order tag is added.
2. Add “Send HTTP request” action:
   - Method: `POST`
   - URL: `https://<your-deployed-host>/webhook/sms`
   - Headers: `Content-Type: application/json`
   - Body (JSON):
     ```json
     {
       "order_id": {{order.id}},
       "customer_phone": {{order.customer.phone}},
       "customer_name": {{order.customer.firstName}},
       "order_number": {{order.name}},
       "added_tag": {{order_tag}},
       "tracking": {{order.fulfillment.displayTrackingUrl}}
     }
     ```
3. Publish the Flow.

## Duplicate Prevention
- Before sending an SMS, the app fetches metafield `sms.sent_log`.
- If the incoming tag exists, it returns `200` with `"duplicate ignored"`.
- Otherwise it sends the SMS, appends the tag, and updates the metafield.

## Deployment

### Railway
1. `railway up` or create a Node service pointing to this repo.
2. Add environment variables in the Railway dashboard.
3. Expose port `PORT` (defaults to 4000).

### Render (Web Service)
- Recommended: use the included `render.yaml` blueprint. In Render, create **New → Blueprint Instance**, point to your repo, and the service will be created with the correct health check and commands.
- If creating manually: **New → Web Service** from your repo, Build command `npm ci --omit=dev`, Start command `npm start`, and set `NODE_ENV=production`.
- Add env vars: `SHOP_DOMAIN`, `SHOPIFY_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. Render sets `PORT` automatically.

### Vercel (Node Serverless)
1. Create `vercel.json` with `"builds": [{"src":"src/server.js","use":"@vercel/node"}]`.
2. `vercel deploy --prod`.
3. Set env vars in Vercel dashboard.

## API Reference
**POST** `/webhook/sms`

Request body:
```json
{
  "order_id": 1234567890,
  "customer_phone": "+15551234567",
  "customer_name": "Jane",
  "order_number": "#1024",
  "added_tag": "shipped",
  "tracking": "https://tracking.example/123"
}
```

Responses:
- `200 { "message": "SMS sent" }`
- `200 { "message": "duplicate ignored" }`
- `200 { "message": "No template configured for <tag>" }`
- `400 { "message": "Invalid payload", "errors": [...] }`
- `500 { "message": "Internal server error" }`

## Observability
- Logs stream to stdout with timestamps and structured metadata via `src/utils/logger.js`.
- Shopify and Twilio errors bubble up with context to aid debugging.

## Next Steps
- Attach your preferred log drain (Papertrail, Datadog, etc.).
- Add HTTPS/authorization if the webhook needs verification.
