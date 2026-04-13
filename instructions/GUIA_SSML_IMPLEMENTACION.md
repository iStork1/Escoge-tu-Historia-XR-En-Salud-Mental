# Guía de Implementación: SSML para Inmersión Emocional

## Resumen
Hemos aplicado SSML (Speech Synthesis Markup Language) a las escenas clave de "El jardín de Rosa" para mejorar la inmersión emocional. Este documento explica cómo el backend debe manejar esto y cómo extender SSML a nuevas escenas.

## Cambios realizados

### Escenas con SSML aplicado
Las siguientes escenas ya incluyen marcado SSML para mejorar la experiencia narrativa:

1. **c01-s01** (Mundo ordinario) - Pausas para evocar el peso del silencio
2. **c01-s02a** (La llamada de Sofía) - Variación de tono para mostrar calidez y conexión
3. **c01-s02b** (Silencio matutino) - Susurros y pausas largas para profundidad emocional
4. **c01-s04** (La duda ante el umbral) - Susurro para los pensamientos internos
5. **c01-s09** (La cueva) - Shock emocional con énfasis y cambio de tono  
6. **c01-s10** (La ordalía) - Revelación importante con control de velocidad
7. **c01-s12** (La recompensa) - Celebración con énfasis y tono elevado
8. **c01-s15** (Regreso con el elixir) - Transformación final con énfasis en la decisión

## Cómo usar las funciones helper

En `backend/src/ssml-helpers.js` hemos creado utilidades para aplicar SSML de forma limpia:

```javascript
const { pause, whisper, slow, emphasize, patterns } = require('./ssml-helpers');

// Pausas simples
const text1 = `Rosa espera. ${pause(500)} Nada sucede.`;

// Susurros para intimidad
const text2 = `Ella piensa: ${whisper('¿Para qué voy?')}`;

// Ralentizar para reflexión
const text3 = `${slow('La tristeza vuelve lentamente', 80)}`;

// Énfasis
const text4 = `Lo que sucede es ${emphasize('importante', 'strong')}.`;
```

## Pasos para aplicar SSML a nuevas escenas

### 1. Identifica el tipo emocional
Primero, determina el momento emocional de la escena:
- **Suspenso/tensión** → Ralentiza, baja tono, pausas largas
- **Calma/reflexión** → Muy lento, susurro, pausas para procesar
- **Sorpresa/shock** → Acelera, sube tono, cambio brusco
- **Alegría/esperanza** → Tono más alto, énfasis positivo
- **Duelo/tristeza** → Tono bajo, pausas, susurros

### 2. Ubica los puntos de inflexión
Identifica dónde en la narración cambia el estado emocional. Estos son los lugares donde el SSML es más efectivo.

### 3. Aplica SSML estratégicamente
No marques todo. Solo los momentos clave:

```javascript
// ❌ DEMASIADO - SUENA FRENÉTICO
const bad = `<break time="300ms"/>${whisper('Rosa')} ${pause(200)} se sienta ${slow('lentamente')} y ${emphasize('piensa', 'strong')}...`

// ✓ CORRECTO - ESTRATÉGICO Y LEGIBLE
const good = `Rosa se sienta. ${pause(400)} En silencio, ${whisper('piensa en Alberto')}.`
```

### 4. Usa los patrones predefinidos
Para mayor consistencia, usa los patrones que ya hemos definido:

```javascript
const { patterns } = require('./ssml-helpers');

// Para momentos de duelo
const griefMoment = patterns.grief('Rosa siente el peso de dos años de soledad');

// Para momentos de reflexión
const reflection = patterns.reflection('¿Para qué vengo si ya no sirvo para nada?');

// Para momentos de determninación
const resolve = patterns.resolve('Ella respira hondo y entra');
```

## Integración con el backend

### En el endpoint de narración
Cuando sirvas una escena narrativa, asegúrate de que el SSML está dentro de `outputSpeech.ssml`:

