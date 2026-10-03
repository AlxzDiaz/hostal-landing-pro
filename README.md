# Landing de hostal · versión completa

> Esta es la versión elaborada del demo. La versión simple está en el repositorio [hostal-landing](https://github.com/AlxzDiaz/hostal-landing).

Página para hostales y hoteles pequeños que reciben reservas por WhatsApp. Es la tercera de la serie (después del [restaurante](../restaurante-landing/GUIA-LANDINGS.md) y la [tienda de ropa](../tienda-ropa-landing/README.md)), pero a propósito **no usa la misma plantilla**: tiene otro estilo visual y otra forma de reservar.

Usa HTML, CSS y JavaScript, sin build ni librerías de animación. Solo hay que subir la carpeta.

```
hostal-landing/
├── index.html          estructura + SEO
├── css/styles.css      estilos (paleta de día y de noche en :root, arriba del archivo)
├── js/config.js        ← DATOS DEL HOSTAL: casi todo se cambia aquí
├── js/main.js          lógica (no hace falta tocarlo)
└── images/
    ├── logo.svg        emblema (árbol de lupuna sobre un sol de guacamayo)
    ├── favicon.svg
    └── habitaciones/ … ilustraciones de respaldo (se ven si una foto no carga)
```

## Qué la hace distinta de los otros demos

| Restaurante y tienda | Hostal |
|---|---|
| Estilo elegante: crema, serif y botones en píldora | Estilo **póster de mochilero**: tipografía grotesca condensada, bordes gruesos, sombras duras y colores de guacamayo (rojo, azul y amarillo) |
| Portada fija | **Portada en vivo**: muestra la hora de Puerto Maldonado y la **temperatura real** ("27 °C afuera · 22 °C en tu cuarto"). La foto y la frase cambian con el **amanecer, el día, el atardecer y la noche** |
| Un solo tema | **Modo noche automático** desde las 7 p. m. (hora de Perú). El visitante puede cambiarlo con el botón de la luna |
| Buscador simple | Buscador con forma de **pase de abordaje** |
| Cuadrícula de tarjetas | **¿Quién viaja?** (mochilero, por trabajo, en pareja, con amigos, en familia): recomienda el cuarto y cuántos hacen falta |
| Vista rápida en ventana | **Showroom**: lista de cuartos a la izquierda y visor grande con foto tipo polaroid y un **recibo con el precio de cada noche** frente al precio en las apps |
| Combo o looks | **Arma tu viaje día por día**: itinerario con los días de la estadía. Los tours de día y de noche se acomodan solos o se eligen tocando un día libre. Respeta el día de llegada y el de salida, y la collpa ocupa 2 días |
| Galería | **Un día cualquiera en la casa**: la galería contada por horas (7 a. m. desayuno → 8 p. m. jardín) |
| Reseñas en tarjetas | **Muro de corcho** con notas escritas a mano y calificaciones como sellos |
| Mapa con dirección | **Línea de metro** con los minutos a cada lugar, además del mapa |
| Preguntas en acordeón | **Chat con la recepcionista**: se toca una pregunta y ella "escribe" la respuesta |
| Bolsa o carrito | **Pase de entrada** con código, ruta "Tu ciudad → PEM" y código de barras. El itinerario viaja en el mensaje |
| Barra inferior | **Dock** de app en el celular |

**Tipografías:** Bricolage Grotesque (títulos y texto) y Caveat (notas a mano). **Íconos:** Phosphor. **Clima:** [Open-Meteo](https://open-meteo.com), gratis y sin clave; si no responde, el dato simplemente no se muestra.

**Paleta "Guacamayo":** rojo `#C8102E` (botones, texto blanco 5.9:1), azul `#1C3F8C`, amarillo `#F5B700` (siempre con texto oscuro) y verde `#0F6B4C`, sobre papel de mapa `#EEF0E7` con curvas de nivel. En modo noche los fondos pasan a verde selva casi negro y las sombras se vuelven amarillas ("luciérnagas").

## Personalizar para un cliente

1. **`js/config.js`:**
   - **Datos básicos:** nombre, año de apertura, WhatsApp (`51` + número, sin espacios), dirección, coordenadas, redes y correo.
   - **Portada en vivo:** foto y frase de cada momento del día, hora en que empieza cada uno y la temperatura del aire acondicionado.
   - **Reservas:** hora de entrada y salida, % de adelanto, horas para cancelar sin costo, medios de pago, temporadas y promo.
   - **¿Quién viaja?:** qué cuarto se recomienda para cada tipo de viajero.
   - **Cuartos, extras y tours:** precios, capacidad, comodidades; en los tours, si son de día o de noche y cuántos días duran.
   - **La casa, ubicación y confianza:** el "día cualquiera", servicios, lugares cercanos, reseñas, nombre de la recepcionista, preguntas y políticas.
2. **`index.html`:** cambia el `<title>`, la `meta description` y la `og:image`.
3. **Logo:** reemplaza `images/logo.svg` y `favicon.svg`.
4. **Colores:** edita las variables de `:root` (día) y de `html[data-cielo="noche"]` (noche) en `css/styles.css`.

### Cómo cargar un cuarto

```js
{ id: "matrimonial", nombre: "Matrimonial con vista al jardín", corto: "Matrimonial",
  precio: 110,          // por noche, domingo a jueves
  precioFinde: 125,     // opcional: noches de viernes y sábado
  precioApps: 129,      // opcional: precio en Booking/Airbnb (se compara en el recibo)
  capacidad: 2, camas: "1 cama queen", m2: 20,
  unidades: 6,          // cuántos cuartos de este tipo tiene el hostal
  etiqueta: "La más pedida",   // opcional: sello sobre la foto
  amenidades: ["aire", "bano", "desayuno", "wifi", "tv"],   // claves de CONFIG.amenidades
  descripcion: "…",
  imagenes: ["images/habitaciones/matrimonial-1.webp", "images/habitaciones/matrimonial-2.webp"] },
```

- Para un dormitorio compartido usa `porCama: true`: se reserva por cama y se sugiere una cama por viajero.
- El `id` no debe tener espacios y no conviene cambiarlo después: con él se guarda la reserva en el navegador.
- Enlace directo a un cuarto: `index.html#cuarto-matrimonial`.

### Cómo cargar un tour

```js
{ id: "sandoval", nombre: "Lago Sandoval", precio: 180,
  momento: "dia",       // "dia" o "noche"
  dias: 1,              // la collpa usa 2: ocupa dos días y la noche en el albergue
  horario: "6 a. m. a 4 p. m.", descripcion: "…", fauna: ["Lobo de río", "Guacamayos"], incluye: "…", imagen: "…" },
```

El día de llegada solo admite tours de noche y el de salida, ninguno. Por eso con 1 noche la página sugiere quedarse más días, y la promo de 3 noches empuja en la misma dirección.

### Fotos

- Las fotos de ejemplo son de [Unsplash](https://unsplash.com) (licencia gratuita, uso comercial permitido) y se cargan desde su CDN.
- Con un cliente real, **usa siempre fotos de sus cuartos**: el huésped compara con lo que encuentra al llegar.
- Para la portada en vivo conviene tener **4 fotos del propio hostal** (amanecer, día, atardecer y noche con luces encendidas). Es lo que más impresiona.
- Cuartos en **4:3 (800 × 600 px)**, en **WebP** de menos de 150 KB. Comprímelas en [squoosh.app](https://squoosh.app).

### Datos que deben ser reales

Las calificaciones, las reseñas, los precios en apps, la promo, el operador de tours y el nombre de la recepcionista son **de ejemplo**. Con un cliente real usa solo sus datos. Si el precio "en las apps" no es el que de verdad aparece en Booking, el huésped lo comprueba en un minuto y deja de confiar.

## Cómo llega la reserva

```
Hola Casa Lupuna 👋, te envío mi pase CL-D5B87V:

📅 Llegada: vie, 16 oct 2026 (desde 1 p. m.)
📅 Salida: mar, 20 oct 2026 (hasta 11 a. m.)
🌙 4 noches · 👥 2 viajeros

🛏️ Cuartos
• 1 x Matrimonial con vista al jardín — S/ 470.00
Descuento Temporada verde (-15%): -S/ 70.50

🗺️ Mi itinerario
• Día 1 (vie, 16 oct): Caimanes de noche x 2 personas — S/ 160.00
• Día 2 (sáb, 17 oct): Lago Sandoval x 2 personas — S/ 360.00
• Día 3 (dom, 18 oct): Collpa de guacamayos x 2 personas — S/ 1300.00
• Día 4 (lun, 19 oct): Collpa de guacamayos (día 2)

➕ Extras
• Recojo del aeropuerto — Gratis (desde 3 noches)

*Total: S/ 2219.50*
Adelanto para confirmar (50%): S/ 1109.75

👤 Nombre: Ana Torres
🪪 DNI: 45678912
🌎 Vengo desde: Lima
🧭 Llego en: Avión
💳 Pago del adelanto: Yape
```

La página **no confirma disponibilidad**: envía una solicitud y el hostal responde por WhatsApp. Las fechas, el pase, el itinerario y el modo día/noche elegido se guardan en el navegador del huésped.

## Probar en tu computadora

Abre una terminal en la carpeta y ejecuta:

```bash
python -m http.server 8000
```

Luego entra a `http://localhost:8000`. Para ver el modo noche de día, toca el botón de la luna.

## Publicar en Netlify (gratis)

1. Entra a [app.netlify.com/drop](https://app.netlify.com/drop) y arrastra la carpeta.
2. En *Site settings → Change site name* ponle un nombre como `casa-lupuna.netlify.app`.
3. Opcional: conecta un dominio `.pe` o `.com`.

Después de publicar, agrega la URL en el **Google Business Profile** (botón "Reservar"), en la bio de Instagram y TikTok, y en un QR para la recepción.

## Checklist antes de entregar

- [ ] Se ve bien en un celular real, de día y de noche
- [ ] "Enviar mi pase" abre WhatsApp con el número correcto y el mensaje completo
- [ ] Los precios por noche, de fin de semana y de temporadas son los reales
- [ ] El precio "en las apps" es el que aparece hoy en Booking/Airbnb (o se quitó)
- [ ] El número de cuartos de cada tipo es el real
- [ ] La promo existe y su fecha de fin es real
- [ ] Los tours, precios, duración y operador están confirmados con el cliente
- [ ] Las fotos (cuartos, portada en vivo y "un día en la casa") son del hostal
- [ ] Las calificaciones y reseñas son reales, y el nombre de la recepcionista también
- [ ] La hora de entrada y salida, el adelanto y la política de cancelación son los del cliente
