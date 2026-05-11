# 🎭 Técnicas Narrativas Completas para "Escoge Tu Historia"

**Documento comprensivo sobre técnicas narrativas, su impacto y aplicación práctica**

---

## 📖 Introducción

Una narrativa enriquecedora no es solo "contar una historia". Es crear una **experiencia sensorial, emocional y cognitiva** que:
- Enganche al usuario sin forzar
- Comunique estados psicológicos mediante acciones, no declaraciones
- Respete la dignidad del adulto mayor
- Mapee clínicamente a escalas psicométricas DE FORMA INVISIBLE

Las técnicas que se detallan abajo vienen del `prompts.js` (especialmente `buildSceneGenerationPrompt()` y `buildChapterGenerationPrompt()`). Cada una es **obligatoria** para cumplir con los estándares de calidad del proyecto.

---

## 🎯 PARTE 1: LAS 19 TÉCNICAS FUNDAMENTALES

### 1️⃣ UBICACIÓN CONCRETA INMEDIATA

**Qué es:**  
La escena comienza diciendo EXACTAMENTE dónde estamos en el primer párrafo. No abstracciones.

**Ejemplo MALO:**  
> "Rosa piensa en los eventos que han pasado."

**Ejemplo BUENO:**  
> "Rosa está en su cuarto. La luz entra por la ventana. Sosteniendo una taza de café que ya se enfría."

**Por qué importa:**
- Ancla al usuario en un espacio concreto (crítico para Alexa, que es audio)
- El cerebro de adultos mayores procesa mejor las localizaciones específicas
- Evita la "desorientación narrativa" común en narrativa vaga

**Aporte a la narrativa enriquecedora:**
- Genera **inmersión sensorial inmediata**
- Permite que el usuario visualice (aunque sea audio) donde está Rosa
- Facilita **continuidad cognitiva** entre escenas

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #1 en buildSceneGenerationPrompt():
"1. ☑️ UBICACIÓN CONCRETA EN PRIMER PÁRRAFO"
"- ¿Dónde estamos? (cuarto, calle, jardín, teléfono)"
"- ✅ 'Rosa está en su cuarto' vs ❌ 'Rosa piensa en su vida'"
```

---

### 2️⃣ RITMO NATURAL

**Qué es:**  
Alternar entre frases cortas y medianas. Usa puntuación para marcar pausas naturales donde el lector (oyente) puede procesar.

**Ejemplo MALO:**  
> "Rosa se levantó de la cama y fue a la ventana y miró hacia afuera y vio que estaba lloviendo y pensó en lo que había sucedido hace días."

**Ejemplo BUENO:**  
> "Rosa se levanta. Camina a la ventana. Lluvia. El barrio está mojado, gris. Piensa en lo que pasó hace días."

**Por qué importa:**
- Adultos mayores procesan mejor ritmo lento pero definido
- Frases largas sin pausas causan **fatiga cognitiva** en audición
- Alexa con pausas naturales suena menos "robótica"

**Aporte a la narrativa enriquecedora:**
- **Prosodia natural** sin necesidad de SSML excesivo
- Ritmo **respira** con el contenido emocional
- Facilita **comprensión y retención**

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #2:
"2. ☑️ RITMO NATURAL"
"- Usa frases cortas/medias y puntuación para marcar pausas naturales"
"- Evita párrafos interminables: cambia de línea cuando cambia la acción"
```

---

### 3️⃣ SHOW, DON'T TELL (REGLA SENSORIAL ESTRICTA)

**Qué es:**  
NO describas emociones abstractas. MUESTRA la emoción a través de:
- **1 sonido** (lo que se escucha)
- **1 textura/tacto** (lo que se siente en el cuerpo)
- **1 olor** (lo que se huele)

**Ejemplo MALO:**  
> "Rosa estaba muy triste y se sentía sola."

**Ejemplo BUENO:**  
> "Las lágrimas vienen sin parar. Rosa sostiene la taza con ambas manos. La cocina huele a café frío."

**Por qué importa:**
- Adultos mayores con depresión NO creen en "estoy triste"
- SIENTEN el cuerpo: "Mi pecho pesa" es más verdadero que "me siento mal"
- Los sentidos son más creíbles que las emociones nombradas
- Evita **sentimentalismo vacío** que ofende a mayores

**Aporte a la narrativa enriquecedora:**
- **Autenticidad emocional** — el usuario VIVE la emoción, no la escucha nombrar
- **Accesibilidad clínica** — lo sensorial es más fácil de mapear a síntomas GDS/PHQ
- **Dignidad** — respeta la inteligencia del usuario

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #3 (CRÍTICO):
"3. ☑️ REGLA SENSORIAL ESTRICTA (SHOW, DON'T TELL)"
"- Prohibido usar adjetivos emocionales abstractos (triste, feliz, asustada, etc.)"
"- Usa exactamente: 1 sonido + 1 textura/tacto + 1 olor"
"- ❌ EVITA: 'Rosa está triste' → ✅ 'La taza vibra en su mano. Huele a tierra húmeda. La silla raspa el suelo.'"
```

---

### 4️⃣ CONEXIÓN CLARA CON DECISIÓN ANTERIOR

**Qué es:**  
Cada escena comienza mostrando cómo la decisión del usuario tuvo CONSECUENCIA. No repetir; mostrar el resultado.

**Ejemplo:**  
- **Decisión del usuario:** "Llamar a Sofía ahora"
- **Segunda frase de la escena (NO la primera):** "Sofía atendió en el tercer timbrazo. Su voz suena alegre, sorprendida."

**Por qué importa:**
- Valida la **agencia del usuario** — "Mi decisión TUVO EFECTO"
- Evita la narrativa lineal plana donde nada cambia
- Crea **causalidad lógica** (decisión → consecuencia → nueva decisión)
- Crítico para mantener **continuidad cognitiva**

**Aporte a la narrativa enriquecedora:**
- El usuario se siente **responsable de la trama**
- Genera **motivación** para seguir tomando decisiones
- Facilita **mapeo clínico** (cada opción genera ruta distinta)

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #4:
"4. ☑️ CONEXIÓN CLARA CON DECISIÓN ANTERIOR"
"- Segunda frase debe mostrar consecuencia (no repetir)"
"- MUESTRA CON DETALLES: 'Sofía atendió en el tercer timbrazo' (no: 'Sofía respondió')"
```

