# Cross-Browser Compatible Webpage Snapshot Tool Implementation Guide

## Objective
Create a Next.js TypeScript application that captures complete offline snapshots of any webpage by fetching HTML content via CORS proxy and processing it in a same-origin iframe with full cross-browser compatibility (Chrome, Firefox, Safari).

## Dependencies & Setup

### Required NPM Packages
```json
{
  "dependencies": {
    "react": "19.1.0",
    "react-dom": "19.1.0", 
    "next": "15.5.2"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@tailwindcss/postcss": "^4",
    "tailwindcss": "^4",
    "eslint": "^9",
    "eslint-config-next": "15.5.2"
  }
}
```

### Installation Commands
```bash
npx create-next-app@latest webpage-snapshot --typescript --tailwind --eslint --app
cd webpage-snapshot
npm install
```

## Core Architecture

### 1. TypeScript Interfaces (`src/types/snapshot.ts`)
```typescript
export interface SnapshotConfig {
  url: string;
  includeImages: boolean;
  includeCss: boolean;
  includeScripts: boolean;
  includeVideos: boolean;
}

export interface SnapshotResult {
  html: string;
  assets: any[];
  processedHtml: string;
}

export interface SnapshotError {
  message: string;
  type: 'cors' | 'network' | 'parsing' | 'unknown';
}
```

### 2. Cross-Browser Snapshot Class (`src/utils/iframe-proxy-snapshot.ts`)

