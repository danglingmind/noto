Flow 3: File & URL Upload + Annotation — Groomed Spec
0) Goals & Constraints

Support annotation on:

Images (PNG/JPG), PDFs, Video (basic), and now Webpages by URL. 

Accurate, resilient positioning on resize/zoom/scroll.

Realtime multiuser sync for annotations and comments. 

No direct client→DB; everything through BFF (/app/api/*). 

1) UX Microflows
A) Upload or Attach

User clicks Upload/Attach → Modal with:

File tab (drag-drop, multiple).

URL tab (enter webpage URL; advanced option: “Snapshot (stable)” vs “Live proxy (experimental)”—see 4).

On submit:

File(s): create DB record(s), request signed URLs, upload to Supabase Storage. 

URL: enqueue a Snapshot job; immediately create File row with type=WEBSITE + status=pending. (See 4B for ingestion.)

B) View & Annotate

Project page opens Viewer:

Left: Annotation Toolbar (Pin, Box, Highlight).

Center: Renderer (Image/PDF/Webpage).

Right: Comment Sidebar (threads). 

User selects a tool → clicks/drag-selects on content:

Create annotation; open comment composer; save.

Others see it live via Realtime. 

Users can zoom and pan; annotations stay glued to targets on resize.

2) Data Model (Prisma) — Focused Changes

You already have these core tables. We’ll extend File.metadata and Annotation for selectors/anchors. 

model File {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  fileUrl     String      // Supabase Storage or snapshot HTML URL
  fileType    FileType    // IMAGE | PDF | VIDEO | WEBSITE
  metadata    Json?       // see below
  createdAt   DateTime @default(now())
  annotations Annotation[]
}

model Annotation {
  id             String   @id @default(cuid())
  fileId         String
  file           File     @relation(fields: [fileId], references: [id])
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  annotationType AnnotationType // PIN | BOX | HIGHLIGHT | TIMESTAMP
  target         Json            // NEW: generic target (see below)
  style          Json?           // e.g., color, opacity, strokeWidth
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  comments       Comment[]
}

File.metadata examples

IMAGE: { "intrinsic": { "width": 2400, "height": 1600 } }

PDF: { "pages": [{ "width": 1024, "height": 1325 }, ...] }

VIDEO: { "duration": 128.43, "dimensions": { "width": 1920, "height": 1080 } }

WEBSITE (Snapshot mode):

{
  "snapshotId": "snap_x",
  "capture": {
    "url": "https://example.com/pricing",
    "timestamp": "2025-09-03T10:02:00Z",
    "document": { "scrollWidth": 1540, "scrollHeight": 8200 },
    "viewport": { "width": 1440, "height": 900 },
    "domVersion": "hash_of_dom" // optional integrity/ref
  },
  "assets": { "baseUrl": "..." }
}

Annotation.target (unified)

Use W3C-style selectors with resilient fallbacks:

{
  "space": "image|pdf|web|video",
  "pageIndex": 3,               // PDF only
  "timestamp": 42.5,            // Video only
  "mode": "region|element|text",
  "box": {                      // region mode (normalized coordinates)
    "x": 0.321, "y": 0.187, "w": 0.25, "h": 0.12,
    "relativeTo": "document|element"
  },
  "element": {                  // element mode (primary)
    "css": "main > section:nth-of-type(2) .price-card:nth-child(3)",
    "xpath": "...",
    "attributes": { "data-qa": "pro-plan" },
    "nth": 0,
    "stableId": "dom-uid-abc123"  // injected at snapshot time
  },
  "text": {                     // text mode (highlight)
    "quote": "Upgrade to Pro",
    "prefix": "…",
    "suffix": "…",
    "start": 102944, "end": 102958 // text-position fallback
  }
}

3) API Contracts (BFF on Next.js) 
POST /api/files
Body:
  { projectId, items: [{ type: "FILE", mime, name, size }, { type: "URL", url, mode: "SNAPSHOT"|"PROXY" }] }
Resp:
  { files: [{ id, uploadUrl?, fileType, status: "ready"|"pending" }] }

POST /api/files/:id/complete-upload
Body: { metadata }
Resp: { ok: true }

GET /api/files/:id
Resp: { file, annotations, comments }

POST /api/annotations
Body: { fileId, annotationType, target, style? }
Resp: { annotation }

PATCH /api/annotations/:id
Body: { target?, style? }
Resp: { annotation }

DELETE /api/annotations/:id


Realtime: publish annotation.created|updated|deleted events on a channel: project:{projectId}. 

4) Webpage by URL — Ingestion & Rendering

Annotating live third-party pages inside your app is blocked by cross-origin security. So we deliver two modes:

A) Snapshot Mode (Recommended for MVP)

Server job (Edge function or background worker) fetches URL via headless Chromium.

Produces a self-contained snapshot (HTML + inlined CSS + re-hosted assets + injected stable IDs).

Saves HTML to Supabase Storage; File.fileUrl points to snapshot HTML (same origin as your app).

Benefit: stable, deterministic layout; you can query/select DOM freely; perfect for accurate anchoring & resize safety.

Snapshot pipeline (pseudocode):

async function snapshotUrl(url: string): Promise<SnapshotResult> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  // 1) Inject "stable-id" attributes to important nodes
  await page.exposeFunction("genId", () => crypto.randomUUID());
  await page.evaluate(() => {
    const walk = (node: Node) => {
      if (node instanceof Element) {
        if (!node.hasAttribute("data-stable-id")) {
          node.setAttribute("data-stable-id", (window as any).genId());
        }
      }
      node.childNodes.forEach(walk);
    };
    walk(document.documentElement);
  });

  // 2) Inline CSS / rewrite asset URLs to a proxied base
  // (Use a library like "single-file" technique or custom rewriter)

  const html = await page.content(); // after inlining/rewrites
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    viewport: { width: window.innerWidth, height: window.innerHeight }
  }));

  await browser.close();

  // 3) Upload to Supabase storage
  const urlInStorage = await uploadHtml(html);

  return { urlInStorage, metrics };
}

B) Live Proxy Mode (Advanced/Optional)

Reverse-proxy the target domain through your server to achieve same-origin iframe.

Rewrite headers/CSP; inject your script; allow DOM access.

Riskier (breakage, legal, perf). Keep behind a feature flag.

Your Phase 2 Chrome extension can enable in-situ annotation on any site, bypassing cross-origin limits altogether. 

5) Viewer Architecture & Coordinate Systems
A) Shared Concepts

Each renderer exposes:

designSize: intrinsic content dimensions (image size, pdf page size, snapshot scrollWidth/Height).

screenToDesign(point), designToScreen(point) mapping.

getAnchorRect(annotation) → DOMRectLike in design space.

Overlay Layer: absolutely-positioned <div class="overlay"> inside the viewer; all annotations render here in screen space.

Scale Model:

const scaleX = container.clientWidth / designWidth;
const scaleY = container.clientHeight / designHeight; // for page-fit
// Use uniform scale when aspect-ratio locked:
const scale = fitMode === "width" ? scaleX : Math.min(scaleX, scaleY);

B) ImageRenderer (simple)

designSize = intrinsic image size.

For BOX/PIN: store normalized coordinates (x,y,w,h in [0..1]).

On paint: px = x * designWidth * scale, etc.

C) PdfRenderer (PDF.js)

designSize per page.

Annotation.target.pageIndex + normalized page coords.

screenY = (pageTop + y*pageHeight) * scale - scrollTop.

D) WebpageRenderer (Snapshot)

Embed snapshot in sandboxed iframe srcdoc or render as HTML within a same-origin viewer.

designSize = { width: doc.scrollWidth_at_capture, height: doc.scrollHeight_at_capture }.

Three modes:

element: compute targetEl = queryBySelectors(); rect = boundingClientRect(targetEl); convert to design space using stored capture scale; then to screen.

text: resolve text range to a rect (using quote/position fallback).

region: normalized region relative to document or to an element’s rect.

6) Resizing, Zoom, Scroll — Staying Glued
A) Core Loop

Attach ResizeObserver to container and (for webpage) to iframe.contentDocument.body.

Attach MutationObserver (webpage) to re-resolve selectors when DOM shifts.

On any resize/scroll/zoom:

Recompute scale.

For each annotation:

If mode=element → re-find element and get fresh rect.

If mode=text → re-resolve range to rect(s).

If mode=region → scale normalized box from its reference frame.

Update overlay positions.

B) Pseudocode (renderer-agnostic)
function layoutAnnotations(annotations: Annotation[]) {
  const scale = computeScale();
  for (const a of annotations) {
    const rectDesign = getDesignRect(a); // from element/text/region logic
    const rectScreen = {
      x: rectDesign.x * scale - scrollX,
      y: rectDesign.y * scale - scrollY,
      w: rectDesign.w * scale,
      h: rectDesign.h * scale,
    };
    positionOverlay(a.id, rectScreen);
  }
}

resizeObserver.onChange(layoutAnnotations);
scrollContainer.addEventListener('scroll', () => layoutAnnotations(current));

7) Anchoring Strategies (Webpage)
A) Element Anchor Resolution
function resolveElementAnchor(target: TargetElement): HTMLElement | null {
  // 1) stableId (fast path)
  if (target.stableId) {
    const byId = document.querySelector(`[data-stable-id="${target.stableId}"]`);
    if (byId) return byId;
  }
  // 2) CSS selector
  if (target.css) {
    const el = document.querySelectorAll(target.css)[target.nth ?? 0];
    if (el) return el as HTMLElement;
  }
  // 3) XPath fallback
  if (target.xpath) {
    const res = document.evaluate(target.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    if (res.singleNodeValue) return res.singleNodeValue as HTMLElement;
  }
  // 4) Attribute probe
  if (target.attributes) {
    const k = Object.keys(target.attributes)[0];
    const v = target.attributes[k];
    const el = document.querySelector(`[${k}="${v}"]`);
    if (el) return el as HTMLElement;
  }
  return null;
}

B) Text Anchor Resolution

Attempt exact quote search near previous text-position window.

If multiple matches, prefer one within/near the last known container (via element anchor).

function resolveTextAnchor(t: TextAnchor): Range | null {
  const candidates = findQuoteOccurrences(t.quote);
  const best = rankByProximityAndContext(candidates, t.prefix, t.suffix, t.start);
  return best?.range ?? null;
}

C) Region Anchors

If relativeTo="element", first resolve element; region rect = elementRect × normalized box.

If relativeTo="document", use document design size.

8) Creating Annotations — Pseudocode
A) Image/PDF (region & pin)
onPointerDown(e) {
  if (tool === "PIN") {
    const p = screenToDesign(e.point);
    createAnnotation({
      annotationType: "PIN",
      target: { space: "image|pdf", mode: "region", box: { x: p.x/designW, y: p.y/designH, w: 0, h: 0 } }
    });
  }
  if (tool === "BOX") {
    drag.start = screenToDesign(e.point);
  }
}
onPointerUp(e) {
  if (tool === "BOX") {
    const end = screenToDesign(e.point);
    const rect = normalizeRect(drag.start, end);
    createAnnotation({
      annotationType: "BOX",
      target: { space: "image|pdf", mode: "region",
        box: { x: rect.x/designW, y: rect.y/designH, w: rect.w/designW, h: rect.h/designH } }
    });
  }
}

B) Webpage — Element pin/box
// Hover highlights candidate elements (outline via CSS), click to select
onElementClick(el) {
  const rect = getElementDesignRect(el); // convert client rect -> design space
  const stable = readStableIdentifier(el); // data-stable-id
  createAnnotation({
    annotationType: currentTool === "PIN" ? "PIN" : "BOX",
    target: {
      space: "web",
      mode: currentTool === "PIN" ? "element" : "region",
      element: { css: optimalCssSelector(el), nth: computeNth(el), stableId: stable },
      box: currentTool === "BOX" ? boxFromSelectionWithin(el) : undefined
    }
  });
}

C) Webpage — Text highlight
onTextSelection(range: Range) {
  const quote = range.toString();
  const { prefix, suffix } = computeContext(range, 32);
  const { start, end }   = textPositionFromDocument(range);
  createAnnotation({
    annotationType: "HIGHLIGHT",
    target: {
      space: "web",
      mode: "text",
      text: { quote, prefix, suffix, start, end }
    }
  });
}

9) Rendering & Hit-Testing in the Overlay
function renderAnnotation(a: Annotation) {
  const rect = getDesignRect(a);
  const screen = designRectToScreen(rect);
  const node = ensureOverlayNode(a.id, a.annotationType);

  node.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
  node.style.width  = `${screen.w}px`;
  node.style.height = `${screen.h}px`;
  node.dataset.annotationId = a.id;

  // For PIN: center an icon at rect.x,rect.y
  // For HIGHLIGHT: draw semi-transparent block or text-range masks
}

overlay.addEventListener("pointerdown", (e) => {
  const id = (e.target as HTMLElement).closest("[data-annotation-id]")?.dataset.annotationId;
  if (id) selectAnnotation(id);
});

10) Realtime Sync (Supabase)

Channel: project:{projectId} or file:{fileId}.

Messages:

annotation.created { annotation }

annotation.updated { id, patch }

annotation.deleted { id }

Listener merges into local store, triggers layoutAnnotations() for fresh positioning. 

11) Edge Cases & Safeguards

Device Pixel Ratio: always measure with CSS pixels; maps are scale-agnostic.

Fonts & FOUC: in snapshot mode, inline critical fonts or preload to avoid reflow drift.

Dynamic content (ads, carousels): snapshot freezes most dynamics; if not, MutationObserver will trigger re-anchor.

Failed element resolution: fallback to nearest ancestor with stable ID, then to region box approximate using last known rect.

PDF text highlights: (optional MVP) use PDF.js text layer; store pageIndex + char offsets.

12) Acceptance Criteria

URL Snapshot

Given https://example.com, after processing, I can create a PIN on the third pricing card’s title. Resizing the app window keeps the pin visually centered on that title (±2px drift at 2× zoom).

Web Text Highlight

Selecting “Upgrade to Pro” creates a highlight that persists after refresh; on container resize the highlight still wraps the phrase.

PDF Box

Drawing a box on page 4 persists with correct placement at 75%, 100%, 200% zoom.

Realtime

User A creates a pin; User B sees it within ≤500ms and at the same spot.

Fallback

If an element disappears, the annotation renders at the last known rect and shows a “detached” badge.

13) Frontend Structure (Quick Map) 

components/annotation-toolbar.tsx — tool selection UI.

components/comment-sidebar.tsx — threads & statuses.

components/viewers/* — ImageViewer, PdfViewer, WebSnapshotViewer.

hooks/use-annotations.ts — CRUD + realtime.

hooks/use-layout-mapper.ts — design↔screen mappings per viewer.

app/api/* — BFF endpoints for files/annotations/snapshot jobs.

14) Minimal Implementation Snippets (Agent-friendly)
A) Mapping helpers
type Rect = { x:number,y:number,w:number,h:number };

function designRectToScreen(rect: Rect, scale: number, scroll: {x:number,y:number}): Rect {
  return { x: rect.x * scale - scroll.x, y: rect.y * scale - scroll.y, w: rect.w * scale, h: rect.h * scale };
}

function normalizedToDesign(box:{x:number,y:number,w:number,h:number}, designW:number, designH:number): Rect {
  return { x: box.x * designW, y: box.y * designH, w: box.w * designW, h: box.h * designH };
}

B) Web element rect in design space
function getElementDesignRect(el: Element, capture: {scrollWidth:number, scrollHeight:number}): Rect {
  const r = el.getBoundingClientRect();
  const doc = el.ownerDocument.documentElement;
  const x = r.left + window.scrollX;
  const y = r.top  + window.scrollY;
  // convert current document pixels → capture design space using ratios
  const sx = capture.scrollWidth / doc.scrollWidth;
  const sy = capture.scrollHeight / doc.scrollHeight;
  return { x: x * sx, y: y * sy, w: r.width * sx, h: r.height * sy };
}

C) Re-anchor on layout change
const ro = new ResizeObserver(() => layoutAnnotations(current));
const mo = new MutationObserver(() => layoutAnnotations(current));
ro.observe(container);
mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: false });
window.addEventListener('scroll', () => layoutAnnotations(current), { passive: true });
window.addEventListener('resize', () => layoutAnnotations(current));

15) Security & Compliance Notes

Snapshot sanitizer: strip scripts or run in sandboxed iframe; allow only your injected annotator.

CSP: enforce strict CSP on snapshots; all assets from your CDN.

Permissions: gate create/edit/delete by workspace roles. 

16) What the AI Agent Should Generate Next

Prisma migrations for Annotation.target/File.metadata shapes.

/api/files (URL ingestion) + snapshot worker.

WebSnapshotViewer with overlay, anchor resolvers, resize/mutation handling.

Image/PDF viewers with normalized coordinates.

Realtime channel wiring + optimistic UI. 