-- Recommended indexes for performance

-- Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_pseudonym ON sessions(pseudonym);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);

-- Decisions (critical for joins and aggregations)
CREATE INDEX IF NOT EXISTS idx_decisions_session_id_timestamp ON decisions(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_decisions_chapter_id ON decisions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_decisions_scene_id ON decisions(scene_id);
CREATE INDEX IF NOT EXISTS idx_decisions_option_id ON decisions(option_id);

-- Clinical mappings (for risk detection and scoring)
CREATE INDEX IF NOT EXISTS idx_clinical_mappings_decision_id ON clinical_mappings(decision_id);
CREATE INDEX IF NOT EXISTS idx_clinical_mappings_option_id ON clinical_mappings(option_id);
CREATE INDEX IF NOT EXISTS idx_clinical_mappings_scale_item ON clinical_mappings(scale, item);
CREATE INDEX IF NOT EXISTS idx_clinical_mappings_source ON clinical_mappings(mapping_source);

-- Risk events (for clinician reporting)
CREATE INDEX IF NOT EXISTS idx_risk_events_timestamp ON risk_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_risk_events_session_id ON risk_events(session_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_risk_type ON risk_events(risk_type);

-- Aggregated metrics
CREATE INDEX IF NOT EXISTS idx_user_metrics_updated ON user_metrics_aggregated(updated_at);

-- Audio metrics
CREATE INDEX IF NOT EXISTS idx_audio_metrics_session ON audio_metrics(session_id);

-- Story structure (chapters, scenes, options)
CREATE INDEX IF NOT EXISTS idx_chapters_order ON chapters("order");
CREATE INDEX IF NOT EXISTS idx_scenes_chapter ON scenes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_options_scene ON options(scene_id);
CREATE INDEX IF NOT EXISTS idx_options_next_chapter ON options(next_chapter_id);
CREATE INDEX IF NOT EXISTS idx_options_next_scene ON options(next_scene_id);

-- Decision ratings and session scores
CREATE INDEX IF NOT EXISTS idx_decision_ratings_decision ON decision_ratings(decision_id);
CREATE INDEX IF NOT EXISTS idx_session_scores_session ON session_scores(session_id);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_pseudonym ON users(pseudonym);