---

### 5️⃣ CIERRE CON DILEMA O PREGUNTA IMPLÍCITA

**Qué es:**  
La escena NO termina con punto final. Termina con una **pregunta abierta sin respuesta obvia**, que prepara naturalmente para las 3 opciones.

**Ejemplo MALO:**  
> "Rosa está sola en casa." ← Punto final. Fin de la escena.

**Ejemplo BUENO:**  
> "Rosa sostiene el teléfono. Sofía le dijo: 'Hay un evento el sábado, ¿vienes?' Pero Rosa recuerda que hace años no va a eventos." ← La pregunta está IMPLÍCITA: ¿Qué hace Rosa?

**Por qué importa:**
- Crea **tensión narrativa** que NO es forzada
- Las opciones surgem NATURALMENTE de la escena, no como menú arbitrario
- Mantiene al usuario en **estado de indecisión activa** (bueno para tomar decisiones)

**Aporte a la narrativa enriquecedora:**
- Transición **suave y orgánica** a las opciones
- Evita la "separación" entre narrativa y interfaz
- Genera **participación activa**, no pasiva

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #5:
"5. ☑️ CIERRE CON DILEMA O PREGUNTA IMPLÍCITA"
"- NO: 'Rosa está sola.' (período)"
"- SÍ: pregunta abierta, dilema, invitación a acción"
```

---

### 6️⃣ DIFERENCIACIÓN DE VOZ EN DIÁLOGO

**Qué es:**  
Cada personaje habla diferente. Sus palabras, longitud de frases, actitud son únicos. **Subtexto:** nadie dice explícitamente su emoción.

**Ejemplo:**
- **Hernando (Mentor, lento, formal):** "Doña Rosa, es un honor tenerla aquí. El jardín necesita gente como usted."
- **Sofía (Compañera, rápida, entusiasta):** "¡Rosa! ¿Dónde estabas? Te he estado esperando toda la semana."
- **Rosa interior (Pensamiento, íntimo, concreto):** "Las manos me tiemblan. No sé si pueda."

**Por qué importa:**
- Humaniza los personajes
- Adultos mayores reconocen voces reales (incluso en texto)
- Evita la "narrativa monótona" donde todos hablan igual
- **Subtexto emocional:** Sofía dice "¿Dónde estabas?" no "Te he extrañado". Pero se siente el peso.

**Aporte a la narrativa enriquecedora:**
- **Autenticidad interpersonal** — se siente como conversación real
- **Profundidad psicológica** — descubres el estado emocional por cómo hablan, no por lo que dicen
- **Riqueza de personajes** — Rosa no está sola en su mundo

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #6:
"6. ☑️ SI HAY DIÁLOGO: DIFERENCIACIÓN DE VOZ"
"- Diferencia personajes por vocabulario, longitud de frases y actitud"
"- Pensamiento interno: más íntimo, concreto y corporal (sin etiquetas)"
"- OBLIGATORIO: incluye al menos 1 intercambio verbal breve entre dos personas"
"- SUBTEXTO: ningún personaje dice su emoción de forma directa"
```

---

### 7️⃣ DURACIÓN TOTAL DEL CAPÍTULO (5 MINUTOS)

**Qué es:**  
**Cada capítulo completo (12 escenas) debe durar exactamente 5 minutos** de reproducción en Alexa.

**Cálculo:**
- 5 minutos = ~850 palabras totales (a velocidad estándar Alexa ~170 palabras/minuto)
- 12 escenas ÷ 850 palabras = ~71 palabras/escena en promedio
- **Distribución:**
  - Escenas narradas (5 total): 50-80 palabras cada una (automáticas, sin opciones)
  - Escenas jugables (7 total): 80-120 palabras cada una (narrativa + 3 opciones)

**Por qué importa:**
- **Atención de adultos mayores:** 5 minutos es tiempo óptimo (no aburre, no abruma)
- **Coherencia temporal:** usuario anticipa "una escena demora ~25-30 segundos" (85-150 palabras)
- **Flujo narrativo:** 5 minutos permite 1 acto completo sin fatiga cognitiva
- **Alexa sostenibilidad:** sesión de 5 minutos es recallable, repetible, sin estrés

**Control de ritmo con SSML:**
- Usa `ssml-helpers.js` para variar velocidad (rate 80-120%)
- Pausas estratégicas (`<break time="400ms"/>`) permiten **comprensión sin aumentar duración**
- Susurros y tonos no agregan tiempo pero agregan **densidad emocional**

**Aporte a la narrativa enriquecedora:**
- **Concentración máxima** — cada palabra cuenta, no hay relleno
- **Cadencia clínica:** 5 minutos es "dosis" psicoterapéutica estándar
- **Experiencia memorable:** usuario siente que vivió algo completo en tiempo manejable
- **Sostenibilidad:** adulto mayor puede jugar diario sin exhaustión

**Distribución por tipo de escena:**

| Tipo | Cantidad | Palabras/escena | Total | Duración |
|------|----------|-----------------|-------|----------|
| Narradas (s02,s04,s07,s09,s11) | 5 | 60 | 300 | ~1m 45s |
| Jugables (s01,s03,s05,s06,s08,s10,s12) | 7 | 79 | 550 | ~3m 15s |
| **TOTAL CAPÍTULO** | 12 | 71 | 850 | **5 min** |

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #7:
"7. ☑️ DURACIÓN TOTAL: 5 minutos (12 escenas ~850 palabras)"
"- Escenas narradas: 50-80 palabras"
"- Escenas jugables: 80-120 palabras + 3 opciones"
"- Usa SSML helpers para comprimir/expandir sin alterar duración"
```

---

### 8️⃣ VERBOS DE ACCIÓN CONCRETA

**Qué es:**  
Las opciones (y la narrativa) usan **verbos específicos y concretos**, no abstractos.

**Ejemplo MALO:**  
> - "Pensar en la vida"
> - "Continuar con rutina"
> - "Reflexionar"

**Ejemplo BUENO:**  
> - "Llamar a Sofía ahora mismo"
> - "Aceptar ir al jardín comunitario"
> - "Quedarse en casa, reflexionar hoy"

**Por qué importa:**
- Adultos mayores responden mejor a **acciones concretas** que conceptos
- "Llamar" es más real que "conectar emocionalmente"
- Facilita **agencia clara** — el usuario sabe exactamente qué va a pasar
- Evita ambigüedad que causa ansiedad

**Aporte a la narrativa enriquecedora:**
- **Claridad narrativa** — el usuario entiende la consecuencia probable
- **Libertad con límites** — opciones reales, no ilusiones de libertad
- **Facilita mapeo clínico** — acción concreta → ítem GDS/PHQ claro

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #8:
"8. ☑️ OPCIONES: VERBOS DE ACCIÓN CONCRETA (3-7 palabras)"
"- ✅ 'Llamar a Sofía ahora mismo'"
"- ✅ 'Aceptar ir al jardín comunitario'"
"- ❌ 'Pensar en la vida' (abstracto)"
```

