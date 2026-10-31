// Modello dei progetti grafici: formati, caratteri, stile del cliente e modelli di partenza.
// Colori e caratteri possono essere riferimenti allo stile del cliente ("@primary", "@heading"):
// se il cliente cambia stile, i progetti che li usano si aggiornano da soli.

export const FORMATS = {
  'post-1x1': { label: 'Post quadrato', w: 1080, h: 1080, kind: 'post', content: 'Post' },
  'post-4x5': { label: 'Post verticale', w: 1080, h: 1350, kind: 'post', content: 'Post' },
  'story-9x16': { label: 'Storia', w: 1080, h: 1920, kind: 'post', content: 'Storia' },
  'reel-9x16': { label: 'Reel o TikTok', w: 1080, h: 1920, kind: 'reel', content: 'Reel' },
  'landscape-16x9': { label: 'Video orizzontale', w: 1920, h: 1080, kind: 'reel', content: 'Video' },
};

export const BRAND_COLORS = { primary: 'Primario', secondary: 'Secondario', accent: 'Accento', background: 'Sfondo', text: 'Testo' };
export const BRAND_FONTS = { heading: 'Titoli', body: 'Testi' };

// I caratteri Habitat sono serviti in locale; gli altri arrivano da Google Fonts quando servono.
export const FONTS = [
  { family: 'DM Sans', weights: [400, 500, 700], local: true },
  { family: 'Playfair Display', weights: [500, 700], local: true },
  { family: 'Inter', weights: [400, 600, 800], g: 'Inter:wght@400;600;800' },
  { family: 'Montserrat', weights: [400, 600, 800], g: 'Montserrat:ital,wght@0,400;0,600;0,800;1,400' },
  { family: 'Poppins', weights: [400, 600, 800], g: 'Poppins:ital,wght@0,400;0,600;0,800;1,400' },
  { family: 'Work Sans', weights: [400, 600, 800], g: 'Work+Sans:wght@400;600;800' },
  { family: 'Archivo', weights: [400, 600, 800], g: 'Archivo:wght@400;600;800' },
  { family: 'Space Grotesk', weights: [400, 600], g: 'Space+Grotesk:wght@400;600' },
  { family: 'Syne', weights: [400, 700, 800], g: 'Syne:wght@400;700;800' },
  { family: 'Nunito', weights: [400, 700, 900], g: 'Nunito:wght@400;700;900' },
  { family: 'Raleway', weights: [400, 600, 800], g: 'Raleway:wght@400;600;800' },
  { family: 'Oswald', weights: [400, 600], g: 'Oswald:wght@400;600' },
  { family: 'Bebas Neue', weights: [400], g: 'Bebas+Neue' },
  { family: 'Anton', weights: [400], g: 'Anton' },
  { family: 'Lora', weights: [400, 700], g: 'Lora:ital,wght@0,400;0,700;1,400' },
  { family: 'Merriweather', weights: [400, 700], g: 'Merriweather:ital,wght@0,400;0,700;1,400' },
  { family: 'Fraunces', weights: [400, 700], g: 'Fraunces:ital,wght@0,400;0,700;1,400' },
  { family: 'Libre Baskerville', weights: [400, 700], g: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400' },
  { family: 'Cormorant Garamond', weights: [500, 700], g: 'Cormorant+Garamond:ital,wght@0,500;0,700;1,500' },
  { family: 'Caveat', weights: [400, 700], g: 'Caveat:wght@400;700' },
];
export const fontInfo = (family) => FONTS.find((f) => f.family === family) || FONTS[0];

const requested = new Set();
const sheets = new Map();
const fontListeners = new Set();
export const onFontLoaded = (fn) => { fontListeners.add(fn); return () => fontListeners.delete(fn); };

// Il foglio di Google Fonts va aspettato: chiedere il carattere prima che arrivi non carica nulla.
function sheet(info) {
  if (!info.g) return Promise.resolve();
  if (!sheets.has(info.family)) {
    sheets.set(info.family, new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.dataset.font = info.family;
      link.href = `https://fonts.googleapis.com/css2?family=${info.g}&display=swap`;
      link.onload = resolve;
      link.onerror = resolve; // senza connessione resta il carattere di riserva
      document.head.append(link);
    }));
  }
  return sheets.get(info.family);
}

// Carica un carattere e avvisa quando è pronto, così il disegno sulla tela usa quello giusto.
export function ensureFont(family, weight = 400, italic = false) {
  const info = fontInfo(family);
  const spec = `${italic ? 'italic ' : ''}${weight} 40px "${info.family}"`;
  if (sheets.has(info.family) || !info.g) { if (document.fonts.check(spec)) return true; }
  if (!requested.has(spec)) {
    requested.add(spec);
    sheet(info)
      .then(() => document.fonts.load(spec))
      .then(() => fontListeners.forEach((fn) => fn()))
      .catch(() => {});
  }
  return false;
}

