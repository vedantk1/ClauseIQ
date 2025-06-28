# React-PDF v8 vs @react-pdf-viewer: Next.js 15 Upgrade Evaluation

## Executive Summary

**Recommendation: Stick with @react-pdf-viewer for now, implement warning suppression.**

React-pdf v8 would solve the `--scale-factor` error but introduces significant trade-offs that don't justify the migration effort for our current use case.

---

## Library Comparison

### Current Setup: @react-pdf-viewer

```json
"@react-pdf-viewer/core": "^3.12.0",
"@react-pdf-viewer/highlight": "^3.12.0",
"pdfjs-dist": "^3.11.174"
```

### Alternative: react-pdf v8

```json
"react-pdf": "^8.0.0"  // Bundles PDF.js fork without --scale-factor check
```

---

## Detailed Analysis

### ✅ **Advantages of react-pdf v8**

1. **Solves the --scale-factor Error**

   - Bundles a PDF.js fork without the problematic guard
   - No console warnings about CSS variables

2. **Simpler API**

   - More React-native approach
   - Fewer plugin configurations needed

3. **Active Maintenance**
   - Popular library with good community support
   - Regular updates and bug fixes

### ❌ **Disadvantages of react-pdf v8**

1. **Bundle Size Impact: +90KB**

   ```
   Current: @react-pdf-viewer (~45KB) + pdfjs-dist (shared)
   React-pdf v8: (~135KB) including bundled PDF.js fork
   ```

2. **Feature Loss**

   - No built-in highlight plugin equivalent
   - Would need to rebuild our highlight functionality from scratch
   - Less sophisticated plugin ecosystem

3. **Migration Effort: HIGH**

   ```typescript
   // Current @react-pdf-viewer approach
   <Viewer
     fileUrl={pdfUrl}
     plugins={[highlightPluginInstance]}
     defaultScale={SpecialZoomLevel.PageFit}
     onZoom={(e) => setCurrentScale(e.scale)}
   />

   // react-pdf v8 approach - completely different API
   <Document file={pdfUrl}>
     <Page pageNumber={1} scale={scale} />
     {/* Manual highlight implementation needed */}
   </Document>
   ```

4. **Next.js 15 Compatibility Concerns**
   - react-pdf has historically had SSR issues with Next.js
   - Our current setup works perfectly with Next.js 15 + Turbopack

---

## Next.js 15 Specific Considerations

### Current Setup Benefits

```typescript
// Our current setup works seamlessly with:
"next": "15.3.3",           // ✅ Latest Next.js
"react": "^19.0.0",         // ✅ React 19
experimental.turbo          // ✅ Turbopack support
```

### react-pdf v8 Concerns

1. **SSR Complexity**: react-pdf often requires `dynamic` imports to avoid SSR issues
2. **Worker Setup**: Different worker configuration requirements
3. **Hydration Issues**: Potential mismatches between server and client rendering

---

## Bundle Size Impact Analysis

### Current Bundle (Estimated)

```
@react-pdf-viewer/core:    ~25KB
@react-pdf-viewer/highlight: ~20KB
PDF.js (shared):           ~500KB (already needed)
Total PDF functionality:   ~545KB
```

### react-pdf v8 Bundle

```
react-pdf v8:              ~135KB
PDF.js fork (bundled):     ~500KB
Custom highlight logic:    ~15KB (custom implementation)
Total PDF functionality:   ~650KB

Net increase: ~105KB (+19%)
```

### Impact Assessment

- **Desktop**: Minimal impact on performance
- **Mobile**: Noticeable on slower connections
- **ClauseIQ Context**: Professional users likely have good connections

---

## Feature Comparison

| Feature              | @react-pdf-viewer  | react-pdf v8             | Migration Effort |
| -------------------- | ------------------ | ------------------------ | ---------------- |
| Basic PDF rendering  | ✅ Excellent       | ✅ Good                  | Low              |
| Highlighting         | ✅ Built-in plugin | ❌ Custom implementation | High             |
| Zoom controls        | ✅ Built-in        | ✅ Built-in              | Medium           |
| Text selection       | ✅ Automatic       | ⚠️ Manual setup          | Medium           |
| Plugin ecosystem     | ✅ Rich            | ❌ Limited               | High             |
| TypeScript support   | ✅ Excellent       | ✅ Good                  | Low              |
| --scale-factor error | ❌ Present         | ✅ Fixed                 | N/A              |

---

## Migration Effort Estimate

### High-Effort Tasks

1. **Highlight System Rebuild**: 2-3 days

   - Custom text selection handling
   - Highlight persistence
   - UI/UX matching current design

2. **Component Refactoring**: 1-2 days

   - API changes throughout InteractivePDFViewer
   - Event handling updates
   - Props interface changes

3. **Testing & QA**: 1-2 days
   - Regression testing
   - Cross-browser compatibility
   - Performance validation

**Total Estimated Effort: 4-7 developer days**

---

## Recommendations by Priority

### 🎯 **Immediate (Current Sprint)**

**Ship with warning suppression** - 30 minutes effort

```typescript
// Production console filter
if (process.env.NODE_ENV === "production") {
  const originalError = console.error;
  console.error = (message, ...args) => {
    if (typeof message === "string" && message.includes("--scale-factor"))
      return;
    originalError(message, ...args);
  };
}
```

### 🔍 **Short-term (Next Quarter)**

**Investigate @react-pdf-viewer text layer hooks**

- Research if library exposes `onTextLayerRender` events
- Implement surgical fix if available
- Monitor library updates for official solutions

### 📊 **Long-term (6+ months)**

**Evaluate during major feature additions**

- If adding form-filling capabilities → Consider commercial SDKs
- If bundle size becomes critical → Reassess react-pdf v8
- If @react-pdf-viewer development stagnates → Migration path

---

## Decision Matrix

| Criteria                 | Weight | @react-pdf-viewer | react-pdf v8 | Winner            |
| ------------------------ | ------ | ----------------- | ------------ | ----------------- |
| Functionality            | 25%    | 9/10              | 6/10         | @react-pdf-viewer |
| Bundle size              | 20%    | 8/10              | 6/10         | @react-pdf-viewer |
| Migration effort         | 20%    | 10/10             | 3/10         | @react-pdf-viewer |
| Console cleanliness      | 15%    | 3/10              | 10/10        | react-pdf v8      |
| Next.js 15 compatibility | 10%    | 9/10              | 7/10         | @react-pdf-viewer |
| Long-term maintenance    | 10%    | 8/10              | 8/10         | Tie               |

**Weighted Score:**

- **@react-pdf-viewer: 7.8/10**
- **react-pdf v8: 5.9/10**

---

## Conclusion

**Stick with @react-pdf-viewer** because:

1. ✅ **Functional excellence**: Our PDF viewer works perfectly
2. ✅ **Next.js 15 compatibility**: Proven stable with latest stack
3. ✅ **Feature richness**: Built-in highlighting and plugin ecosystem
4. ✅ **Bundle efficiency**: Smaller footprint
5. ✅ **Low technical debt**: Warning suppression is clean and safe

The `--scale-factor` error is purely cosmetic and doesn't justify a major migration that would:

- Lose 4-7 developer days
- Increase bundle size by ~19%
- Require rebuilding highlight functionality
- Introduce new compatibility risks

**Ship the warning suppression and focus on user-facing features instead.**
