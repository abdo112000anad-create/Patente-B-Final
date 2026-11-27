const xml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));

const prioritySvg = `<svg class="lesson-svg" viewBox="0 0 1000 800" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%); border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: block; margin: 0 auto;">
  <defs>
    <!-- تدرجات الطريق -->
    <linearGradient id="roadGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    
    <!-- تدرجات السيارة الخضراء (3D) -->
    <linearGradient id="carGreenTop" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6ee7b7"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <linearGradient id="carGreenSide" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>

    <!-- تدرجات السيارة البرتقالية (3D) -->
    <linearGradient id="carOrangeTop" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fcd34d"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <linearGradient id="carOrangeSide" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>

    <!-- ظلال وتوهج -->
    <filter id="shadowHeavy" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="25" stdDeviation="20" flood-color="#000" flood-opacity="0.8"/>
    </filter>
    <filter id="neonGlow">
      <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- حركات -->
    <style>
      @keyframes driveOrange { 
        0% { transform: translate(0, 0); } 
        80% { transform: translate(300px, 0); } 
        100% { transform: translate(300px, 0); } 
      }
      @keyframes driveGreen { 
        0% { transform: translate(0, 0); } 
        40% { transform: translate(0, -300px); } 
        100% { transform: translate(0, -300px); } 
      }
      @keyframes pulseArrow { 
        0%, 100% { opacity: 0.4; stroke-width: 8; } 
        50% { opacity: 1; stroke-width: 14; } 
      }
      .car-anim-orange { animation: driveOrange 5s infinite; }
      .car-anim-green { animation: driveGreen 5s infinite; }
      .arrow-pulse { animation: pulseArrow 1.5s infinite; }
    </style>
  </defs>

  <!-- منظور الطريق Isometric -->
  <g transform="matrix(1, 0.5, -1, 0.5, 500, 100)">
    <rect x="-300" y="-300" width="600" height="600" fill="url(#roadGrad)" stroke="#94a3b8" stroke-width="6" rx="40"/>
    <!-- خطوط الطريق -->
    <line x1="-300" y1="0" x2="300" y2="0" stroke="#cbd5e1" stroke-width="10" stroke-dasharray="30 30" opacity="0.4"/>
    <line x1="0" y1="-300" x2="0" y2="300" stroke="#cbd5e1" stroke-width="10" stroke-dasharray="30 30" opacity="0.4"/>
  </g>

  <!-- تسميات الشوارع -->
  <text x="200" y="500" fill="#94a3b8" font-size="24" font-weight="bold" transform="rotate(-26, 200, 500)">STRADA PRINCIPALE</text>
  <text x="750" y="200" fill="#94a3b8" font-size="24" font-weight="bold" transform="rotate(26, 750, 200)">STRADA SECONDARIA</text>

  <!-- السيارة البرتقالية (3D) -->
  <g class="car-anim-orange" transform="translate(300, 500)">
    <g filter="url(#shadowHeavy)" transform="matrix(1, 0.5, -1, 0.5, 0, 0)">
      <!-- الجانب -->
      <rect x="0" y="10" width="100" height="40" fill="url(#carOrangeSide)" rx="10"/>
      <!-- السقف -->
      <polygon points="15,10 40,-20 80,-20 95,10" fill="url(#carOrangeTop)"/>
      <!-- الزجاج -->
      <polygon points="25,5 40,-15 70,-15 85,5" fill="#bae6fd" opacity="0.8"/>
      <!-- العجلات -->
      <circle cx="25" cy="50" r="15" fill="#111827"/><circle cx="75" cy="50" r="15" fill="#111827"/>
    </g>
  </g>

  <!-- السيارة الخضراء (3D) -->
  <g class="car-anim-green" transform="translate(700, 300)">
    <g filter="url(#shadowHeavy)" transform="matrix(1, 0.5, -1, 0.5, 0, 0)">
      <!-- الجانب -->
      <rect x="0" y="10" width="100" height="40" fill="url(#carGreenSide)" rx="10"/>
      <!-- السقف -->
      <polygon points="15,10 40,-20 80,-20 95,10" fill="url(#carGreenTop)"/>
      <!-- الزجاج -->
      <polygon points="25,5 40,-15 70,-15 85,5" fill="#bae6fd" opacity="0.8"/>
      <!-- العجلات -->
      <circle cx="25" cy="50" r="15" fill="#111827"/><circle cx="75" cy="50" r="15" fill="#111827"/>
    </g>
  </g>

  <!-- سهم الأولوية (متوهج ونابض) -->
  <g transform="translate(500, 400)">
    <path d="M 150 0 L -150 0" stroke="#10b981" stroke-width="12" fill="none" filter="url(#neonGlow)" class="arrow-pulse" marker-end="url(#arrowhead)"/>
    <defs>
      <marker id="arrowhead" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto">
        <polygon points="0 0, 12 4, 0 8" fill="#10b981" />
      </marker>
    </defs>
  </g>

  <!-- التسميات التوضيحية المدمجة -->
  <g transform="translate(700, 550)" filter="url(#shadowHeavy)">
    <rect x="0" y="0" width="200" height="60" fill="#10b981" rx="12"/>
    <text x="100" y="38" fill="#fff" font-size="24" font-weight="900" text-anchor="middle">PRECEDENZA</text>
  </g>
  <g transform="translate(100, 650)" filter="url(#shadowHeavy)">
    <rect x="0" y="0" width="200" height="60" fill="#ef4444" rx="12"/>
    <text x="100" y="38" fill="#fff" font-size="24" font-weight="900" text-anchor="middle">DEVE FERMARSI</text>
  </g>
</svg>`;

