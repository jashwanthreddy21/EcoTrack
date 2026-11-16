# EcoTrack — Smart Waste Collection and Management Platform
### SR University | School of Computer Science & Artificial Intelligence
**Course**: B.Tech — Professional Elective (23CS102PE405) | DevOps and Full Stack Development  
**Academic Year**: 2026–2027 | **Project Number**: 54  
**Project Title**: Online Waste Collection and Management Platform  
**Tagline**: *"Smarter Waste Collection. Cleaner Communities."*

---

## 1. Project Overview
EcoTrack is a centralized municipal waste management web application that digitizes waste collection operations. It empowers citizens to register households, request scheduled waste pickups, and track collection vehicles in real-time. Municipal administrators and collection supervisors can manage zones, assign collectors with collision detection, monitor performance, and generate all four university-mandated statutory reports.

---

## 2. Key Features
- **4 Distinct Role Portals**: Dedicated dashboards for Admin, Citizen, Collection Supervisor, and Waste Collector.
- **Role-Based Access Control (RBAC)**: Secure authorization enforced on frontend and Express backend.
- **Door-to-Door & Special Pickups**: 8 categories (Organic, Plastic, Paper, Recyclable, Electronic, Hazardous, Construction, General).
- **Interactive EcoMap**: GIS visualization using Mapbox/Leaflet displaying collection points, live statuses, and vehicle stops.
- **4 University Statutory Reports**:
  1. *Collection Schedule Report* (filters by date, area, collector, status + CSV export).
  2. *Pickup Request Report* (audit log of citizen requests, categories, quantities + CSV export).
  3. *Area-wise Waste Report* (zone comparisons, total collected kg + Recharts visual comparison).
  4. *Collector Performance Report* (completion rate formula: `(Completed / Total) * 100`, average completion time).
- **Google Workspace Integration**: Google Tasks synchronization and Google Chat space alerts with user confirmation.
- **Gemini 3.8 Flash Grounded AI Locator**: Intelligent municipal facility locator with verified disposal guidelines.
- **DevOps Artifacts**: Dockerfiles, Docker Compose with PostgreSQL 16 volume, Kubernetes manifests (`k8s/`), and GitHub Actions CI/CD.

---

## 3. Technology Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Recharts, Lucide Icons, Leaflet / Mapbox.
- **Backend**: Node.js 22 LTS, Express.js REST APIs, JWT authentication, Gemini 3.8 Flash SDK (`@google/genai`).
- **Database**: PostgreSQL 16, Firebase Firestore (`ai-studio-ecotracksmartwas-fcec692e-df7a-4113-9652-b84fe76d7c76`).
- **DevOps**: Docker, Docker Compose, Kubernetes (`namespace`, `configmap`, `secrets`, `deployments`, `services`, `PVC`), GitHub Actions.

---

## 4. Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npx --yes tsx --test src/utils/ecoLogic.test.ts

# 3. Start full-stack dev server
npm run dev
```
Visit `http://localhost:3000`.

---

## 5. Demo Test Credentials
- **Admin**: `admin@ecotrack.org` | Password: `Admin@1234`
- **Supervisor**: `supervisor.north@ecotrack.org` | Password: `Supervisor@1234`
- **Collector**: `rajesh.collector@ecotrack.org` | Password: `Collector@1234`
- **Citizen**: `vikram.m@gmail.com` | Password: `Citizen@1234`

---

## 6. Documentation Directory
- `docs/architecture.md` — Layered architectural specifications
- `docs/database-design.md` — Entity relationship diagram & schema
- `docs/api-documentation.md` — Complete REST API contract
- `docs/deployment-guide.md` — Docker Compose & Kubernetes runbook
- `docs/testing-guide.md` — Automated unit test guidelines
- `docs/user-guide.md` — End-to-end user workflows
