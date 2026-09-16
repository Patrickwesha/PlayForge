import { FONT_STACK } from '@/model/constants';

/** Rough width of Arial bold text in yards for a given font size in yards. */
export function estimateTextWidth(text: string, sizeYd: number): number {
  return text.length * sizeYd * 0.62;
}

export const fontFamily = FONT_STACK;