```javascript
const alexa = require('ask-sdk-core');

// Correcto ✓
const handlerInput = {
  responseBuilder
    .speak(sceneText)  // sceneText ya contiene SSML marcado
    .reprompt('¿Qué haces?')
    .getResponse()
};

// El backend automáticamente envolverá esto en <speak>...</speak>
```

### Actualizar chapters.json
Los textos en `chapters.json` ahora pueden incluir SSML. El backend debe:

1. Leer el texto de la escena desde chapters.json
2. Pasar ese texto directamente a Alexa en la respuesta

No necesitas hacer parsing especial—el SSML es texto válido que Alexa procesará.

## Ejemplo completo de cómo se vería en una función

```javascript
const { pause, whisper, slow, emphasize, patterns } = require('./ssml-helpers');

function buildSceneResponse(scene, selectedOption) {
  let narration = '';

  // Escena: Rosa descubre la foto
  if (scene.scene_id === 'c01-s09') {
    narration = `Un jueves, mientras removía la tierra, Rosa encontró una foto plastificada enterrada entre las raíces. ${pause(500)}
    Era de hace veinte años: adultos mayores posando frente al mismo jardín en otra época. ${pause(400)}
    En la esquina de la imagen, ${emphasize('reconoció la sonrisa de Alberto', 'high')}, ${whisper('su esposo')}.
    ${pause(800)}
    Sintió que ${patterns.shock('la tierra se movía bajo sus pies')}.`;
  }

  return narration;
}
```

## Consideraciones clínicas

Como esta es una Skill para salud mental, ten en cuenta:

1. **No traumatizar** - El SSML puede evocar emociones intensas. Las pausas largas son tu aliada: dan espacio para sentir sin abrumar.

2. **Susurros con cuidado** - Un susurro en un momento vulnerable connota intimidad, no debe parecer aterrador.

3. **Ritmo calmo en momentos difíciles** - Ralentizar la narración cuando un personaje se siente solo o ansioso ayuda al usuario a sentir que su experiencia es válida y no es apresurada.

4. **Ofrece salidas** - Si una escena es desafiante, asegúrate de que las opciones siempre ofrecen agencia al usuario.

## Checklist para nuevas escenas

Cuando agregues SSML a una nueva escena:

- [ ] ¿Identifiqué el tipo emocional de la escena?
- [ ] ¿Ubiqué 2-3 puntos de inflexión clave?
- [ ] ¿Apliqué SSML solo a esos puntos (no a todo)?
- [ ] ¿Usé las funciones helper para mantenerlo legible?
- [ ] ¿Probé en un dispositivo Alexa real?
- [ ] ¿Las pausas permiten que el usuario procese sin ser lento?
- [ ] ¿El tono y velocidad coinciden con la emoción?

## Testing

Para probar SSML en tu Alexa:

1. Actualiza el JSON con las nuevas naraciones SSML
2. Redeploy el backend
3. En tu dispositivo Alexa, invoca la Skill: "Abre Escoge Tu Historia"
4. Escucha atentamente los cambios en ritmo, tono y pausas
5. Ajusta los valores de SSML según lo que escuchas

Los cambios más comunes a ajustar:
- `break time` - Si necesita más o menos pausa
- `rate` - Si necesita ser más rápido (>100%) o más lento (<100%)
- `pitch` - Si el tono está muy alto o muy bajo

## Próximos pasos

1. **Expandir a más escenas** - Comienzaen con las escenas de mayor impacto emocional (momentos de decisión, revelaciones, crisis).

2. **Crear variaciones** - Considera que según las opciones previas del usuario, la misma escena podría tener diferentes matices emocionales.

3. **Integrar dinámicamente** - Eventualmente, el backend podría elegir dinámicamente qué patrón emocional aplicar según el contexto psicológico del usuario en la historia.

4. **Feedback del usuario** - Recolecta datos sobre qué momentos generan mayor inmersión. Los que más resonaron merecen más refinamiento.
