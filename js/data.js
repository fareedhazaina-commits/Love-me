// ─── SKIN TONES ───────────────────────────────────────────────────────────────
const SKIN_TONES = [
  { id: 'Porcelein', name: 'Porcelain', hex: '#F8EBD8' },
  { id: 'Base',      name: 'Base',      hex: '#F2D9B8' },
  { id: 'Ivory',     name: 'Ivory',     hex: '#EED5A0' },
  { id: 'Sand',      name: 'Sand',      hex: '#E8C49A' },
  { id: 'Honey',     name: 'Honey',     hex: '#D4A472' },
  { id: 'Caramel',   name: 'Caramel',   hex: '#C08A58' },
  { id: 'Toffee',    name: 'Toffee',    hex: '#A06C3C' },
  { id: 'Mahogany',  name: 'Mahogany',  hex: '#7A4C28' },
  { id: 'Espresso',  name: 'Espresso',  hex: '#4E2C10' },
];

// ─── ZONES ────────────────────────────────────────────────────────────────────
const ZONES = {
  foundation: [
    { cx: 0.50, cy: 0.40, rx: 0.44, ry: 0.50 }
  ],
  contour: [
    { cx: 0.18, cy: 0.50, rx: 0.15, ry: 0.19 },
    { cx: 0.82, cy: 0.50, rx: 0.15, ry: 0.19 },
    { cx: 0.44, cy: 0.44, rx: 0.04, ry: 0.12 },
    { cx: 0.56, cy: 0.44, rx: 0.04, ry: 0.12 },
    { cx: 0.28, cy: 0.60, rx: 0.18, ry: 0.04 },
    { cx: 0.72, cy: 0.60, rx: 0.18, ry: 0.04 },
  ],
  eyeshadow: [
    { cx: 0.34, cy: 0.355, rx: 0.20, ry: 0.115 },
    { cx: 0.66, cy: 0.355, rx: 0.20, ry: 0.115 },
  ],
  eyeliner: [
    { cx: 0.34, cy: 0.350, rx: 0.20, ry: 0.075 },
    { cx: 0.66, cy: 0.350, rx: 0.20, ry: 0.075 },
  ],
  blush: [
    { cx: 0.24, cy: 0.52, rx: 0.26, ry: 0.18 },
    { cx: 0.76, cy: 0.52, rx: 0.26, ry: 0.18 },
    { cx: 0.50, cy: 0.44, rx: 0.06, ry: 0.08 },
  ],
  highlighter: [
    { cx: 0.34, cy: 0.315, rx: 0.13, ry: 0.050 },
    { cx: 0.66, cy: 0.315, rx: 0.13, ry: 0.050 },
    { cx: 0.50, cy: 0.375, rx: 0.036, ry: 0.145 },
    { cx: 0.50, cy: 0.488, rx: 0.046, ry: 0.026 },
    { cx: 0.50, cy: 0.620, rx: 0.046, ry: 0.026 },
    { cx: 0.29, cy: 0.355, rx: 0.060, ry: 0.040 },
    { cx: 0.71, cy: 0.355, rx: 0.060, ry: 0.040 },
  ],
  lipcolor: [
    { cx: 0.50, cy: 0.524, rx: 0.200, ry: 0.092 }
  ],
  lipgloss: [
    { cx: 0.50, cy: 0.524, rx: 0.200, ry: 0.092 }
  ],
  mascara: [
    { cx: 0.34, cy: 0.350, rx: 0.18, ry: 0.060 },
    { cx: 0.66, cy: 0.350, rx: 0.18, ry: 0.060 },
  ],
};

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
const PRODUCTS = {
  foundation: {
    id: 'foundation', name: 'Foundation',
    icon: 'assets/Makeup Products/Foundations/Foundations.png',
    zone: 'foundation',
    radius: 52, opacityStep: 0.012, blendMode: 'source-over',
    shadeType: 'pans',
    shades: [
      { name: 'Porcelain', hex: '#F8EBD8' },
      { name: 'Ivory',     hex: '#F2D9B8' },
      { name: 'Sand',      hex: '#E8C49A' },
      { name: 'Honey',     hex: '#D4A472' },
      { name: 'Caramel',   hex: '#C08A58' },
      { name: 'Toffee',    hex: '#A06C3C' },
      { name: 'Mahogany',  hex: '#7A4C28' },
      { name: 'Espresso',  hex: '#4E2C10' },
    ],
  },

  contour: {
    id: 'contour', name: 'Contour',
    icon: 'assets/Makeup Products/Contour/Contour.png',
    zone: 'contour',
    radius: 28, opacityStep: 0.022, blendMode: 'multiply',
    shadeType: 'pans',
    shades: [
      { name: 'Cool Taupe',    hex: '#A08878' },
      { name: 'Warm Tan',      hex: '#B08060' },
      { name: 'Soft Brown',    hex: '#906848' },
      { name: 'Deep Brown',    hex: '#704830' },
      { name: 'Ash Grey',      hex: '#908888' },
      { name: 'Warm Mahogany', hex: '#604028' },
    ],
  },

  blush: {
    id: 'blush', name: 'Blush',
    icon: 'assets/Makeup Products/Blush/Blush.png',
    zone: 'blush',
    radius: 54, opacityStep: 0.020, blendMode: 'multiply',
    shadeType: 'pans',
    shades: [
      { name: 'Baby Pink',  hex: '#F0A0B0' },
      { name: 'Coral',      hex: '#E88060' },
      { name: 'Peach',      hex: '#F0B090' },
      { name: 'Rose',       hex: '#D06080' },
      { name: 'Terracotta', hex: '#C06050' },
      { name: 'Lilac',      hex: '#C0A0C8' },
    ],
  },

  highlighter: {
    id: 'highlighter', name: 'Highlighter',
    icon: 'assets/Makeup Products/Highlighter/Highlighter.png',
    zone: 'highlighter',
    radius: 28, opacityStep: 0.030, blendMode: 'screen',
    shadeType: 'pans',
    shades: [
      { name: 'Champagne',  hex: '#F0E8C8', shimmer: true },
      { name: 'Rose Gold',  hex: '#E8B090', shimmer: true },
      { name: 'Gold',       hex: '#F0C84A', shimmer: true },
      { name: 'Silver',     hex: '#E0E8F0', shimmer: true },
    ],
  },

  eyeshadow: {
    id: 'eyeshadow', name: 'Eyeshadow',
    icon: 'assets/Makeup Products/Eyeshadow/Eyeshadow.png',
    zone: 'eyeshadow',
    radius: 22, opacityStep: 0.032, blendMode: 'multiply',
    shadeType: 'palette',
    shades: [
      { name: 'Nude Pink',     hex: '#E8B4B8' },
      { name: 'Rose Gold',     hex: '#C8845A', shimmer: true },
      { name: 'Dusty Mauve',   hex: '#9E7A8A' },
      { name: 'Berry',         hex: '#7A3A5A' },
      { name: 'Deep Plum',     hex: '#4A1A3A' },
      { name: 'Bronze',        hex: '#A0622A', shimmer: true },
      { name: 'Copper',        hex: '#B8643C', shimmer: true },
      { name: 'Gold',          hex: '#C8A44A', shimmer: true },
      { name: 'Champagne',     hex: '#D4BC8A', shimmer: true },
      { name: 'Olive Khaki',   hex: '#7A8054' },
      { name: 'Forest Green',  hex: '#3A6040' },
      { name: 'Teal',          hex: '#2A7070' },
      { name: 'Sky Blue',      hex: '#6A9EC0' },
      { name: 'Navy',          hex: '#2A3A6A' },
      { name: 'Lavender',      hex: '#9A86C0' },
      { name: 'Lilac',         hex: '#B49AC8' },
      { name: 'Baby Pink',     hex: '#E8B8C8' },
      { name: 'Hot Pink',      hex: '#D04080' },
      { name: 'Coral',         hex: '#E07060' },
      { name: 'White Shimmer', hex: '#F0EAD8', shimmer: true },
    ],
  },

  eyeliner: {
    id: 'eyeliner', name: 'Eyeliner',
    icon: 'assets/Makeup Products/Eyeliners/Thin Eyeliner.png',
    zone: 'eyeliner',
    radius: 3, opacityStep: 0.22, blendMode: 'source-over',
    shadeType: 'pens',
    shades: [
      { name: 'Thin',      hex: '#1A1010', img: 'assets/Makeup Products/Eyeliners/Thin Eyeliner.png',     radius: 2 },
      { name: 'Classic',   hex: '#1A1010', img: 'assets/Makeup Products/Eyeliners/Classic Wing Pen.png',  radius: 3 },
      { name: 'Cat Wing',  hex: '#1A1010', img: 'assets/Makeup Products/Eyeliners/Cat Eyeliner.png',      radius: 4 },
      { name: 'Waterline', hex: '#2A2020', img: 'assets/Makeup Products/Eyeliners/Waterline.png',         radius: 3 },
      { name: 'Graphic',   hex: '#1A1010', img: 'assets/Makeup Products/Eyeliners/Graphic Iiner Pen.png', radius: 5 },
    ],
    colors: [
      { name: 'Black',     hex: '#1A1010' },
      { name: 'Brown',     hex: '#3D1F0D' },
      { name: 'Navy',      hex: '#1A2A5A' },
      { name: 'Dark Grey', hex: '#3A3A3A' },
      { name: 'White',     hex: '#F5F5F0' },
    ],
  },

  mascara: {
    id: 'mascara', name: 'Mascara',
    icon: 'assets/Makeup Products/Mascara/Mascara.png',
    zone: 'mascara',
    radius: 5, opacityStep: 0.18, blendMode: 'source-over',
    shadeType: 'pans',
    shades: [
      { name: 'Black',       hex: '#0A0A0A' },
      { name: 'Brown Black', hex: '#1A1010' },
      { name: 'Dark Brown',  hex: '#2A1508' },
    ],
  },

  lipcolor: {
    id: 'lipcolor', name: 'Lip Color',
    icon: 'assets/Makeup Products/Lipsticks/Rose.png',
    zone: 'lipcolor',
    radius: 14, opacityStep: 0.048, blendMode: 'multiply',
    shadeType: 'bullets',
    shades: [
      { name: 'Nude Beige',  hex: '#C9A882', img: 'assets/Makeup Products/Lipsticks/Nude Beige.png' },
      { name: 'Peachy Nude', hex: '#D4956A', img: 'assets/Makeup Products/Lipsticks/Peachy Nude.png' },
      { name: 'Soft Pink',   hex: '#E08090', img: 'assets/Makeup Products/Lipsticks/Soft Pink.png' },
      { name: 'Rose',        hex: '#C05060', img: 'assets/Makeup Products/Lipsticks/Rose.png' },
      { name: 'Hot Pink',    hex: '#E03070', img: 'assets/Makeup Products/Lipsticks/Hot Pink.png' },
      { name: 'Berry',       hex: '#8A3050', img: 'assets/Makeup Products/Lipsticks/Berry.png' },
      { name: 'Deep Plum',   hex: '#5A1A38', img: 'assets/Makeup Products/Lipsticks/Deep Plum.png' },
      { name: 'Classic Red', hex: '#CC2020', img: 'assets/Makeup Products/Lipsticks/Red.png' },
      { name: 'Coral Red',   hex: '#E04030', img: 'assets/Makeup Products/Lipsticks/Coral Red.png' },
      { name: 'Orange Red',  hex: '#D84820', img: 'assets/Makeup Products/Lipsticks/Red Orange.png' },
      { name: 'Brick',       hex: '#A04030', img: 'assets/Makeup Products/Lipsticks/Brick.png' },
      { name: 'Brown Nude',  hex: '#9A6040', img: 'assets/Makeup Products/Lipsticks/Brown Nude.png' },
      { name: 'Mauve',       hex: '#A07080', img: 'assets/Makeup Products/Lipsticks/Mauve.png' },
      { name: 'Dusty Rose',  hex: '#C09090', img: 'assets/Makeup Products/Lipsticks/Dusty Rose.png' },
      { name: 'Sheer',       hex: '#FFE8E0', img: 'assets/Makeup Products/Lipsticks/Sheer.png' },
    ],
  },

  lipgloss: {
    id: 'lipgloss', name: 'Lip Gloss',
    icon: 'assets/Makeup Products/Gloss/Pink Gloss.png',
    zone: 'lipgloss',
    radius: 13, opacityStep: 0.032, blendMode: 'screen',
    shadeType: 'bullets',
    shades: [
      { name: 'Clear',       hex: '#FFFFFF', shimmer: true, img: 'assets/Makeup Products/Gloss/Clear Gloss.png' },
      { name: 'Pink',        hex: '#FFB0C0', shimmer: true, img: 'assets/Makeup Products/Gloss/Pink Gloss.png' },
      { name: 'Peach',       hex: '#FFD0A0', shimmer: true, img: 'assets/Makeup Products/Gloss/Peach Gloss.png' },
      { name: 'Red',         hex: '#FF8080', shimmer: true, img: 'assets/Makeup Products/Gloss/Red Gloss.png' },
      { name: 'Coral',       hex: '#FFB090', shimmer: true, img: 'assets/Makeup Products/Gloss/Coral Gloss.png' },
      { name: 'Berry',       hex: '#C080A0', shimmer: true, img: 'assets/Makeup Products/Gloss/Berry Gloss.png' },
      { name: 'Brown',       hex: '#C09070', shimmer: true, img: 'assets/Makeup Products/Gloss/Brown Gloss.png' },
      { name: 'Holographic', hex: '#E8D0F8', shimmer: true, img: 'assets/Makeup Products/Gloss/Holographic Gloss.png' },
    ],
  },
};

