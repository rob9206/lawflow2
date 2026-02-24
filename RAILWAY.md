# Deploying LawFlow (Full Stack) to Railway

This guide walks you through deploying **both** the frontend and API to Railway as a single service.

## What this does

- Builds the React frontend (`npm run build` → `frontend/dist`)
- Runs the Flask API with gunicorn
- Flask serves both `/api/*` (API routes) and `/*` (the SPA from `frontend/dist`)
- One domain, one deploy, no CORS issues

## Prerequisites

- A [Railway account](https://railway.app/) (free tier available)
- Your GitHub repo connected to Railway

## Step 1: Create a new Railway project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **Deploy from GitHub repo**
3. Select `rob9206/lawflow2` (or your fork)
4. Railway will auto-detect the Dockerfile and build everything

## Step 2: Configure the service

Railway will create a service. Click on it and:

1. **Add a volume** (for persistent file storage):
   - Go to **Settings** → **Volumes**
   - Click **+ New Volume**
   - Mount path: `/app/data`
   - Size: 1GB (or more if you expect lots of uploads)

2. **Set environment variables** in **Variables** tab:
   ```bash
   # Required
   FLASK_SECRET_KEY=<generate-a-long-random-string>
   JWT_SECRET_KEY=<same-or-another-random-string>
   
   # APP_BASE_URL will be your Railway domain (set after first deploy)
   # Leave blank initially, Railway provides $RAILWAY_PUBLIC_DOMAIN
   
   # Optional (use SQLite on volume by default)
   # DATABASE_URL=sqlite:////app/data/lawflow.db
   
   # Required for document/tutor features
   ANTHROPIC_API_KEY=<your-anthropic-key>
   
  # Optional: Stripe if you use billing
   STRIPE_SECRET_KEY=<your-stripe-secret>
   STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable>
   STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
   STRIPE_PRO_PRICE_ID=<your-stripe-price-id>
   
   # Set Flask to production mode
   FLASK_DEBUG=false
   ```

3. **Generate a domain**:
   - Go to **Settings** → **Networking**
   - Click **Generate Domain**
   - Copy it (e.g., `lawflow2-production.up.railway.app`)

4. **Update APP_BASE_URL**:
   - Go back to **Variables**
   - Add: `APP_BASE_URL=https://<your-railway-domain>`
   - Example: `APP_BASE_URL=https://lawflow2-production.up.railway.app`

5. **Configure Stripe webhook** (required for subscription sync):
   - In Stripe Dashboard, go to **Developers** -> **Webhooks**
   - Add endpoint: `https://<your-railway-domain>/api/billing/webhook`
   - Subscribe to events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy the webhook signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` in Railway

## Step 3: Deploy

Railway will automatically deploy when you push to your repo. Or click **Deploy** in the Railway dashboard.

**Build takes ~5-7 minutes** (includes frontend build with npm).

## Step 4: Access your app

Open `https://<your-railway-domain>` (e.g., `https://lawflow2-production.up.railway.app`)

- Frontend loads at `/`
- API is at `/api/*`
- Everything runs from one service

## Step 5: Remove Vercel (optional)

Since everything is now on Railway:

1. You can delete the Vercel project, or
2. Keep it as a preview/staging environment

## Monitoring

- **Logs**: Railway dashboard → your service → **Logs** tab
- **Metrics**: CPU, memory, bandwidth usage
- **Health check**: Railway pings `/api/health` every 30s

## Costs

- **Free tier**: $5/month credit (~500 hours of uptime)
- **Paid**: $5/month minimum + usage ($0.000231/GB-hour RAM, $0.000463/vCPU-hour)
- Typical cost: $10-20/month for light production use

## Troubleshooting

**502 Bad Gateway**: Service is starting. Wait 1-2 minutes after deploy.

**Frontend shows but API 404**: Check logs for Flask startup errors. Ensure `api/app.py` has `app = create_app(static_dir=...)`.

**CORS errors**: Shouldn't happen since frontend and API share the same origin.

**Build fails**: Check that `frontend/package.json` and `requirements.txt` are in the repo root structure.

## Rolling back

In Railway:
1. Go to **Deployments**
2. Click on a previous successful deploy
3. Click **Redeploy**
