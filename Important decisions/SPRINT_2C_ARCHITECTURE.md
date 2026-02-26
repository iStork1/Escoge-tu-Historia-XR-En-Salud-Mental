# Sprint 2c: Unified LLM Provider Architecture - Implementation Complete ✅

## Overview
The backend now supports a **pluggable, multi-provider LLM architecture** that allows seamless switching between Ollama (local/free), OpenAI (cloud), and Claude (cloud) without code changes.

## Architecture Components

### 1. **Provider Factory Pattern** (`backend/src/llm-providers.js`)
- **Purpose**: Creates the appropriate provider instance based on `LLM_PROVIDER` environment variable
- **Method**: `createLLMProvider()`
- **Available Providers**: 
  - `ollama` (default) - Free, local inference
  - `openai` - Cloud-based GPT models
  - `claude` - Cloud-based Anthropic models

### 2. **Base Provider Interface** 
All providers implement these methods:
- `initialize()` - Initialize provider and verify connectivity
- `generate(model, prompt, options)` - Generate text from a single model
- `generateParallel(models[], prompt, options)` - Generate from multiple models
- `healthCheck()` - Verify provider is operational
- `getAvailableModels()` - List available models

### 3. **Individual Provider Implementations**

#### **Ollama Provider** (`backend/src/providers/ollama.js`)
```javascript
// Configuration
OLLAMA_BASE=http://localhost:11434/api

// Supported Models
- orca-mini (1.7B) - 2GB RAM - Recommended for MVP
- phi (2.7B) - 2.5GB RAM
- mistral (7B) - 4.5GB RAM - RAM limited on dev machine

// Features
- Local inference (no API costs)
- Dynamic model discovery
- 60-second timeout per request
```

#### **OpenAI Provider** (`backend/src/providers/openai.js`)
```javascript
// Configuration  
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo

// Features
- Cloud-based (reliable, always available)
- Token counting for cost tracking
- Requires npm install openai

// Installation
npm install openai
```

#### **Claude Provider** (`backend/src/providers/claude.js`)
```javascript
// Configuration
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-sonnet-20240229

// Features
- Cloud-based (reliable, always available)
- Token counting for cost tracking
- Requires npm install @anthropic-ai/sdk

// Installation
npm install @anthropic-ai/sdk
```

### 4. **Unified LLM Client** (`backend/src/llm-client.js`)
Provides provider-agnostic interface to the rest of the backend:

```javascript
// Initialize at startup
await llmClient.initializeLLMClient()

// Call LLM (uses configured provider)
const result = await llmClient.callLLM(model, prompt, options)

// Call all available models in parallel
const results = await llmClient.callAllModels(prompt, options)

// Check provider health
const health = await llmClient.checkHealth()

// Get provider information
const info = llmClient.getProviderInfo()

// Parse LLM responses
const mapping = llmClient.parseClinicianResponse(responseText)

// Compare mappings
const comparison = llmClient.compareMappings(designer, llm)
```

## Integration Points

### ✅ **Endpoint: POST /decisions/{id}/compute-mapping**
- **Updated**: Uses `callAllModels()` instead of hardcoded Ollama
- **Response**: Includes results from all available models in configured provider
- **Provider-agnostic**: Works with Ollama, OpenAI, Claude

### ✅ **Endpoint: POST /decisions/{id}/compute-mapping/compare**
- **Updated**: Iterates through available models instead of assuming "mistral"
- **Response**: Comparison between designer and LLM mappings
- **Provider-agnostic**: Works with any provider's available models

### ✅ **Endpoint: GET /admin/llm-health**
- **Updated**: Was `/admin/ollama-health`, now `/admin/llm-health`
- **Response**: Provider health status + available models
- **Shows**: Current provider and initialization state

### ✅ **Startup Sequence** (`backend/src/index.js`, lines 14-24)
```javascript
// Initialize LLM provider when server starts
const llmClient = require('./src/llm-client');
(async () => {
  await llmClient.initializeLLMClient();
})();
```

## Configuration

### Environment Variables
Create `.env` in backend directory:

```env
# Choose provider: ollama | openai | claude
LLM_PROVIDER=ollama

# Ollama (local)
OLLAMA_BASE=http://localhost:11434/api

# OpenAI (cloud) - Optional
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo

# Claude (cloud) - Optional  
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

### Provider Selection
```bash
# Use Ollama (default, free, local)
export LLM_PROVIDER=ollama

# Switch to OpenAI (cloud, paid)
export LLM_PROVIDER=openai

# Switch to Claude (cloud, paid)
export LLM_PROVIDER=claude
```

## Testing

### 1. Run Provider Tests
```bash
cd backend
node scripts/test_llm_providers.js
```

This test validates:
- ✅ Provider factory creates correct provider
- ✅ Provider initializes successfully
- ✅ Health check works
- ✅ Model generation works
- ✅ LLM client integrates correctly
- ✅ Available models can be listed

### 2. Test Endpoint with cURL

**Health Check:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/admin/llm-health" -Method GET
```

