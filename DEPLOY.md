# Deployment

## Stock data (TMUS) requires a server-side API

Stock data is proxied through `/api/tmus` (Stooq). Two options:

### Option A: Deploy to Vercel (recommended)

Full functionality including stock data:

```bash
npm run deploy:vercel
# Then: vercel
```

Or connect your repo to Vercel for automatic deployments.

### Option B: GitHub Pages + Vercel API

1. Deploy once to Vercel to get the API: `vercel`
2. Note your URL (e.g. `https://kanban-xxx.vercel.app`)
3. Build for GitHub Pages with the API URL:
   ```bash
   VITE_STOCK_API_URL=https://your-app.vercel.app npm run build
   npm run deploy
   ```
4. Stock requests will go to your Vercel API.

### Local development with stock data

**Terminal 1:** Start the stock proxy
```bash
npm run api
```

**Terminal 2:** Start the app
```bash
npm run dev
```

Vite proxies `/api` to the local server. Or use `vercel dev` for full local serverless functions.