const lessonVisuals = {
  'u1-l1': ['road','Parti della strada','أجزاء الطريق'],
  'u1-l2': ['vehicle','Categorie di veicoli','فئات المركبات'],
  'u1-l3': ['speed','Velocità adeguata','السرعة المناسبة'],
  'u1-l4': ['law','Testo vigente e fonte ufficiale','النص النافذ والمصدر الرسمي'],
  'u2-l1': ['sign-groups','Gruppi della segnaletica','مجموعات الإشارات'],
  'u2-l2': ['sign-types','Pericolo · divieto · obbligo','الخطر والمنع والإلزام'],
  'u2-l3': ['stop','STOP e precedenza','التوقف والأولوية'],
  'u2-l4': ['supplementary','Segnale e pannello integrativo','الإشارة واللوحة التكميلية'],
  'u3-l1': ['markings','Linee e simboli stradali','الخطوط والرموز المرورية'],
  'u3-l2': ['traffic-light','Segnali luminosi','الإشارات الضوئية'],
  'u3-l3': ['officer','Agente e ostacolo','الشرطي والعائق'],
  'u3-l4': ['roadworks','Cantiere stradale','أعمال الطريق'],
  'u4-l1': ['priority','Precedenza a destra','الأولوية للقادم من اليمين'],
  'u4-l2': ['roundabout','Rotatoria','الدوّار'],
  'u4-l3': ['vulnerable','Pedoni e ciclisti','المشاة وراكبو الدراجات'],
  'u4-l4': ['emergency','Mezzi di emergenza','مركبات الطوارئ'],
  'u5-l1': ['lane-change','Posizione e cambio corsia','الموضع وتغيير الحارة'],
  'u5-l2': ['overtake','Sorpasso sicuro','التجاوز الآمن'],
  'u5-l3': ['distance','Distanza di sicurezza','مسافة الأمان'],
  'u5-l4': ['reverse','Retromarcia','الرجوع إلى الخلف'],
  'u6-l1': ['speed-sign','Limiti e velocità','الحدود والسرعة'],
  'u6-l2': ['parking','Arresto · fermata · sosta','التوقف والوقوف'],
  'u6-l3': ['curves','Curve, dossi e discesa','المنحنيات والنتوءات والمنحدرات'],
  'u6-l4': ['highway-emergency','Autostrada e corsia di emergenza','الطريق السريع وحارة الطوارئ'],
  'u6-l5': ['highway-merge','Ingresso, corsie e uscita','الدخول والحارات والخروج'],
  'u7-l1': ['tire','Battistrada e aderenza','نقشة الإطار والتماسك'],
  'u7-l2': ['brake','Freni e controllo','الفرامل والسيطرة'],
  'u7-l3': ['lights','Luci e visibilità','الأضواء ومدى الرؤية'],
  'u7-l4': ['cargo','Carico e stabilità','الحمولة والثبات'],
  'u7-l5': ['restraint','Cinture e sistemi di ritenuta','الأحزمة وأنظمة التثبيت'],
  'u8-l1': ['license','Patente e idoneità','الرخصة والأهلية'],
  'u8-l2': ['documents','Documenti del veicolo','وثائق المركبة'],
  'u8-l3': ['insurance','Assicurazione e responsabilità','التأمين والمسؤولية'],
  'u8-l4': ['accident','Dopo un incidente','ما بعد الحادث'],
  'u8-l5': ['violation','Infrazioni e conseguenze','المخالفات والنتائج'],
  'u9-l1': ['alcohol','Alcol e guida','الكحول والقيادة'],
  'u9-l2': ['medicine','Sostanze e medicinali','المخدرات والأدوية'],
  'u9-l3': ['fatigue','Stanchezza e attenzione','التعب والانتباه'],
  'u9-l4': ['phone','Distrazione da telefono','التشتت بسبب الهاتف'],
  'u9-l5': ['emotion','Equilibrio del conducente','اتزان السائق'],
  'u9-l6': ['vulnerable','Utenti vulnerabili','مستخدمو الطريق الأكثر عرضة للخطر'],
  'u10-l1': ['eco','Guida efficiente','القيادة الموفّرة'],
  'u10-l2': ['noise','Rumore e rispetto','الضوضاء والاحترام'],
  'u10-l3': ['pollution','Manutenzione e emissioni','الصيانة والانبعاثات'],
  'u10-l4': ['fuel','Consumo e pianificazione','الاستهلاك والتخطيط'],
  'u11-l1': ['checklist','Controlli prima di partire','الفحوصات قبل الانطلاق'],
  'u11-l2': ['dashboard','Spie e anomalie','المؤشرات والأعطال'],
  'u11-l3': ['safety','Sistemi di sicurezza','أنظمة الأمان'],
  'u11-l4': ['heat','Temperatura e guasto','الحرارة والعطل'],
  'u11-l5': ['passengers','Carico e passeggeri','الحمولة والركاب']
};

