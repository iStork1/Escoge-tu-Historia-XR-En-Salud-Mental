# P3-02 Matriz de Responsabilidades y Escalamiento

## Estado
Borrador operativo para revisión y firma interna.

## Objetivo
Separar con claridad la responsabilidad:
- técnica,
- clínica,
- y de seguimiento de riesgo,

para cada tarea crítica del sistema.

## Principios
- Cada tarea crítica debe tener un dueño único.
- La responsabilidad clínica no se delega al motor narrativo.
- La escalada de riesgo debe estar definida antes de operar en producción.
- Ningún incidente debe quedarse sin responsable asignado.

## Matriz RACI resumida
| Tarea crítica | Responsable (R) | Aprobador (A) | Consultado (C) | Informado (I) |
|---|---|---|---|---|
| Diseño del consentimiento informado | Coordinación clínica | Dirección clínica | Protección de datos | Equipo técnico |
| Custodia de datos de contacto | Protección de datos | Dirección del estudio | Coordinación clínica | Equipo técnico |
| Pseudonimización y separación de tablas | Equipo técnico | Líder técnico | Protección de datos | Coordinación clínica |
| Configuración del motor narrativo | Equipo técnico | Líder técnico | Coordinación clínica | Dirección clínica |
| Revisión de mapeos clínicos | Coordinación clínica | Dirección clínica | Equipo técnico | Protección de datos |
| Revisión de riesgo moderado | Clínica / seguimiento de riesgo | Dirección clínica | Equipo técnico | Coordinación general |
| Revisión de riesgo alto o crítico | Clínica / urgencias designadas | Dirección clínica | Protección de datos | Coordinación general |
| Baja o retiro del participante | Protección de datos | Dirección del estudio | Coordinación clínica | Equipo técnico |
| Auditoría periódica | Dirección del estudio | Ética / cumplimiento | Todas las áreas | Todas las áreas |

## Dueños por tarea crítica
### 1. Reclutamiento y consentimiento
- Dueño operativo: Coordinación clínica.
- Firma final: Dirección clínica.
- Apoyo: Protección de datos.

### 2. Custodia de identidad
- Dueño operativo: Protección de datos.
- Firma final: Dirección del estudio.
- Apoyo: Coordinación clínica.

### 3. Motor narrativo y backend
- Dueño operativo: Equipo técnico.
- Firma final: Líder técnico.
- Apoyo: Coordinación clínica cuando haya impacto clínico.

### 4. Seguimiento de riesgo
- Dueño operativo: Clínica / seguimiento de riesgo.
- Firma final: Dirección clínica.
- Apoyo: Equipo técnico para soporte de trazabilidad.

### 5. Auditoría y cumplimiento
- Dueño operativo: Dirección del estudio.
- Firma final: Ética / cumplimiento.
- Apoyo: Protección de datos y coordinación clínica.

## Flujo de escalamiento firmado
### Nivel 0: Operativo normal
- No hay riesgo relevante.
- El equipo técnico mantiene la operación.
- No se involucra al canal clínico salvo revisión periódica.

### Nivel 1: Riesgo moderado
- El sistema registra el evento.
- Se notifica al responsable clínico designado.
- Se revisa dentro del SLA acordado.
- Se documenta la resolución.

### Nivel 2: Riesgo alto
- Se activa notificación prioritaria al canal clínico.
- Se informa a dirección clínica.
- Se congela cualquier automatización no esencial sobre ese caso.
- Se registra la decisión y la hora de respuesta.

### Nivel 3: Riesgo crítico
- Se activa el protocolo de urgencia definido por la institución.
- El motor narrativo no toma decisiones clínicas automáticas.
- Se prioriza contacto humano y trazabilidad completa.

## Reglas de firma
Antes de producción, cada responsable debe firmar que conoce:
- su alcance,
- su tiempo de respuesta,
- y el canal de escalamiento.

Firmas requeridas:
- Líder técnico
- Coordinación clínica
- Protección de datos
- Dirección del estudio
- Dirección clínica

## Tiempos de respuesta sugeridos
- Riesgo moderado: revisión el mismo día hábil.
- Riesgo alto: revisión prioritaria dentro de la ventana definida por el protocolo clínico.
- Riesgo crítico: activación inmediata del circuito de urgencia.

## Notas operativas
- El motor narrativo puede detectar y registrar señales, pero no sustituye juicio clínico.
- La custodia de identidad y el seguimiento clínico deben permanecer separados.
- Los cambios de dueño o escalamiento deben dejar constancia en acta o ticket operativo.