// PRD-correct layer order:
// Foundation → Contour → Blush → Highlighter → Eyeshadow → Eyeliner → Mascara → Lipcolor → Lipgloss
const LAYER_ORDER = ['foundation','contour','blush','highlighter','eyeshadow','eyeliner','mascara','lipcolor','lipgloss'];

// ─── OVERLAYS ─────────────────────────────────────────────────────────────────
const BROW_STYLES = [
  { id: 'Straight',        name: 'Straight',      img: 'assets/Eyebrows/Straight.png' },
  { id: 'Soft Arc',        name: 'Soft Arc',       img: 'assets/Eyebrows/Soft Arc.png' },
  { id: 'High Arc',        name: 'High Arc',       img: 'assets/Eyebrows/High Arc.png' },
  { id: 'Thick and Bushy', name: 'Thick & Bushy',  img: 'assets/Eyebrows/Thick and Bushy.png' },
  { id: 'Fluttering',      name: 'Feathered',      img: 'assets/Eyebrows/Fluttering.png' },
];

const BROW_COLORS = [
  { name: 'Black',        hex: '#1A1010', pencil: 'assets/Makeup Products/Eyebrow Pencil/Black Eyebrow Pencil.png' },
  { name: 'Dark Brown',   hex: '#3D1F0D', pencil: 'assets/Makeup Products/Eyebrow Pencil/Dark Brown Eyebrow.png' },
  { name: 'Medium Brown', hex: '#6B3A2A', pencil: 'assets/Makeup Products/Eyebrow Pencil/Medium Brown Eyebrow.png' },
  { name: 'Warm Blonde',  hex: '#C8A040', pencil: 'assets/Makeup Products/Eyebrow Pencil/Warm Blonde Eyebrow.png' },
  { name: 'Auburn',       hex: '#8B3014', pencil: 'assets/Makeup Products/Eyebrow Pencil/Auburn Eyebrow.png' },
  { name: 'Bleached',     hex: '#E8D0A8', pencil: 'assets/Makeup Products/Eyebrow Pencil/Light Bleach.png' },
];