---

### 9️⃣ CONSECUENCIAS SENSORIALES (3 ORACIONES EXACTAS)

**Qué es:**  
Cada opción genera una consecuencia de **exactamente 3 oraciones**. Cada oración tiene información nueva. Sin relleno.

**Estructura:**
1. **Oración 1:** Acción física/visual (qué pasó como resultado inmediato)
2. **Oración 2:** Emoción corporal o cambio de escena (cómo Rosa se siente o dónde está ahora)
3. **Oración 3:** Reacción de otros O nueva situación (mundo responde)

**Ejemplo:**
```
Opción: "Llamar a Sofía ahora mismo"

Consecuencia:
"Sofía atendió en el tercer timbrazo.
Su risa es genuina, como si hubiera estado esperando tu llamada.
Rosa cuelga sintiendo algo que no esperaba: alivio."
```

**Por qué importa:**
- Evita **consecuencias vagas** ("todo sale bien")
- Cada acción tiene **costo y recompensa visible**
- Las 3 oraciones crean **arc narrativo mini** (acción → respuesta → cambio)
- Facilita **edición precisa** sin relleno

**Aporte a la narrativa enriquecedora:**
- **Densidad narrativa** — cada palabra pesa
- **Causalidad clara** — opción A genera consecuencia A (no mezcla)
- **Preparación para próxima escena** — la consecuencia planta semillas

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #9:
"9. ☑️ CONSECUENCIAS: 60-100 palabras SENSORIALES"
"- Qué pasó como resultado"
"- Emoción corporal, cambio de escena, reacción de otros"
"- Prepara para próxima escena"
// Y también en MICRO-TÉCNICAS:
"- 3 oraciones: cada consequence en exactamente 3 oraciones sin relleno."
```

---

### 🔟 ENTORNO VIVO

**Qué es:**  
El mundo de Rosa NO es pasivo. Incluye **al menos 1 acción concreta del personaje con objeto/espacio**. Los objetos cambian, tienen función.

**Ejemplo MALO:**  
> "Rosa estaba en la sala. Era un día nublado."

**Ejemplo BUENO:**  
> "Rosa está en la sala. Mueve la silla para que la luz llegue mejor. Los girasoles en la maceta necesitan riego; los toques y sienten blandos aún. Afuera, nublado."

**Por qué importa:**
- Objetos significantes anclan la narrativa a lo real
- Acciones con objetos comunican estado emocional (inquietud, cuidado, negligencia)
- Adultos mayores tienen relación SENSORIAL con objetos cotidianos
- Evita la "narrativa flotante" donde nada pesa

**Aporte a la narrativa enriquecedora:**
- **Textura táctil** — se siente vivido, no abstracto
- **Psicología implícita** — las acciones revelan estado mental (si riega plantas vs si no)
- **Mundo con gravedad** — cosas tienen peso, función, continuidad

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #11:
"11. ☑️ ENTORNO VIVO"
"- OBLIGATORIO: al menos 1 acción concreta del personaje con objeto/espacio"
"- Ejemplos: mover una silla, regar una maceta, abrir una puerta, tocar una taza"
```

---

### 1️⃣1️⃣ PERSONAJE DESDE EL MUNDO

**Qué es:**  
Al menos 1 rasgo de Rosa conecta con 1 rasgo del entorno (barrio, clima, historia local, cultura). No están separados.

**Ejemplo MALO:**  
> "Rosa es una viuda. El barrio es antiguo."

**Ejemplo BUENO:**  
> "Rosa, que creció en estos mismo edificios hace 40 años, reconoce la fachada del jardín comunitario. Es la casa de los Martínez, donde iba de niña. Ahora es un espacio público. Ella regresa a un lugar que fue suyo."

**Por qué importa:**
- Crea **arraigo emocional** — Rosa no es extranjera en su mundo
- Facilita **continuidad histórica** — la vida es un continuo, no saltos
- Respeta la **biografía del personaje** — tiene pasado, memoria, conexión
- Evita narrativa donde el personaje y el mundo son ajenos

**Aporte a la narrativa enriquecedora:**
- **Profundidad temporal** — el presente está anclado en el pasado
- **Dignidad de Rosa** — no es despiadada, tiene raíces
- **Riqueza contextual** — el barrio es personaje también
- **Facilita mapeo clínico** — el aislamiento se ve como ruptura del vínculo con lugar

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #12:
"12. ☑️ PERSONAJE DESDE EL MUNDO"
"- Vincula al menos 1 rasgo del personaje con 1 rasgo del entorno"
"- (barrio, historia local, cultura, clima)"
```

---

### 1️⃣2️⃣ MUNDO CON CONSECUENCIAS

**Qué es:**  
Si aparece un elemento **inusual o nuevo**, muestra **1 consecuencia práctica/molesta** y cómo la gente se adaptó. El mundo NO es neutro.

**Ejemplo MALO:**  
> "Hay un nuevo café en el barrio."

**Ejemplo BUENO:**  
> "Hay un nuevo café en la esquina. La música es muy fuerte; algunos vecinos se quejan, pero el dueño dice que así atrae gente joven. Rosa pasa rápido porque le duele la cabeza con ese ruido."

**Por qué importa:**
- Evita narrativa de "todo es perfecto"
- Adultos mayores entienden que el cambio tiene **fricción**
- Crea **realismo emocional** — vida tiene obstáculos, no solo felicidad
- Facilita mapeo clínico de **adaptación/resistencia**

**Aporte a la narrativa enriquecedora:**
- **Autenticidad** — el mundo es complejo, no blanco/negro
- **Agencia narrativa** — personaje se adapta (o no) a fricción
- **Profundidad social** — otros personajes tienen motivaciones distintas

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #13:
"13. ☑️ MUNDO CON CONSECUENCIAS"
"- cada elemento inusual trae 1 consecuencia práctica y visible en el capítulo."
```

