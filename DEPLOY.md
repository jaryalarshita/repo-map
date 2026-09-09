# 🚀 Deployment Guide — Codebase Map Backend

## Prerequisites

- A fresh **Ubuntu 22.04** VM (Vultr, GCP, or any cloud provider)
- SSH access to the VM
- Your GitHub repo pushed to `github.com/jaryalarshita/repo-map`

---

## Step 1: SSH into Your VM

```bash
# Replace with your VM's IP address
ssh ubuntu@YOUR_VM_IP
```

> **Vultr:** Find the IP in your Vultr dashboard → Instances → your server  
> **GCP:** `gcloud compute ssh YOUR_INSTANCE_NAME --zone YOUR_ZONE`

---

## Step 2: Clone the Repository

```bash
cd /home/ubuntu
git clone https://github.com/jaryalarshita/repo-map.git codebase-map
cd codebase-map
```

---

## Step 3: Run the Setup Script

The setup script installs everything automatically:

```bash
chmod +x backend/setup-vm.sh
./backend/setup-vm.sh
```

This installs: Node.js 20, g++, compiles the C++ parser, installs npm deps, sets up PM2, and opens port 3001.

---

## Step 4: Configure Environment

```bash
cd /home/ubuntu/codebase-map/backend
nano .env
```

Set your real API key:
```
PORT=3001
DEEPMIND_API_KEY=your_actual_key_here
```

Then restart:
```bash
pm2 restart codebase-map-backend
```

---

## Step 5: Verify Deployment

```bash
# From the VM
curl http://localhost:3001/api/analyze/ping

# From your local machine (replace IP)
curl http://YOUR_VM_IP:3001/api/analyze/ping
```

Expected response: `{ "status": "ok", "timestamp": "..." }`

---

## Common Commands

| Action | Command |
|---|---|
| View live logs | `pm2 logs codebase-map-backend` |
| Restart server | `pm2 restart codebase-map-backend` |
| Stop server | `pm2 stop codebase-map-backend` |
| Check status | `pm2 status` |
| Open firewall port | `sudo ufw allow 3001` |

---

## Updating After Code Changes

```bash
cd /home/ubuntu/codebase-map
git pull origin main
cd backend
npm install                    # In case new deps were added
cd parser && make clean && make && cd ..  # Recompile C++
pm2 restart codebase-map-backend
```

---

## Connecting the Frontend

In your React frontend's `.env` or fetch config, point to:

```
VITE_API_URL=http://YOUR_VM_IP:3001/api
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `curl` times out | `sudo ufw allow 3001` then `sudo ufw enable` |
| PM2 not found | `sudo npm install -g pm2` |
| Parser binary missing | `cd parser && make` |
| `json.hpp` missing | `curl -sL -o json.hpp https://github.com/nlohmann/json/releases/latest/download/json.hpp` |
| Server crashes on start | Check `pm2 logs` for error details |
| GitHub rate limited | Add a `GITHUB_TOKEN` to `.env` and pass it as a Bearer token in `githubService.js` |
