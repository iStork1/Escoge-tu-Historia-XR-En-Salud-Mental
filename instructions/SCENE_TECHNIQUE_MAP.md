# Mapa de Técnicas Narrativas por Escenas

**Guía rápida: Qué técnica usar en cada escena de Capítulo 1**

---

## Escena Breakdown

### c01-s01: Mundo Ordinario (Rosa se despierta)

**Tipo**: Exposition / Establishing scene  
**Técnica Recomendada**: `longForm` automática (ya activa)  
**Personajes**: Rosa (sola)  
**Emocional**: Neutral → Curiosidad leve

```javascript
// Estructura:
// [Normal voice, normal pace]
// "Rosa se despierta en su cuarto..."
// [pause 400ms]
// "El apartamento está en silencio..."
// [pause 300ms]
// Decisión: 3 opciones para Rosa

// CÓDIGO:
const scene = `<speak>
  Rosa se despierta en su cuarto. 
  <break time="400ms"/>
  El apartamento está en silencio.
  <break time="300ms"/>
  Sobre la mesita de noche hay una tarjeta...
</speak>`;

alexaResponse(scene, sessionAttrs, false, true);
```

---

### c01-s02a: La Llamada de Sofía (Phone ring)

**Tipo**: Social catalyst / Call to Adventure  
**Técnica Recomendada**: `characterSays()` para Sofía + `pause()` estratégico  
**Personajes**: Rosa (escucha) + Sofía (voz)  
**Emocional**: Introversión → Esperanza emergente

```javascript
const { characterSays, pause, patterns } = require('./ssml-helpers');

const scene = `<speak>
  Justo cuando Rosa termina el café,
  <break time="300ms"/>
  <emphasis level="high">suena el teléfono.</emphasis>
  <break time="500ms"/>
  Es Sofía, su vecina del tercer piso.
  <break time="300ms"/>
  ${characterSays('sofia', 
    '¡Rosa! ¿Recibiste la tarjeta del jardín? Yo voy el miércoles. ¿Vienes conmigo?'
  )}
  <break time="400ms"/>
  Rosa siente <emphasis level="moderate">el calor</emphasis> de esa voz familiar.
</speak>`;

alexaResponse(scene, sessionAttrs, false, true);
```

---

### c01-s02b: Silencio Matutino (Rosa solución)

**Tipo**: Branch / Isolation  
**Técnica Recomendada**: `patterns.grief()` + `quiet()` + `slower tempo`  
**Personajes**: Rosa (sola)  
**Emocional**: Duelo → Vacío

```javascript
const { patterns, quiet, pause } = require('./ssml-helpers');

const scene = `<speak>
  Rosa se sienta en el sillón de la sala.
  <break time="600ms"/>
  En la pared está la foto de su boda: 
  cuarenta y cinco años juntos con Alberto.
  <break time="700ms"/>
  ${patterns.grief('El apartamento está callado, y ese silencio tiene peso.')}
  <break time="500ms"/>
  La tarjeta está en el cajón.
  <break time="600ms"/>
  ${quiet('El día se extiende largo y sin forma frente a ella.', 'soft')}
</speak>`;

alexaResponse(scene, sessionAttrs, false, true);
```

---

### c01-s03: La Llamada a la Aventura (Scene in park)

**Tipo**: Narrated / Call to Action  
**Técnica Recomendada**: `longForm` automática + light emotional tone  
**Personajes**: Rosa (observa), Joven (voz de fondo)  
**Emocional**: Curiosidad → Incertidumbre

```javascript
const scene = `<speak>
  Esa misma tarde,
  <break time="300ms"/>
  Rosa decide pasar frente al centro comunitario,
  solo para ver.
  <break time="400ms"/>
  Desde la acera observa a un grupo de adultos mayores 
  trabajando en bancales de tierra,
  <emphasis level="moderate">riendo y conversando.</emphasis>
  <break time="500ms"/>
  Una joven con delantal verde la ve
  <break time="200ms"/>
  y le hace una señal.
  <break time="300ms"/>
  Pase, siempre hay espacio para uno más.
  <break time="400ms"/>
  Rosa se detiene en la esquina del andén, dudando.