---

### 1️⃣3️⃣ DOLOR IMPLÍCITO, NO DECLARATIVO

**Qué es:**  
Evita repetir literalmente "dolor", "pérdida", "duelo", "soledad" en escenas consecutivas. Máximo 1 mención explícita; el resto se muestra por **acciones, silencios, decisiones**.

**Ejemplo MALO:**  
> Escena 1: "Rosa se siente sola."
> Escena 2: "Rosa se siente triste y sola."
> Escena 3: "El duelo de Rosa es profundo."

**Ejemplo BUENO:**  
> Escena 1: "Rosa sostiene la foto de Alberto. La besa."
> Escena 2: "En el café, ella pide dos tazas. Se detiene. Pide una."
> Escena 3: "No puede ir al jardín ese día. Llama a Sofía y cancela."

**Por qué importa:**
- **Repetición mata la emoción** — la sexta vez que dices "sola" pierde peso
- Adultos mayores **sienten insultados** por declaraciones obvias
- Lo implícito es más potente (el lector completa)
- Evita "trauma-porn" — respeta dignidad

**Aporte a la narrativa enriquecedora:**
- **Sutileza emocional** — confía en el lector para entender
- **Respeto al adulto mayor** — no subestima su inteligencia
- **Impacto emocional prolongado** — la emoción penetra sin abrumar
- **Variación narrativa** — mantiene frescura

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #14:
"14. ☑️ DOLOR IMPLÍCITO, NO DECLARATIVO"
"- Evita repetir literalmente 'dolor', 'pérdida', 'duelo', 'soledad'"
"- Máximo 1 mención explícita; el resto se muestra por acciones, silencios y decisiones"
```

---

### 1️⃣4️⃣ PATRÓN PERO/ENTONCES

**Qué es:**  
En la escena debe verse: **acción lógica → entonces contradicción → pero ventaja inesperada**.

**Estructura:**
1. Acción lógica: Rosa decide hacer X
2. Entonces (complicación): Sucede Y que no esperaba
3. Pero (ventaja): Y le enseña algo nuevo O abre posibilidad inesperada

**Ejemplo:**
```
Acción: Rosa decide llamar a Sofía porque necesita hablar.
Entonces: Sofía no responde. Rosa se siente rechazada.
Pero: 15 minutos después, Sofía devuelve la llamada. Estaba con su madre en el hospital. Le cuenta a Rosa un secreto que nunca había contado.
```

**Por qué importa:**
- Evita narrativa lineal aburrida (A → B → fin)
- Refleja **realidad** — vida tiene giros inesperados
- Crea **complejidad emocional** — mezcla frustración con sorpresa
- Facilita **arquetipos de crecimiento** — adaptación a lo inesperado

**Aporte a la narrativa enriquecedora:**
- **Dinamismo narrativo** — mantiene atención
- **Realismo psicológico** — la vida no es predecible
- **Agencia de personaje** — Rosa se adapta, aprende
- **Riqueza emocional** — no mono-sentimientos

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #15:
"15. ☑️ PATRÓN PERO/ENTONCES"
"- En la escena debe verse: acción lógica → entonces contradicción → pero ventaja inesperada."
```

---

### 1️⃣5️⃣ CONFLICTO ANIDADO

**Qué es:**  
Cada escena contiene **3 conflictos simultáneos**:
1. **Conflicto externo** — lo que pasa en el mundo (alguien llama, evento, obstáculo físico)
2. **Deseo interno contradictorio** — lo que Rosa quiere vs lo que teme
3. **Recuerdo-gatillo** — 1 frase que trae el pasado al presente

**Ejemplo:**
```
Conflicto externo: Sofía invita a Rosa al jardín comunitario.
Deseo contradictorio: Rosa quiere conexión PERO tiene miedo de no pertenecerle.
Recuerdo-gatillo: "La última vez que intenté algo nuevo, Alberto estaba conmigo."
```

**Por qué importa:**
- Evita escenas **planas** (solo un problema)
- Refleja la **complejidad psicológica real** — depresión no es 1 cosa, es todo a la vez
- Facilita mapeo clínico complejo (GDS+PHQ simultáneamente)
- Crea **tensión dinámica**

**Aporte a la narrativa enriquecedora:**
- **Profundidad psicológica** — Rosa no es personaje unidimensional
- **Causalidad compleja** — decisiones son difíciles, razonadas
- **Riqueza emocional** — múltiples sentimientos en tensión
- **Autenticidad** — así es la mente real

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #16:
"16. ☑️ CONFLICTO ANIDADO EN 1 ESCENA"
"- Incluye 1 conflicto externo + 1 deseo interno contradictorio + 1 recuerdo-gatillo (1 frase)."
```

---

### 1️⃣6️⃣ PÉRDIDA MÍNIMA IRREVERSIBLE

**Qué es:**  
En cada escena, Rosa pierde algo concreto (pequeño). No es recuperable. La consecuencia lo refleja.

**Ejemplo:**
```
Pérdida: Rosa tira accidentalmente la foto de Alberto mientras limpia.
- La foto no se rompe, pero la descubre un visitante casual.
- Rosa pierde la privacidad de su duelo. Ahora alguien sabe.
```

**Por qué importa:**
- **Causalidad irreversible** — cada decisión tiene costo, no solo beneficio
- Refleja **realidad del duelo** — no puedes volver atrás
- Facilita mapeo clínico de **pérdida, adaptación**
- Evita narrativa donde todo es reversible/optimista

**Aporte a la narrativa enriquecedora:**
- **Gravedad emocional** — las decisiones IMPORTAN
- **Madurez narrativa** — vida no es un videojuego donde salvas antes
- **Complejidad moral** — no hay elecciones 100% buenas
- **Humanidad** — Rosa es frágil, su mundo cambia

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #17:
"17. ☑️ PÉRDIDA MÍNIMA IRREVERSIBLE"
"- Debe perder algo concreto en la escena (objeto, oportunidad, vínculo, creencia)."
"- La consecuencia lo refleja en 1 frase."
```