export const nearestWeight = (family, w) => fontInfo(family).weights.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a));

export function resolveColor(c, brand) {
  if (!c) return null;
  if (c[0] === '@') return brand.colors[c.slice(1)] || '#000000';
  return c;
}
export function resolveFont(f, brand) {
  if (f === '@heading') return brand.fonts.heading;
  if (f === '@body') return brand.fonts.body;
  return f || brand.fonts.body;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

const base = { rotation: 0, opacity: 1, hidden: false, locked: false, start: 0, end: null, anim: 'none' };

export function textLayer(props) {
  return {
    ...base, id: uid(), type: 'text', name: 'Testo', x: 100, y: 100, w: 600, h: 100,
    text: 'Testo', font: '@body', weight: 400, italic: false, size: 48, lineHeight: 1.2, align: 'left',
    color: '@text', letterSpacing: 0, uppercase: false, bg: null, bgRadius: 12, pad: 0, shadow: false, ...props,
  };
}
export function shapeLayer(props) {
  return { ...base, id: uid(), type: 'shape', name: 'Forma', shape: 'rect', x: 100, y: 100, w: 300, h: 300, fill: '@accent', stroke: null, strokeWidth: 0, radius: 0, ...props };
}
export function imageLayer(props) {
  return {
    ...base, id: uid(), type: 'image', name: 'Immagine', x: 0, y: 0, w: 400, h: 400, assetId: null, fit: 'cover', radius: 0,
    brightness: 100, contrast: 100, saturate: 100, flipX: false, ...props,
  };
}

export function emptyDoc(format) {
  const f = FORMATS[format];
  const doc = { version: 1, w: f.w, h: f.h, background: { color: '@background', color2: null, angle: 180 }, layers: [] };
  if (f.kind === 'reel') Object.assign(doc, { clips: [], audio: null, clipVolume: 1 });
  return doc;
}

// Modelli di partenza per i post: posizioni proporzionali al formato, colori e caratteri del cliente.
// I testi sono istruzioni da sostituire, non contenuti finti.
export const POST_TEMPLATES = [
  { id: 'vuoto', name: 'Pagina vuota', build: () => [] },
  {
    id: 'titolo', name: 'Titolo e testo',
    build: ({ w, h }) => [
      shapeLayer({ name: 'Filetto', x: w * 0.08, y: h * 0.12, w: w * 0.14, h: Math.max(10, w * 0.012), fill: '@accent' }),
      textLayer({ name: 'Titolo', x: w * 0.08, y: h * 0.17, w: w * 0.84, text: 'Scrivi qui il titolo del post', font: '@heading', weight: 700, size: w * 0.088, lineHeight: 1.08, color: '@primary' }),
      textLayer({ name: 'Testo', x: w * 0.08, y: h * 0.58, w: w * 0.74, text: 'Una o due frasi che spiegano il punto. Tieni il testo breve: si legge meglio dal telefono.', size: w * 0.038, lineHeight: 1.4, color: '@text' }),
      imageLayer({ name: 'Logo', assetId: '@logo', fit: 'contain', x: w * 0.08, y: h * 0.86, w: w * 0.2, h: h * 0.07 }),
    ],
  },
  {
    id: 'citazione', name: 'Citazione',
    background: { color: '@primary' },
    build: ({ w, h }) => [
      textLayer({ name: 'Virgolette', x: w * 0.08, y: h * 0.1, w: w * 0.3, text: '“', font: '@heading', weight: 700, size: w * 0.3, lineHeight: 1, color: '@accent' }),
      textLayer({ name: 'Citazione', x: w * 0.08, y: h * 0.34, w: w * 0.84, text: 'Incolla qui la frase da mettere in evidenza', font: '@heading', italic: true, weight: 500, size: w * 0.07, lineHeight: 1.18, color: '@background' }),
      textLayer({ name: 'Autore', x: w * 0.08, y: h * 0.8, w: w * 0.84, text: 'Nome e ruolo di chi parla', size: w * 0.034, weight: 700, color: '@accent', uppercase: true, letterSpacing: 3 }),
    ],
  },
  {
    id: 'foto', name: 'Foto con titolo',
    build: ({ w, h }) => [
      imageLayer({ name: 'Foto', x: 0, y: 0, w, h }),
      shapeLayer({ name: 'Velatura', x: 0, y: h * 0.55, w, h: h * 0.45, fill: '@primary', opacity: 0.82 }),
      textLayer({ name: 'Titolo', x: w * 0.07, y: h * 0.62, w: w * 0.86, text: 'Titolo sopra la foto', font: '@heading', weight: 700, size: w * 0.08, lineHeight: 1.1, color: '@background' }),
      textLayer({ name: 'Sottotitolo', x: w * 0.07, y: h * 0.86, w: w * 0.86, text: 'Dettaglio o invito all\'azione', size: w * 0.036, color: '@accent', weight: 700 }),
    ],
  },
  {
    id: 'elenco', name: 'Tre punti',
    build: ({ w, h }) => {
      const out = [textLayer({ name: 'Titolo', x: w * 0.08, y: h * 0.08, w: w * 0.84, text: 'Tre cose da sapere su…', font: '@heading', weight: 700, size: w * 0.07, lineHeight: 1.1, color: '@primary' })];
      [0, 1, 2].forEach((i) => {
        const y = h * (0.36 + i * 0.19);
        out.push(shapeLayer({ name: `Numero ${i + 1}`, shape: 'ellipse', x: w * 0.08, y, w: w * 0.1, h: w * 0.1, fill: '@accent' }));
        out.push(textLayer({ name: `Cifra ${i + 1}`, x: w * 0.08, y: y + w * 0.018, w: w * 0.1, text: String(i + 1), font: '@heading', weight: 700, size: w * 0.05, align: 'center', color: '@primary', lineHeight: 1.1 }));
        out.push(textLayer({ name: `Punto ${i + 1}`, x: w * 0.23, y: y + w * 0.012, w: w * 0.69, text: `Punto ${i + 1}: scrivi una frase breve`, size: w * 0.04, lineHeight: 1.3, color: '@text' }));
      });
      return out;
    },
  },
  {
    id: 'evento', name: 'Evento o promo',
    background: { color: '@secondary' },
    build: ({ w, h }) => [
      textLayer({ name: 'Etichetta', x: w * 0.08, y: h * 0.09, w: w * 0.84, text: 'Save the date', size: w * 0.035, weight: 700, uppercase: true, letterSpacing: 4, color: '@accent' }),
      textLayer({ name: 'Data', x: w * 0.08, y: h * 0.16, w: w * 0.84, text: '12.11', font: '@heading', weight: 700, size: w * 0.24, lineHeight: 1, color: '@background' }),
      textLayer({ name: 'Titolo', x: w * 0.08, y: h * 0.46, w: w * 0.84, text: 'Nome dell\'evento o dell\'offerta', font: '@heading', weight: 500, size: w * 0.068, lineHeight: 1.12, color: '@background' }),
      textLayer({ name: 'Bottone', x: w * 0.08, y: h * 0.8, w: w * 0.5, text: 'Prenota il tuo posto', size: w * 0.036, weight: 700, align: 'center', color: '@primary', bg: '@accent', bgRadius: w * 0.05, pad: w * 0.03 }),
    ],
  },
];

// Testi pronti da mettere sopra un reel, con tempi di comparsa.
export const REEL_TEXTS = [
  {
    id: 'apertura', name: "Titolo d'apertura",
    build: ({ w, h }) => [textLayer({ name: "Titolo d'apertura", x: w * 0.08, y: h * 0.38, w: w * 0.84, text: 'La frase che ferma lo scroll', font: '@heading', weight: 700, size: w * 0.085, align: 'center', lineHeight: 1.1, color: '@background', shadow: true, start: 0, end: 3, anim: 'pop' })],
  },
  {
    id: 'sottotitolo', name: 'Sottotitolo in basso',
    build: ({ w, h }) => [textLayer({ name: 'Sottotitolo', x: w * 0.1, y: h * 0.72, w: w * 0.8, text: 'Scrivi qui il sottotitolo', size: w * 0.045, weight: 700, align: 'center', color: '@text', bg: '@background', bgRadius: w * 0.02, pad: w * 0.025, start: 0, end: null, anim: 'fade' })],
  },
  {
    id: 'chiusura', name: 'Chiusura con logo',
    build: ({ w, h }, duration) => {
      const s = Math.max(0, (duration || 6) - 3);
      return [
        shapeLayer({ name: 'Fondo chiusura', x: 0, y: 0, w, h, fill: '@primary', opacity: 0.9, start: s, end: null, anim: 'fade' }),
        imageLayer({ name: 'Logo', assetId: '@logo', fit: 'contain', x: w * 0.25, y: h * 0.36, w: w * 0.5, h: h * 0.14, start: s, end: null, anim: 'pop' }),
        textLayer({ name: 'Invito', x: w * 0.1, y: h * 0.55, w: w * 0.8, text: 'Seguici per altri consigli', size: w * 0.05, weight: 700, align: 'center', color: '@accent', start: s, end: null, anim: 'slide' }),
      ];
    },
  },
  {
    id: 'didascalia', name: 'Didascalia a scorrimento',
    build: ({ w, h }) => [textLayer({ name: 'Didascalia', x: w * 0.08, y: h * 0.12, w: w * 0.84, text: 'Testo che compare lettera per lettera', size: w * 0.05, weight: 700, color: '@background', shadow: true, start: 0.5, end: 5, anim: 'typewriter' })],
  },
];

export const ANIMS = { none: 'Nessuna', fade: 'Dissolvenza', slide: 'Sale dal basso', pop: 'Ingrandimento', typewriter: 'Macchina da scrivere' };
