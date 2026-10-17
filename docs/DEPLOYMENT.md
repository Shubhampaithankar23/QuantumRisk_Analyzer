# Production Deployment Guide: Vercel (Frontend) & Render (Backend)

This guide provides end-to-end instructions for deploying the **QuantumRisk Analyzer** platform across:
1. **Frontend**: [Vercel](https://vercel.com) (Next.js 14 App Router)
2. **Backend**: [Render](https://render.com) (Node.js API + SQLite / PostgreSQL + Python SSLyze Scanner)

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │            Vercel Edge Network          │
                      │     https://your-app.vercel.app         │
                      │       (Next.js 14 Frontend Portal)      │
                      └────────────────────┬────────────────────┘
                                           │
                                HTTPS REST │ NEXT_PUBLIC_API_URL
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │           Render Web Service            │
                      │   https://quantumrisk-api.onrender.com  │
                      │         (Node.js Express Backend)       │
                      └────────────────────┬────────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             ┌─────────────────────┐               ┌─────────────────────┐
             │    SQLite Database  │               │   Python Scanner    │
             │   (Prisma /dev.db)  │               │  SSLyze 6.3.1 micro │
             └─────────────────────┘               └─────────────────────┘
```

---

## PART 1: Deploy Backend to Render

You can deploy the backend to Render in two ways:
- **Method A (Standard Node Web Service)**: Recommended for simplicity.
- **Method B (Docker Web Service)**: Includes both Node Express and the Python SSLyze service in a single container.

### Method A: Standard Node Web Service (Recommended)

1. **Sign in to Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com/) and connect your GitHub account.

2. **Create New Web Service**:
   - Click **New +** -> **Web Service**.
   - Select your repository: `Shubhampaithankar23/QuantumRisk_Analyzer`.

3. **Configure Settings**:
   - **Name**: `quantumrisk-backend` (or your preferred name)
   - **Region**: Closest to your users (e.g., Singapore, Frankfurt, Oregon)
   - **Branch**: `main`
   - **Root Directory**: `backend` *(Important!)*
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npm run build && npx prisma db push
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Instance Type**: `Free`

4. **Add Environment Variables**:
   Under the **Environment Variables** section, add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `10000` | Port assigned by Render |
   | `DATABASE_URL` | `file:./dev.db` | SQLite database file |
   | `JWT_SECRET` | `generate a secure random 32+ character string` | Session token signing key |
   | `CORS_ORIGIN` | `https://*.vercel.app` | Allows requests from your Vercel domain |

5. **Deploy**:
   - Click **Deploy Web Service**.
   - Render will build your TypeScript files, run `prisma db push`, and auto-seed baseline admin accounts.
   - Once deployed, copy your Render URL: e.g., `https://quantumrisk-backend.onrender.com`.

6. **Verify Backend Health**:
   Open in your browser:
   `https://quantumrisk-backend.onrender.com/api/v1/health`
   You should see:
   ```json
   {"success":true,"data":{"status":"operational","service":"pq-readiness-api",...}}
   ```

---

### Method B: Docker Web Service (Includes Python SSLyze)

1. On Render, click **New +** -> **Web Service**.
2. Select your repository `QuantumRisk_Analyzer`.
3. Set **Runtime** to `Docker`.
4. Leave **Root Directory** blank (uses the root `Dockerfile`).
5. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: *(your secret)*
   - `CORS_ORIGIN`: `https://*.vercel.app`
6. Click **Deploy**. Render will build the Docker container with Node.js, Python, and SSLyze.

---

## PART 2: Deploy Frontend to Vercel

1. **Sign in to Vercel**:
   - Go to [vercel.com](https://vercel.com/) and sign in with GitHub.

2. **Add New Project**:
   - Click **Add New...** -> **Project**.
   - Find and click **Import** next to `Shubhampaithankar23/QuantumRisk_Analyzer`.

3. **Configure Project Settings**:
   - **Project Name**: `quantumrisk-analyzer` (or your choice)
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and choose `frontend` *(Crucial step!)*

4. **Environment Variables**:
   Expand the **Environment Variables** section and add:
   | Name | Value |
   | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://quantumrisk-backend.onrender.com/api/v1` |

   *(Replace `https://quantumrisk-backend.onrender.com` with your actual Render URL from Part 1. Make sure to append `/api/v1` at the end).*

5. **Deploy**:
   - Click **Deploy**.
   - Vercel will install dependencies, compile the Next.js App Router static and dynamic pages, and issue a free SSL certificate.
   - Once completed, you will receive your live URL: `https://quantumrisk-analyzer.vercel.app`.

---

## PART 3: Post-Deployment Verification

1. **Open your Vercel URL**:
   Navigate to `https://your-project.vercel.app`.
   You will automatically be redirected to the secure login page (`/login`).

2. **Sign In**:
   Use either seeded institutional administrator credential:
   - **Email**: `admin@quantumrisk.internal`
   - **Password**: `Admin@PQ2026!`
   *(Or `admin@apex.edu` / `Admin@123456`)*

3. **Run a Test Scan**:
   - Go to **Scan & Import** in the sidebar.
   - Enter an authorized target (e.g., `google.com` or `cloudflare.com`).
   - Check the authorization confirmation checkbox.
   - Click **Execute Quantum Risk Scan**.
   - View the verified TLS versions, X.509 certificate public key algorithm, and deterministic NIST recommendations on the dashboard!

---

## Troubleshooting & Tips

### Cold Starts on Render Free Tier
Render's free tier spins down web services after 15 minutes of inactivity. When a request arrives, it may take 30-50 seconds to wake up.
- **Tip**: You can use a free uptime monitor (such as [UptimeRobot](https://uptimerobot.com/)) to ping `https://your-backend.onrender.com/api/v1/health` every 10 minutes to keep it always awake.

### CORS Errors
If the browser console displays `Cross-Origin Request Blocked`:
- Ensure that `CORS_ORIGIN` in Render contains your exact Vercel production URL (e.g., `https://quantumrisk-analyzer.vercel.app`) or `https://*.vercel.app`.
