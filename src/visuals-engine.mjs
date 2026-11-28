const SVG_NS = "http://www.w3.org/2000/svg";
let visualSequence = 0;

const escapeXml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]);

const makeId = (prefix) => `${prefix}-${++visualSequence}`;

function commonDefs(id) {
  return `
    <defs>
      <linearGradient id="${id}-road" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#455469"/>
        <stop offset="1" stop-color="#253244"/>
      </linearGradient>
      <linearGradient id="${id}-green" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#b8ff9b"/>
        <stop offset=".5" stop-color="#39c879"/>
        <stop offset="1" stop-color="#137747"/>
      </linearGradient>
      <linearGradient id="${id}-orange" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffe29a"/>
        <stop offset=".48" stop-color="#ff9940"/>
        <stop offset="1" stop-color="#d34c28"/>
      </linearGradient>
      <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e2fbff"/>
        <stop offset=".55" stop-color="#8fc8d9"/>
        <stop offset="1" stop-color="#38596d"/>
      </linearGradient>
      <linearGradient id="${id}-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e5edf5"/>
        <stop offset=".45" stop-color="#8493a3"/>
        <stop offset="1" stop-color="#414d5d"/>
      </linearGradient>
      <linearGradient id="${id}-blue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#77dcff"/>
        <stop offset="1" stop-color="#2587d8"/>
      </linearGradient>
      <linearGradient id="${id}-amber" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe38b"/>
        <stop offset="1" stop-color="#ef8a22"/>
      </linearGradient>
      <filter id="${id}-shadow" x="-60%" y="-70%" width="220%" height="250%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"/>
        <feOffset in="blur" dx="2" dy="7" result="offset"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope=".45"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="${id}-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="5" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="${id}-soft-shadow" x="-40%" y="-40%" width="180%" height="200%">
        <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000" flood-opacity=".35"/>
      </filter>
      <marker id="${id}-arrow" markerWidth="12" markerHeight="12"
              refX="9" refY="6" orient="auto" markerUnits="strokeWidth">
        <path d="M1 1 L10 6 L1 11 Z" fill="#a6ff83"/>
      </marker>
    </defs>`;
}

function commonStyles(id) {
  return `
    <style>
      @keyframes ${id}-pulse {
        0%, 100% { opacity: .7; transform: scale(.96); }
        50% { opacity: 1; transform: scale(1.04); }
      }
      @keyframes ${id}-drive {
        0%, 15% { transform: translateX(0); }
        72%, 100% { transform: translateX(42px); }
      }
      @keyframes ${id}-brake {
        0%, 18% { transform: translateY(28px); }
        35%, 100% { transform: translateY(0); }
      }
      @keyframes ${id}-needle {
        0%, 10% { transform: rotate(-55deg); }
        55% { transform: rotate(28deg); }
        100% { transform: rotate(-18deg); }
      }
      @keyframes ${id}-level {
        0%, 10% { transform: translateY(52px); }
        60% { transform: translateY(0); }
        100% { transform: translateY(25px); }
      }
      @keyframes ${id}-measure {
        0%, 100% { stroke-dashoffset: 0; }
        50% { stroke-dashoffset: 18; }
      }
      .${id}-pulse { transform-box: fill-box; transform-origin: center; animation: ${id}-pulse 1.8s ease-in-out infinite; }
      .${id}-drive { animation: ${id}-drive 5s ease-in-out infinite alternate; }
      .${id}-brake { animation: ${id}-brake 5s ease-in-out infinite; }
      .${id}-needle { transform-box: view-box; transform-origin: 400px 320px; animation: ${id}-needle 4s ease-in-out infinite alternate; }
      .${id}-level { animation: ${id}-level 4s ease-in-out infinite alternate; }
      .${id}-measure { animation: ${id}-measure 2.4s linear infinite; }
      .${id}-label { font: 700 19px system-ui, sans-serif; letter-spacing: .7px; }
      .${id}-small { font: 600 14px system-ui, sans-serif; }
      .${id}-arabic { font: 600 16px system-ui, sans-serif; }
      .${id}-wheel { fill: #101923; stroke: #8d9aa8; stroke-width: 3; }
      .${id}-rim { fill: #c3ced8; stroke: #394858; stroke-width: 2; }
      @media (prefers-reduced-motion: reduce) {
        .${id}-pulse, .${id}-drive, .${id}-brake, .${id}-needle, .${id}-level, .${id}-measure {
          animation-duration: 12s;
        }
      }
    </style>`;
}

