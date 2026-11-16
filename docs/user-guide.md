# EcoTrack Role-Based User Guide

---

## 1. Demo Credentials & Role Switcher
You can use the one-click role tabs in the top navigation bar or log in using:
- **Admin**: `admin@ecotrack.org` (Password: `Admin@1234`)
- **Supervisor**: `supervisor.north@ecotrack.org` (Password: `Supervisor@1234`)
- **Collector**: `rajesh.collector@ecotrack.org` (Password: `Collector@1234`)
- **Citizen**: `vikram.m@gmail.com` (Password: `Citizen@1234`)

---

## 2. End-to-End Workflows

### Workflow A: Citizen Requests Waste Pickup
1. Log in as **Citizen** or click the "Citizen" tab in the navbar.
2. Click **"Request Waste Pickup"**.
3. Select your registered household address and choose a waste category (e.g. Organic, Recyclable, E-Waste).
4. Enter estimated weight (e.g. 15 kg), select preferred collection date and time window.
5. Click **Submit**. You receive a unique reference ID (e.g. `ECOTRACK-REQ-1011`).

### Workflow B: Supervisor Approves & Assigns Collector
1. Switch to **Supervisor** console.
2. Locate the new request in the Review table.
3. Click **Approve**.
4. Click **Assign**, select active collector **Rajesh Kumar**, confirm date & slot.
5. The system saves the assignment and notifies the collector.

### Workflow C: Collector Completes Collection
1. Switch to **Collector** console.
2. View today's assigned tasks. Click **Start: On The Way**, then **Arrived: In Progress**.
3. Once waste is weighed, click **Complete Pickup**.
4. Enter actual measured weight (e.g. 16.5 kg) and remarks. Click **Confirm Completed**.
5. The request status updates to `Completed`, recalculating municipal KPI reports.

### Workflow D: Missed Pickup & Reschedule
1. Collector clicks **Mark Missed** and selects reason (e.g., *Citizen unavailable*).
2. Supervisor sees the flagged pickup and clicks **Reschedule** to assign a new time slot.

### Workflow E: 4 Mandatory University Reports
1. Switch to **Admin** or **Supervisor** console.
2. Click **Reports & Analytics**.
3. Access all 4 statutory tabs:
   - Report 1: Collection Schedule Report
   - Report 2: Pickup Request Report
   - Report 3: Area-wise Waste Report (with comparison chart)
   - Report 4: Collector Performance Report (with calculated completion rate %)
4. Click **Export CSV** or **Print View**.
