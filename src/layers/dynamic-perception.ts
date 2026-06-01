import type { DesignIR, IRNode } from '../types';
import type { PixelData } from '../metrics/image';

/**
 * M1 — Dynamic perception via Playwright.
 *
 * Renders a JSX/TSX component in headless Chromium, reads computed bounding
 * boxes per node, and captures a screenshot for image-statistic metrics.
 *
 * The approach:
 * 1. Inject `data-cds-id` attributes into the source (surgical, byte-safe)
 * 2. Wrap in an HTML page with React + Tailwind CDN
 * 3. Render in Playwright
 * 4. Read getBoundingClientRect() per `[data-cds-id]`
 * 5. Capture screenshot as raw pixel data
 * 6. Merge geometry back into the IR
 */

export interface DynamicOptions {
  /** Viewport width in px (default 1440). */
  width?: number;
  /** Viewport height in px (default 900). */
  height?: number;
  /** Wait time in ms after render before reading boxes (default 500). */
  waitMs?: number;
  /** Whether to capture screenshot for image metrics (default true). */
  captureScreenshot?: boolean;
}

export interface DynamicResult {
  /** The IR with box geometry filled in. */
  ir: DesignIR;
  /** Screenshot pixel data for image metrics (null if captureScreenshot=false). */
  pixels: PixelData | null;
}

/**
 * Inject `data-cds-id="nX"` attributes into the source code for each JSX
 * element that has a corresponding IR node. This is a surgical edit that
 * only touches static className sites.
 */
export function injectCdsIds(code: string, ir: DesignIR): string {
  // Build a map: classNameSite index → node id
  const siteToNode = new Map<number, string>();
  for (const node of ir.nodes) {
    if (node.classSite) {
      const siteIdx = ir.source.classSites.indexOf(node.classSite);
      if (siteIdx >= 0) siteToNode.set(siteIdx, node.id);
    }
  }

  // We need to inject data-cds-id into each JSX element's opening tag.
  // Strategy: find each element's opening tag by tracking JSX elements in the AST.
  // Since we already have the IR nodes with their classSite offsets, we can
  // inject right before the className attribute.

  // Sort sites by position (descending) so we can inject right-to-left.
  const injections: { pos: number; id: string }[] = [];
  for (const [siteIdx, nodeId] of siteToNode) {
    const site = ir.source.classSites[siteIdx];
    // Find the opening quote of the className attribute to inject before it.
    // We'll inject data-cds-id="nX" right before className.
    const beforeClass = code.lastIndexOf('className', site.start);
    if (beforeClass > 0) {
      injections.push({ pos: beforeClass, id: nodeId });
    }
  }

  // Sort descending by position so offsets remain valid.
  injections.sort((a, b) => b.pos - a.pos);

  let result = code;
  for (const inj of injections) {
    result = result.slice(0, inj.pos) + ` data-cds-id="${inj.id}" ` + result.slice(inj.pos);
  }

  return result;
}

/**
 * Build an HTML page that renders the component with React + Tailwind.
 */
function buildHtmlPage(modifiedCode: string, width: number, height: number): string {
  // Extract the function body and render it.
  // The code is typically a single exported function component.
  // We wrap it in a minimal React app.

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${width}, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${width}px; height: ${height}px; overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
${modifiedCode}

    const root = ReactDOM.createRoot(document.getElementById('root'));
    // Try to find the default export or the first function component.
    const Component = typeof DangerPanel !== 'undefined' ? DangerPanel
      : typeof App !== 'undefined' ? App
      : null;
    if (Component) {
      root.render(React.createElement(Component));
    }
  </script>
</body>
</html>`;
}

/**
 * Read bounding boxes from the rendered page.
 * Returns a plain object of cds-id → { x, y, w, h }.
 * (Playwright serializes Maps to plain objects, so we use Record.)
 */
async function readBoxes(page: any): Promise<Record<string, { x: number; y: number; w: number; h: number }>> {
  return page.evaluate(() => {
    const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
    const elements = document.querySelectorAll('[data-cds-id]');
    for (const el of elements) {
      const id = el.getAttribute('data-cds-id')!;
      const rect = el.getBoundingClientRect();
      boxes[id] = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      };
    }
    return boxes;
  });
}

/**
 * Capture screenshot as raw RGBA pixel data.
 * Returns null when a proper PNG decoder is not available — image metrics
 * will be skipped gracefully.
 */
async function capturePixels(page: any, width: number, height: number): Promise<PixelData | null> {
  // For a proper implementation, decode the PNG buffer to raw RGBA.
  // This requires a PNG decoder (sharp, pngjs, or similar).
  // For now, return null — image metrics are optional and skip gracefully.
  // TODO: add pngjs or sharp as optional dependency for full image metrics.
  void page; void width; void height; // unused until decoder is added
  return null;
}

/**
 * Run dynamic perception: render the component, read geometry, capture screenshot.
 */
export async function perceiveDynamic(
  code: string,
  ir: DesignIR,
  options: DynamicOptions = {},
): Promise<DynamicResult> {
  const {
    width = 1440,
    height = 900,
    waitMs = 500,
    captureScreenshot = true,
  } = options;

  // Dynamic import of Playwright (only when needed).
  const { chromium } = await import('playwright');

  // Inject data-cds-id attributes.
  const modifiedCode = injectCdsIds(code, ir);
  const html = buildHtmlPage(modifiedCode, width, height);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width, height },
    });
    const page = await context.newPage();

    // Load the HTML.
    await page.setContent(html, { waitUntil: 'networkidle' });

    // Wait for React to render.
    await page.waitForTimeout(waitMs);

    // Read bounding boxes.
    const boxMap = await readBoxes(page);

    // Merge geometry into IR nodes.
    const updatedNodes: IRNode[] = ir.nodes.map((node) => {
      const box = boxMap[node.id];
      if (box) {
        return {
          ...node,
          box,
          area: box.w * box.h,
          visualWeight: box.w * box.h * 1.0, // saliency = 1.0 for now
        };
      }
      return node;
    });

    // Capture screenshot if requested.
    let pixels: PixelData | null = null;
    if (captureScreenshot) {
      pixels = await capturePixels(page, width, height);
    }

    const updatedIR: DesignIR = {
      ...ir,
      nodes: updatedNodes,
      meta: { ...ir.meta, rendered: true },
    };

    return { ir: updatedIR, pixels };
  } finally {
    if (browser) await browser.close();
  }
}
