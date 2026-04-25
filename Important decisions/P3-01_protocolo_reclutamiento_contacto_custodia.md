# P3-01 Protocolo Formal de Reclutamiento y Contacto Fuera del Motor Narrativo

## Estado
Borrador operativo institucional para revisión y firma por ética, protección de datos y dirección clínica.

## Propósito
Definir un procedimiento separado del motor narrativo para:
- Reclutar participantes.
- Gestionar contacto inicial y seguimiento logístico.
- Obtener consentimiento informado.
- Custodiar datos de contacto fuera del entorno narrativo.

## Alcance
Aplica a:
- Convocatoria institucional.
- Contacto inicial por el equipo humano.
- Consentimiento informado antes de cualquier uso de la experiencia narrativa.
- Custodia separada de datos identificables.

No aplica a:
- Lógica de narrativa interactiva.
- Mapeo clínico dentro del backend narrativo.
- Telemetría anónima o pseudonimizada de sesiones.

## Principios obligatorios
- Separación de finalidades: reclutamiento y seguimiento logístico no se mezclan con la telemetría del juego.
- Minimización: solo se recogen los datos estrictamente necesarios para contactar y gestionar participación.
- Pseudonimización: el motor narrativo trabaja con `pseudonym`, no con datos identificables.
- Acceso restringido: solo personal autorizado puede ver la base de contacto.
- Trazabilidad: cada contacto, consentimiento y baja debe quedar registrado.

## Flujo operativo
### 1. Convocatoria
- La convocatoria se realiza por canales institucionales aprobados.
- El mensaje debe explicar propósito, duración, criterios básicos y riesgos.
- Se ofrece canal de contacto humano para resolver dudas.

### 2. Preselección
- El equipo de reclutamiento verifica criterios de elegibilidad.
- Si la persona no cumple criterios, se cierra el contacto sin derivarlo al motor narrativo.
- Si cumple, se registra un identificador de reclutamiento separado del pseudónimo narrativo.

### 3. Consentimiento informado
- El consentimiento se obtiene antes de iniciar la experiencia.
- Debe incluir:
  - Finalidad del estudio.
  - Tipo de datos recogidos.
  - Riesgos y beneficios.
  - Derecho a retirarse.
  - Tratamiento de datos y custodia separada.
- El consentimiento debe quedar firmado o registrado con evidencia equivalente aprobada.

### 4. Asignación de pseudónimo
- Tras el consentimiento, se genera o asigna un `pseudonym`.
- El `pseudonym` es el único vínculo operativo hacia la sesión narrativa.
- La tabla o repositorio de contacto nunca debe reutilizarse como fuente de narrativa.

### 5. Ejecución narrativa
- El motor narrativo recibe únicamente el `pseudonym` y datos de sesión mínimos.
- No debe recibir teléfono, correo, nombre completo ni dirección.
- Cualquier seguimiento clínico o de riesgo se gestiona con identificadores operativos separados.

### 6. Seguimiento y baja
- Si la persona solicita baja, el equipo de contacto registra la decisión.
- Se corta todo contacto futuro no imprescindible.
- Se conserva únicamente lo exigido por normativa, ética o auditoría.

## Custodia separada de datos
### Registro de contacto
Debe mantenerse fuera del motor narrativo y, idealmente, en un repositorio separado con acceso restringido. Contiene solo:
- Nombre o alias de contacto.
- Medio de contacto.
- Estado de reclutamiento.
- Fecha de consentimiento.
- Estado de baja o retiro.

### Registro narrativo
El backend narrativo conserva:
- `pseudonym`
- sesiones
- decisiones
- auditoría clínica
- eventos de riesgo

No debe almacenar datos de contacto directo salvo obligación operativa explícita y documentada.

## Controles mínimos
- Acceso por rol.
- Registro de auditoría de accesos.
- Separación de llaves, credenciales y backups.
- Retención diferenciada entre contacto y telemetría.
- Revisión periódica de políticas de privacidad.

## Retención
- Datos de contacto: solo el tiempo necesario para coordinación, seguimiento o auditoría autorizada.
- Datos narrativos pseudonimizados: según política de investigación y retención clínica aprobada.
- Audio o identificadores sensibles: solo con consentimiento explícito y política separada.

## Texto de consentimiento base
"Acepto participar de forma voluntaria. Entiendo que mi información de contacto se gestionará por separado de la experiencia narrativa, que mi participación puede retirarse en cualquier momento y que mis datos se tratarán conforme a la política de privacidad y ética del estudio."

## Criterios de aprobación
Antes de usar este protocolo en producción debe existir:
- Visto bueno de ética.
- Visto bueno de protección de datos.
- Visto bueno de dirección clínica.
- Evidencia de que el flujo de custodia separada está implementado.

## Anexos
- El motor narrativo solo debe operar con datos pseudonimizados.
- El equipo de reclutamiento no debe usar métricas narrativas para decisiones de elegibilidad.
- El contacto humano debe ser el único punto de acceso a la identidad real del participante.
