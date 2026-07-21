# 🗺️ Custom Exhibition Navigation & Live Tracking System

* **Live Demo (Visitor Portal):** [exhibition-navigation-system.pages.dev](https://exhibition-navigation-system.pages.dev/)
* **Admin Portal Login:** [exhibition-navigation-system.pages.dev/admin/](https://exhibition-navigation-system.pages.dev/admin/)

Interactive indoor/outdoor map routing, directory search, realtime alerts, and administrative features built using React, Vite, Leaflet, and Supabase.



---

## 📋 Remaining / Future Work
1.  **Phase 8 Testing**: Expand unit tests for shortest-path calculation, execute simulated concurrent visitor load testing.
2.  **Future Enhancements**: QR code check-ins, indoor Bluetooth beacons, PWA offline caching.

---

## 🚀 Deployment (Cloudflare Pages)

To deploy the application to Cloudflare Pages:

### 1. Build the Production Bundle
Compile production-ready code with code splitting:
```bash
npm run build
```

### 2. Deploy via Wrangler CLI
Upload assets using Wrangler:
```bash
npx wrangler pages deploy dist --project-name exhibition-navigation-system --branch main --commit-dirty=true
```

### 3. Environment Variables
Add environment variables under **Settings > Environment Variables**:
*   `VITE_SUPABASE_URL`
*   `VITE_SUPABASE_ANON_KEY`

