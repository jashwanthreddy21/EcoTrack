# EcoTrack Deployment & DevOps Guide
## Docker, Kubernetes & Local Runbook

---

## 1. Quick Local Execution
```bash
# Install dependencies
npm install

# Run unit tests
npx --yes tsx --test src/utils/ecoLogic.test.ts

# Start the full-stack development server (Express + Vite on Port 3000)
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 2. Docker Compose Deployment
To launch the complete container stack (Express Backend + PostgreSQL 16):
```bash
docker compose up --build -d
```
Inspect logs and health:
```bash
docker compose logs -f backend
curl -f http://localhost:3000/api/health
```
Teardown:
```bash
docker compose down -v
```

---

## 3. Kubernetes Cluster Deployment (Minikube / Docker Desktop)
Apply the manifests sequentially:
```bash
# 1. Create dedicated namespace
kubectl apply -f k8s/namespace.yaml

# 2. Apply ConfigMap and Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.example.yaml

# 3. Deploy PostgreSQL Database with PVC storage
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml

# 4. Deploy Backend and Frontend Services
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# 5. Verify Pods and Services
kubectl get pods -n ecotrack
kubectl get svc -n ecotrack
```

---

## 4. Render Deployment (Backend API / Full-Stack)

1. Sign in to [Render](https://render.com) and click **New +** -> **Web Service**.
2. Connect your GitHub repository: `https://github.com/jashwanthreddy21/EcoTrack.git`.
3. Configure the service:
   - **Name**: `ecotrack-api`
   - **Runtime**: `Node`
   - **Build Command**: `npm install --legacy-peer-deps`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
4. Add Environment Variables under the **Environment** tab:
   - `NODE_ENV` = `production`
   - `GEMINI_API_KEY` = `your_gemini_api_key` *(optional)*
   - `ADMIN_EMAIL` = `admin@ecotrack.org` *(optional)*
   - `ADMIN_PASSWORD` = `Admin@1234` *(optional)*
5. Click **Create Web Service**. Render provides your live URL (e.g. `https://ecotrack-api.onrender.com`).

---

## 5. Vercel Deployment (Frontend React App)

1. Sign in to [Vercel](https://vercel.com) and click **Add New...** -> **Project**.
2. Import `https://github.com/jashwanthreddy21/EcoTrack.git`.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Add Environment Variables:
   - `VITE_API_URL` = `https://<your-render-service-name>.onrender.com/api`
   - `VITE_GOOGLE_MAPS_API_KEY` = `your_google_maps_key` *(optional)*
5. Click **Deploy**. Vercel will build and assign your production URL (e.g. `https://ecotrack.vercel.app`).

