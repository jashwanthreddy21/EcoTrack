# EcoTrack System Architecture Specification
## SR University | Department of Computer Science & Artificial Intelligence
### Course: DevOps and Full Stack Development (23CS102PE405) | Project No. 54

---

## 1. Executive Summary
**EcoTrack** is a centralized, production-grade municipal solid waste management platform designed to digitize door-to-door and on-demand waste collection. It enforces strict Role-Based Access Control (RBAC) across four primary actors:
1. **Municipal Administrator**
2. **Collection Operations Supervisor**
3. **Waste Collection Driver / Field Operator**
4. **Citizen / Household Generator**

---

## 2. Layered Architectural Blueprint

```
+-------------------------------------------------------------------------+
|                              PRESENTATION TIER                          |
|  - React 19 SPA (Vite 8, TypeScript, Tailwind CSS)                     |
|  - Leaflet & Mapbox Raster GIS Tile Layer (EcoMap)                      |
|  - Recharts Responsive Analytics & 4 University Statutory Reports       |
|  - Role-Scoped Views: Admin, Supervisor, Collector, Citizen             |
+-------------------------------------------------------------------------+
                                     |
                                     | REST API / JSON over HTTPS
                                     v
+-------------------------------------------------------------------------+
|                              APPLICATION TIER                           |
|  - Node.js 22 LTS with Express.js Modular Engine                        |
|  - JWT Bearer Authentication & RBAC Middleware                          |
|  - Schedule Conflict Detection & State Machine Validation Logic         |
|  - Google Workspace Integration Proxy (Tasks & Chat API with OAuth)     |
|  - Gemini 3.8 Flash Maps Grounding & Municipal Facility Locator        |
+-------------------------------------------------------------------------+
                                     |
                                     | Dual-Storage Persistence Layer
                                     v
+-------------------------------------------------------------------------+
|                                DATA TIER                                |
|  - Primary Persistence: PostgreSQL Relational Database (16-Alpine)      |
|  - Cloud Document Store: Firebase Firestore Engine                      |
|  - Firestore Security Rules (ABAC Zero-Trust / No Orphaned Writes)      |
|  - Docker Persistent Volume Claim for Durable Storage                   |
+-------------------------------------------------------------------------+
```

---

## 3. DevOps Infrastructure & Deployment Topology
- **Containerization**: Multi-stage Docker builds (`backend/Dockerfile`, `frontend/Dockerfile`).
- **Orchestration**: Kubernetes cluster manifests (`k8s/`) with Namespaces, ConfigMaps, Secrets, Deployments, Services, and PVC storage.
- **CI/CD Pipeline**: GitHub Actions (`.github/workflows/ci.yml`) automating linting, logic unit tests (`tsx --test`), production asset bundling, and container image verification.
