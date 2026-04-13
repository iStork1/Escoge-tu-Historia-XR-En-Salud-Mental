# Auto-Continue Debug Guide

## Summary of Changes
Added strategic console logging to the **end-of-chapter auto-continue flow** in `backend/src/index.js` (lines 2004-2080) to debug why Chapter 2 isn't displaying automatically when users reach the end of Chapter 1.

## What Was Changed
### File Modified
- `backend/src/index.js` lines 2004-2080

### New Debug Logging
When a user reaches the end of a chapter (no more scenes available), the system now logs:

1. **🛑 END OF CHAPTER DETECTED** 
   - When code detects `!nextScene` (no next scene available)
   - Shows: `{ currentChapter, currentScene }`

2. **⏭️ AUTO_CONTINUE_NEXT_CHAPTER** 
   - Whether feature is enabled + calculated `nextChapterIdAuto` (e.g., "c02")

3. **🔍 First lookup (findChapter)** 
   - Checks if next chapter already loaded in memory
   - Result: "FOUND in memory" or "not found"

4. **🔍 Second lookup (hydrateChapterFromDb)** 
   - Checks if next chapter exists in Supabase database
   - Result: "FOUND in DB" or "not found"

5. **⚙️ Chapter not found, attempting to GENERATE** 
   - Triggers LLM generation when c02 doesn't exist yet
   - Shows which chapter is being generated (e.g., "c02")

6. **✅ Generate succeeded** 
   - LLM generation completed successfully
   - Shows result object keys

7. **🔍 After generation lookup** 
   - Checks if just-generated chapter now found in database
   - Result: "FOUND in DB" or "still not found"

8. **✅ AUTO-CONTINUING TO NEXT CHAPTER** ✅ SUCCESS PATH
   - When auto-continue succeeds
   - Shows: `{ fromChapter: 'c01', toChapter: 'c02', toScene: 'c02-s01' }`
   - User receives: Chapter 2 title + first scene + available options

9. **⏰ FALLING BACK TO REMINDER** ❌ FAILURE PATH
   - When auto-continue fails
   - Shows: `{ AUTO_CONTINUE_NEXT_CHAPTER: true/false, hasNextAutoChapter: true/false }`
   - User receives: "¿Quieres que te recuerde mañana para continuar? Di sí o no."

## How to Test

### Step 1: Monitor Server Logs
Open TWO terminal windows in VS Code:

**Terminal 1 (Server): Already Running**
```
Backend server running via: npm run dev
(terminal ID: da911dd2-6d4b-4f31-be49-9024cc0847b1)
```

**Terminal 2 (Watch Logs): Create New**
```powershell
# In terminal 2, use this command to watch the running terminal's output
Get-Content -Path "~\Desktop\Escoge Tu Historia XR En Salud Mental\backend\*.log" -Wait

# OR simply switch focus to Terminal 1 and watch the output there
```

### Step 2: Watch for Server Ready State
The server logs initialization like this:
```
✅ LLM client and prompts loaded
[LLM] Initializing provider: mock
[LLM] Initializing provider: openrouter
✅ OpenRouter provider initialized
✅ Groq provider initialized
✅ Cohere provider initialized
```

**Wait until you see:**
```
✅ LLM Client initialized. Default: mock, core: openrouter, narrative: groq
```

Then the server is ready (listening on port 7070).

### Step 3: Test with Alexa Simulator

#### Option A: Use Actual Alexa Device (Preferred)
1. Say: **"Abre Escoge Tu Historia XR en Salud Mental"**
2. Complete login flow
3. Navigate through Chapter 1 scenes
4. **At the final scene** (when no more options or when you make the final decision), watch Terminal 1 for logs
5. Expected logs to appear: 🛑 → ⏭️ → 🔍 → 🔍 → (⚙️) → ✅ or ⏰

#### Option B: Use Test POST Request (Quick Test)
If you have a session that's already mid-chapter:

```powershell
# Replace with actual session_id and chapter_id
$session_id = "0d339672-d93f-4da5-9964-b7d916ce1767"
$chapter = "c01"
$scene = "c01-s06"  # Last scene
$option = "tres"    # Final option

$body = @{
    "session": @{ 
        sessionAttributes = @{
            session_id = $session_id
            chapter_id = $chapter
            current_scene_id = $scene
        }
    }
    "request": @{
        intent = @{ name = "scene" }
        slots = @{ option = @{ value = $option } }
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:7070/alexa" `
  -Method POST `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $body
```

### Step 4: Interpret the Logs

