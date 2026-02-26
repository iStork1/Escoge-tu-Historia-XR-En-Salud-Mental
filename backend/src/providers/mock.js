/**
 * Mock Provider Implementation
 * Simulates LLM responses for testing and development
 * FREE - no API calls, instant responses
 */

const BaseProvider = require('./base');

class MockProvider extends BaseProvider {
  constructor() {
    super('mock');
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    console.log(`✅ Mock provider initialized. (Testing mode)`);
  }

  async healthCheck() {
    return { 
      ok: true, 
      models: ['mock-gpt', 'mock-claude'],
      note: 'Mock provider - simulated responses'
    };
  }

  /**
   * Generate mock chapter response
   * Simulates realistic chapter structure for testing
   */
  async generate(model = null, prompt, options = {}) {
    const startTime = Date.now();
    
    try {
      // Simulate processing time (200-500ms)
      await new Promise(r => setTimeout(r, Math.random() * 300 + 200));

      // Generate mock chapter based on context
      const mockChapter = {
        chapter: {
          chapter_id: `c${String(Math.floor(Math.random() * 10) + 2).padStart(2, '0')}`,
          title: 'Continuación de la historia',
          narrative: `En este momento de la historia, la situación evoluciona de manera inesperada. 
Te encuentras reflexionando sobre tus decisiones anteriores y las consecuencias que han traído. 

La escena presenta un escenario en el que deberás tomar una nueva decisión que  
impactará significativamente el curso de los eventos. ¿Qué harás?`
        },
        scene: {
          scene_id: `c${Math.floor(Math.random() * 10) + 2}-s01`,
          narration: 'Nueva escena clave en tu viaje'
        },
        options: [
          {
            option_id: `opt-${Math.random().toString(36).substr(2, 9)}`,
            option_text: 'Buscar ayuda de alguien de confianza',
            consequence: 'Decides confiar en otros y crear conexiones significativas',
            gds_mapping: [
              {
                scale: 'GDS',
                item: 2,
                weight: 0.8,
                confidence: 0.9,
                construct: 'social_engagement',
                rationale: 'Buscar ayuda demuestra disposición a conexión social'
              }
            ],
            phq_mapping: [
              {
                scale: 'PHQ-9',
                item: 8,
                weight: 0.7,
                confidence: 0.85,
                construct: 'interest_in_activities',
                rationale: 'Compromiso con soluciones activas'
              }
            ]
          },
          {
            option_id: `opt-${Math.random().toString(36).substr(2, 9)}`,
            option_text: 'Reflexionar en soledad sobre tus emociones',
            consequence: 'Te tomas tiempo para introspección y autoconocimiento',
            gds_mapping: [
              {
                scale: 'GDS',
                item: 5,
                weight: 0.6,
                confidence: 0.8,
                construct: 'self_awareness',
                rationale: 'Introspección relacionada con conciencia de sí mismo'
              }
            ],
            phq_mapping: [
              {
                scale: 'PHQ-9',
                item: 1,
                weight: 0.75,
                confidence: 0.82,
                construct: 'depressed_mood',
                rationale: 'Reflexión sobre estados emocionales'
              }
            ]
          },
          {
            option_id: `opt-${Math.random().toString(36).substr(2, 9)}`,
            option_text: 'Tomar acción inmediata para cambiar la situación',
            consequence: 'Demuestras iniciativa y capacidad de agencia',
            gds_mapping: [
              {
                scale: 'GDS',
                item: 1,
                weight: 0.9,
                confidence: 0.92,
                construct: 'life_satisfaction',
                rationale: 'Acción proactiva aumenta sentido de propósito'
              }
            ],
            phq_mapping: [
              {
                scale: 'PHQ-9',
                item: 9,
                weight: 0.85,
                confidence: 0.88,
                construct: 'motivation_energy',
                rationale: 'Acción directa requiere energía y motivación'
              }
            ]
          },
          {
            option_id: `opt-${Math.random().toString(36).substr(2, 9)}`,
            option_text: 'Buscar información o recursos que puedan ayudarte',
            consequence: 'Utilizas herramientas disponibles para tu beneficio',
            gds_mapping: [
              {
                scale: 'GDS',
                item: 12,
                weight: 0.7,
                confidence: 0.85,
                construct: 'resourcefulness',
                rationale: 'Búsqueda de recursos demuestra capacidad de planificación'
              }
            ],
            phq_mapping: [
              {
                scale: 'PHQ-9',
                item: 7,
                weight: 0.65,
                confidence: 0.8,
                construct: 'concentration',
                rationale: 'Investigación requiere enfoque y concentración'
              }
            ]
          }
        ]
      };

      const timeTaken = Date.now() - startTime;

      return {
        response: JSON.stringify(mockChapter),
        model: model || 'mock-gpt',
        time_ms: timeTaken,
        provider: 'mock',
        note: 'Simulated response for testing'
      };

    } catch (err) {
      const timeTaken = Date.now() - startTime;
      return {
        response: null,
        error: err.message,
        model: model || 'mock-gpt',
        time_ms: timeTaken,
        provider: 'mock'
      };
    }
  }

  /**
   * Mock parallel generation
   */
  async generateParallel(models, prompt, options = {}) {
    const results = {};
    for (const model of models) {
      results[model] = await this.generate(model, prompt, options);
    }
    return { results };
  }

  /**
   * Get available mocked models
   */
  async getAvailableModels() {
    return ['mock-gpt', 'mock-claude'];
  }
}

module.exports = MockProvider;
