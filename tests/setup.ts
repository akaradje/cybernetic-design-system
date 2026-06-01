import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Load a fixture file by name. */
export function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

/** Standard test components. */
export const CLEAN_CODE = loadFixture('clean.tsx');
export const DIRTY_CODE = loadFixture('dirty.tsx');

/** Pixel grid test data. */
export const PIXEL_GRID = [
  [{ r: 255, g: 0, b: 0, a: 255 }, { r: 0, g: 0, b: 255, a: 255 }],
  [{ r: 0, g: 0, b: 255, a: 255 }, { r: 255, g: 0, b: 0, a: 255 }],
];

/** Calibration test ratings. */
export const RATINGS = [
  { screenId: 'good', code: CLEAN_CODE, score: 6.1, method: 'likert' as const },
  { screenId: 'bad', code: DIRTY_CODE, score: 2.8, method: 'likert' as const },
  {
    screenId: 'ok',
    code: `export function Ok(){return(<div className="p-4 bg-gray-100"><h2 className="text-gray-900 text-xl">Title</h2><button className="bg-indigo-600 text-white px-4 py-2">Go</button></div>)}`,
    score: 4.5,
    method: 'likert' as const,
  },
  {
    screenId: 'minimal',
    code: `export function Min(){return(<div className="p-4 bg-white"><p className="text-gray-900">Hello</p></div>)}`,
    score: 4.0,
    method: 'likert' as const,
  },
  {
    screenId: 'complex',
    code: `export function Cx(){return(<div className="p-8 m-4 bg-slate-900"><h1 className="text-white text-3xl mb-4">Dark</h1><p className="text-slate-300">Body text here.</p><div className="gap-4 mt-4"><button className="bg-blue-600 text-white px-6 py-3">Primary</button><button className="bg-slate-700 text-slate-200 px-6 py-3">Secondary</button></div></div>)}`,
    score: 5.5,
    method: 'likert' as const,
  },
];
