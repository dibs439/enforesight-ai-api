# Render Deployment Troubleshooting

## Error: "Could not open requirements.txt"

**Root Cause:** Render dashboard is configured to deploy as a **Python application** instead of **Node.js**.

---

## Fix: Update Render Dashboard Settings

### ✅ CRITICAL - Fix Build Command in Render Dashboard

**Your current build command is trying to run Python!** This needs to be changed immediately.

1. **Go to Render Dashboard** → Select your service (e.g., `enforesight-api-production`)

2. **Update Build Command (CRITICAL):**
   - Go to **Settings** → **Build & Deploy**
   - Find the "Build Command" field
   - **DELETE** the existing Python/Poetry command:
     ```
     npm install && curl -sSL https://install.python-poetry.org | python3 - || true &&python3 -m pip install --upgrade pip setuptools wheel &&python3 -m pip install --no-cache-dir --prefer-binary -r requirements.txt &&npm run build
     ```
   - **Replace with:**
     ```
     npm install && npm run build
     ```
   - Set **Start Command** to: `npm start`

3. **Verify Runtime Settings:**
   - Go to **Settings** → **Environment**
   - Verify **Runtime** is `Node` (NOT Python)
   - If it says Python, change it to `Node`

4. **Set Node Version:**
   - Go to **Environment** tab
   - Add environment variable: `NODE_VERSION=20.13.0`

5. **Clear Build Cache & Redeploy:**
   - Click **Manual Deploy** → **Clear Build Cache & Deploy**

---

## Verification Checklist

- [ ] **Runtime** is set to `Node` (NOT Python)
- [ ] **Build Command** is: `npm install && npm run build`
- [ ] **Start Command** is: `npm start`
- [ ] **NODE_VERSION** environment variable is `20.13.0`
- [ ] NO Python/Poetry commands in build command
- [ ] NO `requirements.txt` reference in build command
- [ ] All required environment variables are set (JWT_SECRET, CONVEX_URL, etc.)
- [ ] Click **Manual Deploy** → **Clear Build Cache & Deploy**

---

## Environment Variables to Configure

**Required (no default value):**

```
JWT_SECRET
CONVEX_DEPLOYMENT
CONVEX_URL
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
OPENAI_API_KEY
```

**Optional (with defaults):**

```
NODE_ENV=production
PORT=10000
API_BASE_URL=https://api.enforesight.ai
CORS_ORIGIN=https://enforesight.ai,https://www.enforesight.ai
AUTHORIZED_PARTIES=https://enforesight.ai,https://www.enforesight.ai
AI_ENGINE_URL=https://enforesight-ai-engine.onrender.com
```

---

---

## Visual Step-by-Step Guide

### Step 1: Navigate to Build Settings
```
Render Dashboard
  → Select: enforesight-api-production (or staging)
    → Click: Settings (top menu)
      → Click: Build & Deploy (left sidebar)
```

### Step 2: Update Build Command
**FIND THIS:**
```
npm install && curl -sSL https://install.python-poetry.org | python3 - || true &&python3 -m pip install --upgrade pip setuptools wheel &&python3 -m pip install --no-cache-dir --prefer-binary -r requirements.txt &&npm run build
```

**REPLACE WITH:**
```
npm install && npm run build
```

### Step 3: Verify Runtime
```
Render Dashboard
  → Select: enforesight-api-production
    → Click: Environment (top menu)
      → Find: Runtime
      → Change to: Node
```

### Step 4: Set Node Version
```
Render Dashboard
  → Select: enforesight-api-production
    → Click: Environment (top menu)
      → Click: Add Environment Variable
      → Key: NODE_VERSION
      → Value: 20.13.0
      → Click: Save
```

### Step 5: Deploy
```
Render Dashboard
  → Select: enforesight-api-production
    → Scroll down: Manual Deploy section
    → Click: "Clear Build Cache & Deploy"
    → Wait for deployment to complete
    → Check Logs tab for success
```

---

1. **Check Render Build Logs:**
   - Go to **Logs** tab
   - Look for error messages after "Build started"

2. **Test Locally:**

   ```bash
   npm install
   npm run build
   npm start
   ```

3. **Verify Files:**
   - `.render/build.sh` exists ✅ (just created)
   - `package.json` has `build` script ✅
   - `render.yaml` specifies Node runtime ✅

4. **Reset Service:**
   - Delete the service from Render
   - Push updated code to GitHub
   - Redeploy from Render dashboard

---

## Deploy Command (for reference)

```bash
# Local build verification
npm install
npm run build
npm start
```

**Expected output:**

```
✅ Using Node.js v20.13.0
📦 Installing dependencies...
🏗️  Building application...
✅ Build completed successfully!
Server running on port 10000
```

---

## Quick Deploy Checklist

After making dashboard changes:

1. Push code with `.render/build.sh` to GitHub:

   ```bash
   git add .render/build.sh render.yaml
   git commit -m "fix: add Render build script and update deployment config"
   git push origin main
   ```

2. In Render Dashboard:
   - Change Runtime to: **Node**
   - Change Build Command to: `bash .render/build.sh`
   - Click **Manual Deploy** → **Clear Build Cache & Deploy**

3. Monitor deployment:
   - Watch **Logs** tab for success/failure
   - Should complete in 2-5 minutes

---

**Need Help?** Check Render docs: https://render.com/docs/deploy-node-express-app
