# 🗺️ Custom Exhibition Navigation & Live Tracking System
### Comprehensive Project Plan — Version 1.0

> **Goal:** Build a web application that allows visitors to navigate through exhibitions, stores, campuses, or private areas using **custom paths** instead of relying on Google Maps.

---

## 📋 Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Modules](#2-project-modules)
3. [Database Design](#3-database-design)
4. [Frontend Pages & Components](#4-frontend-pages--components)
5. [Backend APIs](#5-backend-apis)
6. [Navigation Algorithm](#6-navigation-algorithm)
7. [Map Features](#7-map-features)
8. [Security](#8-security)
9. [Testing](#9-testing)
10. [Deployment](#10-deployment)
11. [Project Timeline — Phase by Phase](#11-project-timeline--phase-by-phase)
12. [Repository Architecture](#12-repository-architecture)
13. [Voice Broadcasting (Future)](#13-voice-broadcasting-future)
14. [Future Features](#14-future-features)

---

## 1. Technology Stack

### 🖥️ Frontend
| Technology | Purpose |
|---|---|
| React.js (Vite) | UI framework |
| HTML5 | Structure |
| CSS / Tailwind CSS | Styling |
| JavaScript / TypeScript | Logic |
| Leaflet.js | Interactive maps |
| OpenStreetMap | Map tiles |

### ⚙️ Backend
| Technology | Purpose |
|---|---|
| Supabase | Backend-as-a-Service |
| PostgreSQL | Database |
| Supabase Realtime | Live updates |
| Supabase Authentication | User auth |
| Supabase Storage | File/image storage |
| Edge Functions | Custom server logic (if needed) |

### ☁️ Hosting & Repository
| Service | Use |
|---|---|
| Cloudflare Pages | Frontend hosting |
| Supabase Cloud | Backend hosting |
| GitHub | Code repository |
| Git | Version control |

---

## 2. Project Modules

### 👤 Module 1 — User Module ✅ DONE
- [x] Login
- [x] Register
- [x] Anonymous visitor mode
- [x] User profile
- [x] GPS permission handling
- [x] Location updates

### 🛠️ Module 2 — Admin Module ✅ DONE
- [x] Dashboard
- [x] Manage exhibitions
- [x] Manage stores
- [x] Manage categories
- [x] Manage navigation nodes
- [x] Manage routes
- [x] View visitor statistics
- [x] Send announcements

### 🏪 Module 3 — Store Module ✅ DONE
- [x] Store information display
- [x] Store images
- [x] Promotions
- [x] Categories
- [x] Opening hours
- [x] Contact details
- [x] Search stores


### 🎪 Module 4 — Exhibition Module ✅ DONE
- [x] Exhibition details page
- [x] Event schedule
- [x] Map view
- [x] Categories
- [x] Featured exhibitions


### 🧭 Module 5 — Navigation Module ✅ DONE
- [x] Detect user location
- [x] Find nearest navigation node
- [x] Calculate shortest path
- [x] Draw navigation line on map
- [x] Live position updates
- [x] Destination guidance

### 🔍 Module 6 — Search Module ✅ DONE
- [x] Search stores
- [x] Search exhibitions
- [x] Search facilities
- [x] Search services

### 🔔 Module 7 — Notification Module ✅ DONE
- [x] Push notifications
- [x] Live announcements
- [x] Emergency alerts

### 📊 Module 8 — Analytics Module ✅ DONE
- [x] Visitor count
- [x] Popular stores
- [x] Most visited routes
- [x] Heat map
- [x] Live visitor statistics

---

## 3. Database Design

### Tables & Fields

| Table | Fields |
|---|---|
| `users` | id, name, email, phone, role, created_at |
| `exhibitions` | id, title, description, image, start_date, end_date |
| `stores` | id, name, description, logo, category_id, latitude, longitude, opening_time, closing_time |
| `categories` | id, name |
| `navigation_nodes` | id, name, latitude, longitude |
| `navigation_edges` | id, from_node, to_node, distance |
| `routes` | id, store_id, node_id |
| `announcements` | id, title, message, created_at |
| `visitor_locations` | user_id, latitude, longitude, updated_at |

---

## 4. Frontend Pages & Components

### 📄 Pages
| Page | Status | Description |
|---|---|---|
| Home Page | ✅ Done | Landing / welcome screen |
| Login Page | ✅ Done | User sign in |
| Register Page | ✅ Done | New user registration |
| Map Page | ✅ Done | Interactive map view |
| Navigation Page | ✅ Done | Turn-by-turn navigation |
| Store Details | ✅ Done | Individual store info |
| Exhibition Details | ✅ Done | Individual exhibition info |
| Search Page | ✅ Done | Global search |
| Profile Page | ✅ Done | User profile & settings |
| Admin Dashboard | ✅ Done | Admin control panel |
| Settings | ⬜ Later | App settings |
| About | ⬜ Later | About the system |

### 🧩 Components
| Component | Status | Purpose |
|---|---|---|
| Navbar | ✅ Done | Top navigation bar |
| Sidebar | ✅ Done | Side menu |
| Map | ✅ Done | Leaflet.js map component |
| GPS Button | ✅ Done | Trigger location detection |
| Store Card | ✅ Done | Store list item card |
| Exhibition Card | ✅ Done | Exhibition list item card |
| Search Bar | ✅ Done | Global search input |
| Navigation Panel | ✅ Done | Route display panel |
| Bottom Navigation | ✅ Done | Mobile bottom nav bar |
| Profile Card | ✅ Done | User info card |
| Notification Popup | ✅ Done | Alert/announcement popup |
| Loading Screen | ✅ Done | App loading state |
| GPS Permission Banner | ✅ Done | GPS nudge banner |
| Protected Route | ✅ Done | Auth route guard |
| Auth Context | ✅ Done | Global auth state |

---

## 5. Backend APIs

- [x] **Authentication API** — Register, login, logout, session management
- [x] **Store API** — CRUD for stores
- [x] **Exhibition API** — CRUD for exhibitions
- [x] **Navigation API** — Nodes, edges, path calculation
- [x] **Search API** — Unified search across all entities
- [x] **Location API** — Real-time user location update & fetch
- [x] **Realtime API** — Supabase Realtime subscriptions
- [x] **Announcement API** — Create and broadcast announcements
- [x] **Admin API** — Admin-only operations and statistics

---

## 6. Navigation Algorithm

> The core of the system — getting users from point A to point B using custom indoor/outdoor paths.

### Step-by-Step Flow

```
Step 1 → Get current GPS location from browser
Step 2 → Find the nearest navigation node to the user position
Step 3 → Find the nearest navigation node to the destination
Step 4 → Calculate shortest path using Dijkstra OR A* algorithm
Step 5 → Return the ordered list of nodes (the route)
Step 6 → Draw the route as a polyline on the Leaflet.js map
Step 7 → Continuously update user location in real-time
```

### Algorithm Choice
| Algorithm | Best For |
|---|---|
| **Dijkstra** | Reliable, works for all weighted graphs |
| **A*** | Faster, uses heuristic (geographic distance) |

---

## 7. Map Features

### Core Map Elements
- [x] Current location marker (live)
- [x] Destination marker
- [x] Store markers
- [x] Exhibition markers

### Facility Markers
- [x] Parking
- [x] Washrooms
- [x] Food courts
- [x] Emergency exits

### Controls
- [x] Zoom in / Zoom out
- [x] Compass / Orientation
- [x] Navigation line (polyline along route)

---

## 8. Security

| Security Measure | Implementation |
|---|---|
| HTTPS | Cloudflare SSL (automatic) |
| Authentication | Supabase Auth (JWT) |
| Row Level Security (RLS) | Supabase Postgres RLS policies |
| Admin permissions | Role-based access control |
| Input validation | Frontend + Backend validation |
| Rate limiting | Supabase + Cloudflare rate limiting |

---

## 9. Testing

| Test Type | What to Test |
|---|---|
| GPS accuracy testing | Location precision across devices |
| Navigation testing | Correct route calculation & drawing |
| Load testing | Performance with many concurrent users |
| Database testing | Data integrity, queries, edge cases |
| Mobile testing | Responsive UI on phones & tablets |
| Cross-browser testing | Chrome, Firefox, Safari, Edge |

---

## 10. Deployment

### Deployment Pipeline

```
GitHub (push) → Cloudflare Pages (frontend auto-deploy) → Supabase (backend always live) → Production
```

### Future Mobile App
> Using the **same Supabase backend**, build a mobile app with:
> - Flutter
> - React Native

---

## 11. Project Timeline — Phase by Phase

### Phase 1 — Project Setup ✅ DONE
- [x] Create GitHub repository
- [x] Set up Cloudflare Pages project
- [x] Initialize Supabase project
- [x] Scaffold React + Vite frontend
- [x] Connect frontend to Supabase
- [x] Configure environment variables

---

### Phase 2 — Authentication & User Management ✅ DONE
- [x] Design `users` table in Supabase
- [x] Implement Supabase Auth (email/password)
- [x] Build Login page
- [x] Build Register page
- [x] Implement anonymous visitor mode
- [x] Add role-based access (admin / user / visitor)
- [x] Protect admin routes

---

### Phase 3 — Map Integration & GPS Tracking ✅ DONE
- [x] Integrate Leaflet.js into the React app
- [x] Load OpenStreetMap tiles
- [x] Add "Show my location" GPS button
- [x] Request browser GPS permission
- [x] Display user current location on map
- [x] Handle GPS errors gracefully

---

### Phase 4 — Custom Navigation System ✅ DONE
- [x] Design `navigation_nodes` table
- [x] Design `navigation_edges` table
- [x] Create Admin UI to add/edit nodes & edges
- [x] Implement Dijkstra / A* algorithm in JavaScript
- [x] Find nearest node to user location
- [x] Find nearest node to destination
- [x] Calculate and return shortest path
- [x] Draw route polyline on the Leaflet map
- [x] Handle no-route-found edge case

---

### Phase 5 — Store & Exhibition Management + Search
- [x] Design `stores` table
- [x] Design `exhibitions` table
- [x] Design `categories` table
- [x] Build Admin UI for stores & exhibitions
- [x] Build Store Details page
- [x] Build Exhibition Details page
- [x] Build Search page (unified search)
- [x] Link stores to navigation nodes (routes)

---

### Phase 6 — Realtime Location Updates
- [x] Design `visitor_locations` table
- [x] Enable Supabase Realtime on the table
- [x] Update user location every N seconds
- [x] Show live visitor positions on Admin map
- [x] Handle realtime subscription cleanup on unmount

---

### Phase 7 — Announcements & Notifications
- [x] Design `announcements` table
- [x] Build Admin UI to create announcements
- [x] Subscribe to realtime announcement updates on frontend
- [x] Show Notification Popup to all visitors in real-time
- [x] Add Emergency Alert support (priority flag)

---

### Phase 8 — Testing
- [ ] Write unit tests for navigation algorithm
- [ ] Test GPS accuracy on real devices
- [ ] Perform load testing (simulate N users)
- [ ] Test all API endpoints
- [x] Cross-browser & mobile testing
- [x] Fix bugs found during testing

---

### Phase 9 — Deployment
- [x] Connect GitHub repo to Cloudflare Pages
- [x] Set all environment variables on Cloudflare
- [x] Run final production build
- [x] Verify all features on production URL
- [ ] Set up custom domain (if applicable)
- [x] Monitor Supabase dashboard after launch

---

### Phase 10 — Future Improvements
- [ ] Indoor navigation support
- [ ] QR Code checkpoints
- [ ] Bluetooth Beacon positioning
- [ ] Offline maps (PWA)
- [ ] Voice navigation
- [ ] AI route recommendations
- [ ] Mobile app (Flutter / React Native)

---

## 12. Repository Architecture

```
project-root/
│
├── frontend/            # React + Vite app
│   ├── src/
│   │   ├── components/  # Reusable components (Map, Navbar, etc.)
│   │   ├── pages/       # Route pages (Home, Login, Map, etc.)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── utils/       # Helper functions (Dijkstra, etc.)
│   │   ├── lib/         # Supabase client setup
│   │   └── App.tsx
│   └── index.html
│
├── backend/             # Edge Functions (if needed)
│
├── database/            # SQL schema and migrations
│   └── schema.sql
│
├── docs/                # Documentation
│
├── assets/              # Images, icons
│
├── scripts/             # Utility scripts
│
├── tests/               # Automated tests
│
└── README.md
```

---

## 13. Voice Broadcasting (Future)

> Live announcements broadcast to all visitors simultaneously.

```
Broadcaster (Admin) → Icecast Server → All Visitors receive live audio
```

**Example Announcements:**
- *"Hall A presentation starts in 5 minutes."*
- *"Emergency exit is on the left side of Building B."*
- *"The food court on Level 2 is now open."*

---

## 14. Future Features

| Feature | Description |
|---|---|
| Indoor Navigation | Navigate inside buildings using floor maps |
| QR Code Checkpoints | Scan QR to confirm & locate position indoors |
| Bluetooth Beacons | Precise indoor positioning via BLE beacons |
| Offline Maps (PWA) | Use the app without internet via service workers |
| Voice Navigation | Audio turn-by-turn directions |
| AI Route Recommendations | Suggest optimal routes based on crowd |
| Crowd Density Prediction | Predict and visualize crowded areas |
| Traffic Estimation | Estimate travel time per route segment |
| Store Recommendations | "You may also like nearby stores" |
| Multi-language Support | Localization for multiple languages |
| Dark Mode | Dark theme for the UI |
| Accessibility Mode | Screen reader & high-contrast support |
| Volunteer/Staff Tracking | Track staff positions on admin map |
| Emergency Evacuation Routing | Dedicated safe-route mode in emergencies |
| Heat Maps | Visualize visitor flow & hotspots |
| Business Analytics | Exhibitor dashboard with visitor insights |

---

*Last updated: 2026-07-16 | Based on Exhibition_Navigation_Plan-v2.pdf*