---

### 1️⃣7️⃣ STORY CIRCLE EN MICRO-BEATS

**Qué es:**  
La estructura interna de cada escena sigue: **Confort → Deseo → Salida → Adaptación → Obtención → Costo → Retorno → Cambio**

No enumeres esto; **intégralo en la progresión dramática**.

**Ejemplo (integrado, no evidente):**
```
CONFORT: Rosa en su cama, luz de mañana.
DESEO: Quiere escuchar a Sofía, sentirse conectada.
SALIDA: Suena el teléfono.
ADAPTACIÓN: Rosa respira, se sienta mejor.
OBTENCIÓN: Sofía le cuenta del jardín.
COSTO: Rosa recuerda que hace años no va a lugares nuevos.
RETORNO: Cuelga el teléfono. Se queda pensando.
CAMBIO: La tarjeta del jardín está en su mano. Por primera vez, la abre.
```

**Por qué importa:**
- Proporciona **estructura profunda** sin que sea visible
- Cada paso sigue lógica emocional/narrativa
- Facilita **continuidad entre escenas** — retorno de una = confort de la siguiente
- Es la base del **storytelling efectivo**

**Aporte a la narrativa enriquecedora:**
- **Coherencia interna** — escena sigue arco emocional natural
- **Satisfacción narrativa** — usuario siente que algo se completó
- **Preparación orgánica** — siguiente escena fluye naturalmente
- **Psicología profunda** — responde a cómo procesa mente humana

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #18:
"18. ☑️ STORY CIRCLE EN MICRO-BEATS (INTERNO)"
"- Confort → deseo → salida → adaptación → obtención → costo → retorno → cambio"
"- No lo enumeres en salida; intégralo en la progresión dramática"
```

---

### 1️⃣8️⃣ ANTIRREPETICIÓN ESTRICTA

**Qué es:**  
No reutilices:
- Frases plantilla ("Rosa se siente...", "se da cuenta de que...", "nuevo propósito...")
- Opciones literalmente en capítulos consecutivos
- Párrafos recientes con sinónimos (introducir evento/objeto/relación NUEVO en su lugar)

**Ejemplo MALO (repetición):**
```
Escena 1: "Rosa se siente sola en la mañana."
Escena 2: "Rosa se siente sola mientras espera."
Escena 3: "Rosa se siente sola en la tarde."
```

**Ejemplo BUENO (variación):**
```
Escena 1: "El silencio del apartamento pesa."
Escena 2: "En la calle, rodeada de gente, Rosa está más sola que nunca."
Escena 3: "La taza de café se enfría. Ella no la bebe."
```

**Por qué importa:**
- **Fatiga cognitiva** — repetición aburre y ofende a adultos mayores
- **Calidad narrativa** — cada frase debe ser nueva
- Facilita **relectura** — historias no se sienten copiadas
- **Respeto editorial** — señala que alguien se tomó tiempo

**Aporte a la narrativa enriquecedora:**
- **Frescura constante** — cada escena se siente nueva
- **Precisión lingüística** — cada palabra es necesaria
- **Variación narrativa** — evita monotonía
- **Calidad profesional** — marca diferencia

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #19:
"19. ☑️ ANTIRREPETICIÓN ESTRICTA"
"- No reutilices frases plantilla como 'Rosa se siente...', 'se da cuenta de que...', 'nuevo propósito...'"
"- No repitas literalmente ninguna opción reciente."
"- No reescribas párrafos recientes con sinónimos: introduce un evento/objeto/relación nuevo."
```

---

## 🎬 PARTE 2: TÉCNICAS DE ESTRUCTURA NARRATIVA (MACROESCALA)

### 🏛️ VIAJE DEL HÉROE (12 ESCENAS POR CAPÍTULO)

**Qué es:**  
Cada capítulo tiene 12 escenas que distribuyen el Viaje del Héroe clásico (monomito):

| Escena | Etapa | Descripción |
|--------|-------|------------|
| s01 | 1. Mundo Ordinario | Rosa en su vida cotidiana, estable pero vacía |
| s02 | Narrada | Incidente gatillo — algo llama su atención |
| s03 | 3. Rechazo/Miedo | Primera respuesta: dudas, resistencia |
| s04 | Narrada | Se intensifica la llamada — no puede ignorarla |
| s05 | 5. Cruce del Umbral | Rosa decide entrar (o rechaza) |
| s06 | 6. Pruebas | Conoce aliados, aprende reglas del mundo nuevo |
| s07 | Narrada | Punto medio transformador — algo cambia internamente |
| s08 | 8. Crisis | La prueba más difícil, el miedo mayor |
| s09 | Narrada | Recompensa — obtiene lo que buscaba (o descubre verdad) |
| s10 | 10. Retorno | Rosa regresa, pero transformada |
| s11 | Narrada | Integración — asimila el cambio |
| s12 | 12. Retorno con Elixir | Rosa tiene algo nuevo que aportar |

**Por qué importa:**
- Es estructura **probada por miles de años** de narrativa
- Adoltos mayores la reconocen (aunque sea inconscientemente)
- Facilita **continuidad emocional clara** — usuario sabe dónde está en la historia
- Permite **mapeo clínico predecible** — cada etapa refleja síntomas específicos

**Aporte a la narrativa enriquecedora:**
- **Profundidad arquetipal** — toca estructuras profundas de psique
- **Cambio auténtico** — Rosa no es la misma al final
- **Significado** — su viaje no es solo eventos, es transformación
- **Satisfacción narrativa** — el usuario siente que algo se completó

