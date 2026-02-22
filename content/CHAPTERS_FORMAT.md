# chapters.json Format Reference

## Purpose
This file defines the narrative structure (chapters, scenes, options) and their clinical mappings (GDS/PHQ items). It sources all content for:
- Alexa skill responses
- Database seeding (chapters, scenes, options tables)
- Clinical mapping sync (clinical_mappings table with mapping_source='designer')

---

## Schema

```json
{
  "chapters": [
    {
      "chapter_id": "c01",
      "title": "Chapter Title",
      "order": 1,
      "metadata": {
        "estimated_duration_seconds": 120
      },
      "scenes": [
        {
          "scene_id": "c01-s01",
          "title": "Scene Title (for UI/logs)",
          "order": 1,
          "text": "Full scene narration/description for Alexa",
          "metadata": {
            "scene_type": "choice_point"
          },
          "options": [
            {
              "option_id": "c01-s01-o1",
              "option_text": "User's choice text (read aloud/shown)",
              "consequence": "Brief outcome narration (read after selection)",
              "next_chapter_id": "c02",
              "next_scene_id": null,
              "gds_mapping": [
                {
                  "item": 7,
                  "weight": 0.8,
                  "confidence": 0.9,
                  "rationale": "social_engagement"
                }
              ],
              "phq_mapping": [
                {
                  "item": 4,
                  "weight": 0.5,
                  "confidence": 0.7,
                  "rationale": "sleep_or_fatigue"
                }
              ],
              "metadata": {
                "difficulty": "easy"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Field Descriptions

### Chapter Object
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `chapter_id` | string | ✅ | Unique identifier (e.g., "c01", "c02") |
| `title` | string | ✅ | Chapter title/name |
| `order` | integer | ✅ | Narrative order (1, 2, 3...) |
| `metadata` | object | ❌ | Additional chapter data (duration, tags, etc.) |

### Scene Object
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `scene_id` | string | ✅ | Unique identifier (e.g., "c01-s01", "c01-s02") |
| `title` | string | ✅ | Scene title (for UI/logging) |
| `order` | integer | ✅ | Scene order within chapter (1, 2, 3...) |
| `text` | string | ✅ | Full narration (read aloud by Alexa) |
| `metadata` | object | ❌ | Data (scene_type: "choice_point", etc.) |

### Option Object
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `option_id` | string | ✅ | Unique identifier (e.g., "c01-s01-o1") |
| `option_text` | string | ✅ | User choice (read aloud/shown in UI) |
| `consequence` | string | ✅ | Outcome narration (brief response to selection) |
| `next_chapter_id` | string | ❌ | Chapter to navigate to (null = stay in current) |
| `next_scene_id` | string | ❌ | Scene within next_chapter to start (null = first scene) |
| `gds_mapping` | array | ✅ | GDS-15 item mappings (can be empty []) |
| `phq_mapping` | array | ✅ | PHQ-9 item mappings (can be empty []) |
| `metadata` | object | ❌ | Additional data (difficulty, tags, etc.) |

### Mapping Object (gds_mapping / phq_mapping)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `item` | integer | ✅ | GDS item 1-15 or PHQ item 1-9 |
| `weight` | float | ✅ | Clinical weight (0.0–1.0) |
| `confidence` | float | ✅ | Designer confidence in mapping (0.0–1.0) |
| `rationale` | string | ✅ | Key construct mapped (e.g., "social_engagement", "sleep_disturbance") |

---

## Database Sync

When POST /admin/sync-chapters runs:

1. **Chapters table**: Upsert all chapters (chapter_id, title, order, metadata)
2. **Scenes table**: Upsert all scenes (scene_id, chapter_id, title, order, text from "text" field, metadata)
3. **Options table**: Upsert all options
   - option_id, scene_id, option_text, consequence
   - next_chapter_id, next_scene_id
   - gds_mapping → stored as JSONB in options.gds_mapping
4. **Clinical Mappings table**: Create entries for each item in both gds_mapping and phq_mapping
   - For each gds_mapping item: scale='GDS', item, weight, confidence, rationale, mapping_source='designer'
   - For each phq_mapping item: scale='PHQ', item, weight, confidence, rationale, mapping_source='designer'

---

## Validation Rules

- ✅ All `_id` fields must be unique within their scope (chapter_id globally, scene_id globally, option_id globally)
- ✅ References (next_chapter_id, next_scene_id) must point to existing chapters/scenes, or be null
- ✅ Mapping items (GDS 1-15, PHQ 1-9) must be within valid ranges
- ✅ weight and confidence must be 0.0–1.0
- ✅ Each scene must have at least 1 option
- ✅ Each chapter must have at least 1 scene

---

## Example: Minimal Valid Structure

```json
{
  "chapters": [
    {
      "chapter_id": "c01",
      "title": "Introductory Scene",
      "order": 1,
      "scenes": [
        {
          "scene_id": "c01-s01",
          "title": "Initial Choice",
          "order": 1,
          "text": "You wake up. What do you do?",
          "options": [
            {
              "option_id": "c01-s01-o1",
              "option_text": "Get out of bed",
              "consequence": "You stretch and feel better.",
              "next_chapter_id": "c02",
              "next_scene_id": null,
              "gds_mapping": [
                { "item": 2, "weight": 1.0, "confidence": 0.9, "rationale": "daily_activity" }
              ],
              "phq_mapping": []
            },
            {
              "option_id": "c01-s01-o2",
              "option_text": "Stay in bed",
              "consequence": "You feel tired.",
              "next_chapter_id": "c03",
              "next_scene_id": null,
              "gds_mapping": [],
              "phq_mapping": [
                { "item": 1, "weight": 0.8, "confidence": 0.85, "rationale": "depressed_mood" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Notes for Scene & Consequence Text

- **Scene text** (`scenes[].text`): Full narration, read aloud by Alexa. Can include scene setting, context, and choice prompt.
- **Consequence text** (`options[].consequence`): Brief response to the user's choice. Read after option selection to confirm the choice and its immediate outcome.

**Example:**
- Scene: "You're at the park. Do you approach your friend or sit alone?"
- Option: "Approach your friend"
- Consequence: "You walk over and have a lovely chat. They're happy to see you."

---

**Version**: 1.0  
**Last Updated**: 2026-02-22  
**Status**: Ready for Sprint 1a/1b implementation