const text = (x,y,value,fill='#e8f2f7',size=13,weight=700,anchor='start') => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${xml(value)}</text>`;
const car = (x,y,color='#10b981',rotate=0,scale=1) => `<g transform="translate(${x} ${y}) rotate(${rotate} 42 20) scale(${scale})" filter="url(#shadow)"><path d="M8 28 12 16q2-5 8-5h24q7 0 10 6l5 11v8H8z" fill="${color}" stroke="#a8fff0" stroke-width="2"/><path d="m18 16 3-4h20l5 6H16z" fill="url(#glass)"/><path d="M31 12v7m-14 0h32" stroke="#102433" stroke-width="2" opacity=".72"/><circle cx="20" cy="36" r="5" fill="#0b1722" stroke="#8aa2b2" stroke-width="2"/><circle cx="48" cy="36" r="5" fill="#0b1722" stroke="#8aa2b2" stroke-width="2"/><path d="M10 28h5m39 0h4" stroke="#f7c46a" stroke-width="2" stroke-linecap="round"/></g>`;
const wheel = (x,y,r=42) => `<g filter="url(#shadow)"><circle cx="${x}" cy="${y}" r="${r}" fill="#0b1722" stroke="#637b8d" stroke-width="8"/><circle cx="${x}" cy="${y}" r="${r-10}" fill="#20384b" stroke="#10b981" stroke-width="3"/><circle cx="${x}" cy="${y}" r="${r-22}" fill="url(#glass)" stroke="#9bdad9" stroke-width="3"/><circle cx="${x}" cy="${y}" r="7" fill="#cceff3"/><path d="M${x} ${y-r+5}v9M${x+r-5} ${y}h-9M${x} ${y+r-5}v-9M${x-r+5} ${y}h9" stroke="#9ab2c1" stroke-width="3" stroke-linecap="round"/></g>`;
const defs = (id) => `<defs><linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#20384b"/><stop offset="1" stop-color="#101c29"/></linearGradient><linearGradient id="${id}-mint" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#39e4c3"/><stop offset="1" stop-color="#10b981"/></linearGradient><linearGradient id="${id}-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#76c6ff"/><stop offset="1" stop-color="#3b82f6"/></linearGradient><linearGradient id="${id}-glass" x1="0" y1="0" x2="0.9" y2="1"><stop stop-color="#8eeaff"/><stop offset="1" stop-color="#285d81"/></linearGradient><linearGradient id="${id}-rubber" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#556b7c"/><stop offset=".5" stop-color="#1b2a39"/><stop offset="1" stop-color="#41586b"/></linearGradient><linearGradient id="${id}-road" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#30495b"/><stop offset="1" stop-color="#1b2d3c"/></linearGradient><radialGradient id="${id}-glow"><stop stop-color="#10b981" stop-opacity=".26"/><stop offset="1" stop-color="#10b981" stop-opacity="0"/></radialGradient><marker id="${id}-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0 0 10 5 0 10z" fill="#10b981"/></marker><filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#050c13" flood-opacity=".62"/></filter><filter id="${id}-soft"><feGaussianBlur stdDeviation="7"/></filter><style>@keyframes ${id}-pulse{0%,100%{opacity:.5}50%{opacity:1}}@keyframes ${id}-flow{from{stroke-dashoffset:42}to{stroke-dashoffset:0}}.${id}-pulse{animation:${id}-pulse 2.2s ease-in-out infinite}.${id}-flow{stroke-dasharray:9 9;animation:${id}-flow 1.8s linear infinite}@media(prefers-reduced-motion:reduce){.${id}-pulse,.${id}-flow{animation:none!important}}</style></defs>`;