function label(x, y, text, className, fill = "#f4f8fc", anchor = "middle") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" class="${className}">${escapeXml(text)}</text>`;
}

function car(id, x, y, paint, { rotation = 0, className = "" } = {}) {
  const safeClass = className ? `class="${className}"` : "";
  return `
    <g transform="translate(${x} ${y}) rotate(${rotation})" ${safeClass} filter="url(#${id}-shadow)">
      <ellipse cx="0" cy="31" rx="66" ry="18" fill="#0b121a" opacity=".42"/>
      <g transform="matrix(1 .18 -.34 .82 0 0)">
        <path d="M-58 0 L-45-20 L-25-37 L26-37 L47-19 L60 0 L55 17 L-51 17 Z"
              fill="url(#${id}-${paint})" stroke="#13242d" stroke-width="2"/>
        <path d="M-24-34 L-15-51 L20-51 L34-34 Z"
              fill="url(#${id}-${paint})" stroke="#13242d" stroke-width="2"/>
        <path d="M-16-47 L-21-35 L-1-35 L-1-47 Z"
              fill="url(#${id}-glass)" stroke="#345366" stroke-width="2"/>
        <path d="M3-47 L3-35 L29-35 L19-47 Z"
              fill="url(#${id}-glass)" stroke="#345366" stroke-width="2"/>
        <path d="M-48-15 L-29-34 L-23-34 L-28-15 Z" fill="#fff3c4" opacity=".88"/>
        <path d="M42-14 L53-7 L55 2 L45 1 Z" fill="#fff0b0"/>
        <path d="M-54 7 L-46 6 L-43 13 L-53 13 Z" fill="#ff5c58"/>
        <path d="M44 8 L54 8 L52 14 L43 14 Z" fill="#ff5c58"/>
        <rect x="-40" y="12" width="17" height="12" rx="5" class="${id}-wheel"/>
        <rect x="28" y="12" width="17" height="12" rx="5" class="${id}-wheel"/>
        <circle cx="-31.5" cy="18" r="4" class="${id}-rim"/>
        <circle cx="36.5" cy="18" r="4" class="${id}-rim"/>
        <path d="M-22-5 H31" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
      </g>
    </g>`;
}

