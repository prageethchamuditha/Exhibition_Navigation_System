# 🗺️ Custom Exhibition Navigation & Live Tracking System

Interactive indoor/outdoor map routing, directory search, realtime alerts, and administrative features built using React, Vite, Leaflet, and Supabase.

---

## ✅ Completed Tasks & Features

### 👤 1. Authentication & Profiles
*   **Sign-in & Sign-up**: Full authentication flows backed by Supabase Auth.
*   **Visitor Mode**: Anonymous browsing support.
*   **Role-Based Access Control**: Visitor vs. Registered User vs. Admin permissions.

### 🧭 2. Realtime Navigation
*   **Custom Map Interface**: Leaflet.js rendering customized dark-matter layers.
*   **Shortest Path Routing**: Client-side Dijkstra / A* algorithm calculating node paths.
*   **GPS Tracker integration**: High-accuracy live geolocation tracking with a grace fallback mock position manager.

### 📱 3. Mobile Optimization
*   **Responsive Layouts**: Multi-breakpoint viewport configurations supporting small screen sizes (down to 320px).
*   **Draggable Pull-up Bottom Sheet**: Interactive Google Maps-style route information sheet.
*   **Fixed Overlaps**: Compact toolbar and safe-area notch supports (`viewport-fit=cover`).

### ⚡ 4. Performance Optimizations
*   **React Code Splitting**: All pages use React `lazy` and `Suspense` loaders to load on-demand.
*   **Vite Bundle Chunking**: Split vendor dependencies (React, Leaflet, Supabase) into independent cached assets.

### 🔔 5. Realtime Alerts
*   **Live Announcements**: Supabase PostgreSQL event broadcasting showing popup alerts and emergency broadcasts.

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