const LASH_STYLES = [
  { id: 'Natural',   name: 'Natural',   img: 'assets/Eyelashes/Natural.png' },
  { id: 'Fluttery',  name: 'Fluttery',  img: 'assets/Eyelashes/Fluttery.png' },
  { id: 'Dramatic',  name: 'Dramatic',  img: 'assets/Eyelashes/Dramatic.png' },
  { id: 'Wispy',     name: 'Wispy',     img: 'assets/Eyelashes/Wispy.png' },
  { id: 'Half-lash', name: 'Half Lash', img: 'assets/Eyelashes/Half-lash.png' },
];

const HAIR_STYLES = [
  { id: 'Long Straight', name: 'Long Straight',
    back:  'assets/Hair/Long Straight Back.png',
    front: 'assets/Hair/Long Straight Front.png' },
  { id: 'Wavy Long',     name: 'Wavy Long',      img: 'assets/Hair/Wavy long.png' },
  { id: 'Curtain Bangs', name: 'Curtain Bangs',  img: 'assets/Hair/Curtain Bangs.png' },
  { id: 'Half Up Bump',  name: 'Half Up Bump',   img: 'assets/Hair/Half up Bump.png' },
  { id: 'High Ponytail', name: 'High Ponytail',  img: 'assets/Hair/High Ponytail.png' },
  { id: 'Double Buns',   name: 'Double Buns',    img: 'assets/Hair/Double Buns.png' },
  { id: 'Braided',       name: 'Braided Half-up', img: 'assets/Hair/Braider Half-up.png' },
];