function svgDocument(id, title, description, body) {
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 800 600" width="100%" role="img"
    aria-labelledby="${id}-title ${id}-desc" preserveAspectRatio="xMidYMid meet">
    <title id="${id}-title">${escapeXml(title)}</title>
    <desc id="${id}-desc">${escapeXml(description)}</desc>
    ${commonDefs(id)}
    ${commonStyles(id)}
    <rect width="800" height="600" rx="28" fill="#172330"/>
    <path d="M0 450 Q190 400 380 450 T800 430 V600 H0Z" fill="#1e3d39"/>
    ${body}
  </svg>`;
}

function heading(id, italian, arabic) {
  return `
    <g filter="url(#${id}-soft-shadow)">
      <rect x="32" y="26" width="736" height="80" rx="22" fill="#223244" stroke="#486078"/>
      ${label(400, 59, italian, `${id}-label`, "#eaf4ff")}
      ${label(400, 87, arabic, `${id}-arabic`, "#b9d1e4")}
    </g>`;
}

function isometricRoad(id) {
  return `
    <path d="M95 300 L335 170 L705 340 L465 500 Z" fill="url(#${id}-road)" stroke="#8190a0" stroke-width="3"/>
    <path d="M95 300 L465 500 M335 170 L705 340" stroke="#d8e1e9" stroke-opacity=".64" stroke-width="3" stroke-dasharray="14 12"/>
    <path d="M274 397 L438 307" stroke="#f4f7fa" stroke-opacity=".75" stroke-width="4" stroke-dasharray="11 10"/>
    <path d="M423 420 L587 330" stroke="#f4f7fa" stroke-opacity=".75" stroke-width="4" stroke-dasharray="11 10"/>`;
}

/** أولوية اليمين: مشهد توضيحي؛ يجب تطبيق الإشارات الفعلية وقواعد التقاطع. */
export function renderPriorityLesson(options = {}) {
  const id = makeId("priority");
  const title = options.title ?? "Precedenza a destra";
  const body = `
    ${heading(id, "PRECEDENZA", "الأولوية في التقاطع")}
    ${isometricRoad(id)}
    <g transform="matrix(1 .28 -.55 .62 0 0)" opacity=".5">
      <path d="M185 350 H585" stroke="#d5dde5" stroke-width="3" stroke-dasharray="12 10"/>
    </g>
    <g class="${id}-pulse" filter="url(#${id}-glow)">
      <path d="M574 300 C520 269 474 258 424 264" fill="none" stroke="#9dff83"
            stroke-width="9" stroke-linecap="round" marker-end="url(#${id}-arrow)"/>
    </g>
    <g class="${id}-drive">${car(id, 544, 274, "green", { rotation: -24 })}</g>
    <g class="${id}-brake">${car(id, 390, 385, "orange", { rotation: 66 })}</g>
    <g filter="url(#${id}-soft-shadow)">
      <rect x="530" y="165" width="205" height="44" rx="15" fill="#174a39" stroke="#67df9a"/>
      ${label(632, 194, "PRECEDENZA", `${id}-small`, "#bfffd0")}
      <rect x="66" y="437" width="250" height="44" rx="15" fill="#603324" stroke="#ffae69"/>
      ${label(191, 466, "DEVO FERMARMI", `${id}-small`, "#ffe0bd")}
    </g>
    ${label(400, 545, options.note ?? "Esempio didattico: verifica sempre segnali e precedenze.", `${id}-small`, "#d8e3ec")}
  `;
  return svgDocument(id, title, "تقاطع توضيحي بسيارتين وسهم يبين أولوية المرور، مع التنبيه إلى ضرورة مراعاة الإشارات.", body);
}

/** مقطع إطار توضيحي؛ قيمة 1.6 mm هي حد أدنى شائع لإطارات سيارات الركوب في إيطاليا، وتُراجع القواعد السارية. */
export function renderTireLesson(options = {}) {
  const id = makeId("tire");
  const title = options.title ?? "Pneumatici · battistrada";
  const body = `
    ${heading(id, "PNEUMATICI", "الإطارات وعمق النقشة")}
    <ellipse cx="405" cy="338" rx="226" ry="144" fill="#0a1119" opacity=".45"/>
    <g filter="url(#${id}-shadow)">
      <path d="M200 301 C225 208 304 158 406 158 C514 158 585 211 608 305
               L572 386 C550 314 490 274 407 274 C324 274 258 316 239 389 Z"
            fill="#131b24" stroke="#8c9aaa" stroke-width="6"/>
      <path d="M239 389 C258 316 324 274 407 274 C490 274 550 314 572 386
               L540 428 C518 365 470 335 407 335 C343 335 297 368 278 431 Z"
            fill="url(#${id}-metal)" stroke="#263442" stroke-width="5"/>
      <path d="M286 431 C303 371 347 340 407 340 C467 340 511 372 528 430
               L494 450 C478 407 449 386 407 386 C365 386 335 408 320 451 Z"
            fill="#26313d" stroke="#a9b5c1" stroke-width="4"/>
      <path d="M205 300 L239 310 M225 246 L258 262 M264 202 L286 231 M320 174 L333 207
               M389 161 L391 202 M458 170 L446 208 M520 199 L496 233 M573 249 L540 267
               M600 303 L565 312"
            stroke="#bdc7d0" stroke-width="9" stroke-linecap="round"/>
      <path d="M266 322 L294 332 M312 292 L332 312 M367 277 L374 305 M436 276 L432 305
               M493 294 L473 316 M541 324 L512 336"
            stroke="#53616f" stroke-width="8" stroke-linecap="round"/>
    </g>
    <path d="M248 272 C292 210 345 189 406 188" fill="none" stroke="#73d9ff" stroke-width="7"
          stroke-linecap="round" marker-end="url(#${id}-arrow)" class="${id}-pulse"/>
    <g filter="url(#${id}-soft-shadow)">
      <rect x="506" y="168" width="234" height="70" rx="18" fill="#223244" stroke="#72cfff"/>
      ${label(623, 197, "BATTISTRADA", `${id}-small`, "#d8f4ff")}
      ${label(623, 222, "MINIMO: 1,6 mm*", `${id}-small`, "#a9e8ff")}
      <rect x="62" y="427" width="260" height="60" rx="18" fill="#223244" stroke="#64788d"/>
      ${label(192, 453, "Controllo della profondità", `${id}-small`, "#f2f7fb")}
      ${label(192, 475, "*Verificare norma e categoria", `${id}-small`, "#b9c9d8")}
    </g>
  `;
  return svgDocument(id, title, "Rappresentazione tridimensionale schematica di un pneumatico e della zona di battistrada.", body);
}

/** Limiti esemplificativi; i limiti reali dipendono da strada, veicolo e segnaletica. */
export function renderSpeedLesson(options = {}) {
  const id = makeId("speed");
  const title = options.title ?? "Limiti di velocità";
  const body = `
    ${heading(id, "LIMITI DI VELOCITÀ", "حدود السرعة تتبع الطريق والإشارات")}
    <path d="M190 410 A220 220 0 0 1 610 410 L565 410 A174 174 0 0 0 235 410 Z"
          fill="url(#${id}-metal)" stroke="#d0dae4" stroke-width="5" filter="url(#${id}-shadow)"/>
    <path d="M226 405 A184 184 0 0 1 574 405" fill="none" stroke="#182431" stroke-width="18"/>
    <path d="M240 396 A170 170 0 0 1 560 396" fill="none" stroke="#72d8ff" stroke-width="4"
          stroke-dasharray="4 18"/>
    <g class="${id}-needle">
      <path d="M400 320 L390 398 L400 388 L410 398 Z" fill="#ff675c" stroke="#7b2929" stroke-width="2"/>
    </g>
    <circle cx="400" cy="399" r="15" fill="#dbe4ed" stroke="#273647" stroke-width="5"/>
    <g class="${id}-small" fill="#f3f7fb" text-anchor="middle">
      <text x="255" y="350">0</text>
      <text x="286" y="284">50</text>
      <text x="400" y="245">90</text>
      <text x="514" y="284">110</text>
      <text x="545" y="350">130</text>
    </g>
    <g filter="url(#${id}-soft-shadow)">
      <rect x="258" y="440" width="284" height="55" rx="18" fill="#1b2b3a" stroke="#61c9f3"/>
      ${label(400, 474, "km/h · valori illustrativi", `${id}-small`, "#c9edff")}
      <rect x="104" y="172" width="592" height="50" rx="17" fill="#26374a" stroke="#536b83"/>
      ${label(400, 204, options.note ?? "Adegua la velocità alle condizioni e ai segnali.", `${id}-small`, "#edf5fc")}
    </g>
    <g transform="translate(400 320)" opacity=".22">
      <circle r="170" fill="none" stroke="#8edfff" stroke-width="2"/>
    </g>
  `;
  return svgDocument(id, title, "عداد سرعة متحرك بقيم توضيحية وليست بديلاً عن حدود السرعة المنشورة على الطريق.", body);
}

/** حد 0.5 g/l عام في إيطاليا مع استثناءات؛ يُرجى مراجعة القواعد الرسمية الحالية. */
export function renderAlcoholLesson(options = {}) {
  const id = makeId("alcohol");
  const title = options.title ?? "Alcol e guida";
  const body = `
    ${heading(id, "ALCOL · GUIDA SICURA", "الكحول والقيادة")}
    <path d="M250 182 H550 L518 430 Q515 458 490 466 H310 Q285 458 282 430 Z"
          fill="#203647" fill-opacity=".72" stroke="#c8e8f4" stroke-width="8"
          filter="url(#${id}-shadow)"/>
    <path d="M271 299 H529 L512 430 Q510 446 489 451 H311 Q290 446 288 430 Z"
          fill="url(#${id}-amber)" opacity=".92"/>
    <path d="M271 299 Q399 280 529 299" fill="none" stroke="#fff1b6" stroke-width="6"/>
    <g class="${id}-level">
      <path d="M272 349 Q400 331 526 349 L518 430 Q515 454 490 460 H310 Q285 454 282 430 Z"
            fill="#ffb342" opacity=".87"/>
      <path d="M272 349 Q400 331 526 349" fill="none" stroke="#fff0bd" stroke-width="5"/>
    </g>
    <path d="M400 466 V512 M340 514 H460" stroke="#c6d3df" stroke-width="12" stroke-linecap="round"/>
    <g filter="url(#${id}-soft-shadow)">
      <rect x="78" y="245" width="160" height="62" rx="18" fill="#27394c" stroke="#ffcf73"/>
      ${label(158, 273, "0,5 g/l", `${id}-label`, "#ffe3a2")}
      ${label(158, 295, "limite generale*", `${id}-small`, "#d8e5ee")}
      <rect x="550" y="330" width="185" height="62" rx="18" fill="#26374a" stroke="#80cfff"/>
      ${label(642, 357, "NON GUIDARE", `${id}-small`, "#d8f2ff")}
      ${label(642, 380, "dopo aver bevuto", `${id}-small`, "#b9d1e4")}
      ${label(400, 550, options.note ?? "*Eccezioni e regole da verificare su fonti ufficiali.", `${id}-small`, "#e0e9f1")}
    </g>
    <path d="M237 276 H296" stroke="#ffd774" stroke-width="5" stroke-dasharray="8 7"
          class="${id}-measure"/>
  `;
  return svgDocument(id, title, "Bicchiere schematico con indicatore animato e richiamo al limite generale, con avvertenza sulle eccezioni.", body);
}

/** Distanza illustrativa: il valore cambia con velocità e condizioni, non è un numero fisso. */
export function renderSafeDistanceLesson(options = {}) {
  const id = makeId("distance");
  const body = `
    ${heading(id, "DISTANZA DI SICUREZZA", "اترك مسافة تتناسب مع السرعة والظروف")}
    <path d="M70 355 L400 220 L730 355 L400 495 Z" fill="url(#${id}-road)" stroke="#8292a3" stroke-width="4"/>
    <path d="M155 355 L400 255 M645 355 L400 455" stroke="#dce4eb" stroke-width="4" stroke-dasharray="15 13"/>
    <path d="M400 271 V439" stroke="#f4f7fa" stroke-width="4" stroke-dasharray="13 12"/>
    <g transform="translate(0 0)">
      ${car(id, 396, 292, "green", { rotation: 0 })}
      ${car(id, 202, 375, "orange", { rotation: 0 })}
    </g>
    <path d="M285 328 L365 295" fill="none" stroke="#a6ff83" stroke-width="7"
          stroke-dasharray="12 8" marker-start="url(#${id}-arrow)" marker-end="url(#${id}-arrow)"
          class="${id}-measure" filter="url(#${id}-glow)"/>
    <g filter="url(#${id}-soft-shadow)">
      <rect x="270" y="175" width="260" height="54" rx="18" fill="#223244" stroke="#79d9ff"/>
      ${label(400, 209, options.distanceLabel ?? "Spazio variabile · esempio", `${id}-small`, "#dbf5ff")}
      <rect x="522" y="435" width="220" height="48" rx="16" fill="#1d4638" stroke="#70d69b"/>
      ${label(632, 465, "MANTIENI LA DISTANZA", `${id}-small`, "#c9ffdc")}
      ${label(400, 550, options.note ?? "Più velocità o meno aderenza: aumenta lo spazio necessario.", `${id}-small`, "#e3ebf2")}
    </g>
  `;
  return svgDocument(
    id,
    options.title ?? "Distanza di sicurezza",
    "Due auto in prospettiva isometrica mostrano che la distanza di sicurezza deve variare in base a velocità e condizioni.",
    body,
  );
}

const lessonVisuals = Object.freeze({
  priority: renderPriorityLesson,
  precedenza: renderPriorityLesson,
  tires: renderTireLesson,
  pneumatici: renderTireLesson,
  speed: renderSpeedLesson,
  velocita: renderSpeedLesson,
  alcohol: renderAlcoholLesson,
  alcol: renderAlcoholLesson,
  safeDistance: renderSafeDistanceLesson,
  distanza: renderSafeDistanceLesson,
});

/** Genera il visuale associato al tipo di lezione; ritorna stringa SVG o stringa vuota per tipo ignoto. */
export function renderLessonVisual(type, options = {}) {
  const renderer = lessonVisuals[String(type ?? "").trim()];
  return renderer ? renderer(options) : "";
}

export function getLessonVisualTypes() {
  return Object.keys(lessonVisuals);
}

export default Object.freeze({
  renderLessonVisual,
  renderPriorityLesson,
  renderTireLesson,
  renderSpeedLesson,
  renderAlcoholLesson,
  renderSafeDistanceLesson,
  getLessonVisualTypes,
});