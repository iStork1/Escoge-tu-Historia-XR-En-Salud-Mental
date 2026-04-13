# Sprint 4: LLM Arc Cost and Scaling Decisions

## Context and project goal

This project started with a strong narrative and clinical intent: deliver an interactive mental health story experience with continuity, meaningful decisions, and clinically useful mappings (GDS/PHQ). The challenge was cost.

We identified a concrete business target:

- From roughly `~$0.50-0.65` per active user per week
- To roughly `~$0.10-0.20` per active user per week
- Without degrading perceived quality

The key conclusion was simple: the main cost problem was not only prompt wording. The biggest issue was generation strategy. We were generating too much content too early.

## What we changed and why

## 1) From full chapter generation to scene-by-scene default

### Before

- Generation flow favored large outputs in one call
- Prompt requested many scenes and full chapter payload
- High token output and high variability in latency/cost

### Decision

Set `scene_by_scene` as the default generation mode.

- One playable scene at a time
- Exactly 3 options per playable scene
- Generate only what the user will see now (lazy generation)

### Why this matters

- Immediate token reduction
- Better runtime control
- Better adaptation to user behavior in real time

### Fallback policy

We keep a controlled fallback mode: `mini_chapter`.

Used only for specific recovery cases:

- Model output error or invalid JSON
- Strong narrative reset needed
- High skip velocity / unstable interaction path

This keeps safety and continuity without returning to expensive full-chapter generation.

## 2) Hard token budget in backend (not only prompt-level)

### Decision

Enforce explicit ceilings in backend:

- `MAX_INPUT_TOKENS` (default `800`)
- `MAX_OUTPUT_TOKENS` (default `1200`)

### Behavior

If prompt size is too large:

- Degrade narrative intensity (`medium -> low`)
- Send compact architecture context
- Keep structure and continuity while reducing verbosity

### Why this matters

This prevents cost spikes and makes cost predictable at scale. Prompt instructions alone are not enough; runtime enforcement is required.

## 3) Deterministic segmented path cache

### Problem to solve

We wanted this product behavior:

- If users follow equivalent decision paths, they should be able to see the same validated narrative result
- But not globally for everyone; clinical/context segmentation is needed

### Decision

Implement deterministic cache keys based on path and segment buckets.

Path key built from:

- Last N choices (sliding window)
- Segment (`clinical_level`, `user_pattern`, `age_group`)
- Critical convergence node
- Prompt version

### Why segmented (not global)

Same choices can require different narrative tone or risk framing depending on profile and pattern. Segmentation preserves clinical coherence while reusing expensive generation.

### What was added

- `narrative_path_cache` table for reusable variants
- `narrative_cache_events` table for hit/miss/write/rating telemetry
- Ranking fields (`quality_score`, `avg_rating`, `usage_count`)
- KPI views (`v_narrative_path_cache_best`, `v_narrative_cache_kpis`)

## 4) Strict continuity state contract

### Decision

Require a minimal continuity object per generation call:

```json
{
  "last_scene_summary": "...",
  "emotional_state": "resistance|hope|apathy",
  "clinical_flags": ["low_energy"],
  "top_choice": "o2",
  "current_goal": "social_activation"
}
```

### Why this matters

Without strict continuity input, models drift and re-invent context. This is one of the main causes of perceived inconsistency in interactive narrative systems.

## 5) Convergence model: static backbone + dynamic adaptation

### Decision

Use a hybrid convergence strategy:

- Static critical nodes as backbone (for compression/control)
- Architect/day context can adjust tone, trigger, and intensity

Baseline static anchors:

- Day 3: social event
- Day 5: emotional crisis
- Day 7: resolution

### Why this matters

This avoids branch explosion while preserving enough variation to feel alive and personalized.

## 6) Clinical pipeline: keep parity, add deterministic rules first

### What already mattered

Clinical mappings are the real data asset, not just LLM telemetry. We must persist:

- item
- weight
- confidence
- rationale

### Decision

Keep canonical persistence for generated arc content into:

- `chapters`
- `scenes`
- `options`
- `clinical_mappings`

And add deterministic clinical rule patching when mappings are weak/ambiguous.

### Why this matters

- Preserves analysis quality
- Reduces unnecessary LLM dependence in obvious clinical patterns
- Keeps downstream scoring and reporting stable

## 7) Payload storage strategy for arcs

### Decision

Use compact payload modes in `arc_days`:

- `reference`
- `delta`
- `full`

### Why this matters

This prevents unnecessary JSON duplication and gives a practical path to reduce storage and downstream token rehydration cost over time.

## 8) Operational observability and product KPIs

### Added operational metrics

- Token and estimated cost per generation
- Scene/option/mapping counts
- Cache hit/miss/write/rating events
- Cache savings and hit-rate views

### Why this matters

We can now validate if the system is truly achieving the business goal, not just "working technically".

## Key implementation artifacts

### Backend

- `backend/src/prompts.js`
  - Scene-by-scene prompt contract as default
  - Mini-chapter fallback contract
  - Continuity and narrative intensity controls
  - Reduced generator max tokens

- `backend/src/index.js`
  - Hard token budget enforcement
  - Deterministic segmented path-key generation
  - Cache lookup + reuse + write-through
  - Strict continuity validation
  - Critical node convergence hooks
  - Hybrid deterministic clinical mapping patching
  - Canonical persistence for generated arc clinical data
  - Cache KPI endpoint

### Database

- `database/migrations/004_arc_workflow_tables.sql`
  - Arc planning/day persistence + compact payload strategy

- `database/migrations/005_narrative_path_cache.sql`
  - Deterministic path cache tables, indexes, ranking, KPI views

### Documentation updated

- `database/migrations/README.md`
- `database/DEPLOYMENT_ORDER.md`

## Tradeoffs we accepted

- We do not optimize for infinite uniqueness per user
- We optimize for controlled variation + coherence + scalability

This is intentional.

At product level, this is the right tradeoff for reliability and cost efficiency.

## How this now aligns with project purpose

The project purpose is not only to generate story text. It is to deliver a consistent, emotionally meaningful, and clinically useful interactive experience that can scale to real usage.

With these decisions, the system now has:

- Better cost control
- Better narrative continuity discipline
- Better reuse of validated content
- Better clinical data quality and persistence
- Better operational measurement to guide iteration

In short:

- We moved from "generate everything" to "generate what matters now"
- We turned generation from pure expense into reusable narrative assets
- We aligned architecture decisions with both clinical integrity and product sustainability

## Next recommended validation phase

1. Run migration `005_narrative_path_cache.sql` in target environment.
2. Execute controlled A/B between old and new generation mode.
3. Track weekly KPIs:
   - Cost per active user
   - Cache hit rate
   - Session length
   - Drop-off by scene
   - Clinical consistency trends
4. Calibrate segmentation buckets and path window size based on real usage.

This closes the loop between architecture, cost objective, and user experience quality.
