# Quick Reference: Switching LLM Providers

## Current Setup (Ollama - Free, Local)

**Status**: ✅ Running on http://localhost:11434
**Model**: orca-mini (1.7B parameters, ~2GB RAM)
**Cost**: Free

```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Test endpoint
node backend/scripts/test_llm_providers.js
```

---

## Switch to OpenAI (Cloud, Paid)

### 1. Get API Key
- Visit https://platform.openai.com/api/keys
- Create new secret key
- Copy to clipboard

### 2. Update `.env`
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo
```

### 3. Install Dependencies
```bash
cd backend
npm install openai
```

### 4. Restart Server
```bash
node src/index.js
```

### 5. Verify
```bash
# Check health
curl http://localhost:3000/admin/llm-health

# Expected response
{
  "ok": true,
  "provider": {
    "provider": "openai",
    "initialized": true,
    "model": "gpt-4-turbo"
  }
}
```

### 6. Test Endpoint
```powershell
$payload = @{
    decision_id = "test-id"
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://localhost:3000/decisions/test-id/compute-mapping" `
  -Method POST `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $payload
```

### Cost Estimation
- **GPT-4 Turbo**: $0.01/1K input tokens, $0.03/1K output tokens
- **Typical mapping request**: ~500 tokens input, ~200 tokens output
- **Cost per request**: ~$0.01
- **100 requests/day**: ~$1/day

---

## Switch to Claude (Cloud, Paid)

### 1. Get API Key
- Visit https://console.anthropic.com/account/keys
- Create new API key
- Copy to clipboard

### 2. Update `.env`
```env
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

### 3. Install Dependencies
```bash
cd backend
npm install @anthropic-ai/sdk
```

### 4. Restart Server
```bash
node src/index.js
```

### 5. Verify
```bash
# Check health
curl http://localhost:3000/admin/llm-health

# Expected response
{
  "ok": true,
  "provider": {
    "provider": "claude",
    "initialized": true,
    "model": "claude-3-sonnet-20240229"
  }
}
```

### 6. Test Endpoint
```powershell
$payload = @{
    decision_id = "test-id"
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://localhost:3000/decisions/test-id/compute-mapping" `
  -Method POST `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $payload
```

### Cost Estimation
- **Claude 3 Sonnet**: $0.003/1K input tokens, $0.015/1K output tokens
- **Typical mapping request**: ~500 tokens input, ~200 tokens output
- **Cost per request**: ~0.004 cents
- **100 requests/day**: ~$0.12/day

### Available Models (in order of capability/cost)
1. **claude-3-haiku-20240307** - Fastest, cheapest ($0.00025/input, $0.00125/output)
2. **claude-3-sonnet-20240229** - Balanced (default) ($0.003/input, $0.015/output)
3. **claude-3-opus-20240229** - Most capable ($0.015/input, $0.075/output)

---

## Switch Back to Ollama (Free, Local)

### 1. Update `.env`
```env
LLM_PROVIDER=ollama
OLLAMA_BASE=http://localhost:11434/api
```

### 2. Restart Server
```bash
node src/index.js
```

### 3. Verify
```bash
# Check health
curl http://localhost:3000/admin/llm-health

# Should show available models
{
  "ok": true,
  "models": ["orca-mini", "phi"],
  "provider": {
    "provider": "ollama",
    "initialized": true,
    "model": "orca-mini"
  }
}
```

---

## Provider Comparison

| Feature | Ollama | OpenAI | Claude |
|---------|--------|--------|--------|
| **Setup Complexity** | ⭐ Easy (running) | ⭐⭐ Medium | ⭐⭐ Medium |
| **Cost** | Free | $0.01/req | $0.004/req |
| **Latency** | 10-30s (depends on model) | 1-3s | 1-3s |
| **Model Quality** | Good for MVP | Excellent | Excellent |
| **Privacy** | ✅ All local | ❌ Cloud | ❌ Cloud |
| **Reliability** | ✅ Full local control | ⭐⭐⭐⭐⭐ Stable | ⭐⭐⭐⭐⭐ Stable |
| **Offline capable** | ✅ Yes | ❌ No | ❌ No |

---

## Troubleshooting Provider Switching

### Error: "Provider not initialized"
```bash
# 1. Check current .env
cat backend/.env

# 2. Verify provider is running
# For Ollama:
curl http://localhost:11434/api/tags

# For OpenAI:
# Just verify API key is valid

# For Claude:
# Just verify API key is valid

# 3. Restart server
node backend/src/index.js

# 4. Check health endpoint
curl http://localhost:3000/admin/llm-health
```

### Error: "Model not available"
```bash
# For Ollama - pull a model
ollama pull orca-mini
ollama pull phi
ollama pull mistral

# For OpenAI - verify model name
# gpt-4-turbo, gpt-3.5-turbo, etc.

# For Claude - verify model name
# claude-3-haiku-20240307
# claude-3-sonnet-20240229
# claude-3-opus-20240229
```

### Error: "Timeout waiting for response"
```bash
# For Ollama - reduce model size
# Switch from mistral (7B) to orca-mini (1.7B)
# mistral needs more RAM/GPU

# For OpenAI/Claude
# Usually API timeout - try again
# If persistent, might be rate limited
```

### Error: "API Key invalid"
```env
# For OpenAI - verify key format
OPENAI_API_KEY=sk-proj-xxxxx  # Should start with sk-proj-

# For Claude - verify key format
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Should start with sk-ant-

# Regenerate key if unsure:
# OpenAI: https://platform.openai.com/api-keys
# Claude: https://console.anthropic.com/account/keys
```

---

## Environment Variable Checklist

### Ollama Setup
```env
✅ LLM_PROVIDER=ollama
✅ OLLAMA_BASE=http://localhost:11434/api
```

### OpenAI Setup
```env
✅ LLM_PROVIDER=openai
✅ OPENAI_API_KEY=sk-proj-...
✅ OPENAI_MODEL=gpt-4-turbo (or gpt-3.5-turbo)
```

### Claude Setup
```env
✅ LLM_PROVIDER=claude
✅ ANTHROPIC_API_KEY=sk-ant-...
✅ ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

---

## Testing Commands (PowerShell)

### Health Check (All Providers)
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/admin/llm-health" -Method GET | ConvertTo-Json
```

### Compute Mapping (All Providers)
```powershell
$payload = @{
    decision_id = "12345678-1234-5678-1234-567812345678"
    clinical_scores = @{
        gds15 = 8
        phq9 = 12
    }
    decision_text = "Patient decided to seek therapy"
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://localhost:3000/decisions/12345678-1234-5678-1234-567812345678/compute-mapping" `
  -Method POST `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $payload
```

### Provider Info
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/admin/llm-health" -Method GET
```

---

## Economics Summary

### Daily Cost Estimates (100 requests/day)
- **Ollama**: $0/day (free, local)
- **OpenAI GPT-4**: $1-2/day
- **Claude 3 Sonnet**: $0.12/day
- **Claude 3 Haiku**: $0.025/day

### Monthly Cost Estimates (1000 requests/month)
- **Ollama**: $0 + your server/infra
- **OpenAI GPT-4**: $10-20
- **Claude 3 Sonnet**: $1.20
- **Claude 3 Haiku**: $0.25

### Recommendation for MVP
**Use Ollama locally** until product-market fit is established. Then:
- If reliability > cost: Switch to OpenAI (GPT-4)
- If cost is critical: Use Claude Haiku ($0.25/1000 req)
- Or hybrid: Ollama for testing, OpenAI/Claude for production

---

## Next: Testing the Configuration

Run the test script after switching providers:
```bash
cd backend
npm install  # If switching to OpenAI/Claude
node scripts/test_llm_providers.js
```

This validates the new provider is working before using endpoints.
