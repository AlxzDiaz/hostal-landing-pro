/* ==========================================================
   Landing de hostal · lógica
   Lee los datos de CONFIG (js/config.js) y arma la página.
   ========================================================== */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const soles = (n) => "S/ " + (Number.isInteger(n) ? n : n.toFixed(2));   // para la página
  const solesExacto = (n) => "S/ " + n.toFixed(2);                          // para el mensaje
  const redondear = (n) => Math.round(n * 100) / 100;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const waLink = (msg) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const FALLBACK_HAB = "images/habitaciones/habitacion.svg";
  const FALLBACK_TOUR = "images/habitaciones/tour.svg";
  const FALLBACK_LUGAR = "images/habitaciones/instalacion.svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");

  const HABS = new Map(CONFIG.habitaciones.map((h) => [h.id, h]));
  const TOURS = new Map(CONFIG.tours.map((t) => [t.id, t]));
  const EXTRAS = new Map(CONFIG.extras.map((x) => [x.id, x]));
  const VIAJEROS = new Map(CONFIG.viajeros.map((v) => [v.id, v]));
  const AMEN = CONFIG.amenidades;
  const MAX_NOCHES = 30, MAX_HUESPEDES = 16;

  /* ---------- 0. Si una foto no carga, usar la ilustración de respaldo ---------- */
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName === "IMG" && img.dataset.fallback && !img.src.endsWith(img.dataset.fallback)) img.src = img.dataset.fallback;
  }, true);

  /* ---------- 1. Fechas y horas (todo en hora de Perú, fechas como "AAAA-MM-DD") ---------- */
  const hoyLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const aUTC = (f) => new Date(f + "T00:00:00Z");
  const sumarDias = (f, n) => { const d = aUTC(f); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const difDias = (a, b) => Math.round((aUTC(b) - aUTC(a)) / 86400000);
  const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !isNaN(aUTC(f));
  const fmt = (f, opciones) => new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", ...opciones }).format(aUTC(f)).replace(/\./g, "");
  const fechaCorta = (f) => fmt(f, { weekday: "short", day: "numeric", month: "short" });          // "vie, 16 oct"
  const fechaLarga = (f) => fmt(f, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const diaSemana = (f) => fmt(f, { weekday: "short" });
  const aMinutos = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const formatoHora = (hhmm) => {
    let [h, m] = hhmm.split(":").map(Number);
    const sufijo = h >= 12 ? "p. m." : "a. m.";
    h = h % 12 || 12;
    return m === 0 ? `${h} ${sufijo}` : `${h}:${String(m).padStart(2, "0")} ${sufijo}`;
  };
  const horaLima = () => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

  /* ---------- 2. Estado (se guarda en el navegador) ---------- */
  const CLAVE = "hostal-" + CONFIG.nombre;
  const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(`${CLAVE}-${k}`)) ?? def; } catch (_) { return def; } };
  const escribir = (k, v) => { try { localStorage.setItem(`${CLAVE}-${k}`, JSON.stringify(v)); } catch (_) { /* almacenamiento no disponible */ } };

  const est = (() => {
    const guardado = leer("estadia", {});
    const hoy = hoyLima();
    const llegada = esFecha(guardado.llegada) && guardado.llegada >= hoy ? guardado.llegada : hoy;
    let salida = esFecha(guardado.salida) ? guardado.salida : sumarDias(llegada, 1);
    if (difDias(llegada, salida) < 1 || difDias(llegada, salida) > MAX_NOCHES) salida = sumarDias(llegada, 1);
    const huespedes = Math.min(MAX_HUESPEDES, Math.max(1, Number(guardado.huespedes) || 2));
    return { llegada, salida, huespedes, viajero: VIAJEROS.has(guardado.viajero) ? guardado.viajero : null };
  })();

  const pase = new Map(leer("cuartos", []).filter(([id, n]) => HABS.has(id) && n > 0)
    .map(([id, n]) => [id, Math.min(n, HABS.get(id).unidades)]));
  // Itinerario: tour → { fecha en que empieza, personas }
  let itinerario = new Map(leer("itinerario", []).filter(([id, v]) => TOURS.has(id) && v && esFecha(v.fecha) && v.personas > 0));
  const extrasSel = new Set(leer("extras", []).filter((id) => EXTRAS.has(id)));
  const guardar = () => {
    escribir("estadia", est);
    escribir("cuartos", [...pase]);
    escribir("itinerario", [...itinerario]);
    escribir("extras", [...extrasSel]);
  };

  /* ---------- 3. Precios ---------- */
  const noches = () => Array.from({ length: difDias(est.llegada, est.salida) }, (_, i) => sumarDias(est.llegada, i));
  const temporadaDe = (f) => CONFIG.temporadas.find((t) => f >= t.desde && f <= t.hasta);

  function precioNoche(h, f) {
    const dia = aUTC(f).getUTCDay();
    const finde = (dia === 5 || dia === 6) && Boolean(h.precioFinde);
    const base = finde ? h.precioFinde : h.precio;
    const t = temporadaDe(f);
    return { fecha: f, finde, temporada: t, precio: t ? Math.round(base * (1 + t.recargo / 100)) : base };
  }
  const detalleEstadia = (h) => noches().map((f) => precioNoche(h, f));
  const precioEstadia = (h) => detalleEstadia(h).reduce((s, n) => s + n.precio, 0);

  const promo = CONFIG.promo;
  const finPromo = promo ? new Date(promo.fin).getTime() : 0;
  const promoVigente = () => Boolean(promo) && Date.now() < finPromo;
  const promoAplica = () => promoVigente() && noches().length >= promo.minNoches;
  const conPromo = (monto) => (promoAplica() ? redondear(monto * (1 - promo.porcentaje / 100)) : monto);

  function precioExtra(x) {
    const n = noches().length;
    if (x.gratisDesdeNoches && n >= x.gratisDesdeNoches) return 0;
    return { unico: 1, noche: n, personaNoche: n * est.huespedes }[x.cobro] * x.precio;
  }

  function calcular() {
    const n = noches().length;
    let cuartos = 0, capacidad = 0, unidades = 0;
    pase.forEach((cant, id) => {
      const h = HABS.get(id);
      cuartos += cant * precioEstadia(h);
      capacidad += cant * h.capacidad;
      unidades += cant;
    });
    const descuento = promoAplica() ? redondear(cuartos * promo.porcentaje / 100) : 0;
    let tours = 0;
    itinerario.forEach(({ personas }, id) => { tours += personas * TOURS.get(id).precio; });
    const extras = pase.size ? [...extrasSel].reduce((s, id) => s + precioExtra(EXTRAS.get(id)), 0) : 0;
    const total = redondear(cuartos - descuento + tours + extras);
    return { n, cuartos, descuento, tours, extras, total, adelanto: redondear(total * CONFIG.adelanto / 100), capacidad, unidades, items: pase.size + itinerario.size };
  }

  /* ---------- 4. Datos generales ---------- */
  $$("[data-config]").forEach((el) => { el.textContent = CONFIG[el.dataset.config]; });
  $$("[data-anfitriona]").forEach((el) => { el.textContent = CONFIG.anfitriona.nombre; });
  $$("[data-wa]").forEach((a) => {
    a.href = waLink(a.dataset.wa || `Hola ${CONFIG.nombre}, quiero hacer una consulta.`);
    a.target = "_blank";
    a.rel = "noopener";
  });
  $$("[data-red]").forEach((a) => {
    const url = CONFIG.redes[a.dataset.red];
    if (url) a.href = url; else a.remove();
  });
  $("#tel").href = "tel:" + CONFIG.telefono.replace(/\s/g, "");
  $("#email").href = "mailto:" + CONFIG.email;
  $("#anio").textContent = new Date().getFullYear();
  $("#direccion").textContent = CONFIG.direccion;
  $("#footer-direccion").textContent = `${CONFIG.direccion}, ${CONFIG.ciudad}. Hostal familiar con piscina, aire acondicionado y tours a Tambopata.`;
  $("#operador").textContent = CONFIG.operador;
  $("#select-pago").innerHTML = CONFIG.pagos.map((p) => `<option>${esc(p)}</option>`).join("");
  $("#nota-pago").textContent = `No pagas aquí: te confirmamos la disponibilidad y te enviamos los datos para el adelanto (${CONFIG.adelanto}%) por WhatsApp.`;
  $("#footer-horarios").innerHTML = [
    ["ph-sign-in", `Entrada desde ${formatoHora(CONFIG.checkin)}`],
    ["ph-sign-out", `Salida hasta ${formatoHora(CONFIG.checkout)}`],
    ["ph-bell-simple", "Recepción 24 horas"],
  ].map(([i, t]) => `<li><i class="ph ${i}" aria-hidden="true"></i><span>${t}</span></li>`).join("");

  // Calificaciones como sellos (portada y muro)
  const sellosRating = CONFIG.ratings.map((r, i) =>
    `<li class="sello ${i % 2 ? "sello--azul" : "sello--rojo"}"><b>${r.valor.toFixed(1)}</b><span>/${r.max} en ${esc(r.fuente)}</span><small>${r.total} reseñas</small></li>`).join("");
  $("#ratings").innerHTML = sellosRating + `<li class="sello sello--amarillo"><b>24 h</b><span>recepción</span><small>abierta siempre</small></li>`;
  $("#calificaciones").innerHTML = `<ul class="sellos-portada">${sellosRating}</ul>`;

  /* ---------- 5. Portada en vivo: hora, cielo y clima de Puerto Maldonado ---------- */
  const MOMENTOS = Object.entries(CONFIG.portada).sort((a, b) => aMinutos(a[1].desde) - aMinutos(b[1].desde));
  function momentoReal() {
    const ahora = aMinutos(horaLima());
    let actual = MOMENTOS[MOMENTOS.length - 1][0];       // antes del primero: sigue siendo de noche
    MOMENTOS.forEach(([id, m]) => { if (ahora >= aMinutos(m.desde)) actual = id; });
    return actual;
  }
  let cieloManual = leer("cielo", null);                 // "dia" | "noche" | null (automático)
  const temaReal = () => (momentoReal() === "noche" ? "noche" : "dia");

  function pintarCielo() {
    const tema = cieloManual || temaReal();
    const real = momentoReal();
    const momento = tema === "noche" ? "noche" : real === "noche" ? "dia" : real;
    document.documentElement.dataset.cielo = tema;
    document.documentElement.dataset.momento = momento;
    $('meta[name="theme-color"]').content = tema === "noche" ? "#0B1512" : "#121C18";
    const btn = $("#cielo-btn");
    btn.setAttribute("aria-pressed", String(tema === "noche"));
    btn.innerHTML = `<i class="ph-fill ${tema === "noche" ? "ph-sun" : "ph-moon-stars"}" aria-hidden="true"></i><span class="sr-only">${tema === "noche" ? "Cambiar a modo día" : "Cambiar a modo noche"}</span>`;
    btn.title = tema === "noche" ? "Modo día" : "Modo noche";

    const p = CONFIG.portada[momento];
    const img = $("#portada-img");
    if (img.dataset.momento !== momento) {
      img.dataset.momento = momento;
      img.classList.add("cambiando");
      img.onload = () => img.classList.remove("cambiando");
      img.src = p.imagen;
    }
    $("#frase").textContent = p.frase;
    const [h, m] = horaLima().split(":");
    $("#hora-lima").textContent = formatoHora(`${h}:${m}`);
  }
  $("#cielo-btn").addEventListener("click", () => {
    const actual = cieloManual || temaReal();
    const nuevo = actual === "noche" ? "dia" : "noche";
    cieloManual = nuevo === temaReal() ? null : nuevo;    // si coincide con la hora real, vuelve a ser automático
    escribir("cielo", cieloManual);
    pintarCielo();
  });

  // Temperatura real (Open-Meteo: gratis y sin clave). Si falla, simplemente no se muestra.
  const CLIMA = [
    [[0], "despejado", "ph-sun"], [[1, 2], "parcialmente nublado", "ph-cloud-sun"], [[3], "nublado", "ph-cloud"],
    [[45, 48], "con neblina", "ph-cloud-fog"], [[51, 53, 55, 56, 57], "con llovizna", "ph-cloud-rain"],
    [[61, 63, 65, 66, 67, 80, 81, 82], "con lluvia", "ph-cloud-rain"], [[95, 96, 99], "con tormenta", "ph-cloud-lightning"],
  ];
  async function cargarClima() {
    if (!CONFIG.clima) return;
    const { lat, lng } = CONFIG.ubicacion;
    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 6000);
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,is_day&timezone=America%2FLima`, { signal: control.signal });
      const { current } = await r.json();
      const temp = Math.round(current.temperature_2m);
      const [, texto, icono] = CLIMA.find(([codigos]) => codigos.includes(current.weather_code)) || [null, "", "ph-thermometer"];
      const iconoFinal = icono === "ph-sun" && !current.is_day ? "ph-moon" : icono;
      const el = $("#clima");
      el.innerHTML = `<i class="ph-fill ${iconoFinal}" aria-hidden="true"></i>${temp} °C ${esc(texto)}${temp >= 26 ? ` · <b>${CONFIG.temperaturaCuarto} °C en tu cuarto</b>` : ""}`;
      el.hidden = false;
    } catch (_) { /* sin conexión o servicio caído: no se muestra */ }
    clearTimeout(espera);
  }

  /* ---------- 6. Fechas y viajeros (hay varios selectores, todos sincronizados) ---------- */
  const resumenFechas = () =>
    `${fechaCorta(est.llegada)} → ${fechaCorta(est.salida)} · ${plural(noches().length, "noche", "noches")} · ${plural(est.huespedes, "viajero", "viajeros")}`;

  function pintarFechas() {
    const hoy = hoyLima();
    $$('[data-fecha="llegada"]').forEach((i) => { i.min = hoy; i.max = sumarDias(hoy, 365); i.value = est.llegada; });
    $$('[data-fecha="salida"]').forEach((i) => { i.min = sumarDias(est.llegada, 1); i.max = sumarDias(est.llegada, MAX_NOCHES); i.value = est.salida; });
    $$("[data-huespedes-n]").forEach((s) => { s.textContent = est.huespedes; });
    $$('[data-huespedes="-1"]').forEach((b) => { b.disabled = est.huespedes <= 1; });
    $$('[data-huespedes="1"]').forEach((b) => { b.disabled = est.huespedes >= MAX_HUESPEDES; });
    $$("[data-resumen-fechas]").forEach((p) => { p.textContent = resumenFechas(); });
  }

  function cambiarFecha(campo, valor) {
    const hoy = hoyLima();
    if (!esFecha(valor)) return pintarFechas();          // campo borrado: se restaura
    if (campo === "llegada") {
      est.llegada = valor < hoy ? hoy : valor;
      const n = difDias(est.llegada, est.salida);
      if (n < 1 || n > MAX_NOCHES) est.salida = sumarDias(est.llegada, Math.max(1, Math.min(n, MAX_NOCHES)));
    } else {
      est.salida = valor;
      if (difDias(est.llegada, est.salida) < 1) est.salida = sumarDias(est.llegada, 1);
      if (difDias(est.llegada, est.salida) > MAX_NOCHES) est.salida = sumarDias(est.llegada, MAX_NOCHES);
    }
    alCambiarEstadia();
  }

  function alCambiarEstadia() {
    reacomodarItinerario();
    guardar();
    pintarFechas();
    pintarPromo();
    pintarRecomendacion();
    pintarCuartos();
    pintarViaje();
    actualizarPase();
  }

  document.addEventListener("change", (e) => {
    const campo = e.target.dataset?.fecha;
    if (campo) cambiarFecha(campo, e.target.value);
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-huespedes]");
    if (!b) return;
    const antes = est.huespedes;
    est.huespedes = Math.min(MAX_HUESPEDES, Math.max(1, est.huespedes + Number(b.dataset.huespedes)));
    // Los tours que iban "para todos" siguen siendo para todos
    itinerario.forEach((v) => { if (v.personas === antes) v.personas = est.huespedes; });
    alCambiarEstadia();
  });

  const irA = (sel) => $(sel).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  $("#buscador").addEventListener("submit", (e) => { e.preventDefault(); irA("#cuartos"); });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-ir-buscador]")) {
      if ($("#pase").open) $("#pase").close();
      irA("#inicio");
      setTimeout(() => $('#buscador [data-fecha="llegada"]').focus({ preventScroll: true }), reduceMotion ? 0 : 500);
    }
    const ir = e.target.closest("[data-ir]");
    if (ir) { if ($("#pase").open) $("#pase").close(); irA(ir.dataset.ir); }
  });

  // Promo en el pase de la portada
  let promoTimer;
  function pintarPromo() {
    const chip = $("#chip-promo");
    if (!promoVigente()) { chip.hidden = true; clearInterval(promoTimer); return; }
    const resta = finPromo - Date.now();
    const d = Math.floor(resta / 86400000), h = Math.floor(resta / 3600000) % 24, m = Math.floor(resta / 60000) % 60;
    chip.hidden = false;
    chip.classList.toggle("activa", promoAplica());
    $("#promo-txt").textContent = promoAplica()
      ? `${promo.titulo}: -${promo.porcentaje}% aplicado · termina en ${d} d ${h} h`
      : `${promo.titulo}: -${promo.porcentaje}% desde ${promo.minNoches} noches · termina en ${d} d ${h} h ${m} min`;
  }

  /* ---------- 7. ¿Quién viaja? (recomendador) ---------- */
  $("#quien").innerHTML = CONFIG.viajeros.map((v) => `
    <button type="button" class="quien__op" role="radio" aria-checked="false" data-viajero="${v.id}">
      <i class="ph-fill ${v.icono}" aria-hidden="true"></i><span>${esc(v.nombre)}</span>
    </button>`).join("");

  const cantidadPara = (h, huespedes) => Math.min(h.unidades, h.porCama ? huespedes : Math.ceil(huespedes / h.capacidad));

  function pintarRecomendacion() {
    $$("[data-viajero]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.viajero === est.viajero)));
    const p = $("#recomendacion");
    const v = VIAJEROS.get(est.viajero);
    if (!v) { p.hidden = true; return; }
    const h = HABS.get(v.habitacion);
    const cant = cantidadPara(h, est.huespedes);
    const total = conPromo(cant * precioEstadia(h));
    const entra = cant * h.capacidad >= est.huespedes;
    p.hidden = false;
    p.innerHTML = `<span class="nota-mano">Nuestra recomendación →</span>
      <span>Para ${plural(est.huespedes, "viajero", "viajeros")}: <b>${cant > 1 ? `${cant} × ` : ""}${esc(h.nombre)}</b> · ${soles(total)} por ${plural(noches().length, "noche", "noches")}${entra ? "" : ". Escríbenos y te armamos una opción para el grupo."}</span>
      <button type="button" class="btn btn--amarillo" data-recomendado="${h.id}" data-cant="${cant}"><i class="ph ph-ticket" aria-hidden="true"></i>${pase.get(h.id) === cant ? "Ya está en tu pase" : "Agregar a mi pase"}</button>`;
  }

  $("#quien").addEventListener("click", (e) => {
    const b = e.target.closest("[data-viajero]");
    if (!b) return;
    const v = VIAJEROS.get(b.dataset.viajero);
    const antes = est.huespedes;
    est.viajero = v.id;
    // "Con amigos" y "En familia" respetan el número si ya era mayor
    est.huespedes = v.huespedes >= 2 && antes > v.huespedes ? antes : v.huespedes;
    itinerario.forEach((t) => { if (t.personas === antes) t.personas = est.huespedes; });
    sel.id = v.habitacion;
    sel.cantidad = cantidadPara(HABS.get(v.habitacion), est.huespedes);
    sel.foto = 0;
    alCambiarEstadia();
    pintarVisor();
  });
  $("#recomendacion").addEventListener("click", (e) => {
    const b = e.target.closest("[data-recomendado]");
    if (!b) return;
    const h = HABS.get(b.dataset.recomendado);
    pase.set(h.id, Number(b.dataset.cant));
    alCambiarEstadia();
    pintarVisor();
    pop($$("[data-contador]"));
    avisar(`${h.corto} en tu pase`, "ph-ticket");
  });

  /* ---------- 8. Showroom de cuartos ---------- */
  const lista = $("#lista-cuartos");
  const sel = { id: CONFIG.habitaciones[0].id, foto: 0, cantidad: 1 };

  lista.innerHTML = CONFIG.habitaciones.map((h, i) => `
    <button type="button" class="cuarto" role="tab" id="tab-${h.id}" data-cuarto="${h.id}" aria-controls="visor" aria-selected="false" tabindex="-1">
      <span class="cuarto__num">${String(i + 1).padStart(2, "0")}</span>
      <span class="cuarto__txt"><b><span class="cuarto__largo">${esc(h.nombre)}</span><span class="cuarto__corto">${esc(h.corto)}</span></b><small>${h.porCama ? "Por cama" : `Hasta ${h.capacidad}`} · ${h.m2} m²</small></span>
      <span class="cuarto__precio" data-precio-cuarto="${h.id}"></span>
    </button>`).join("");

  function pintarCuartos() {
    const n = noches().length;
    $$("[data-precio-cuarto]").forEach((el) => {
      const h = HABS.get(el.dataset.precioCuarto);
      const enPase = pase.get(h.id);
      el.innerHTML = `<b>${soles(conPromo(precioEstadia(h)))}</b><small>${plural(n, "noche", "noches")}</small>${enPase ? `<em class="cuarto__check"><i class="ph-fill ph-check" aria-hidden="true"></i>${enPase}</em>` : ""}`;
    });
    $$("[data-cuarto]").forEach((b) => {
      const activo = b.dataset.cuarto === sel.id;
      b.setAttribute("aria-selected", String(activo));
      b.tabIndex = activo ? 0 : -1;
    });
    $("#visor").setAttribute("aria-labelledby", `tab-${sel.id}`);
    if (HABS.has(sel.id)) pintarVisor();
  }

  function elegirCuarto(id, enfocar) {
    if (!HABS.has(id)) return;
    const h = HABS.get(id);
    Object.assign(sel, { id, foto: 0, cantidad: pase.get(id) || cantidadPara(h, h.porCama ? est.huespedes : 1) });
    pintarCuartos();
    const tab = $(`#tab-${id}`);
    if (enfocar) tab.focus();
    // En celular la lista es horizontal: centra la pestaña elegida
    lista.scrollTo({ left: tab.offsetLeft - (lista.clientWidth - tab.offsetWidth) / 2, behavior: reduceMotion ? "auto" : "smooth" });
  }
  lista.addEventListener("click", (e) => { const b = e.target.closest("[data-cuarto]"); if (b) elegirCuarto(b.dataset.cuarto); });
  lista.addEventListener("keydown", (e) => {
    const teclas = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(e.key in teclas)) return;
    e.preventDefault();
    const ids = CONFIG.habitaciones.map((h) => h.id);
    elegirCuarto(ids[(ids.indexOf(sel.id) + teclas[e.key] + ids.length) % ids.length], true);
  });

  function pintarVisor() {
    const h = HABS.get(sel.id);
    const [a, b] = [h.imagenes[sel.foto % h.imagenes.length], h.imagenes[(sel.foto + 1) % h.imagenes.length]];
    const img = $("#visor-img");
    if (img.getAttribute("src") !== a) { img.src = a; img.classList.remove("entra"); void img.offsetWidth; img.classList.add("entra"); }
    img.alt = h.nombre;
    img.dataset.fallback = FALLBACK_HAB;
    $("#visor-img2").src = b;
    $("#visor-img2").alt = "";
    $("#visor-img2").dataset.fallback = FALLBACK_HAB;
    $("#visor-polaroid").hidden = h.imagenes.length < 2;
    const etiqueta = $("#visor-etiqueta");
    etiqueta.hidden = !h.etiqueta;
    etiqueta.textContent = h.etiqueta || "";

    $("#visor-nombre").textContent = h.nombre;
    $("#visor-desc").textContent = h.descripcion;
    $("#visor-datos").innerHTML = [
      ["ph-users", h.porCama ? "Se reserva por cama" : `Hasta ${plural(h.capacidad, "persona", "personas")}`],
      ["ph-bed", h.camas],
      ["ph-frame-corners", `${h.m2} m²`],
    ].map(([i, t]) => `<li><i class="ph ${i}" aria-hidden="true"></i>${esc(t)}</li>`).join("");
    $("#visor-amenidades").innerHTML = h.amenidades.filter((k) => AMEN[k]).map((k) =>
      `<li><i class="ph ${AMEN[k].icono}" aria-hidden="true"></i>${esc(AMEN[k].nombre)}</li>`).join("");

    // Recibo: precio de cada noche, promo y comparación con las apps
    const detalle = detalleEstadia(h);
    $("#visor-noches").innerHTML = detalle.map((d) => `<li>
      <span>${fechaCorta(d.fecha)}${d.temporada ? ` <em>${esc(d.temporada.nombre)}</em>` : d.finde ? " <em>fin de semana</em>" : ""}</span>
      <span class="puntos" aria-hidden="true"></span><b>${soles(d.precio)}</b></li>`).join("");
    const unidad = h.porCama ? ["cama", "camas"] : ["cuarto", "cuartos"];
    const bruto = sel.cantidad * detalle.reduce((s, d) => s + d.precio, 0);
    const neto = conPromo(bruto);
    const apps = h.precioApps ? h.precioApps * detalle.length * sel.cantidad : 0;
    $("#visor-total").innerHTML = `
      ${sel.cantidad > 1 ? `<p class="recibo__linea"><span>× ${plural(sel.cantidad, unidad[0], unidad[1])}</span><b>${soles(bruto)}</b></p>` : ""}
      ${promoAplica() ? `<p class="recibo__linea recibo__linea--promo"><span>${esc(promo.titulo)} (-${promo.porcentaje}%)</span><b>-${soles(redondear(bruto - neto))}</b></p>` : ""}
      <p class="recibo__total"><span>Total directo</span><b>${soles(neto)}</b></p>
      ${apps > neto ? `<p class="recibo__apps"><s>En las apps: ${soles(apps)}</s><span class="sello sello--verde">Ahorras ${soles(redondear(apps - neto))}</span></p>` : ""}`;

    $("#visor-cantidad").textContent = sel.cantidad;
    $("#visor-menos").disabled = sel.cantidad <= 1;
    $("#visor-mas").disabled = sel.cantidad >= h.unidades;
    $("#visor-agregar").lastElementChild.textContent = pase.get(h.id) === sel.cantidad ? "Ya está en tu pase" : pase.has(h.id) ? "Actualizar mi pase" : "Agregar a mi pase";
    $("#visor-unidades").textContent = `Hay ${plural(h.unidades, unidad[0], unidad[1])} de este tipo.`;
    $("#visor-preguntar").href = waLink(`Hola ${CONFIG.nombre}, ¿tienen libre ${sel.cantidad > 1 ? `${sel.cantidad} ${unidad[1]}` : "el cuarto"} ${h.nombre} del ${fechaCorta(est.llegada)} al ${fechaCorta(est.salida)} para ${plural(est.huespedes, "persona", "personas")}?`);
  }

  const cambiarFoto = () => { sel.foto += 1; pintarVisor(); };
  $("#visor-foto").addEventListener("click", cambiarFoto);
  $("#visor-polaroid").addEventListener("click", cambiarFoto);
  $("#visor-menos").addEventListener("click", () => { sel.cantidad = Math.max(1, sel.cantidad - 1); pintarVisor(); });
  $("#visor-mas").addEventListener("click", () => { sel.cantidad = Math.min(HABS.get(sel.id).unidades, sel.cantidad + 1); pintarVisor(); });
  $("#visor-agregar").addEventListener("click", () => {
    const h = HABS.get(sel.id);
    const habia = pase.has(h.id);
    pase.set(h.id, sel.cantidad);
    alCambiarEstadia();
    pop($$("[data-contador]"));
    avisar(habia ? "Pase actualizado" : `${h.corto} en tu pase`, "ph-ticket");
  });
  $("#visor-compartir").addEventListener("click", async () => {
    const h = HABS.get(sel.id);
    const url = `${location.origin}${location.pathname}#cuarto-${h.id}`;
    const texto = $("#visor-compartir span");
    try {
      if (navigator.share) { await navigator.share({ title: h.nombre, text: `Mira este cuarto de ${CONFIG.nombre}`, url }); return; }
      await navigator.clipboard.writeText(url);
      texto.textContent = "¡Enlace copiado!";
    } catch (_) {
      texto.textContent = "No se pudo copiar";
    }
    setTimeout(() => { texto.textContent = "Compartir"; }, 2000);
  });

  /* ---------- 9. Arma tu viaje: itinerario día por día ---------- */
  // Días del viaje: del de llegada al de salida (incluidos)
  const diasViaje = () => Array.from({ length: noches().length + 1 }, (_, i) => sumarDias(est.llegada, i));

  // Qué tour ocupa cada momento: "fecha|dia" o "fecha|noche"
  function ocupacion(mapa = itinerario) {
    const m = new Map();
    mapa.forEach(({ fecha }, id) => {
      const t = TOURS.get(id);
      if (t.momento === "noche") { m.set(`${fecha}|noche`, { id, parte: 0 }); return; }
      for (let k = 0; k < t.dias; k++) {
        const f = sumarDias(fecha, k);
        m.set(`${f}|dia`, { id, parte: k });
        if (k < t.dias - 1) m.set(`${f}|noche`, { id, parte: k, albergue: true });
      }
    });
    return m;
  }

  // ¿El tour puede empezar esa fecha? Llegada: solo noche. Salida: nada.
  function cabe(t, fecha, mapa = itinerario) {
    const dias = diasViaje(), ultimo = dias.length - 1, i = dias.indexOf(fecha);
    if (i < 0) return false;
    const ocup = ocupacion(mapa);
    const libre = (f, s) => { const o = ocup.get(`${f}|${s}`); return !o || o.id === t.id; };
    if (t.momento === "noche") return i < ultimo && libre(fecha, "noche");
    for (let k = 0; k < t.dias; k++) {
      const j = i + k;
      if (j < 1 || j > ultimo - 1 || !libre(dias[j], "dia")) return false;
      if (k < t.dias - 1 && !libre(dias[j], "noche")) return false;
    }
    return true;
  }
  const primerDiaLibre = (t, mapa = itinerario) => diasViaje().find((f) => cabe(t, f, mapa));
  const nochesMinimas = (t) => (t.momento === "noche" ? 1 : t.dias + 1);

  // Al cambiar las fechas, cada tour intenta quedarse en su día; si no entra, busca otro
  function reacomodarItinerario() {
    const nuevo = new Map();
    const fuera = [];
    [...itinerario].sort((a, b) => a[1].fecha.localeCompare(b[1].fecha)).forEach(([id, v]) => {
      const t = TOURS.get(id);
      const fecha = cabe(t, v.fecha, nuevo) ? v.fecha : primerDiaLibre(t, nuevo);
      if (fecha) nuevo.set(id, { ...v, fecha }); else fuera.push(t.nombre);
    });
    itinerario = nuevo;
    if (fuera.length) avisar(`No entra en tus fechas: ${fuera.join(", ")}`, "ph-warning-circle");
  }

  function agregarTour(t, fecha) {
    const f = fecha || primerDiaLibre(t);
    if (!f) {
      avisar(noches().length < nochesMinimas(t) ? `${t.nombre} necesita ${plural(nochesMinimas(t), "noche", "noches")} de estadía` : `No queda un día libre para ${t.nombre}`, "ph-warning-circle");
      return;
    }
    itinerario.set(t.id, { fecha: f, personas: itinerario.get(t.id)?.personas || est.huespedes });
    abierto = null;
    guardar();
    pintarViaje();
    actualizarPase();
    pop($$("[data-contador]"));
    avisar(`${t.nombre} · ${fechaCorta(f)}`, "ph-map-pin");
  }
  function quitarTour(id) {
    itinerario.delete(id);
    guardar();
    pintarViaje();
    actualizarPase();
  }

  let abierto = null;   // espacio libre con su menú de tours abierto: "fecha|momento"

  function pintarViaje() {
    // Tarjetas de tours (sellos)
    $("#lista-tours").innerHTML = CONFIG.tours.map((t) => {
      const plan = itinerario.get(t.id);
      const posible = Boolean(primerDiaLibre(t));
      return `<li class="tour carta${plan ? " tour--en-plan" : ""}">
        <div class="tour__foto"><img src="${esc(t.imagen)}" data-fallback="${FALLBACK_TOUR}" alt="" loading="lazy" width="600" height="600"></div>
        <div class="tour__info">
          ${t.etiqueta ? `<span class="sello sello--rojo tour__sello">${esc(t.etiqueta)}</span>` : ""}
          <h3>${esc(t.nombre)}</h3>
          <p class="tour__meta"><i class="ph-fill ${t.momento === "noche" ? "ph-moon" : "ph-sun"}" aria-hidden="true"></i>${esc(t.horario)}</p>
          <p class="tour__desc">${esc(t.descripcion)}</p>
          <ul class="fauna">${t.fauna.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
          <p class="tour__incluye"><i class="ph ph-check-circle" aria-hidden="true"></i>${esc(t.incluye)}</p>
          <div class="tour__pie">
            <p class="tour__precio"><b>${soles(t.precio)}</b><small>por persona</small></p>
            ${plan
              ? `<button type="button" class="btn btn--claro" data-quitar-tour="${t.id}"><i class="ph-fill ph-check" aria-hidden="true"></i>${fechaCorta(plan.fecha)}<span class="sr-only">. Quitar ${esc(t.nombre)}</span><i class="ph ph-x" aria-hidden="true"></i></button>`
              : `<button type="button" class="btn ${posible ? "btn--tinta" : "btn--claro"}" data-agregar-tour="${t.id}"><i class="ph ph-plus" aria-hidden="true"></i>${posible ? "Agregar" : noches().length < nochesMinimas(t) ? `Desde ${plural(nochesMinimas(t), "noche", "noches")}` : "Sin día libre"}</button>`}
          </div>
        </div>
      </li>`;
    }).join("");

    // Días del itinerario
    const dias = diasViaje(), ultimo = dias.length - 1;
    const ocup = ocupacion();
    const espacio = (fecha, momento, i) => {
      const icono = momento === "dia" ? "ph-sun" : "ph-moon";
      if (momento === "dia" && i === 0) return `<div class="slot slot--fijo slot--${momento}"><i class="ph ph-sign-in" aria-hidden="true"></i><span>Llegada · entrada desde ${formatoHora(CONFIG.checkin)}</span></div>`;
      if (i === ultimo) return momento === "dia"
        ? `<div class="slot slot--fijo slot--dia"><i class="ph ph-sign-out" aria-hidden="true"></i><span>Salida · hasta ${formatoHora(CONFIG.checkout)}</span></div>`
        : `<div class="slot slot--fijo slot--noche"><i class="ph ph-airplane-takeoff" aria-hidden="true"></i><span>¡Buen viaje!</span></div>`;
      const o = ocup.get(`${fecha}|${momento}`);
      if (o) {
        const t = TOURS.get(o.id);
        const nombre = o.albergue ? "Noche en el albergue" : o.parte > 0 ? `${t.nombre} (día ${o.parte + 1})` : t.nombre;
        return `<div class="slot slot--tour slot--${momento}${o.albergue ? " slot--albergue" : ""}"><i class="ph-fill ${icono}" aria-hidden="true"></i>
          <span><b>${esc(nombre)}</b><small>${o.parte === 0 && !o.albergue ? esc(t.horario) : "incluido en el tour"}</small></span>
          ${o.parte === 0 && !o.albergue ? `<button type="button" class="slot__quitar" data-quitar-tour="${t.id}" aria-label="Quitar ${esc(t.nombre)}"><i class="ph ph-x"></i></button>` : ""}</div>`;
      }
      const clave = `${fecha}|${momento}`;
      const opciones = CONFIG.tours.filter((t) => t.momento === momento && !itinerario.has(t.id) && cabe(t, fecha));
      return `<div class="slot slot--libre slot--${momento}${abierto === clave ? " abierto" : ""}">
        <button type="button" class="slot__libre" data-abrir-slot="${clave}" aria-expanded="${abierto === clave}">
          <i class="ph ${icono}" aria-hidden="true"></i><span>${momento === "dia" ? "Día libre" : "Noche libre"}</span><i class="ph ph-plus-circle" aria-hidden="true"></i>
        </button>
        ${abierto === clave ? `<div class="slot__menu">${opciones.length
          ? opciones.map((t) => `<button type="button" data-agregar-tour="${t.id}" data-dia="${fecha}"><b>${esc(t.nombre)}</b><small>${soles(t.precio)} c/u</small></button>`).join("")
          : `<p>${momento === "dia" ? "Piscina, hamaca y descanso. O escríbenos y te sugerimos algo." : "Cena en el centro y a dormir temprano."}</p>`}</div>` : ""}
      </div>`;
    };
    $("#dias").innerHTML = dias.map((f, i) => `
      <li class="dia${i === 0 || i === ultimo ? " dia--borde" : ""}">
        <div class="dia__fecha"><b>${aUTC(f).getUTCDate()}</b><span>${diaSemana(f)}</span><small>Día ${i + 1}</small></div>
        <div class="dia__slots">${espacio(f, "dia", i)}${espacio(f, "noche", i)}</div>
      </li>`).join("");

    const aviso = $("#itinerario-aviso");
    const nochesDia = Math.min(...CONFIG.tours.filter((t) => t.momento === "dia").map(nochesMinimas));
    aviso.hidden = noches().length >= nochesDia;
    aviso.innerHTML = `<i class="ph ph-lightbulb" aria-hidden="true"></i><span>Con ${plural(noches().length, "noche", "noches")} solo entran tours de noche. Quédate ${plural(nochesDia, "noche", "noches")} para tener un día completo en la selva.</span>
      <button type="button" class="link-btn" data-sumar-noches="${nochesDia}">Sumar noches</button>`;
    $("#itinerario-total").textContent = soles(calcular().tours);
  }

  document.addEventListener("click", (e) => {
    const agregar = e.target.closest("[data-agregar-tour]");
    if (agregar) return agregarTour(TOURS.get(agregar.dataset.agregarTour), agregar.dataset.dia);
    const quitar = e.target.closest("[data-quitar-tour]");
    if (quitar) return quitarTour(quitar.dataset.quitarTour);
    const slot = e.target.closest("[data-abrir-slot]");
    if (slot) {
      abierto = abierto === slot.dataset.abrirSlot ? null : slot.dataset.abrirSlot;
      pintarViaje();
      $(`[data-abrir-slot="${CSS.escape(slot.dataset.abrirSlot)}"]`)?.focus();
    }
    const sumar = e.target.closest("[data-sumar-noches]");
    if (sumar) { est.salida = sumarDias(est.llegada, Number(sumar.dataset.sumarNoches)); alCambiarEstadia(); }
  });

  /* ---------- 10. Un día en la casa, servicios y reserva directa ---------- */
  $("#horas").innerHTML = CONFIG.unDia.map((h) => `
    <li class="hora" data-revelar>
      <span class="hora__reloj">${formatoHora(h.hora)}</span>
      <figure class="hora__foto"><img src="${esc(h.imagen)}" data-fallback="${FALLBACK_LUGAR}" alt="${esc(h.titulo)}" loading="lazy" width="700" height="900"></figure>
      <h3>${esc(h.titulo)}</h3>
      <p>${esc(h.texto)}</p>
    </li>`).join("");
  $("#servicios").innerHTML = CONFIG.servicios.map((s) => `<li><i class="ph ${s.icono}" aria-hidden="true"></i>${esc(s.nombre)}</li>`).join("");

  const maxAhorro = Math.max(0, ...CONFIG.habitaciones.map((h) => (h.precioApps ? Math.round((1 - h.precio / h.precioApps) * 100) : 0)));
  const recojo = EXTRAS.get("recojo");
  $("#directo").innerHTML = [
    ["sello--rojo", maxAhorro ? `-${maxAhorro}%` : "Directo", "que en las apps"],
    ["sello--azul", "Gratis", recojo?.gratisDesdeNoches ? `recojo desde ${recojo.gratisDesdeNoches} noches` : "asesoría de viaje"],
    ["sello--verde", `${CONFIG.cancelacionHoras} h`, "para cancelar sin costo"],
    ["sello--amarillo", `${CONFIG.adelanto}%`, "de adelanto y listo"],
  ].map(([c, b, s]) => `<li class="sello ${c}" data-revelar><b>${b}</b><span>${s}</span></li>`).join("");

  /* ---------- 11. Muro de viajeros ---------- */
  $("#testimonios").innerHTML = CONFIG.testimonios.map((t) => `
    <li class="nota" data-revelar>
      <span class="nota__cinta" aria-hidden="true"></span>
      <span class="estrellas" role="img" aria-label="${t.estrellas} de 5 estrellas">${"★".repeat(t.estrellas)}${"☆".repeat(5 - t.estrellas)}</span>
      <blockquote>${esc(t.texto)}</blockquote>
      <p class="nota__firma">— ${esc(t.nombre)}, ${esc(t.pais)}</p>
      <p class="nota__estadia"><i class="ph ph-bed" aria-hidden="true"></i>${esc(t.estadia)} · ${esc(t.fuente)}</p>
    </li>`).join("");

  /* ---------- 12. Ubicación: línea de metro ---------- */
  $("#linea").innerHTML = `<li class="parada parada--inicio"><span class="parada__punto" aria-hidden="true"></span><b>${esc(CONFIG.nombre)}</b><small>Tú estás aquí</small></li>` +
    CONFIG.cerca.map((c) => `<li class="parada" data-revelar><span class="parada__punto" aria-hidden="true"></span><i class="ph ${c.icono}" aria-hidden="true"></i><b>${esc(c.lugar)}</b><small>${esc(c.tiempo)} ${esc(c.modo)}</small></li>`).join("");
  const { lat, lng } = CONFIG.ubicacion;
  $("#mapa").src = `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  $("#como-llegar").href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  /* ---------- 13. Chat de preguntas y letra chica ---------- */
  const anf = CONFIG.anfitriona;
  $("#chat-avatar").textContent = anf.nombre.charAt(0);
  $("#chat-rol").textContent = anf.rol;
  const chat = $("#chat");
  const preguntadas = new Set();
  const burbuja = (quien, html) => {
    const div = document.createElement("div");
    div.className = `burbuja burbuja--${quien}`;
    div.innerHTML = html;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  };
  const horaChat = () => `<small>${formatoHora(horaLima())}</small>`;
  function pintarOpciones() {
    const quedan = CONFIG.preguntas.map((q, i) => [q, i]).filter(([, i]) => !preguntadas.has(i));
    $("#chat-opciones").innerHTML = quedan.map(([q, i]) => `<button type="button" class="chip" data-pregunta="${i}">${esc(q.p)}</button>`).join("") +
      `<a class="chip chip--wa" href="${waLink(`Hola ${anf.nombre}, tengo una consulta: `)}" target="_blank" rel="noopener"><i class="ph-fill ph-whatsapp-logo" aria-hidden="true"></i>Otra pregunta: escribir a ${esc(anf.nombre)}</a>`;
  }
  burbuja("ella", `¡Hola! Soy ${esc(anf.nombre)}, de la ${esc(anf.rol.toLowerCase())} de ${esc(CONFIG.nombre)}. ¿Qué quieres saber antes de venir? ${horaChat()}`);
  pintarOpciones();
  let respondiendo = false;
  $("#chat-opciones").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pregunta]");
    if (!b || respondiendo) return;
    const i = Number(b.dataset.pregunta);
    const q = CONFIG.preguntas[i];
    preguntadas.add(i);
    respondiendo = true;
    burbuja("yo", `${esc(q.p)} ${horaChat()}`);
    pintarOpciones();
    const escribiendo = burbuja("ella escribiendo", '<span></span><span></span><span></span><span class="sr-only">Escribiendo…</span>');
    setTimeout(() => {
      escribiendo.remove();
      burbuja("ella", `${esc(q.r)} ${horaChat()}`);
      respondiendo = false;
    }, reduceMotion ? 0 : 900);
  });

  $("#politicas").innerHTML = CONFIG.politicas.map((p) =>
    `<li><i class="ph ${p.icono}" aria-hidden="true"></i><div><b>${esc(p.titulo)}</b><span>${esc(p.texto)}</span></div></li>`).join("");

  /* ---------- 14. Mi pase (la reserva) ---------- */
  const dlgPase = $("#pase");
  const form = $("#form-pase");

  $("#extras").innerHTML = CONFIG.extras.map((x) => `
    <label class="extra">
      <input type="checkbox" name="extra" value="${x.id}">
      <i class="ph ${x.icono}" aria-hidden="true"></i>
      <span class="extra__txt"><b>${esc(x.nombre)}</b><small>${esc(x.detalle)}</small></span>
      <span class="extra__precio" data-extra-precio="${x.id}"></span>
    </label>`).join("");

  // Código del pase y código de barras (decorativo), según la estadía
  function codigoPase() {
    const base = `${est.llegada}${est.salida}${est.huespedes}${[...pase].join()}`;
    let h = 0;
    for (const c of base) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return "CL-" + h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
  }
  function pintarCodigoBarras(codigo) {
    let x = 0, barras = "";
    for (const c of codigo + codigo.split("").reverse().join("")) {
      const n = c.charCodeAt(0);
      [1 + (n % 3), 1 + ((n >> 2) % 2), 2 + ((n >> 1) % 3)].forEach((w, k) => {
        if (k !== 1) barras += `<rect x="${x}" y="0" width="${w}" height="40"/>`;
        x += w + 1;
      });
    }
    const svg = $("#codigo-barras");
    svg.setAttribute("viewBox", `0 0 ${x} 40`);
    svg.innerHTML = barras;
  }

  function actualizarPase() {
    const c = calcular();
    const n = c.n;
    $$("[data-contador]").forEach((b) => { b.hidden = c.items === 0; b.textContent = c.items; });
    document.body.classList.toggle("con-pase", c.items > 0);
    const codigo = codigoPase();
    $("#pase-codigo").textContent = `${codigo} · ${CONFIG.nombre}`;
    pintarCodigoBarras(codigo);

    // Cuartos
    $("#items-cuartos").innerHTML = [...pase].map(([id, cant]) => {
      const h = HABS.get(id);
      return `<li class="item">
        <img src="${esc(h.imagenes[0])}" data-fallback="${FALLBACK_HAB}" alt="" loading="lazy">
        <div><b>${esc(h.nombre)}</b><small>${plural(cant, h.porCama ? "cama" : "cuarto", h.porCama ? "camas" : "cuartos")} · ${plural(n, "noche", "noches")} · ${soles(cant * precioEstadia(h))}</small></div>
        <div class="stepper stepper--chico">
          <button type="button" data-item="hab:${id}" data-op="-1" aria-label="Quitar uno: ${esc(h.nombre)}"><i class="ph ph-${cant === 1 ? "trash" : "minus"}"></i></button>
          <output>${cant}</output>
          <button type="button" data-item="hab:${id}" data-op="1" aria-label="Agregar otro: ${esc(h.nombre)}" ${cant >= h.unidades ? "disabled" : ""}><i class="ph ph-plus"></i></button>
        </div>
      </li>`;
    }).join("");
    $("#vacio").hidden = pase.size > 0;
    $("#aviso-capacidad").innerHTML = pase.size && c.capacidad < est.huespedes
      ? `<i class="ph ph-warning-circle" aria-hidden="true"></i><span>Tus cuartos son para ${plural(c.capacidad, "persona", "personas")} y son ${plural(est.huespedes, "viajero", "viajeros")}. Agrega otro cuarto o elige uno más grande.</span>`
      : "";

    // Itinerario
    $("#bloque-tours").hidden = itinerario.size === 0;
    $("#items-tours").innerHTML = [...itinerario].sort((a, b) => a[1].fecha.localeCompare(b[1].fecha)).map(([id, v]) => {
      const t = TOURS.get(id);
      return `<li class="item">
        <span class="item__fecha"><b>${aUTC(v.fecha).getUTCDate()}</b>${diaSemana(v.fecha)}</span>
        <div><b>${esc(t.nombre)}</b><small>${plural(v.personas, "persona", "personas")} · ${soles(v.personas * t.precio)}</small></div>
        <div class="stepper stepper--chico">
          <button type="button" data-item="tour:${id}" data-op="-1" aria-label="Una persona menos: ${esc(t.nombre)}"><i class="ph ph-${v.personas === 1 ? "trash" : "minus"}"></i></button>
          <output>${v.personas}</output>
          <button type="button" data-item="tour:${id}" data-op="1" aria-label="Una persona más: ${esc(t.nombre)}" ${v.personas >= MAX_HUESPEDES ? "disabled" : ""}><i class="ph ph-plus"></i></button>
        </div>
      </li>`;
    }).join("");

    // Promo: cuántas noches faltan para el descuento
    const pp = $("#promo-progreso");
    pp.hidden = !promoVigente() || pase.size === 0;
    if (!pp.hidden) {
      const faltan = promo.minNoches - n;
      pp.classList.toggle("listo", faltan <= 0);
      pp.innerHTML = faltan > 0
        ? `<i class="ph-fill ph-leaf" aria-hidden="true"></i><span>Quédate <b>${plural(faltan, "noche", "noches")} más</b> y tus cuartos salen ${promo.porcentaje}% más baratos.</span><button type="button" class="link-btn" data-sumar-noches="${promo.minNoches}">Sumar</button>`
        : `<i class="ph-fill ph-check-circle" aria-hidden="true"></i><span>¡${esc(promo.titulo)}: -${promo.porcentaje}% en tus cuartos!</span>`;
    }

    // Extras
    $("#bloque-extras").hidden = pase.size === 0;
    $$("[name=extra]", form).forEach((cb) => { cb.checked = extrasSel.has(cb.value); });
    $$("[data-extra-precio]").forEach((el) => {
      const x = EXTRAS.get(el.dataset.extraPrecio);
      const p = precioExtra(x);
      el.innerHTML = p === 0 && x.gratisDesdeNoches ? `<b class="gratis">Gratis</b>` : `${soles(p)}${x.gratisDesdeNoches ? `<small>gratis desde ${x.gratisDesdeNoches} noches</small>` : ""}`;
    });

    // Formulario y totales
    $("#checkout").hidden = c.items === 0;
    $("#pase-pie").hidden = c.items === 0;
    $("#campo-vuelo").hidden = form.llegaPor.value !== "Avión";
    const filas = (lista) => lista.filter(Boolean).map(([dt, dd, cls]) => `<div${cls ? ` class="totales__${cls}"` : ""}><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`).join("");
    $("#resumen").innerHTML = filas([
      pase.size ? [`Cuartos (${plural(n, "noche", "noches")})`, soles(c.cuartos)] : null,
      c.descuento ? [`${promo.titulo} (-${promo.porcentaje}%)`, "-" + soles(c.descuento), "descuento"] : null,
      itinerario.size ? ["Tours", soles(c.tours)] : null,
      extrasSel.size && pase.size ? ["Extras", c.extras ? soles(c.extras) : "Gratis"] : null,
    ]);
    $("#totales").innerHTML = filas([
      ["Total", soles(c.total), "total"],
      [`Adelanto (${CONFIG.adelanto}%)`, soles(c.adelanto), "adelanto"],
    ]);
  }

  // +/− dentro del pase (mantienen el foco tras redibujar)
  dlgPase.addEventListener("click", (e) => {
    const b = e.target.closest("[data-item][data-op]");
    if (!b) return;
    const [tipo, id] = b.dataset.item.split(":");
    const op = Number(b.dataset.op);
    if (tipo === "hab") {
      const nuevo = Math.min(HABS.get(id).unidades, (pase.get(id) || 0) + op);
      if (nuevo > 0) pase.set(id, nuevo); else pase.delete(id);
    } else {
      const v = itinerario.get(id);
      v.personas = Math.min(MAX_HUESPEDES, v.personas + op);
      if (v.personas < 1) itinerario.delete(id);
    }
    alCambiarEstadia();
    const { item } = b.dataset;
    requestAnimationFrame(() => {
      const mismo = $(`[data-item="${CSS.escape(item)}"][data-op="${b.dataset.op}"]:not(:disabled)`, dlgPase) || $(`[data-item="${CSS.escape(item)}"]`, dlgPase);
      (mismo || $("#pase-titulo")).focus?.();
    });
  });

  form.addEventListener("change", (e) => {
    if (e.target.name === "extra") {
      if (e.target.checked) extrasSel.add(e.target.value); else extrasSel.delete(e.target.value);
      guardar();
      actualizarPase();
    }
    if (e.target.name === "llegaPor") $("#campo-vuelo").hidden = e.target.value !== "Avión";
  });
  $("#procedencia").addEventListener("input", (e) => { $("#pase-origen").textContent = e.target.value.trim() || "Tu ciudad"; });

  const abrirPase = () => { actualizarPase(); dlgPase.showModal(); };
  document.addEventListener("click", (e) => { if (e.target.closest("[data-abrir-pase]")) abrirPase(); });
  dlgPase.addEventListener("click", (e) => { if (e.target === dlgPase) dlgPase.close(); });
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-cerrar]"); if (b) b.closest("dialog").close(); });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const c = calcular();
    if (!c.items) return;
    const v = (campo) => form[campo].value.trim();
    const requeridos = ["nombre", "docnum"];
    requeridos.forEach((r) => form[r].setAttribute("aria-invalid", String(!v(r))));
    const primero = requeridos.find((r) => !v(r));
    if (primero) return form[primero].focus();

    const n = c.n;
    const lineasCuartos = [...pase].map(([id, cant]) => {
      const h = HABS.get(id);
      return `• ${cant} x ${h.nombre} — ${solesExacto(cant * precioEstadia(h))}`;
    });
    // El itinerario se escribe día por día
    const ocup = ocupacion();
    const lineasViaje = diasViaje().slice(0, -1).flatMap((f, i) => {
      const partes = ["dia", "noche"].map((m) => ocup.get(`${f}|${m}`)).filter((o) => o && !o.albergue)
        .map((o) => {
          const t = TOURS.get(o.id);
          if (o.parte > 0) return `${t.nombre} (día ${o.parte + 1})`;
          const p = itinerario.get(o.id).personas;
          return `${t.nombre} x ${plural(p, "persona", "personas")} — ${solesExacto(p * t.precio)}`;
        });
      return partes.length ? [`• Día ${i + 1} (${fechaCorta(f)}): ${partes.join(" + ")}`] : [];
    });
    const lineasExtras = pase.size ? [...extrasSel].map((id) => {
      const x = EXTRAS.get(id);
      const p = precioExtra(x);
      return `• ${x.nombre} — ${p ? solesExacto(p) : `Gratis (desde ${x.gratisDesdeNoches} noches)`}`;
    }) : [];
    const llegaPor = form.llegaPor.value;
    const llegada = [llegaPor, llegaPor === "Avión" && v("vuelo") ? `vuelo ${v("vuelo")}` : null, v("hora") ? `aprox. ${formatoHora(v("hora"))}` : null].filter(Boolean).join(" · ");

    const msg = [
      `Hola ${CONFIG.nombre} 👋, te envío mi pase ${codigoPase()}:`,
      "",
      `📅 Llegada: ${fechaLarga(est.llegada)} (desde ${formatoHora(CONFIG.checkin)})`,
      `📅 Salida: ${fechaLarga(est.salida)} (hasta ${formatoHora(CONFIG.checkout)})`,
      `🌙 ${plural(n, "noche", "noches")} · 👥 ${plural(est.huespedes, "viajero", "viajeros")}`,
      ...(lineasCuartos.length ? ["", "🛏️ Cuartos", ...lineasCuartos] : []),
      c.descuento ? `Descuento ${promo.titulo} (-${promo.porcentaje}%): -${solesExacto(c.descuento)}` : null,
      ...(lineasViaje.length ? ["", "🗺️ Mi itinerario", ...lineasViaje] : []),
      ...(lineasExtras.length ? ["", "➕ Extras", ...lineasExtras] : []),
      "",
      `*Total: ${solesExacto(c.total)}*`,
      `Adelanto para confirmar (${CONFIG.adelanto}%): ${solesExacto(c.adelanto)}`,
      "",
      `👤 Nombre: ${v("nombre")}`,
      `🪪 ${form.doc.value}: ${v("docnum")}`,
      v("procedencia") ? `🌎 Vengo desde: ${v("procedencia")}` : null,
      `🧭 Llego en: ${llegada}`,
      `💳 Pago del adelanto: ${form.pago.value}`,
      v("notas") ? `📝 Notas: ${v("notas")}` : null,
    ].filter((l) => l !== null).join("\n");

    window.open(waLink(msg), "_blank", "noopener");
  });

  /* ---------- 15. Toast, animaciones y navegación ---------- */
  let toastTimer;
  function avisar(texto, icono = "ph-check-circle") {
    const t = $("#toast");
    t.innerHTML = `<i class="ph-fill ${icono}" aria-hidden="true"></i>${esc(texto)}`;
    t.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("visible"), 2400);
  }
  function pop(els) { els.forEach((el) => { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }); }

  // Aparecer al hacer scroll (sin librerías)
  const revelar = (el) => el.classList.add("visible");
  if (reduceMotion || !("IntersectionObserver" in window)) $$("[data-revelar]").forEach(revelar);
  else {
    const io = new IntersectionObserver((entradas) => entradas.forEach((en) => {
      if (en.isIntersecting) { revelar(en.target); io.unobserve(en.target); }
    }), { threshold: .15, rootMargin: "0px 0px -40px 0px" });
    $$("[data-revelar]").forEach((el) => io.observe(el));
  }

  const nav = $("#nav");
  const alScroll = () => nav.classList.toggle("nav--solida", window.scrollY > 40);
  window.addEventListener("scroll", alScroll, { passive: true });
  alScroll();

  /* ---------- 16. SEO local: datos estructurados para Google ---------- */
  const precios = CONFIG.habitaciones.map((h) => h.precio);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Hostel",
    name: CONFIG.nombre,
    telephone: CONFIG.telefono,
    email: CONFIG.email,
    priceRange: `S/ ${Math.min(...precios)} – S/ ${Math.max(...precios)}`,
    url: location.href.split("#")[0],
    checkinTime: CONFIG.checkin,
    checkoutTime: CONFIG.checkout,
    paymentAccepted: CONFIG.pagos.join(", "),
    amenityFeature: [...new Set(CONFIG.habitaciones.flatMap((h) => h.amenidades))].filter((k) => AMEN[k])
      .map((k) => ({ "@type": "LocationFeatureSpecification", name: AMEN[k].nombre, value: true })),
    address: { "@type": "PostalAddress", streetAddress: CONFIG.direccion, addressLocality: CONFIG.ciudad, addressRegion: CONFIG.region, addressCountry: "PE" },
    geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng },
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(ld);
  document.head.appendChild(script);

  /* ---------- 17. Inicio ---------- */
  pintarCielo();
  cargarClima();
  setInterval(() => {
    pintarCielo();
    // La fecha de hoy cambia a medianoche: si la llegada quedó en el pasado, se corrige
    if (est.llegada < hoyLima()) cambiarFecha("llegada", hoyLima());
  }, 30 * 1000);
  pintarPromo();
  promoTimer = setInterval(pintarPromo, 30 * 1000);

  const recomendado = VIAJEROS.get(est.viajero)?.habitacion;
  const primeroEnPase = [...pase.keys()][0];
  sel.id = recomendado || primeroEnPase || CONFIG.habitaciones[0].id;
  sel.cantidad = pase.get(sel.id) || 1;
  reacomodarItinerario();
  alCambiarEstadia();

  // Enlace directo a un cuarto: index.html#cuarto-matrimonial
  const enlace = location.hash.match(/^#cuarto-(.+)$/);
  if (enlace && HABS.has(enlace[1])) {
    elegirCuarto(enlace[1]);
    setTimeout(() => irA("#cuartos"), 100);
    history.replaceState(null, "", location.pathname + location.search);
  }
})();