#### Expected Success Sequence ✅
```
🛑 END OF CHAPTER DETECTED: { currentChapter: 'c01', currentScene: 'c01-s06' }
⏭️ AUTO_CONTINUE_NEXT_CHAPTER: true nextChapterIdAuto: c02
🔍 First lookup (findChapter): not found
🔍 Second lookup (hydrateChapterFromDb): not found
⚙️ Chapter not found, attempting to GENERATE: c02
✅ Generate succeeded, result keys: [...]
🔍 After generation lookup: FOUND in DB
✅ AUTO-CONTINUING TO NEXT CHAPTER: { fromChapter: 'c01', toChapter: 'c02', toScene: 'c02-s01' }
```

**What this means:**
- System detected end-of-chapter
- Attempted to find c02 (not yet generated)
- Called LLM to generate c02
- Successfully generated and saved to database
- Loaded c02 from database
- Returned c02 to user

**User should hear:**
> "Fin del capítulo. Capítulo 2: [Title]. [First scene text]. Uno: [option]. Dos: [option]. Tres: [option]."

#### Expected Failure Sequence ❌ (Current Problem)
```
🛑 END OF CHAPTER DETECTED: { currentChapter: 'c01', currentScene: 'c01-s06' }
⏭️ AUTO_CONTINUE_NEXT_CHAPTER: true nextChapterIdAuto: c02
🔍 First lookup (findChapter): not found
🔍 Second lookup (hydrateChapterFromDb): not found
⏰ FALLING BACK TO REMINDER: { AUTO_CONTINUE_NEXT_CHAPTER: true, hasNextAutoChapter: false }
```

**What this means:**
- System detected end-of-chapter
- Attempted to find c02 (not yet generated)
- Generation was NOT called OR failed silently
- c02 still not found
- Fell back to reminder prompt

**User should hear:**
> "Fin del capítulo. ¿Quieres que te recuerde mañana para continuar? Di sí o no."

#### Intermediate Failure (Generation Started But Didn't Complete)
```
🛑 END OF CHAPTER DETECTED: [...]
⏭️ AUTO_CONTINUE_NEXT_CHAPTER: true
🔍 First lookup (findChapter): not found
🔍 Second lookup (hydrateChapterFromDb): not found
⚙️ Chapter not found, attempting to GENERATE: c02
❌ auto-generate next chapter failed [ERROR MESSAGE HERE]
```

**What this means:**
- Generation was called but threw an error (check the error message)
- Most likely causes:
  - Groq API failure
  - Cohere fallback failure
  - Database save failure
  - Network timeout

## Debugging Tips

### 1. Check Environment Variable
```powershell
# Verify AUTO_CONTINUE_NEXT_CHAPTER is true
cd backend ; Get-Content .env | Select-String AUTO_CONTINUE_NEXT_CHAPTER
```

Expected output: `AUTO_CONTINUE_NEXT_CHAPTER=true`

### 2. Manually Test Chapter Generation
```powershell
# Test if Groq is working
$session = "YOUR-SESSION-ID"
$response = Invoke-WebRequest -Uri "http://localhost:7070/chapters/generate" `
  -Method POST `
  -Headers @{"Content-Type" = "application/json"} `
  -Body (@{
    session_id = $session
    chapter_id = "c01"
  } | ConvertTo-Json)

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: Returns c02 chapter with title, scenes, options

### 3. Check Database
```powershell
# Verify c02 is in Supabase chapters table
# Use Supabase Dashboard → chapters table → Search for "c02"
```

### 4. Increase Timeouts
If generation is slow (300 seconds), consider:
- Checking Groq API status
- Checking internet connection
- Reviewing LLM model settings (too many tokens?)

## Next Steps Based on Findings

### If you see ✅ AUTO-CONTINUING
- **Issue is SOLVED!** User should get automatic Chapter 2 continuation
- Request another manual Alexa test to confirm

### If you see ⏰ FALLING BACK TO REMINDER
- **Generation not being called** — Check if `AUTO_CONTINUE_NEXT_CHAPTER` is in .env as `true`
- **Generation called but failed** — Check Groq API key and rate limits
- **Generation succeeded but DB lookup failed** — Check database connectivity

### If server doesn't start
- **Port 7070 in use** — Kill old process: `Get-Process node | Stop-Process -Force`
- **Database timeout** — Check Supabase connection, network, .env SECRET
- **LLM provider error** — Check API keys in .env

## Contact Support
If logs don't match any expected scenario above, save the full log output and provide:
1. Complete log sequence (from 🛑 to final ✅ or ⏰)
2. Error message (if any)
3. Session ID tested with
4. Time of test
