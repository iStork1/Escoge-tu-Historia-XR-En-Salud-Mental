# Referencia Rápida SSML para Narrativa en Alexa

## Elementos SSML essenciales

### Pausas - El elemento más poderoso
```xml
<break time="500ms"/>     <!-- pausa de 500 milisegundos -->
<break time="1s"/>        <!-- pausa de 1 segundo -->
<break time="2s"/>        <!-- pausa larga, para tensión extrema -->
```

**Cuándo usar:** Antes de momentos importantes, después de revelaciones, para permitir que el usuario procese.

---

### Susurros - Para intimidad y vulnerabilidad
```xml
<amazon:effect name="whispered">texto aquí</amazon:effect>

<!-- Ejemplo -->
<amazon:effect name="whispered">¿Para qué sirvo ahora?</amazon:effect>
```

**Cuándo usar:** Pensamientos privados, confessiones, miedo, intimidad emocional.

---

### Velocidad - Ritmo narrativo
```xml
<prosody rate="80%">texto lento</prosody>           <!-- 80% = más lento -->
<prosody rate="100%">texto normal</prosody>         <!-- 100% = velocidad normal -->
<prosody rate="120%">texto rápido</prosody>        <!-- 120% = más rápido -->
<prosody rate="150%">texto muy rápido</prosody>    <!-- entusiasmo extremo -->
```

**Referencia de velocidad:**
- 50-80% = Reflexionador, solemne, pesado
- 85-95% = Contemplativo, tranquilo
- 100% = Normal
- 105-120% = Energético, positivo
- 130%+ = Urgencia, pánico

**Ejemplo completo:**
```xml
<prosody rate="80%">Rosa se sienta lentamente en el sillón, pensando en los años perdidos.</prosody>
```

---

### Tono (Pitch) - Altura de la voz
```xml
<prosody pitch="-8%">tono bajo, oscuro</prosody>      <!-- más sombría -->
<prosody pitch="0%">tono normal</prosody>             <!-- sin cambio -->
<prosody pitch="+5%">tono más alto, alegre</prosody> <!-- más luminoso -->
```

**Matriz de tono:**
| Emoción | Pitch | Ejemplo |
|---------|-------|---------|
| Duelo/tristeza | -8% a -10% | Noticias tristes |
| Reflexión | -3% | Pensamientos serios |
| Normal | 0% | Línea base |
| Curiosidad | +3% | Pregunta interesada |
| Alegría/sorpresa | +5% a +8% | Buenas noticias |

```xml
<!-- Rosa llora -->
<prosody pitch="-8%">Las lágrimas vienen sin parar.</prosody>

<!-- Sofía brinda bienvenida -->
<prosody pitch="+5%">¡Rosa, por fin! ¡Qué alegría verte!</prosody>
```

---

### Énfasis - Resaltar palabras
```xml
<emphasis level="reduced">algo secundario</emphasis>      <!-- más suave -->
<emphasis level="moderate">importante</emphasis>          <!-- normal -->
<emphasis level="strong">muy importante</emphasis>        <!-- enfatizado -->
```

**Cuándo usar:**
- `reduced`: detalles secundarios, pensamientos de fondo
- `moderate`: cambios de estado, revelaciones normales
- `strong`: momentos de shock, decisiones cruciales

```xml
Rosa hizo una <emphasis level="strong">decisión importante</emphasis>: entraría al jardín.
```

---

### Volumen - Control de amplitud
```xml
<prosody volume="x-soft">muy suave, casi susurro</prosody>    <!-- muy bajo -->
<prosody volume="soft">suave, íntimo</prosody>                <!-- bajo -->
<prosody volume="medium">normal</prosody>                      <!-- estándar -->
<prosody volume="loud">alto</prosody>                          <!-- alto -->
<prosody volume="x-loud">muy alto</prosody>                   <!-- máximo -->
```

---

## Combinaciones efectivas

### Momento de profunda soledad
```xml
${pause(600)}Rosa se sienta en el sillón. ${pause(400)}
<prosody rate="80%" pitch="-8%">El apartamento está callado, y ese silencio tiene peso.</prosody>
${pause(800)}$
```

### Momento de shock/revelación
```xml
Rosa encontró una <emphasis level="high">foto plastificada</emphasis> enterrada entre las raíces.
${pause(500)}
En la esquina reconoció <emphasis level="strong">la sonrisa de Alberto</emphasis>.
${pause(700)}
<prosody pitch="-8%">Sintió que la tierra se movía bajo sus pies.</prosody>
```

### Momento de esperanza/determinación
```xml
${pause(500)}Rosa respira hondo. ${pause(300)}
<prosody rate="85%">No porque tenga que ir. Sino porque <emphasis level="strong">quiere</emphasis>.</prosody>
${pause(600)}
```

---

## Patrones narrativos listos para usar

### Patrón: Soledad profunda
```
${pause(600)}
${whisper('texto íntimo')}
${pause(500)}
<prosody rate="80%" pitch="-8%">reflexión lenta</prosody>
${pause(800)}
```