**Cómo se aplica en prompts.js:**
```javascript
// ESTRUCTURA JSON (buildChapterGenerationPrompt):
"========== ESTRUCTURA: 12 ESCENAS (7 jugables + 5 narradas) =========="
"ESCENAS JUGABLES (tipo: 'playable'): s01, s03, s05, s06, s08, s10, s12"
"ESCENAS NARRADAS (tipo: 'narrated'): s02, s04, s07, s09, s11"
"La s01 = Mundo Ordinario, s03 = Rechazo/Miedo, etc."
```

---

### 📐 TRES ACTOS + PUNTOS DE GIRO

**Qué es:**  
El capítulo se divide en 3 actos, cada uno con **punto de giro** que altera el curso:

| Acto | % de Capítulo | Composición | Punto de Giro |
|------|--------------|-------------|---------------|
| I | 0-25% | Incidente gatillo (~15%) | Primer giro (~25%): Rosa decide responder |
| II | 25-75% | Pruebas (~50%) + Punto medio transformador (~50%) + Crisis (~75%) | Crisis: lo que más temía sucede |
| III | 75-100% | Clímax (~90%) | Resolución emocional (~100%): Rosa ha cambiado |

**Ejemplo (con escenas):**
```
ACTO I:
- s01: Mundo ordinario
- s02: Incidente gatillo
- s03: Rechazo inicial ← PUNTO DE GIRO 1

ACTO II:
- s04-s06: Pruebas (50%)
- s07: Punto medio transformador ← PUNTO DE GIRO 2 (internal shift)
- s08-s09: Crisis (75%) ← PUNTO DE GIRO 3 (todo está en riesgo)

ACTO III:
- s10-s11: Retorno e integración (90%)
- s12: Resolución ← PUNTO DE GIRO 4 (Rosa regresa transformada)
```

**Por qué importa:**
- **Dinamismo** — el capítulo no es línea plana, tiene momentum
- **Apego emocional** — puntos de giro generan **tensión e inversión emocional**
- Facilita **distribución de clímax** — no todo sucede en s09
- Refleja **realidad psicológica** — cambio no es lineal, es giros

**Aporte a la narrativa enriquecedora:**
- **Velocidad narrativa variable** — inicio lento, mitad rápida, fin catártico
- **Sorpresa manejada** — giros son orgánicos, no forzados
- **Satisfacción de arco** — el usuario siente que la historia se desarrolló
- **Climax memorable** — no es difuso, es punto inequívoco

**Cómo se aplica en prompts.js:**
```javascript
// En buildChapterGenerationPrompt():
"========== ESTRUCTURA JSON REQUERIDA =========="
"19. ☑️ 3 ACTOS + PUNTOS DE GIRO:"
"- Acto I (0-25%): incidente gatillo (~15%) + primer giro (~25%)."
"- Acto II (25-75%): pruebas + punto medio transformador (~50%) + crisis (~75%)."
"- Acto III (75-100%): clímax (~90%) + resolución emocional."
```

---

### 🧩 STORY CIRCLE (COMPLETA, MACROSCALA)

**Qué es:**  
La estructura de todo el capítulo es una Story Circle: **Confort → Deseo → Salida → Adaptación → Obtención → Costo → Retorno → Cambio**

Es la **integración de todas las micro-técnicas en una estructura madre**.

**Ejemplo (capítulo 1 completo):**
```
CONFORT (s01-s02): Rosa en su rutina, Sofía le invita.
DESEO (s03-s04): Rosa quiere pertenecer PERO teme.
SALIDA (s05): Rosa entra al jardín.
ADAPTACIÓN (s06-s07): Conoce gente, aprende hacer cosas.
OBTENCIÓN (s08-s09): Encuentra la foto de Alberto en el jardín.
COSTO (s10): Debe decidir si el jardín es ahora SU lugar o si es "profanación" de la memoria de Alberto.
RETORNO (s11): Rosa integra: puede estar aquí Y honrar a Alberto.
CAMBIO (s12): Rosa propone algo nuevo en el jardín en honor de Alberto.
```

**Por qué importa:**
- Es la **estructura madre de toda narrativa efectiva**
- Proporciona **coherencia profunda** sin ser evidente
- Cada escena fluye del anterior de forma **inevitable pero orgánica**
- Facilita **mapeo clínico**: cada fase puede reflejar síntoma específico

**Aporte a la narrativa enriquecedora:**
- **Unidad narrativa** — no son 12 escenas sueltas, es 1 arco completo
- **Transformación auténtica** — Rosa termina diferente
- **Satisfacción profunda** — usuario siente que vivió algo significativo
- **Reutilización** — story circle es modular, puede repetirse cada capítulo

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #20 (implícita en prompts.js):
"20. ☑️ STORY CIRCLE EN MACRO-BEATS (ESTRUCTURAL)"
"- Integra confort→deseo→salida→adaptación→obtención→costo→retorno→cambio"
"- en la progresión global del capítulo (12 escenas)"
```

---

### 🎭 SUBTEXTO EN DIÁLOGO

**Qué es:**  
Nadie en la narrativa dice explícitamente su emoción. Se expresa en:
- **Acciones** (qué hacen)
- **Silencios** (qué no dicen)
- **Metáforas** (lenguaje simbólico)
- **Tono implícito** (cómo hablan, no qué dicen)

**Ejemplo:**
```
❌ MALO (explícito):
Sofía: "Estoy muy feliz de verte aquí porque te he extrañado mucho."

✅ BUENO (subtexto):
Sofía: "¿Dónde estabas?" (la pregunta revela el vacío)
[Sofía sostiene el brazo de Rosa más tiempo del necesario]
(La acción revela el afecto)
```

**Por qué importa:**
- **Adultos mayores responden mejor a subtexto** — han vivido bastante para leerlo
- Dirección explícita se siente **infantilizante**
- Subtexto es más **creíble emocionalmente** — la emoción es VIVIDA, no contada
- Facilita **mapeo clínico implícito** — acción revela síntoma

**Aporte a la narrativa enriquecedora:**
- **Inteligencia narrativa** — confía en el lector para completar
- **Autenticidad relacional** — así hablan personas reales
- **Profundidad psicológica** — las acciones revelan verdades que palabras ocultan
- **Adulto mayor como protagonista** — se siente respetado, no infantilizado

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #21:
"21. ☑️ SUBTEXTO EN DIÁLOGO"
"- OBLIGATORIO: incluye al menos 1 intercambio verbal breve entre dos personas"
"- SUBTEXTO: ningún personaje dice su emoción de forma directa"
```