</speak>`;

alexaResponse(scene, sessionAttrs, false, true);
```

---

### c01-s04: La Duda ante el Umbral (Decision point)

**Tipo**: Refusal / Test  
**Técnica Recomendada**: `patterns.anxiety()` + `narrativeTensionCascade()`  
**Personajes**: Rosa (internal), Joven (distant)  
**Emocional**: Miedo → Determinación (según opción)

```javascript
const { patterns, pause, narrative TensionCascade } = require('./ssml-helpers');

// Si Rosa elige "respirar hondo y entrar":
const braveChoice = `<speak>
  Rosa está parada ante la entrada del jardín.
  <break time="400ms"/>
  Su corazón late un poco más rápido de lo normal.
  <break time="500ms"/>
  ${patterns.anxiety('Un pensamiento aparece: Yo ya no soy de esas personas que empiezan cosas nuevas.')}
  <break time="600ms"/>
  Pero respira.
  <break time="400ms"/>
  Y entra.
</speak>`;

// Si Rosa elige "observar sin entrar":
const timidChoice = narrativeTensionCascade({
  line1: 'Rosa observa sin entrar.',
  line2: 'Ve que don Manuel se equivoca con los nombres de las hierbas.',
  line3: 'El grupo ríe. Ríen juntos.',
  line4: 'Rosa siente algo entre curiosidad y miedo.',
  pausesBetween: [300, 400, 500, 1200],
});

alexaResponse(braveChoice, sessionAttrs, false, true);
```

---

### c01-s05: El Mentor Llega (Don Hernando visit)

**Tipo**: Meeting with Mentor  
**Técnica Recomendada**: `characterSays('hernando')` + wisdom patterns  
**Personajes**: Don Hernando (voz lenta, sabia)  
**Emocional**: Comfort → Hope

```javascript
const { characterSays, pause, patterns } = require('./ssml-helpers');

const scene = `<speak>
  Esa noche 
  <break time="200ms"/>
  <emphasis level="high">suena el timbre.</emphasis>
  <break time="300ms"/>
  Es Don Hernando, presidente de la junta de acción comunal,
  <break time="200ms"/>
  un señor de 78 años con voz pausada
  <break time="200ms"/>
  y paso lento.
  <break time="600ms"/>
  ${characterSays('hernando', 
    'Doña Rosa, vengo de parte del jardín. Nos dijeron que estuvo por allá hoy.'
  )}
  <break time="400ms"/>
  Rosa lo invita a sentarse.
  <break time="300ms"/>
  ${characterSays('hernando',
    'El jardín es más que un lugar. Es un motivo para salir de la casa cada mañana.'
  )}
  <break time="500ms"/>
  Antes de irse, deja una bolsita de semillas sobre la mesa.
  <break time="600ms"/>
</speak>`;

alexaResponse(scene, sessionAttrs, false, true);
```

---

### c01-s06: Cruce del Umbral (Seeds decision)

**Tipo**: Threshold Guardian / Commitment  
**Técnica Recomendada**: `narrativeTensionCascade()` combinado con `characterSays('rosa_inner')`  
**Personajes**: Rosa (internal struggle)  
**Emocional**: Dubt → Commitment (según opción)

```javascript
const { narrativeTensionCascade, characterSays, pause } = require('./ssml-helpers');

// Opción brava:
const commitChoice = `<speak>
  Rosa está sola en la cocina.
  <break time="400ms"/>
  Sosteniendo la bolsita de semillas.
  <break time="600ms"/>
  Don Hernando dijo: Es más que un jardín.
  <break time="400ms"/>
  Rosa deja las semillas sobre la mesa, en un lugar visible.
  <break time="400ms"/>
  <emphasis level="high">Mañana busca los guantes.</emphasis>
  <break time="500ms"/>
