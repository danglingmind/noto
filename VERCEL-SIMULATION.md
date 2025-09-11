# Vercel Environment Simulation

This document explains how to run your app locally with the exact same runtime environment as Vercel.

## 🎯 Purpose

Reproduce Vercel-specific issues locally, including:
- Chromium brotli files errors
- Puppeteer configuration issues
- Environment variable differences
- Serverless function limitations

## 🚀 Available Scripts

### Development with Vercel Environment
```bash
npm run dev:vercel
```
- Simulates Vercel's serverless environment
- Sets `VERCEL=1` and `NODE_ENV=production`
- Configures Puppeteer for Vercel compatibility
- Uses the same Chromium path as Vercel

### Build with Vercel Environment
```bash
npm run build:vercel
```
- Builds the app with Vercel environment variables
- Tests the build process in Vercel-like conditions
- Useful for catching build-time issues

### Standard Vercel Dev
```bash
npm run vercel:dev
```
- Uses Vercel CLI's built-in development server
- Most accurate Vercel simulation
- Requires Vercel CLI installation

## 🔧 Environment Variables Set

When using `dev:vercel` or `build:vercel`, these environment variables are automatically set:

```bash
VERCEL=1                                    # Identifies Vercel environment
NODE_ENV=production                         # Production mode
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true      # Skip default Chromium download
PUPPETEER_EXECUTABLE_PATH=/var/task/node_modules/@sparticuz/chromium/bin/chromium
```

## 🐛 Common Issues & Solutions

### Chromium Brotli Files Error
**Error**: `The input directory "/var/task/node_modules/@sparticuz/chromium/bin" does not exist`

**Solution**: The app automatically falls back to basic fetch when this occurs.

### Puppeteer Launch Failures
**Error**: `Browser was not found at the configured executablePath`

**Solution**: The app detects this and falls back to local Chrome or basic fetch.

### Network Call Blocking
The snapshot system blocks all network calls from scripts to prevent interference:
- `fetch()` calls are blocked
- `XMLHttpRequest` is disabled
- `WebSocket` connections are prevented
- Analytics scripts are removed

## 🧪 Testing the Simulation

To verify your local environment matches Vercel:

1. **Run the Vercel simulation**:
   ```bash
   npm run dev:vercel
   ```

2. **Test snapshot creation**:
   - Try creating a snapshot of a website
   - Check the console logs for Vercel-specific behavior
   - Verify fallback mechanisms work

3. **Compare with production**:
   - Deploy to Vercel
   - Test the same functionality
   - Compare logs and behavior

## 📊 Environment Comparison

| Feature | Local Dev | Vercel Simulation | Vercel Production |
|---------|-----------|-------------------|-------------------|
| `VERCEL` env var | ❌ | ✅ | ✅ |
| `NODE_ENV` | development | production | production |
| Chromium path | Local Chrome | Vercel path | Vercel path |
| Memory limit | Unlimited | Simulated | 1024MB |
| Timeout | Unlimited | Simulated | 60s |

## 🔍 Debugging Tips

1. **Check environment variables**:
   ```javascript
   console.log('VERCEL:', process.env.VERCEL)
   console.log('NODE_ENV:', process.env.NODE_ENV)
   ```

2. **Monitor Chromium behavior**:
   ```javascript
   console.log('Chromium executable:', await chromium.executablePath())
   ```

3. **Test fallback mechanisms**:
   - Intentionally break Chromium
   - Verify basic fetch fallback works
   - Check error handling

## 🚀 Deployment

When deploying to Vercel, the app will:
1. Try to use @sparticuz/chromium
2. Fall back to basic fetch if Chromium fails
3. Always produce a snapshot (never fail completely)

The `vercel.json` configuration ensures proper memory allocation and timeouts for serverless functions.

## 📝 Notes

- The simulation is not 100% accurate but covers the main differences
- Use `vercel dev` for the most accurate simulation
- Test both development and production modes
- Monitor logs for environment-specific behavior
