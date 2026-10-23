/* ==========================================================
   AVISO DE DEMO (portafolio ALXZ//)
   Muestra una pastilla "Demo de ALXZ//" abajo a la izquierda que
   lleva al cotizador del estudio. Solo aparece con CONFIG.demo = true:
   para un cliente real, pon demo: false en config.js (o borra este archivo).
   ========================================================== */
(function () {
  "use strict";
  if (typeof CONFIG === "undefined" || !CONFIG.demo) return;

  const css = `
    .alxz-demo {
      position: fixed; left: 16px; bottom: 16px; z-index: 9990;
      display: inline-flex; align-items: center; gap: 8px;
      max-width: calc(100vw - 120px);
      padding: 9px 14px;
      background: rgba(8, 8, 8, .88); color: #E8E8E8;
      border: 1px solid rgba(255, 255, 255, .16); border-radius: 999px;
      font: 500 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: .01em; text-decoration: none;
      box-shadow: 0 6px 20px rgba(0, 0, 0, .25);
      -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
      transition: border-color .3s, transform .3s;
    }
    .alxz-demo:hover, .alxz-demo:focus-visible { border-color: #D62B30; transform: translateY(-2px); }
    .alxz-demo:focus-visible { outline: 2px solid #D62B30; outline-offset: 3px; }
    .alxz-demo b { font-weight: 600; white-space: nowrap; }
    .alxz-demo span { color: #BDBDBD; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .alxz-demo i { font-style: normal; color: #D62B30; }
    @media (max-width: 420px) { .alxz-demo span { display: none; } }
    @media (prefers-reduced-motion: reduce) { .alxz-demo { transition: none; } }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const a = document.createElement("a");
  a.className = "alxz-demo";
  a.href = "https://alxz-studio.netlify.app/#cotizar";
  a.target = "_blank";
  a.rel = "noopener";
  a.setAttribute("aria-label", "Proyecto conceptual con negocio ficticio. Demo de ALXZ// Digital Studio: cotiza una web así");
  a.innerHTML = '<b>Demo de ALXZ//</b><span>· Negocio ficticio · ¿Quieres una web así?</span><i aria-hidden="true">→</i>';
  document.body.appendChild(a);

  // Si la página tiene una barra fija abajo (p. ej. menú inferior en celular), sube el aviso encima.
  function place() {
    let top = window.innerHeight;
    document.querySelectorAll("body *").forEach((el) => {
      if (el === a || a.contains(el)) return;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      const anchoBarra = r.width > window.innerWidth * 0.6;
      // "Pegada abajo" incluye barras flotantes a pocos píxeles del borde (como un dock).
      if (anchoBarra && r.bottom >= window.innerHeight - 40 && r.height < window.innerHeight / 3) top = Math.min(top, r.top);
    });
    a.style.bottom = (window.innerHeight - top + 16) + "px";
  }
  place();
  window.addEventListener("resize", place);
  window.addEventListener("load", place);
})();