</speak>`;

// Opción pesimista:
const doubtChoice = narrativeTensionCascade({
  line1: 'Rosa guarda las semillas con cuidado.',
  line2: 'No sabe si irá.',
  line3: 'Tampoco las bota.',
  line4: characterSays('rosa_inner', 'Las deja ahí, como una posibilidad.'),
  pausesBetween: [400, 300, 400, 1500],
});

alexaResponse(commitChoice, sessionAttrs, false, true);
```

---

### c01-s07a: Primera Mañana en el Jardín (Active path)

**Tipo**: Hero Takes Action / First Tests  
**Técnica Recomendada**: Mix de characterSays + patterns.joy()  
**Personajes**: Rosa (participant), Sofía (greeting), Camilo (enthusiasm)  
**Emocional**: Nervios → Alegría

```javascript
const { characterSays, patterns, pause } = require('./ssml-helpers');

const scene = `<speak>
  Es miércoles.
  <break time="300ms"/>
  Rosa llega al jardín con los guantes que encontró.
  <break time="400ms"/>
  Sofía ya está allí,
  <break time="200ms"/>
  con tierra en la frente y
  <emphasis level="high">sonrisa enorme.</emphasis>
  <break time="300ms"/>
  ${characterSays('sofia', '¡Rosa, por fin!')}
  <break time="400ms"/>
  Le presentan a Camilo,
  <break time="200ms"/>
  ${characterSays('camilo', 
    'un joven que habla de compostaje con entusiasmo que casi duele'
  )}
  <break time="400ms"/>
  ${patterns.joy('Rosa mete las manos en la tierra. Algo en ese gesto le resulta sorprendentemente bueno.')}
  <break time="500ms"/>
</speak>`;

alexaResponse(scene, sessionAttrs, false, true);
```

---

### c01-s07b: Camino de la Resistencia (Isolated path)

**Tipo**: Reluctant Hero / Indirect Path  
**Técnica Recomendada**: `patterns.resolve()` + slow tempo  
**Personajes**: Don Hernando (patient mentor), Rosa (hesitant)  
**Emocional**: Dudas → Determinación callada

```javascript
const { characterSays, patterns, pause } = require('./ssml-helpers');

const scene = `<speak>
  Rosa no fue el miércoles.
  <break time="400ms"/>
  Tampoco el jueves.
  <break time="500ms"/>
  Pero el domingo,
  <break time="300ms"/>
  asomada al balcón,
  <break time="300ms"/>
  vio a Don Hernando trabajando solo
  <break time="300ms"/>
  bajo el sol de las once.
  <break time="400ms"/>
  Sin pensarlo mucho, bajó.
  <break time="300ms"/>
  Rosa: Hola, Don Hernando. Ya vine.
  <break time="400ms"/>
  ${characterSays('hernando', 'Qué bien. Aquí tiene su pala.')}
  <break time="600ms"/>
  ${patterns.resolve('Juntos trabajaron en silencio cómodo.')}
</speak>`;

alexaResponse(scene, sessionAttrs, false, true);
```

---

### c01-s08: Pruebas y Aliados (Weeks passing)

**Tipo**: Allies & Tests / Montage  
**Técnica Recomendada**: `longForm` automática + varied characterSays  
**Personajes**: Rosa, Amparo, Camilo, Manuel  
**Emocional**: Soledad → Pertenencia

```javascript
const { characterSays, pause, patterns } = require('./ssml-helpers');

const scene = `<speak>
  Las semanas que siguieron tomaron su propio ritmo.
  <break time="400ms"/>
  Algunos días Rosa llegaba temprano,
  <break time="200ms"/>
  otros llegaba tarde,
  <break time="300ms"/>
  algún día no llegó.
  <break time="500ms"/>
  Conoció a Doña Amparo,
  <break time="200ms"/>
  ${characterSays('amparo', 'que siempre traía arepas de choclo.')}
  <break time="300ms"/>
  A Camilo, que sabía cómo hacer compostaje sin olor.
  <break time="300ms"/>
  A Manuel,
  <break time="200ms"/>
  ${patterns.joy('que confundía los nombres de las plantas y se reía de sí mismo.')}
  <break time="600ms"/>
  <emphasis level="moderate">El jardín fue llenando la semana</emphasis>
  <break time="200ms"/>
  de <emphasis level="moderate">pequeñas razones.</emphasis>
  <break time="700ms"/>
