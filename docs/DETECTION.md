# Metodo De Deteccion

## Objetivo

Detectar si una escucha corta contiene un toque conocido sin inventar coincidencias cuando la señal es ruido, silencio o evidencia insuficiente.

## Enfoque

El detector mezcla ideas de:

- fingerprints de audio por coherencia local
- comparacion ritmica por golpes e intervalos
- segmentos fuertes por referencia
- landmarks espectrales ligeros para reforzar separacion entre toques parecidos

No se apoya en un modelo entrenado. Es un sistema heuristico y explicable.

## Flujo De Decision

1. La app captura audio desde microfono.
2. Analiza si la señal es usable.
3. Extrae varias ventanas activas de la captura.
4. Compara la captura contra:
   - la referencia completa
   - segmentos fuertes de 8, 10 y 12 segundos
5. Agrega evidencia de varias variantes por referencia.
6. Decide entre:
   - `Confirmado`
   - `Probable`
   - `Probable ambiguo`
   - `Sin deteccion fiable`

## Señales Que Usa

- RMS y pico
- envolvente
- perfil de onset
- golpes detectados
- fingerprints por intervalos
- tempo estimado
- estabilidad ritmica
- calidad de señal
- perfil espectral ligero
- flujo espectral
- landmarks espectrales

## Perfil `Micro real`

El modo `Micro real` esta diseñado para:

- altavoz -> sala -> microfono
- eco
- coloracion del altavoz
- pequeñas deformaciones del ritmo y del timbre

Por eso:

- depende menos del voto bruto de fingerprint exacto
- depende mas de patron, envolvente, intervalos y timbre
- es mas conservador al confirmar

## Estados De Resultado

### Confirmado

El mejor candidato domina con evidencia suficiente y margen razonable.

### Probable

El mejor candidato es fuerte y util, pero no llega todavia al nivel de confirmacion plena.

### Probable ambiguo

El mejor candidato sigue siendo el mas razonable, pero otro toque queda demasiado cerca como para confirmarlo con seguridad.

### Sin deteccion fiable

La captura no tiene calidad suficiente o no existe un ganador defendible.

## Segmentos Fuertes

Cada referencia guarda:

- una huella completa
- varios segmentos fuertes

Esos segmentos no se eligen solo por energia. Tambien se ordenan por distintividad frente al resto de referencias. Esto evita depender de una unica parte del toque.

## Capturas Reales

Antes de comparar, la app hace un preprocesado suave:

- centra la señal
- estima ruido de fondo
- atenúa ruido bajo entre golpes

No amplifica artificialmente capturas debiles. La energia sigue sirviendo para rechazar señales pobres.

## Criterio De Diseño

El detector esta deliberadamente sesgado a:

- evitar falsos positivos
- aceptar `Probable` antes que confirmar mal
- pedir repetir una escucha cuando dos toques estan demasiado cerca

En este proyecto, una ambigüedad razonable es preferible a una confirmacion incorrecta.
