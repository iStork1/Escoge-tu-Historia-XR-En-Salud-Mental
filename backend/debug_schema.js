const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ strict: true, useDefaults: false });
addFormats.default(ajv);

const schemaPath = path.join(__dirname, '..', 'database', 'decision_payload_schema.json');
const schemaData = fs.readFileSync(schemaPath, 'utf8');
const schema = JSON.parse(schemaData);

console.log('Required fields:', schema.required);

const validatePayloadSchema = ajv.compile(schema);

const payload = {
  session_id: '550e8400-e29b-41d4-a716-446655440000',
  pseudonym: 'test-user',
  started_at: '2026-02-25T14:00:00Z',
  decisions: [
    {
      decision_id: '550e8400-e29b-41d4-a716-446655440001',
      timestamp: '2026-02-25T14:00:00Z',
      chapter_id: 'c01',
      scene_id: 'c01-s01',
      option_selected: {
        option_id: 'c01-s01-o1',
        option_text: 'Test option',
        time_to_decision_ms: 5000
      },
      mapping_results: {
        mapping_confidence: 0.85,
        clinical_mappings: [
          {
            scale: 'GDS',
            item: 2,
            weight: 1.0,
            confidence: 0.9
          }
        ]
      }
    }
  ]
};

const valid = validatePayloadSchema(payload);

if (!valid) {
  console.log('INVALID');
  console.log('Errors:');
  validatePayloadSchema.errors.forEach(err => {
    console.log('  ' + (err.instancePath || '/') + ': ' + err.message);
  });
} else {
  console.log('VALID');
}