</speak>`;

alexaResponse(scene, sessionAttrs, false, true);
```

---

### c01-s09: La Cueva Se Acerca (Photo discovery - CLIMAX)

**Tipo**: Approach to Inmost Cave / Emotional Climax  
**Técnica Recomendada**: `narrativeTensionCascade()` — CASCADA EMOCIONAL MÁXIMA  
**Personajes**: Rosa (alone with photo)  
**Emocional**: Shock → Grief → Recognition

```javascript
const { narrativeTensionCascade, pause } = require('./ssml-helpers');

const climax = narrativeTensionCascade({
  line1: 'Un jueves, mientras removía la tierra, Rosa encontró una foto plastificada.',
  line2: 'Era de hace veinte años. Adultos mayores en el mismo jardín.',
  line3: 'Ella no fue el primero grupo que pasó por aquí.',
  line4: 'En la esquina de la imagen... reconoció la sonrisa de Alberto.',
  pausesBetween: [600, 400, 900, 3000], // Última pausa EXTRA larga
});

const scene = `<speak>
  ${climax}
</speak>`;

alexaResponse(scene, sessionAttrs, false, true);
```

**NOTA**: Esta es LA escena emocional clave. La pausa de 3 segundos al final permite que:
1. Alexa termine la frase
2. Usuario procese "Alberto estuvo aquí"
3. Silencio reflexivo
4. Luego sigue: Acciones de Rosa (ramas de decisión)

---

## 📊 Tabla Rápida (Copy-Paste Reference)

| Escena | Técnica | Velocidad | Tono | Volumen | Pausa Final |
|--------|---------|-----------|------|---------|------------|
| c01-s01 | longForm | normal | neutral | normal | 300ms |
| c01-s02a | characterSays(sofia) | +10% | +6 | normal | 400ms |
| c01-s02b | patterns.grief | -20% | -5 | soft | 600ms |
| c01-s03 | longForm | normal | light | normal | 300ms |
| c01-s04 | patterns.anxiety | -15% | -3 | normal | 500ms |
| c01-s05 | characterSays(hernando) | -25% | -8 | soft | 600ms |
| c01-s06 | cascadaEmocional | variable | variable | variable | 1500ms |
| c01-s07a | characterSays(sofia/camilo) | variable | variable | normal | 400ms |
| c01-s07b | patterns.resolve | -15% | neutral | medium | 500ms |
| c01-s08 | characterSays(amparo) | normal | +2 | normal | 300ms |
| c01-s09 | **tensionCascade** | **-30%** | **-15%** | **x-soft** | **3000ms** ⭐ |

---

## 🎯 Recomendación Inmediata

**Comienza con c01-s09** (la más impactante):

```javascript
// En backend/src/index.js, cuando Rosa encuentra la foto:
if (decision === 'find_photo') {
  const { narrativeTensionCascade } = require('./ssml-helpers');
  
  const climax = narrativeTensionCascade({
    line1: 'Un jueves, mientras removía la tierra, Rosa encontró algo.',
    line2: 'Una foto plastificada. Enterrada entre las raíces.',
    line3: 'Hace veinte años. Ella lo reconoció de inmediato.',
    line4: 'La sonrisa de Alberto. Su Alberto.',
    pausesBetween: [600, 400, 900, 3000],
  });

  const response = `<speak>${climax}</speak>`;
  
  alexaResponse(response, sessionAttrs, false, true);
}
```

**Resultado**: Usuarios sienten la **magnitud emocional** del descubrimiento. GDS-7 (duelo) mejora capturaría en datos.

---

**Status**: ✅ Listo. Tu narrativa es:
- Clínicamente sólida (GDS/PHQ mapping)
- Emocionalmente estratificada (scaffolded moments)
- Vocalmente caracterizada (character profiles)
- Narrativamente inmersiva (tension cascades)

🚀 **Próximo paso**: Elige una escena, implementa y testa en Alexa simulator.