---

### 🎨 OBJETO SIGNIFICANTE + CHEKHOV

**Qué es:**  
Introduce un **objeto cotidiano** que gana función a lo largo del capítulo. Si aparece en s02, debe tener propósito narrativo claro antes de s11. No introduzcas detalles sin función (regla de Chekhov).

**Ejemplo:**
```
s02: Rosa recibe la tarjeta del jardín. La sostiende.
s05: La tarjeta está en su bolsa. La toca mientras camina.
s07: Suelta la tarjeta en la tierra del jardín accidentalmente.
s09: Encuentra la tarjeta enterrada en el mismo lugar donde encontró la foto de Alberto.
s11: La tarjeta marca el lugar donde Rosa plantará algo en honor de Alberto.
```

**Por qué importa:**
- **Continuidad narrativa visible** — objeto viaja con Rosa
- Facilita **mapeo clínico** — objeto = esperanza que Rosa carga
- Evita **detalles perdidos** — todo significa algo
- Proporciona **ancla física** — conexión sensorial a la trama

**Aporte a la narrativa enriquecedora:**
- **Coesión narrativa** — detalles no son accidentales, son intencionales
- **Simbología orgánica** — objeto gana peso emocional sin ser forzado
- **Subconsciente narrativo** — objeto viaja con Rosa, como su subconsciente
- **Profesionalismo** — Chekhov: "si aparece un arma en acto 1, debe dispararse en acto 3"

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST #22 (MICRO-TÉCNICAS):
"14. ☑️ OBJETO SIGNIFICANTE: introduce o reutiliza un objeto común"
"y muéstralo con un cambio físico/funcional."
"15. ☑️ CHEKHOV: no introduzcas detalles sin función narrativa"
"en escenas posteriores."
```

---

### 🌈 TONO DUAL

**Qué es:**  
Combina **dos emociones tensas simultáneamente** sin explicarlas ni resolverlas.

**Ejemplo:**
```
❌ MALO (emocional única):
"Rosa está feliz en el jardín."

✅ BUENO (tono dual):
"Rosa está en el jardín riendo con Sofía. 
Pero sus ojos se llenan de lágrimas cuando ve el girasol que crece donde Alberto solía sentarse."
```

**Por qué importa:**
- Refleja **realidad emocional** — adultos mayores sienten múltiples cosas a la vez
- Evita **emociones puras/artificiales** — la vida es mezcla
- Facilita **mapeo clínico complejo** — alegría + duelo simultáneamente
- Humaniza **complejidad existencial**

**Aporte a la narrativa enriquecedora:**
- **Profundidad emocional** — no es blanco/negro, es gris complejo
- **Honestidad narrativa** — la vida no es una emoción
- **Compasión implícita** — se entiende que Rosa vive múltiples verdades
- **Riqueza psicológica** — el usuario se siente visto en su complejidad

**Cómo se aplica en prompts.js:**
```javascript
// MICRO-TÉCNICAS:
"11. ☑️ TONO DUAL"
"- combina dos emociones tensas (ej. miedo + ternura) sin explicarlas."
```

---

### ⏱️ STORY PACING

**Qué es:**  
Alterna ritmo entre párrafos:
- Un párrafo **breve** (rápido, impacto)
- Uno **más desarrollado** (lento, contemplación)

**Ejemplo:**
```
Rosa entra al jardín. [BREVE - rápido, nerviosismo]

El sol está alto. Los girasoles se mecen levemente. Sofía está arrodillada entre los bancales, 
las manos en la tierra, señalando las plantas que crecieron. Rosa siente que el corazón le late 
más lentamente que hace un minuto. Sofía la ve y sonríe. [DESARROLLADO - lento, asimilación]

¿Va a ayudar? [BREVE - rápido, decisión]
```

**Por qué importa:**
- **Naturalidad rítmica** — lee como respirar, no como lecturas de máquina
- Facilita **SSML natural** — pausas surgen del ritmo, no son forzadas
- Mantiene **atención** — velocidad variable evita monotonía

**Aporte a la narrativa enriquecedora:**
- **Musicalidad narrativa** — fluye naturalmente
- **Control de energía** — puede acelerar o desacelerar emociones
- **Prosodia intrínseca** — Alexa puede leer mejor sin SSML extremo

**Cómo se aplica en prompts.js:**
```javascript
// MICRO-TÉCNICAS:
"12. ☑️ STORY PACING"
"- alterna ritmo de párrafos (uno breve, uno más desarrollado)."
```

---

### 🌍 EVOLUCIÓN DE FONDO

**Qué es:**  
El entorno (fondo) debe mostrar **marca de lo ocurrido antes**. No es neutro, es palimpsesto de eventos pasados.

**Ejemplo:**
```
s01: El apartamento está limpio pero vacío. Todo está en su lugar.
[Rosa decide ir al jardín]

s05: Rosa regresa a casa. La puerta del apartamento tiene una maceta nueva con flores. 
Algo en la casa ha cambiado porque Rosa ha cambiado.

s12: El apartamento ahora tiene fotos del jardín en la pared, junto a la de Alberto. 
La casa refleja que Rosa ya no está sola en su memoria.
```

**Por qué importa:**
- **Realidad narrativa** — las experiencias dejan huellas
- Facilita **mapeo clínico visual** — cambio de entorno = cambio interno
- Evita "escenas aisladas" — todo está conectado

**Aporte a la narrativa enriquecedora:**
- **Coesión sensorial** — el mundo responde a Rosa
- **Continuidad visible** — no es montaje de escenas, es progresión
- **Profundidad emocional** — el hogar cambia cuando Rosa cambia

**Cómo se aplica en prompts.js:**
```javascript
// MICRO-TÉCNICAS:
"13. ☑️ EVOLUCIÓN DE FONDO"
"- el entorno debe mostrar una marca de lo ocurrido antes."
```

---

### 🔄 COHERENCIA OPCIÓN-CONSECUENCIA

**Qué es:**  
CADA consecuencia debe corresponder **exactamente** a su option_text. No confundir.

**Ejemplo MALO (confusión):**
```
Opción 1: "Llamar a Sofía"
Consecuencia 1: "Rosa se queda sola en casa pensando" ← INCORRECTA, no corresponde

