{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "echo 'No build needed'"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "NEVER",  // <-- CRITICAL: Don't auto-restart
    "healthcheckPath": "/",        // Simple health check
    "healthcheckTimeout": 120,     // 2 minutes timeout
    "startCommand": "node server.js"
  }
}