function artwork(theme,id){
  const road = `<rect x="38" y="124" width="684" height="137" rx="23" fill="url(#${id}-road)" stroke="#436176" stroke-width="2"/><path d="M52 191h656" stroke="#c6e9ef" stroke-width="3" stroke-dasharray="18 15" opacity=".75"/><path d="M60 137h640M60 249h640" stroke="#10b981" stroke-width="2" opacity=".75"/>${car(166,166,'#10b981',0,.88)}${text(548,158,'CORSIA', '#9ed9e9',11,800)}`;
  const sign = (x,y,color,label,shape='circle') => {
    const symbol = shape==='triangle'
      ? `<path d="M${x} ${y-39} ${x+39} ${y+29} ${x-39} ${y+29}Z" fill="#f4f7f9" stroke="${color}" stroke-width="7"/><path d="M${x} ${y-19}v25m0 10v2" stroke="#e25555" stroke-width="6" stroke-linecap="round"/>`
      : shape==='oct'
        ? `<path d="M${x-23} ${y-38}h46l15 15v46l-15 15h-46l-15-15v-46z" fill="#f5f8f8" stroke="${color}" stroke-width="8"/>`
        : `<circle cx="${x}" cy="${y}" r="35" fill="#f5f8f8" stroke="${color}" stroke-width="8"/>`;
    const labelMarkup = shape==='triangle' ? '' : text(x,y+6,label,'#172b3a',shape==='oct'?14:18,900,'middle');
    return `<g filter="url(#shadow)">${symbol}${labelMarkup}</g>`;
  };
  switch(theme){
    case 'tire': return `<g><ellipse cx="174" cy="193" rx="91" ry="94" fill="none" stroke="#07121d" stroke-width="48"/><ellipse cx="174" cy="193" rx="91" ry="94" fill="none" stroke="url(#${id}-rubber)" stroke-width="38"/><ellipse cx="174" cy="193" rx="63" ry="66" fill="none" stroke="#92a6b4" stroke-width="8" opacity=".8"/><path d="M128 113q46-26 91 3M127 270q48 26 94-3" fill="none" stroke="#10b981" stroke-width="4" stroke-dasharray="7 7"/>${wheel(174,193,42)}<path d="M338 103h368a16 16 0 0 1 16 16v145a16 16 0 0 1-16 16H338a16 16 0 0 1-16-16V119a16 16 0 0 1 16-16Z" fill="#132637" stroke="#3f6178" stroke-width="2"/><path d="M348 226h352" stroke="#aebbc5" stroke-width="5"/><path d="M348 218h352" stroke="#60798b" stroke-width="16"/><path d="M364 218v-35h47v35m9 0v-35h46v35m10 0v-35h46v35m10 0v-35h46v35m10 0v-35h46v35m10 0v-35h46v35" fill="#263c4e" stroke="#7890a0" stroke-width="2"/><path d="M393 185v26m72-26v26m72-26v26m72-26v26" stroke="#081723" stroke-width="7" stroke-linecap="round"/><path d="M375 180v-30m0 0-8 10m8-10 8 10m290 20v-20m0 0-8 10m8-10 8 10" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${text(380,140,'BATTISTRADA','#e9f5f8',13,800)}${text(558,263,'PROFONDITÀ DEL BATTISTRADA','#8ee9d4',11,800,'middle')}${text(174,302,'Sezione del pneumatico','#b5c9d5',11,700,'middle')}<path d="M375 180h-20v22" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="4 4"/></g>`;
    case 'priority': return `<rect x="46" y="90" width="668" height="191" rx="22" fill="#172a39" stroke="#34546a" stroke-width="2"/><path d="M269 98h222v174H269z" fill="url(#${id}-road)"/><path d="M54 137h652v97H54z" fill="url(#${id}-road)"/><path d="M380 99v39m0 96v35M55 185h214m222 0h213" stroke="#d1e0e5" stroke-width="3" stroke-dasharray="15 13" opacity=".65"/><path d="M286 137v96m188-96v96" stroke="#10b981" stroke-width="3" opacity=".6"/><path d="M380 253V207" stroke="#10b981" stroke-width="5" stroke-linecap="round" marker-end="url(#${id}-arrow)" class="${id}-flow"/><path d="M246 185h53" stroke="#f4bd63" stroke-width="4" stroke-linecap="round"/><path d="M286 165v40" stroke="#f4bd63" stroke-width="4"/><path d="M424 185h74" stroke="#10b981" stroke-width="4" stroke-linecap="round" marker-end="url(#${id}-arrow)"/>${car(220,165,'#f2b85b',0,.82)}${car(339,229,'#10b981',-90,.82)}<circle cx="380" cy="185" r="19" fill="url(#${id}-glow)" class="${id}-pulse"/>${text(66,114,'CHI ARRIVA DA DESTRA PASSA PER PRIMO','#d8e8ed',11,800)}${text(665,267,'A DESTRA → PRECEDENZA','#56e2c5',11,800,'end')}<path d="M0 0"/>`;
    case 'speed': return `<circle cx="246" cy="190" r="105" fill="#142838" stroke="#46667c" stroke-width="3"/><path d="M167 235a98 98 0 1 1 158 0" fill="none" stroke="#3b5264" stroke-width="15" stroke-linecap="round"/><path d="M171 232a94 94 0 0 1 132-119" fill="none" stroke="url(#${id}-mint)" stroke-width="9" stroke-linecap="round"/><g transform="rotate(-38 246 190)" class="${id}-pulse"><path d="M246 190 246 112" stroke="#f6bc62" stroke-width="6" stroke-linecap="round"/><circle cx="246" cy="190" r="10" fill="#f6bc62"/></g>${text(246,242,'ADEGUA LA VELOCITÀ','#e8f3f7',12,800,'middle')}${text(515,145,'VEICOLO','#8ed7ef',12,800)}${text(515,169,'STRADA','#8ed7ef',12,800)}${text(515,193,'TRAFFICO','#8ed7ef',12,800)}${text(515,217,'VISIBILITÀ','#8ed7ef',12,800)}<path d="M481 140h-20v88h20" fill="none" stroke="#3b82f6" stroke-width="3"/>${car(446,229,'#10b981',0,.68)}`;
    case 'traffic-light': return `<rect x="96" y="98" width="174" height="177" rx="32" fill="#0b1722" stroke="#516c7e" stroke-width="4" filter="url(#shadow)"/><circle cx="183" cy="143" r="28" fill="#f0525f" class="${id}-pulse"/><circle cx="183" cy="143" r="40" fill="#ef445d" opacity=".16" filter="url(#${id}-soft)"/><circle cx="183" cy="190" r="23" fill="#735c35"/><circle cx="183" cy="235" r="23" fill="#234c44"/><path d="M183 275v22m-22 0h44" stroke="#7892a3" stroke-width="8" stroke-linecap="round"/>${text(364,139,'ROSSO','#ff8890',18,900)}${text(364,165,'FERMATI','#d5e5eb',12,700)}<path d="M320 153h26" stroke="#f0525f" stroke-width="3"/><path d="M370 204h258" stroke="#496b80" stroke-width="4"/><circle cx="376" cy="204" r="8" fill="#10b981"/><circle cx="505" cy="204" r="8" fill="#3b82f6"/><circle cx="632" cy="204" r="8" fill="#10b981"/>${text(376,233,'OSSERVA','#b8ccd6',10,700,'middle')}${text(505,233,'DECIDI','#b8ccd6',10,700,'middle')}${text(632,233,'AGISCI','#b8ccd6',10,700,'middle')}`;
    case 'distance': return `<path d="M80 119h600v146H80z" fill="url(#${id}-road)" stroke="#496c80" stroke-width="2"/><path d="M86 192h588" stroke="#c9e1e9" stroke-width="3" stroke-dasharray="20 16"/><path d="M128 145v95m74-95v95m74-95v95m74-95v95m74-95v95m74-95v95m74-95v95" stroke="#3b82f6" stroke-width="2" opacity=".25"/><path d="M232 145h282" stroke="#10b981" stroke-width="3" marker-start="url(#${id}-arrow)" marker-end="url(#${id}-arrow)"/>${car(140,165,'#3b82f6',0,.76)}${car(534,165,'#10b981',0,.76)}<circle cx="378" cy="185" r="40" fill="url(#${id}-glow)"/>${text(374,137,'SPAZIO DI ARRESTO','#b8e9e2',12,800,'middle')}${text(380,249,'AUMENTA LO SPAZIO CON VELOCITÀ E CONDIZIONI','#d6e5eb',10,700,'middle')}`;
    case 'stop': return `<path d="M78 117h604v145H78z" fill="url(#${id}-road)" stroke="#426075" stroke-width="2"/><path d="M98 187h565" stroke="#d4e8ed" stroke-width="3" stroke-dasharray="16 14"/><path d="M493 128v122" stroke="#f7f8f9" stroke-width="5"/><path d="M469 152h48" stroke="#ef5d65" stroke-width="5"/>${car(270,164,'#f1b85f',0,.78)}${sign(572,184,'#e7555c','STOP','oct')}${text(112,144,'ARRESTO COMPLETO','#f4c86d',12,800)}${text(112,231,'POI DAI LA PRECEDENZA','#dfeaf0',12,800)}`;
    case 'roundabout': return `<circle cx="375" cy="192" r="96" fill="none" stroke="#344e61" stroke-width="73"/><circle cx="375" cy="192" r="59" fill="#132534" stroke="#547286" stroke-width="3"/><circle cx="375" cy="192" r="20" fill="url(#${id}-glow)"/><path d="M375 82a110 110 0 0 1 98 59m-8 98a110 110 0 0 1-108 61m-92-55a110 110 0 0 1 0-108" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round" marker-end="url(#${id}-arrow)" class="${id}-flow"/>${car(432,108,'#10b981',40,.65)}${text(375,197,'ROTATORIA','#e8f4f8',12,800,'middle')}${text(88,268,'OSSERVA I SEGNALI E REGOLA LA VELOCITÀ','#b5cbd6',10,700)}`;
    case 'road': case 'markings': return `${road}<path d="M367 135v38m0 45v33" stroke="#f3c75d" stroke-width="5" stroke-linecap="round"/><path d="M610 185h-58m0 0 15-12m-15 12 15 12" fill="none" stroke="#3b82f6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${text(82,108,theme==='road'?'CARREGGIATA · CORSIA · MARCIAPIEDE':'LINEE CHE ORGANIZZANO LA CIRCOLAZIONE','#dbeaf0',11,800)}`;
    case 'vehicle': case 'lane-change': case 'overtake': case 'reverse': case 'highway-merge': case 'highway-emergency': return `<path d="M84 123h592v140H84z" fill="url(#${id}-road)" stroke="#47667a" stroke-width="2"/><path d="M95 192h570" stroke="#d2e3e9" stroke-width="3" stroke-dasharray="19 15"/><path d="M374 127v130" stroke="#e9c45e" stroke-width="3" stroke-dasharray="9 10"/>${car(205,165,'#10b981',theme==='reverse'?180:0,.84)}<path d="M345 180h98" stroke="#3b82f6" stroke-width="4" marker-end="url(#${id}-arrow)" class="${id}-flow"/>${text(465,150,theme==='vehicle'?'VEICOLO':'MANOVRA SICURA','#dcebf0',12,800)}${text(465,174,theme==='highway-emergency'?'CORSIA DI EMERGENZA':'CONTROLLA SPAZIO E TRAFFICO','#9dc4d7',10,700)}`;
    case 'speed-sign': return `<rect x="70" y="111" width="620" height="144" rx="20" fill="#162b3c" stroke="#405e72" stroke-width="2"/>${sign(210,180,'#e5545b','50')}${text(210,235,'km/h','#b9d0da',11,800,'middle')}${text(375,158,'LIMITE INDICATO','#e8f2f5',13,800)}${text(375,186,'ESEMPIO: 50 km/h','#f2c56f',15,900)}${text(375,214,'ADEGUA LA VELOCITÀ ALLE CONDIZIONI','#9fc5d4',10,700)}`;
    case 'sign-groups': case 'sign-types': return `<rect x="70" y="111" width="620" height="144" rx="20" fill="#162b3c" stroke="#405e72" stroke-width="2"/>${sign(192,178,'#e5545b','!','triangle')}${sign(375,178,'#e5545b','—')}${sign(558,178,'#3b82f6','↗')}${text(192,238,'PERICOLO','#f2c56f',10,800,'middle')}${text(375,238,'DIVIETO','#f2c56f',10,800,'middle')}${text(558,238,'OBBLIGO / INFO','#f2c56f',10,800,'middle')}`;
    case 'supplementary': return `<rect x="86" y="110" width="178" height="137" rx="18" fill="#f4f7f8" stroke="#e5545b" stroke-width="8" filter="url(#shadow)"/><path d="M175 129v50m-15-15 15 15 15-15" stroke="#243b4d" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="330" y="137" width="332" height="86" rx="14" fill="#e5edf1" stroke="#7892a2" stroke-width="2"/><path d="M356 159h280m-280 20h190m-190 20h235" stroke="#617c8f" stroke-width="5" stroke-linecap="round"/>${text(498,250,'IL PANNELLO PRECISA IL SEGNALE','#b9d1dc',11,800,'middle')}`;
    case 'officer': return `<path d="M90 220h580" stroke="#91a8b5" stroke-width="5"/><circle cx="379" cy="132" r="25" fill="#e8c49a"/><path d="M344 127q35-42 70 0v11h-70z" fill="#1b3448" stroke="#75c9ec" stroke-width="3"/><path d="M349 160h60l21 78h-101z" fill="#3b82f6" stroke="#a9dcfa" stroke-width="2"/><path d="M359 180 318 160m82 20 43-37" stroke="#e8c49a" stroke-width="12" stroke-linecap="round"/><path d="M318 155h-25m147-34 18-11" stroke="#f4c35e" stroke-width="7" stroke-linecap="round"/>${text(112,260,'SEGUI LE INDICAZIONI DELL’AGENTE','#dbe9ee',11,800)}`;
    case 'roadworks': return `<path d="M84 230h592V129H84z" fill="url(#${id}-road)"/><path d="M95 197h570" stroke="#d4e5eb" stroke-width="3" stroke-dasharray="17 15"/><path d="M120 130h500" stroke="#f3bd55" stroke-width="5" stroke-dasharray="15 10"/>${[190,300,410,520].map(x=>`<path d="m${x} 220 20-54 20 54z" fill="#f29b44" stroke="#ffcf74" stroke-width="3"/><path d="M${x+9} 199h22" stroke="#f6e9d6" stroke-width="5"/>`).join('')}<path d="M610 147v45m-12-12 12 12 12-12" fill="none" stroke="#3b82f6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${text(107,111,'SEGNALETICA TEMPORANEA','#f5ca76',11,800)}`;
    case 'vulnerable': return `<path d="M95 235h570" stroke="#416176" stroke-width="28" stroke-linecap="round"/><path d="M95 235h570" stroke="#dce9ed" stroke-width="3" stroke-dasharray="16 15"/>${car(490,202,'#3b82f6',0,.62)}<circle cx="202" cy="159" r="14" fill="#f2bd65"/><path d="m202 176-6 39m6-25-19 15m19-15 17 10m-23 15-16 30m18-30 20 29" stroke="#d9e5eb" stroke-width="7" stroke-linecap="round"/><circle cx="319" cy="191" r="9" fill="#10b981"/><circle cx="352" cy="191" r="9" fill="#10b981"/><path d="M318 200v29m34-29v29m-34-14 34 0" stroke="#a2c4d1" stroke-width="5" stroke-linecap="round"/>${text(92,119,'ATTENZIONE · SPAZIO · PRECEDENZA','#d7e8ee',11,800)}`;
    case 'emergency': return `<path d="M82 226h596" stroke="#445f72" stroke-width="58"/><path d="M82 226h596" stroke="#d5e2e8" stroke-width="3" stroke-dasharray="20 16"/><rect x="133" y="167" width="139" height="55" rx="15" fill="#eef4f6" stroke="#8aa1af" stroke-width="2"/><path d="M160 168v-13h84v13" fill="#e24f59" stroke="#ff8b89" stroke-width="3"/><path d="M201 160v-10m-8 5h16" stroke="#fff" stroke-width="3"/>${car(155,177,'#f1f5f7',0,.75)}<path d="M290 191h140" stroke="#10b981" stroke-width="5" marker-end="url(#${id}-arrow)" class="${id}-flow"/>${text(446,172,'LIBERA IL PASSAGGIO','#90eadb',13,800)}${text(446,196,'SICUREZZA PRIMA DI TUTTO','#d0e0e7',10,700)}`;
    case 'parking': case 'curves': return `<path d="M85 251h590" stroke="#38576b" stroke-width="78" stroke-linecap="round"/><path d="M85 251h590" stroke="#d7e7eb" stroke-width="3" stroke-dasharray="20 15"/><path d="M158 216v-54q0-34 34-34h83m-63 122v-52q0-28 26-28h96" fill="none" stroke="#3b82f6" stroke-width="5" stroke-linecap="round" marker-end="url(#${id}-arrow)"/>${car(220,207,'#10b981',0,.62)}${text(440,142,theme==='curves'?'VISIBILITÀ LIMITATA':'OSSERVA I DIVIETI','#dcebf0',12,800)}${text(440,166,'SCEGLI UN LUOGO SICURO','#95becf',10,700)}`;
    case 'brake': return `${wheel(188,194,70)}<circle cx="188" cy="194" r="34" fill="#263e50" stroke="#f0b65e" stroke-width="7"/><path d="M222 157q40 28 0 74" fill="none" stroke="#ff7478" stroke-width="12" stroke-linecap="round"/><path d="M280 191h96" stroke="#10b981" stroke-width="5" marker-end="url(#${id}-arrow)"/><path d="M409 138v106m-14-15 14 15 14-15" fill="none" stroke="#3b82f6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${text(492,167,'FRENATA PROGRESSIVA','#e3eef2',12,800)}${text(492,194,'VEICOLO SOTTO CONTROLLO','#94bfd1',10,700)}`;
    case 'lights': return `<path d="M112 159q72-52 144 0v63q-72-52-144 0z" fill="#193043" stroke="#7fa2b6" stroke-width="4"/><path d="M242 163h136m-136 27h189m-189 27h136" stroke="#10b981" stroke-width="4" stroke-linecap="round" opacity=".85"/><path d="M363 151 438 124m-75 66h92m-92 28 75 27" stroke="#3b82f6" stroke-width="3" opacity=".75"/>${text(485,158,'LUCI ADEGUATE','#dcebf0',13,800)}${text(485,183,'VEDERE · ESSERE VISTI','#98c6d4',11,700)}`;
    case 'cargo': case 'passengers': return `<path d="M118 176h380v70H118z" fill="#344e62" stroke="#7992a2" stroke-width="3"/><path d="M177 176v-47h92v47m22 0v-58h99v58m20 0v-34h82v34" fill="#10b981" fill-opacity=".45" stroke="#5be4c6" stroke-width="3"/><path d="M512 202h78m-78 0 16-13m-16 13 16 13" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${wheel(190,250,15)}${wheel(438,250,15)}${text(519,147,'CARICO STABILE','#dceaf0',11,800)}${text(519,170,'PESO DISTRIBUITO','#96c2d2',10,700)}`;
    case 'restraint': return `<path d="M167 112v130m124-130v130" stroke="#536e82" stroke-width="18" stroke-linecap="round"/><path d="M177 130 271 229" stroke="#10b981" stroke-width="13" stroke-linecap="round"/><path d="M254 135 193 229" stroke="#3b82f6" stroke-width="9" stroke-linecap="round"/><circle cx="220" cy="155" r="18" fill="#e9c79f"/><path d="M220 176v52m-24-35h48" stroke="#dcebf1" stroke-width="9" stroke-linecap="round"/>${text(369,158,'ANCORAGGIO CORRETTO','#dcebf0',12,800)}${text(369,187,'PROTEZIONE PER OGNI VIAGGIO','#94bfd1',10,700)}`;
    case 'license': case 'documents': case 'law': return `<rect x="113" y="111" width="222" height="145" rx="17" fill="#e5eef2" stroke="#98b3c0" stroke-width="3" filter="url(#shadow)"/><rect x="113" y="111" width="222" height="30" rx="15" fill="url(#${id}-blue)"/><circle cx="155" cy="180" r="24" fill="#9bb7c4"/><path d="M136 221q19-28 38 0" fill="none" stroke="#526f80" stroke-width="9" stroke-linecap="round"/><path d="M200 166h102m-102 23h84m-84 23h95" stroke="#59788a" stroke-width="5" stroke-linecap="round"/>${text(406,157,theme==='law'?'TESTO VIGENTE':theme==='license'?'PATENTE IN REGOLA':'DOCUMENTI A BORDO','#dcebf1',12,800)}${text(406,184,'VERIFICA · CONSERVA · AGGIORNA','#99c6d5',10,700)}`;
    case 'insurance': case 'accident': case 'violation': return `<path d="M210 112h138l50 50v92H210z" fill="#e9f1f4" stroke="#9bb1bd" stroke-width="3" filter="url(#shadow)"/><path d="M348 112v51h50" fill="#c8dbe2" stroke="#8ea7b4" stroke-width="3"/><path d="M241 185h122m-122 22h105m-105 22h79" stroke="#607c8b" stroke-width="5" stroke-linecap="round"/><circle cx="507" cy="178" r="51" fill="#193345" stroke="${theme==='accident'?'#f1b65f':'#10b981'}" stroke-width="4"/><path d="M507 148v35m0 16h.1" stroke="${theme==='accident'?'#f1b65f':'#10b981'}" stroke-width="8" stroke-linecap="round"/>${text(507,253,theme==='insurance'?'COPERTURA':'SEGUI LA PROCEDURA','#dbeaf0',11,800,'middle')}`;
    case 'alcohol': case 'medicine': return `<path d="M190 125h85m-15 0v69l38 52q9 13-8 13h-116q-17 0-8-13l38-52v-69" fill="#244258" stroke="#8da9b7" stroke-width="4"/><path d="M184 212h98" stroke="#10b981" stroke-width="25" opacity=".75"/><path d="M164 135 300 247" stroke="#ec5c67" stroke-width="9" stroke-linecap="round"/><circle cx="492" cy="184" r="61" fill="#162b3b" stroke="#e85d65" stroke-width="5"/><path d="m460 184 22 22 44-48" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>${text(492,269,'MAI ALLA GUIDA','#f28b8e',12,800,'middle')}`;
    case 'fatigue': case 'emotion': return `<path d="M113 195q83-93 166 0-83 93-166 0Z" fill="#172c3c" stroke="#6e8c9e" stroke-width="4"/><circle cx="196" cy="195" r="29" fill="#3b82f6"/><circle cx="196" cy="195" r="12" fill="#0b1520"/><path d="M420 136h160m-160 32h120m-120 32h142" stroke="#5b778a" stroke-width="6" stroke-linecap="round"/><path d="M451 232h94" stroke="#10b981" stroke-width="5" stroke-linecap="round"/>${text(420,125,theme==='fatigue'?'RIPOSA PRIMA DI GUIDARE':'CALMA E CONCENTRAZIONE','#dcebf0',12,800)}${text(196,259,theme==='fatigue'?'ATTENZIONE':'EQUILIBRIO','#96c3d2',10,700,'middle')}`;
    case 'phone': return `<rect x="150" y="105" width="112" height="174" rx="20" fill="#071522" stroke="#92aab8" stroke-width="4" filter="url(#shadow)"/><rect x="162" y="124" width="88" height="131" rx="8" fill="#24465d"/><circle cx="206" cy="267" r="5" fill="#91aab7"/><path d="M150 116 267 270" stroke="#ed5d66" stroke-width="9" stroke-linecap="round"/><path d="M355 227h278" stroke="#3c596d" stroke-width="31"/><path d="M355 227h278" stroke="#d4e4e9" stroke-width="3" stroke-dasharray="16 13"/>${car(470,194,'#10b981',0,.62)}${text(352,150,'SGUARDO SULLA STRADA','#dcebf0',12,800)}${text(352,175,'TELEFONO LONTANO DALLA MANO','#96c3d2',10,700)}`;
    case 'eco': case 'fuel': case 'pollution': case 'noise': return `<path d="M86 233h588" stroke="#36576a" stroke-width="55" stroke-linecap="round"/><path d="M86 233h588" stroke="#d4e4e9" stroke-width="3" stroke-dasharray="18 15"/>${car(196,203,'#10b981',0,.8)}<path d="M392 210q37-48 77 0t77 0" fill="none" stroke="${theme==='noise'?'#f0bc60':'#3b82f6'}" stroke-width="4" stroke-linecap="round"/><circle cx="566" cy="143" r="38" fill="#15394a" stroke="#10b981" stroke-width="3"/><path d="M548 148q18-34 36 0v18h-36z" fill="#10b981"/><path d="M566 122v40m-20-20h40" stroke="#b3ffeb" stroke-width="3"/>${text(400,118,theme==='noise'?'RIDUCI IL RUMORE':theme==='pollution'?'MANUTENZIONE REGOLARE':theme==='fuel'?'PIANIFICA IL PERCORSO':'GUIDA FLUIDA', '#dcebf0',12,800)}`;
    case 'checklist': return `<rect x="115" y="104" width="230" height="171" rx="18" fill="#152b3b" stroke="#4a687c" stroke-width="3" filter="url(#shadow)"/>${[145,190,235].map(y=>`<rect x="140" y="${y-14}" width="24" height="24" rx="6" fill="#10202d" stroke="#10b981" stroke-width="3"/><path d="m145 ${y-2} 7 7 11-15" fill="none" stroke="#69eed1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M179 ${y-2}h130" stroke="#91aab8" stroke-width="5" stroke-linecap="round"/>`).join('')}<circle cx="512" cy="184" r="59" fill="#142b3b" stroke="#3b82f6" stroke-width="4"/><path d="m482 184 21 22 41-47" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>${text(512,263,'CONTROLLO COMPLETATO','#dcebf0',10,800,'middle')}`;
    case 'dashboard': case 'safety': case 'heat': return `<path d="M108 233a130 130 0 0 1 260 0" fill="none" stroke="#446276" stroke-width="25" stroke-linecap="round"/><path d="M108 233a130 130 0 0 1 194-112" fill="none" stroke="${theme==='heat'?'#f05b61':'#10b981'}" stroke-width="9" stroke-linecap="round"/><path d="m238 225 69-72" stroke="#f4bd63" stroke-width="6" stroke-linecap="round"/><circle cx="238" cy="225" r="11" fill="#f4bd63"/><path d="M430 148h148m-148 35h108m-108 35h128" stroke="#6e8b9c" stroke-width="6" stroke-linecap="round"/><circle cx="615" cy="151" r="22" fill="${theme==='heat'?'#ef5a63':'#10b981'}" class="${id}-pulse"/>${text(430,128,theme==='heat'?'TEMPERATURA':'SPIE E SISTEMI', '#dcebf0',12,800)}${text(430,245,theme==='heat'?'FERMATI IN SICUREZZA':'OSSERVA · VALUTA · INTERVIENI','#96c3d2',10,700)}`;
    default: return `${road}${text(80,108,'OSSERVA · VALUTA · AGISCI','#dcebf0',11,800)}`;
  }
}