Opción 2: "Quedarse sola reflexionando"
Consecuencia 2: "Sofía atiende alegre" ← INCORRECTA, pero es de la opción 1
```

**Ejemplo BUENO (correspondencia):**
```
Opción 1: "Llamar a Sofía"
Consecuencia 1: "Sofía atiende. Su voz es cálida. Rosa se siente menos sola." ← CORRECTA

Opción 2: "Quedarse sola reflexionando"
Consecuencia 2: "Rosa pasa la tarde pensando en el jardín. Imagina cómo sería estar allí." ← CORRECTA
```

**Por qué importa:**
- **Validación de agencia** — opción A genera resultado A (no aleatorio)
- **Mapeo clínico exacto** — cada acción mapea a ítem específico
- **Confianza del usuario** — sus elecciones IMPORTAN

**Aporte a la narrativa enriquecedora:**
- **Causalidad moral** — el mundo responde a Rosa de forma justa
- **Agencia clara** — no hay sorpresas arbitrarias
- **Validación lógica** — la narrativa es coherente

**Cómo se aplica en prompts.js:**
```javascript
// CHECKLIST:
"23. ☑️ COHERENCIA OPCIÓN-CONSECUENCIA"
"- Cada consequence debe corresponder a su option_text exacta."
"- Prohibido narrar la acción de otra opción."
```

---

## 🎯 PARTE 3: POR QUÉ VALE LA PENA USAR ESTAS TÉCNICAS

### Para Rosa (el usuario)
1. **Dignidad** — Se siente respetada, no infantilizada
2. **Agencia** — Sus decisiones importan y generan consecuencias reales
3. **Belleza** — La narrativa es poética sin ser artificiosa
4. **Autenticidad** — Se reconoce a sí misma en la historia
5. **Transformación** — Siente que creció internamente

### Para el Sistema Clínico
1. **Detección sin diagnóstico** — Mapea GDS/PHQ sin "test"
2. **Continuidad** — Cada escena acumula datos válidos
3. **Validez** — La narrativa es plausible para mapeo automático
4. **Riesgo temprano** — Detecta señales de crisis antes de crisis real

### Para el Proyecto (Escoge Tu Historia)
1. **Diferenciación** — No es "otro test clínico", es arte + ciencia
2. **Escalabilidad** — Técnicas son aplicables a todos los capítulos
3. **Mantenibilidad** — Código (`prompts.js`) es predecible, documentado
4. **Innovación** — Combina narrativa + clínica de forma nunca vista
5. **Impacto social** — Realmente ayuda adultos mayores

---

## 📋 CHECKLIST RÁPIDA DE APLICACIÓN

Cuando escribas una escena, verifica:

- [ ] **UBICACIÓN**: ¿Dónde estamos en primer párrafo? (concreto)
- [ ] **RITMO**: ¿Frases varían en longitud? (no todas igual)
- [ ] **SHOW**: ¿Hay 1 sonido + 1 textura + 1 olor? (sin adjetivos emocionales)
- [ ] **CONEXIÓN**: ¿Segunda frase muestra consecuencia de opción anterior? (no repite)
- [ ] **CIERRE**: ¿Termina con dilema, no punto final? (pregunta implícita)
- [ ] **DIÁLOGO**: ¿Cada personaje habla diferente? (subtexto, no emociones dichas)
- [ ] **LONGITUD**: ¿180-250 palabras? (no menos, no más)
- [ ] **VERBOS**: ¿Opciones son concretas (3-7 palabras)? (no abstracciones)
- [ ] **CONSECUENCIAS**: ¿Exactamente 3 oraciones cada una? (sin relleno)
- [ ] **ENTORNO**: ¿Hay 1 acción concreta con objeto/espacio? (no flotante)
- [ ] **PERSONAJE+MUNDO**: ¿1 rasgo de Rosa conecta con 1 del entorno? (arraigo)
- [ ] **MUNDO**: ¿Elemento inusual tiene 1 consecuencia práctica? (realismo)
- [ ] **DOLOR**: ¿No repites "dolor/pérdida/soledad" literal? (máximo 1 vez, resto implícito)
- [ ] **PERO/ENTONCES**: ¿Hay acción → contradicción → ventaja? (dinamismo)
- [ ] **CONFLICTO**: ¿1 externo + 1 deseo contradictorio + 1 recuerdo? (complejidad)
- [ ] **PÉRDIDA**: ¿Rosa pierde algo concreto e irreversible? (gravedad)
- [ ] **STORY CIRCLE**: ¿Escena tiene mini-arco (confort→...→cambio)? (satisfacción)
- [ ] **ANTIRREPETICIÓN**: ¿No reutilizo frases/opciones recientes? (frescura)
- [ ] **MAPEO**: ¿Opción A genera consecuencia A exacta? (coherencia)

---

## 🔗 REFERENCIAS RÁPIDAS

- **Localización física:** `backend/src/prompts.js` (líneas ~250-900, funciones `buildSceneGenerationPrompt()` y `buildChapterGenerationPrompt()`)
- **Implementación:** `backend/src/ssml-helpers.js` (generación SSML de narrativa)
- **Aplicación real:** `backend/content/chapters.json` (Capítulo 1 con todas las técnicas aplicadas)
- **Validación:** `backend/tests/p0-regression.test.js` (tests de coherencia narrativa)

---

## 📌 Conclusión

Estas **19 técnicas + 10 macro-técnicas** no son arbitrarias. Son producto de:
- **Miles de años** de storytelling (Hero's Journey, Story Circle)
- **Investigación clínica** (mapeo a GDS-15, PHQ-9)
- **Diseño para adultos mayores** (respeto, accesibilidad cognitiva)
- **Innovación en XR** (narrativa invisible, evaluación como entretenimiento)

**Usar todas juntas transforma "una skill con opciones" en "una experiencia de transformación personal con detección clínica integrada".**

Eso es lo que hace que Escoge Tu Historia sea diferente.
