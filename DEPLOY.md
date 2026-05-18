# ReviewRadar — Cloudflare Pages Deployment

## Prerequisites

- Cloudflare account
- Wrangler CLI installed: `npm install -g wrangler`
- Logged in: `wrangler login`

## Build

```bash
npm run build
```

This generates the static site into the `dist/` directory.

## Deploy

```bash
npx wrangler pages deploy dist --project-name=review-radar --branch=main
```

Or use the deploy script:

```bash
./deploy.sh
```

## First-Time Setup

1. **Create the Pages project** (if it doesn't exist):
   ```bash
   npx wrangler pages project create review-radar --production-branch=main
   ```

2. **Deploy**:
   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name=review-radar --branch=main
   ```

3. **Get your production URL** from the output and update any callback URLs if needed.

## Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Pages → reviewradar → Custom domains
2. Add your domain and follow the DNS setup instructions

## File Structure

```
dist/                          → Built static site (deployed)
├── index.html                 → Landing page
├── dashboard/index.html       → Dashboard
├── guide/index.html           → Guide page
├── reports/index.html         → Reports page
├── settings/index.html        → Settings page
├── styles.css                 → Compiled CSS
├── main.js                    → Entry bundle
├── js/                        → Module chunks
├── assets/                    → Images, favicons
└── css/                       → Additional styles
```

## Notes

- ReviewRadar is **100% client-side**. No server functions or KV storage needed.
- The GitHub PAT is stored in the user's browser `localStorage` only.
- All API calls go directly from the browser to GitHub's API.
