# Flow 3: File & URL Upload + Annotation — Groomed Spec

## 0) Goals & Constraints
- Support annotation on:
  - **Images (PNG/JPG)**, **PDFs**, **Video (basic)**, and now **Webpages by URL**.
- **Accurate, resilient positioning** on resize/zoom/scroll.
- **Realtime** multiuser sync for annotations and comments.
- **No direct client→DB**; everything through **BFF** (`/app/api/*`).

---

## 1) UX Microflows

### A) Upload or Attach
1) User clicks **Upload/Attach** → Modal with:
   - **File** tab (drag-drop, multiple).
   - **URL** tab (enter webpage URL; advanced option: “Snapshot (stable)” vs “Live proxy (experimental)”).
2) On submit:
   - File(s): create DB record(s), request signed URLs, upload to Supabase Storage.
   - URL: enqueue a **Snapshot** job; immediately create `File` row with `type=WEBSITE` + `status=pending`.

### B) View & Annotate
1) Project page opens **Viewer**:
   - Left: **Annotation Toolbar** (Pin, Box, Highlight).
   - Center: **Renderer** (Image/PDF/Webpage).
   - Right: **Comment Sidebar** (threads).
2) User selects a tool → clicks/drag-selects on content:
   - Create annotation; open comment composer; save.
3) Others see it **live** via Realtime.
4) Users can **zoom** and **pan**; annotations stay glued to targets on resize.

---

## 2) Data Model (Prisma)

```prisma
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
```

### `File.metadata` examples
- **IMAGE**: `{ "intrinsic": { "width": 2400, "height": 1600 } }`
- **PDF**: `{ "pages": [{ "width": 1024, "height": 1325 }, ...] }`
- **VIDEO**: `{ "duration": 128.43, "dimensions": { "width": 1920, "height": 1080 } }`
- **WEBSITE**:
```json
{
  "snapshotId": "snap_x",
  "capture": {
    "url": "https://example.com/pricing",
    "timestamp": "2025-09-03T10:02:00Z",
    "document": { "scrollWidth": 1540, "scrollHeight": 8200 },
    "viewport": { "width": 1440, "height": 900 },
    "domVersion": "hash_of_dom"
  },
  "assets": { "baseUrl": "..." }
}
```

### `Annotation.target` (unified)
```json
{
  "space": "image|pdf|web|video",
  "pageIndex": 3,
  "timestamp": 42.5,
  "mode": "region|element|text",
  "box": {
    "x": 0.321, "y": 0.187, "w": 0.25, "h": 0.12,
    "relativeTo": "document|element"
  },
  "element": {
    "css": "main > section:nth-of-type(2) .price-card:nth-child(3)",
    "xpath": "...",
    "attributes": { "data-qa": "pro-plan" },
    "nth": 0,
    "stableId": "dom-uid-abc123"
  },
  "text": {
    "quote": "Upgrade to Pro",
    "prefix": "…",
    "suffix": "…",
    "start": 102944, "end": 102958
  }
}
```

---

## 3) API Contracts

```
POST /api/files
POST /api/files/:id/complete-upload
GET /api/files/:id
POST /api/annotations
PATCH /api/annotations/:id
DELETE /api/annotations/:id
```

---

## 4) Webpage by URL — Ingestion & Rendering

### Snapshot Mode
- Use Puppeteer to fetch and inject stable IDs.
- Inline CSS, rehost assets, store snapshot HTML in Supabase.

### Live Proxy Mode
- Reverse-proxy + CSP rewrite, inject annotator script.

---

## 5) Viewer Architecture & Coordinate Systems
- `designSize`
- `screenToDesign(point)` / `designToScreen(point)`
- Overlay layer maps annotations.

---

## 6) Resizing, Zoom, Scroll — Staying Glued

- Use **ResizeObserver**, **MutationObserver**, and re-resolve anchors.

---

## 7) Anchoring Strategies

- Element anchors (stableId → CSS → XPath → attributes fallback).
- Text anchors (quote + prefix/suffix + char positions).
- Region anchors (relativeTo: element|document).

---

## 8) Creating Annotations — Pseudocode

- Image/PDF pin & box
- Webpage element pin/box
- Webpage text highlight

---

## 9) Rendering & Hit-Testing

- Overlay updates rects via `designRectToScreen`.
- Event delegation via `data-annotation-id`.

---

## 10) Realtime Sync

- Supabase channel per project/file.
- `annotation.created|updated|deleted`.

---

## 11) Edge Cases

- Device pixel ratio, fonts, dynamic content, resolution fallbacks.

---

## 12) Acceptance Criteria

1) URL Snapshot pinning stable.
2) Web text highlight persists across resizes.
3) PDF boxes stable at zoom.
4) Realtime propagation <500ms.
5) Graceful fallback when element gone.

---

## 13) Frontend Structure

- `annotation-toolbar.tsx`
- `comment-sidebar.tsx`
- `viewers/*`
- `use-annotations.ts`
- `use-layout-mapper.ts`
- `/api/*`

---

## 14) Minimal Helpers

```ts
function designRectToScreen(rect, scale, scroll) { ... }
function normalizedToDesign(box, designW, designH) { ... }
function getElementDesignRect(el, capture) { ... }
```

---

## 15) Security

- Sanitize snapshots, CSP strict, enforce permissions.

---

## 16) What Dev Agent Should Build Next

1) Prisma migrations for `target`/`metadata`.
2) `/api/files` ingestion + snapshot worker.
3) `WebSnapshotViewer`.
4) Image/PDF viewers.
5) Realtime sync + optimistic UI.