**Compute Mapping:**
```powershell
$payload = @{
    decision_id = "your-decision-id"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/decisions/your-decision-id/compute-mapping" `
  -Method POST `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $payload
```

### 3. Expected Test Output
```
✅ Test 1: Provider Factory ✓
✅ Test 2: Provider Initialization ✓
✅ Test 3: Health Check ✓
✅ Test 4: Model Generation ✓
✅ Test 5: LLM Client Integration ✓
✅ Test 6: Available Models ✓

Summary: 6 Passed, 0 Failed
```

## Error Handling

### Provider Initialization Failures
- **Ollama unavailable**: Server starts but health check fails
  - Can still run with other providers if configured
- **OpenAI API key invalid**: Graceful degradation if SDK not installed
- **Claude API key missing**: Falls back to other providers

### Timeout Handling
- **Ollama**: 60-second timeout per model
- **OpenAI/Claude**: API defaults (typically 30-60 seconds)
- **Graceful degradation**: If one model times out, others continue

## Extensibility

### Adding a New Provider (e.g., Hugging Face)
```javascript
// 1. Create backend/src/providers/huggingface.js
class HuggingFaceProvider extends BaseProvider {
  async initialize() { /* ... */ }
  async generate(model, prompt, options) { /* ... */ }
  async healthCheck() { /* ... */ }
  async getAvailableModels() { /* ... */ }
}

// 2. Export default
module.exports = HuggingFaceProvider;

// 3. Add to factory in llm-providers.js
case 'huggingface':
  return new HuggingFaceProvider();

// 4. Update .env
LLM_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_...
```

## Benefits

| Feature | Ollama | OpenAI | Claude |
|---------|--------|--------|--------|
| **Cost** | Free | Paid | Paid |
| **Location** | Local | Cloud | Cloud |
| **Setup** | Running locally | API key | API key |
| **Speed** | Depends on model | Fast | Fast |
| **Models** | orca-mini, phi, mistral | GPT-4, GPT-3.5 | Claude 3 variants |
| **Best For** | MVP development | Production | Production |

## Files Modified/Created

### Created (New)
- ✅ `backend/src/llm-providers.js` - Factory + BaseProvider
- ✅ `backend/src/providers/ollama.js` - Ollama implementation
- ✅ `backend/src/providers/openai.js` - OpenAI implementation
- ✅ `backend/src/providers/claude.js` - Claude implementation
- ✅ `backend/scripts/test_llm_providers.js` - Comprehensive tests

### Modified (Refactored)
- ✅ `backend/src/llm-client.js` - Provider-agnostic client
- ✅ `backend/src/index.js` - Updated endpoints + initialization

### Unchanged
- ✅ `backend/src/prompts.js` - No changes needed
- ✅ Database schema - No changes needed
- ✅ All other endpoints - Fully backward compatible

## Next Steps

### Immediate (Sprint 2c Completion)
1. ✅ Run test script to verify all providers initialize
2. ✅ Test POST /decisions/{id}/compute-mapping endpoint
3. ✅ Verify health endpoint shows correct provider
4. ✅ Confirm response format matches expected schema

### Short Term (Sprint 3)
- **Chapter Generation**: POST /chapters/generate
  - Input: session_id + decision_history
  - Uses llmClient.callLLM() for narrative generation
  - Outputs: chapter_id, scenes[], options[]

### Medium Term (UI/Dashboard)
- Clinician dashboard for mapping validation
- Side-by-side comparison: designer vs LLM mappings
- Cost analytics (if using OpenAI/Claude)
- Model selection UI for power users

## Troubleshooting

### "Provider not initialized" error
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Or check OpenAI key
echo $OPENAI_API_KEY

# Restart backend
node backend/src/index.js
```

### "Model not found" error
```bash
# Check available models
node scripts/test_llm_providers.js

# For Ollama, pull a model
ollama pull orca-mini

# For OpenAI, verify key has access to model
```

### "Timeout" error
```bash
# Increase timeout in .env
# Ollama: OLLAMA_TIMEOUT=120000 (in llm-client.js)

# Switch to smaller model (Ollama)
# Or use cloud provider (OpenAI/Claude)
```

## Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Provider factory | ✅ Complete | Pluggable design |
| Ollama provider | ✅ Complete | Free, local, tested |
| OpenAI provider | ✅ Complete | Cloud, requires API key |
| Claude provider | ✅ Complete | Cloud, requires API key |
| LLM client refactor | ✅ Complete | Provider-agnostic |
| Endpoint integration | ✅ Complete | compute-mapping + compare |
| Health endpoint | ✅ Complete | Updated to /admin/llm-health |
| Server initialization | ✅ Complete | Provider init on startup |
| Test suite | ✅ Complete | 6 test scenarios |
| Documentation | ✅ Complete | This file |

**Ready for Sprint 3: Chapter Generation** 🚀