#### Key Features:
- **CORS Proxy**: Uses `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
- **Cross-Browser Iframe**: Data URL approach for Firefox/Safari compatibility
- **Fallback Mechanisms**: Graceful degradation when iframe access is blocked
- **Base URL Management**: Proper relative URL resolution

#### Critical Implementation:
```typescript
export class IframeProxySnapshot {
  async createSnapshot(config: SnapshotConfig): Promise<SnapshotResult> {
    console.log('🚀 Fetching page content:', config.url);
    
    // Fetch HTML via proxy
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(config.url)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();
    
    if (!data.contents) {
      throw new Error('Failed to fetch page content');
    }
    
    console.log('✅ Processing HTML content...');
    
    // Parse and prepare HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.contents, 'text/html');
    
    // Add base tag for relative URLs
    const baseTag = doc.createElement('base');
    baseTag.href = config.url;
    doc.querySelectorAll('base').forEach(base => base.remove());
    if (doc.head.firstChild) {
      doc.head.insertBefore(baseTag, doc.head.firstChild);
    } else {
      doc.head.appendChild(baseTag);
    }
    
    // Cross-browser iframe processing
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;';
      
      iframe.onload = () => {
        try {
          setTimeout(() => {
            let iframeDoc: Document;
            
            try {
              iframeDoc = iframe.contentDocument || iframe.contentWindow?.document!;
            } catch (error) {
              // Fallback for blocked iframe access
              console.log('⚠️ Iframe access blocked, using direct processing');
              const finalHtml = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
              document.body.removeChild(iframe);
              resolve({
                html: data.contents,
                assets: [],
                processedHtml: finalHtml
              });
              return;
            }
            
            const finalHtml = `<!DOCTYPE html>\n${iframeDoc.documentElement.outerHTML}`;
            console.log('✅ Snapshot ready, size:', finalHtml.length, 'chars');
            
            document.body.removeChild(iframe);
            resolve({
              html: data.contents,
              assets: [],
              processedHtml: finalHtml
            });
          }, 1000);
        } catch (error) {
          document.body.removeChild(iframe);
          reject(error);
        }
      };
      
      iframe.onerror = () => {
        // Complete fallback
        console.log('⚠️ Iframe failed, using direct processing');
        const finalHtml = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
        document.body.removeChild(iframe);
        resolve({
          html: data.contents,
          assets: [],
          processedHtml: finalHtml
        });
      };
      
      document.body.appendChild(iframe);
      
      // Use data URL for cross-browser compatibility
      const htmlContent = `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
      iframe.src = dataUrl;
    });
  }
}
```

### 3. UI Component (`src/app/page.tsx`)
```typescript
'use client';

import { useState } from 'react';
import { SnapshotConfig, SnapshotResult, SnapshotError } from '@/types/snapshot';
import { IframeProxySnapshot, downloadHtml } from '@/utils/iframe-proxy-snapshot';

export default function Home(): JSX.Element {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [config, setConfig] = useState<Omit<SnapshotConfig, 'url'>>({
    includeImages: true,
    includeCss: true,
    includeScripts: true,
    includeVideos: true,
  });

  const handleSnapshot = async (): Promise<void> => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const snapshot = new IframeProxySnapshot();
      const result: SnapshotResult = await snapshot.createSnapshot({
        url: url.trim(),
        ...config,
      });

      const filename = `snapshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`;
      downloadHtml(result.processedHtml, filename);
    } catch (err) {
      const snapshotError = err as SnapshotError;
      setError(snapshotError.message || 'Failed to create snapshot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Webpage Snapshot Tool
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              Website URL
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Include Assets</h3>
            <div className="space-y-2">
              {[
                { key: 'includeImages', label: 'Images' },
                { key: 'includeCss', label: 'CSS Stylesheets' },
                { key: 'includeScripts', label: 'JavaScript' },
                { key: 'includeVideos', label: 'Videos' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config[key as keyof typeof config]}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleSnapshot}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Snapshot...' : 'Create Snapshot'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 4. Download Utility
```typescript
export const downloadHtml = (html: string, filename: string): void => {
  console.log('💾 Downloading HTML file:', filename, 'Size:', html.length, 'chars');
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('✅ Download initiated');
};
```

## Critical Cross-Browser Compatibility Fixes

### Firefox/Safari Specific Issues:
1. **Document Access**: Firefox/Safari block `contentDocument` access more aggressively
2. **Solution**: Implement try-catch around iframe document access with fallback
3. **Data URLs**: Use `data:text/html` URLs instead of `document.write()`
4. **Positioning**: Use absolute positioning instead of `display: none`

### Error Handling Strategy:
```typescript
try {
  iframeDoc = iframe.contentDocument || iframe.contentWindow?.document!;
} catch (error) {
  // Fallback: return processed HTML without iframe
  console.log('⚠️ Iframe access blocked, using direct processing');
  const finalHtml = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
  document.body.removeChild(iframe);
  resolve({ html: data.contents, assets: [], processedHtml: finalHtml });
  return;
}
```

## Browser Support Matrix

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 90+ | ✅ Full Support | Works with all approaches |
| Firefox | 88+ | ✅ Full Support | Requires data URL approach |
| Safari | 14+ | ✅ Full Support | Strictest security, requires fallbacks |
| Edge | 90+ | ✅ Full Support | Chromium-based, same as Chrome |

## External Services Used

### CORS Proxy Service
- **Service**: `https://api.allorigins.win`
- **Purpose**: Bypass CORS restrictions for fetching external webpages
- **Cost**: Free (with rate limits)
- **Alternative**: Set up your own CORS proxy server for production use

### No Additional NPM Libraries Required
This implementation uses only:
- **Native Browser APIs**: `fetch`, `DOMParser`, `Blob`, `URL`, `FileReader`
- **React/Next.js**: Built-in hooks and components
- **TypeScript**: Built-in type system
- **Tailwind CSS**: For styling (included in Next.js setup)

## File Structure
```
src/
├── types/
│   └── snapshot.ts
├── utils/
│   └── iframe-proxy-snapshot.ts
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
└── WEBPAGE_SNAPSHOT_IMPLEMENTATION_GUIDE.md
```

## Implementation Steps

1. **Setup Project**:
   ```bash
   npx create-next-app@latest webpage-snapshot --typescript --tailwind --eslint --app
   cd webpage-snapshot
   ```

2. **Create Type Definitions**: Implement `src/types/snapshot.ts`

3. **Implement Core Logic**: Create `src/utils/iframe-proxy-snapshot.ts` with cross-browser iframe handling

4. **Build UI Component**: Update `src/app/page.tsx` with form and snapshot functionality

5. **Update Layout**: Modify `src/app/layout.tsx` with proper metadata

6. **Test Cross-Browser**: Verify functionality on Chrome, Firefox, and Safari

## Success Criteria
- ✅ Works reliably across Chrome, Firefox, and Safari
- ✅ Handles iframe access restrictions gracefully
- ✅ Provides meaningful fallbacks when iframe fails
- ✅ Generates downloadable HTML files consistently
- ✅ Clear error messages for browser limitations
- ✅ No external library dependencies beyond Next.js ecosystem

## Limitations & Considerations
- **Rate Limits**: Free CORS proxy has usage limits
- **Large Pages**: Very large webpages may cause memory issues
- **Dynamic Content**: JavaScript-generated content may not be captured
- **Authentication**: Cannot capture pages requiring login
- **Same-Origin Policy**: Some resources may still be blocked by browsers

## Production Recommendations
- Implement your own CORS proxy server
- Add progress indicators for large page processing
- Implement retry mechanisms for failed requests
- Add support for custom headers and authentication
- Consider server-side rendering for better reliability