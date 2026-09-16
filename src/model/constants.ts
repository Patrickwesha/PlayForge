/**
 * All diagram sizes are in YARDS so the editor, thumbnails, and print cells
 * render identically. transform.ts converts yards to SVG user units.
 */
export const UNITS_PER_YARD = 24;

/** Field geometry */
export const FIELD_WIDTH_YD = 53.333;
export const HASH_PRESETS = {
  nfl: 3.083,   // 18'6" from center
  ncaa: 6.667,  // 40' from sideline
  hs: 8.889,    // 53'4" apart
} as const;

/** Player symbols */
export const SYMBOL_R = 0.42;          // circle radius
export const SQUARE_SIDE = 0.84;       // center square
export const OL_SPACING = 1.0;         // default gap between OL centers
export const LETTER_SIZE = 0.9;        // bare defender letter height
export const LABEL_SIZE = 0.62;        // letter inside a circle
export const LABEL_SIZE_2CH = 0.5;     // two-character labels (LT, RG, FS)

/** Strokes */
export const STROKE = { thin: 0.045, normal: 0.07, thick: 0.1 } as const;
export const SYMBOL_STROKE = 0.06;
export const PRIMARY_UNDERLAY = 0.32;
export const HIT_STROKE = 0.6;

/** Markers */
export const ARROW_LEN = 0.55;
export const ARROW_HALF_W = 0.28;
export const TBAR_HALF_W = 0.35;
export const DOT_R = 0.16;
export const SQUIGGLE_AMP = 0.18;
export const SQUIGGLE_STEP = 0.25;
export const DASH = { dashed: [0.5, 0.3], dotted: [0.08, 0.25] } as const;

/** Text */
export const ANNOTATION_SIZE = { sm: 0.45, md: 0.55, lg: 0.75 } as const;
export const SPLIT_SIZE = 0.5;
export const FONT_STACK = 'Arial, Helvetica, sans-serif';

/** Colors */
export const COLORS = {
  ink: '#000000',
  paper: '#ffffff',
  red: '#D0021B',
  blue: '#1F4FD1',
  green: '#1E8A3C',
  brown: '#8B4A1C',
  orange: '#E07B00',
  gray: '#9AA0A6',
  primary: '#FFE600',
  yardline: '#D9D9D9',
  los: '#8C8C8C',
  selection: '#2D7FF9',
  guide: '#2D7FF9',
} as const;

/** Default view window in yards (x centered on the ball, y=0 at the LOS) */
export const DEFAULT_WINDOW = { minX: -20, maxX: 20, minY: -10, maxY: 15 } as const;

/** Print */
export const PAPER = {
  letter: { id: 'letter', wIn: 8.5, hIn: 11 },
  a4: { id: 'a4', wIn: 8.27, hIn: 11.69 },
} as const;
export const PAGE_MARGIN_IN = 0.35;