### Patrón: Tensión creciente
```
${pause(300)}Situación normal.
${pause(400)}
<emphasis level="moderate">cambio leve</emphasis>
${pause(500)}
<emphasis level="strong">punto de inflexión</emphasis>
${pause(800)}
```

### Patrón: Revelación importante
```
${pause(600)}Se lo contó lentamente.
${pause(400)}
<prosody pitch="+3%"><emphasis level="high">información clave</emphasis></prosody>
${pause(700)}
```

### Patrón: Transformación positiva
```
${pause(400)}Ahora, <prosody pitch="+5%">seis meses después</prosody>,
${pause(300)}Rosa se despierta y lo primero que piensa
<emphasis level="strong">es en ir al jardín</emphasis>.
${pause(600)}
```

---

## Errores comunes a evitar

❌ **Demasiado SSML** - Cada segundo tiene un cambio. Resultado: frenético
✓ **Estratégico** - Solo cambios en puntos clave. Resultado: inmersivo

❌ **SSML anidado profundamente** - Confunde a Alexa
```xml
<!-- ❌ MALO -->
<prosody rate="80%"><emphasis level="strong"><whisper>texto</whisper></emphasis></prosody>

<!-- ✓ BUENO - Aplicar cambios por separado -->
<prosody rate="80%">texto lento</prosody> <!-- luego énfasis en el anterior -->
```

❌ **Valores extremos** - rate de 50% o pitch de ±20 suena forzado
✓ **Sutileza** - rate 80-120%, pitch ±3 a ±10 suena natural

❌ **Pausas al inicio** - La gente no sabe qué está pasando
✓ **Pausas después del contenido** - Permite que se asimile

---

## Valores de referencia

### Velocidad (rate) - Efectos por porcentaje
| Rango | Efecto | Uso |
|-------|--------|-----|
| 50-70% | Muy lento, solemne | Crisis emocional, muerte |
| 75-85% | Lento, reflexivo | Duelo, decisiones, reflexión |
| 90-110% | Normal a ligeramente lento | Narrativa base |
| 115-130% | Rápido, energético | Acción, alegría |
| 140%+ | Muy rápido, pánico | Urgencia extrema |

### Pitch (tono) - Efectos por semitones
| Rango | Efecto | Uso |
|-------|--------|-----|
| -12 a -8 | Muy sombrío | Duelo profundo |
| -7 a -4 | Sombrío | Tristeza, misterio |
| -3 a 0 | Neutral-sombrío | Reflexión seria |
| +1 a +3 | Levemente alegre | Curiosidad |
| +4 a +8 | Alegre | Sorpresa positiva |
| +10+ | Muy alegre | Celebración |

---

## Testing en Alexa

1. Actualiza el texto en chapters.json con SSML
2. Prueba en un dispositivo real (no emulador)
3. Ajusta según lo que escuchas - el SSML es un arte, no ciencia exacta

**Parámetros más fáciles de ajustar:**
- `break time` en milisegundos (±100ms hace diferencia)
- `rate` en puntos de porcentaje (±5% es perceptible)
- `pitch` en semitones (±1 es sutil, ±5 es obvio)

---

## Referencia por contexto clínico

Para una Skill de salud mental:

| Momento | Estrategia SSML | Por qué |
|---------|-----------------|--------|
| Depresión/vacío | Pausas largas + tono bajo + ritmo lento | Respeta el sentimiento sin abumar |
| Ansiedad | Ritmo normal o lento (NO rápido) + pausas | Hablar rápido aumenta ansiedad |
| Duelo | Susurro + tono bajo + muy lento | Crea espacio para sentir |
| Esperanza/cambio | Tono más alto + énfasis + ritmo normal | Energía sin abumar |
| Reflexión | Susurro + pausas + muy lento | Invita a la introspección |
| Conexión social | Tono cálido + énfasis en nombre, sonrisa | Humaniza |

---

## Fórmula rápida por tipo de escena

### Escena triste
```
${pause(500)} <prosody rate="80%" pitch="-8%">narración lenta</prosody> ${pause(800)}
```

### Escena reflexiva  
```
${pause(600)} <amazon:effect name="whispered">pensamiento interno</amazon:effect> ${pause(700)}
```

### Escena positiva
```
${pause(300)} <prosody pitch="+5%"><emphasis level="moderate">contenido positivo</emphasis></prosody> ${pause(400)}
```

### Escena de shock
```
${pause(200)} <emphasis level="high">revelación</emphasis> ${pause(1000)}
```

---

## Más información

Para más detalles y ejemplos aplicados a "El jardín de Rosa", ver:
- `docs/INMERSIÓN_EMOCIONAL_EN_ALEXA.md` - Guía conceptual completa
- `instructions/GUIA_SSML_IMPLEMENTACION.md` - Cómo integrar con el backend
- `backend/src/ssml-helpers.js` - Funciones listas para usar