function fullSvg(lesson,compact=false){
  const id = String(lesson?.id ?? 'u1-l1');
  const [theme,labelIt,labelAr] = lessonVisuals[id] || ['road','Guida sicura','قيادة آمنة'];
  const prefix = id.replace(/[^a-zA-Z0-9_-]/g,'-');
  const title = lesson?.titleIt || lesson?.heading_it || labelIt;
  const description = `${labelIt} — ${labelAr}`;
  if (id === 'u4-l1') {
    return `<figure class="lesson-svg-figure${compact?' is-compact':''}" data-lesson-visual="${xml(id)}">${prioritySvg}${compact?'':`<figcaption><span lang="it" dir="ltr">${xml(labelIt)}</span><span lang="ar" dir="rtl">${xml(labelAr)}</span></figcaption>`}</figure>`;
  }
  const illustration = artwork(theme,prefix).replaceAll('url(#shadow)', `url(#${prefix}-shadow)`).replaceAll('url(#glass)', `url(#${prefix}-glass)`);
  return `<figure class="lesson-svg-figure${compact?' is-compact':''}" data-lesson-visual="${xml(id)}"><svg class="lesson-svg" viewBox="0 0 760 320" width="760" height="320" font-family="sans-serif" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" focusable="false" xmlns="http://www.w3.org/2000/svg"><title id="${prefix}-title">${xml(title)} · ${xml(labelAr)}</title><desc id="${prefix}-desc">${xml(description)}</desc>${defs(prefix)}<rect x="1" y="1" width="758" height="318" rx="24" fill="url(#${prefix}-bg)" stroke="#38566b" stroke-width="2"/><circle cx="662" cy="144" r="118" fill="url(#${prefix}-glow)"/><text x="30" y="35" fill="#89a9bb" font-size="10" font-weight="800" letter-spacing="1.5">PATENTE B · LEZIONE VISIVA</text><text x="30" y="64" fill="#f1f7fa" font-size="17" font-weight="800">${xml(labelIt)}</text><text x="730" y="63" fill="#8ee9d4" font-size="15" font-weight="700" text-anchor="end" direction="rtl" unicode-bidi="plaintext">${xml(labelAr)}</text>${illustration}</svg>${compact?'':`<figcaption><span lang="it" dir="ltr">${xml(labelIt)}</span><span lang="ar" dir="rtl">${xml(labelAr)}</span></figcaption>`}</figure>`;
}

export function renderLessonVisual(lesson, {compact=false}={}) {
  return fullSvg(lesson,compact);
}

export function renderLessonVisualById(id, {compact=false}={}) {
  return fullSvg({id},compact);
}

export function lessonVisualIds() {
  return Object.keys(lessonVisuals);
}
