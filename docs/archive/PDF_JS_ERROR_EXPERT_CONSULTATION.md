# PDF.js CSS Variable Error: Expert Consultation Report

## Problem Summary

The InteractivePDFViewer component continues to show this persistent error in the console:

```
Error: The `--scale-factor` CSS-variable must be set, to the same value as `viewport.scale`, either on the `container`-element itself or higher up in the DOM.
```

Despite extensive attempts to set the `--scale-factor` CSS variable at multiple levels, the error persists. The PDF renders and functions correctly, but the error appears in the console.

## Library Information

- **@react-pdf-viewer/core**: Latest version
- **@react-pdf-viewer/highlight**: Latest version
- **Next.js**: TypeScript-based React application
- **PDF.js**: Underlying PDF rendering engine

## All Attempted Fixes

### 1. Global CSS Variable Setting

```typescript
// Set globally on document root
document.documentElement.style.setProperty("--scale-factor", "1");
```

### 2. Dynamic CSS Injection

```typescript
const createPdfViewerStyles = (scaleFactor: number) => `
  :root {
    --scale-factor: ${scaleFactor};
  }
  .rpv-core__viewer {
    --scale-factor: ${scaleFactor};
  }
  // ... all PDF.js CSS classes
`;
```

### 3. Container-Level CSS Variable

```typescript
// Set on PDF container
pdfContainerRef.current.style.setProperty("--scale-factor", currentScale.toString());

// Also set via React style prop
style={
  {
    "--scale-factor": currentScale.toString(),
  } as React.CSSProperties
}
```

### 4. DOM Element Targeting

```typescript
const setScaleFactorOnDOMElements = useCallback((scaleFactor: number) => {
  const pdfViewerElements = pdfContainerRef.current.querySelectorAll(
    ".rpv-core__viewer, .rpv-core__doc, .rpv-core__inner-pages, .rpv-core__page, .rpv-core__text-layer, .rpv-core__annotation-layer, .rpv-core__canvas-layer"
  );
  pdfViewerElements.forEach((element) => {
    (element as HTMLElement).style.setProperty(
      "--scale-factor",
      scaleFactor.toString()
    );
  });
}, []);
```

### 5. MutationObserver for Dynamic Elements

```typescript
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.classList.contains("rpv-core__viewer") || /* other PDF.js classes */) {
          element.style.setProperty("--scale-factor", currentScale.toString());
        }
      }
    });
  });
});
```

### 6. Event Handler Updates

```typescript
onZoom={(e) => {
  // CRITICAL: Set global CSS variable IMMEDIATELY
  document.documentElement.style.setProperty("--scale-factor", e.scale.toString());
  setCurrentScale(e.scale);
  updatePdfViewerStyles(e.scale);
  setTimeout(() => {
    setScaleFactorOnDOMElements(e.scale);
  }, 0);
}}
```

### 7. Timing-Based Approaches

- Set CSS variable before PDF.js renders
- Periodic checks after PDF loads (every 500ms for 3 seconds)
- Immediate setting on scale changes with setTimeout for DOM updates

## Current State

- **PDF Functionality**: ✅ Working (PDF renders, zoom works, highlighting works)
- **Error Status**: ❌ Persistent console error about `--scale-factor`
- **User Experience**: ✅ No visible issues, fully functional

## Technical Analysis

### What We Know

1. The error originates from PDF.js internal code expecting `--scale-factor` CSS variable
2. @react-pdf-viewer is a wrapper around PDF.js
3. The variable needs to match `viewport.scale` value
4. Multiple approaches to set the variable have been attempted
5. The PDF renders correctly despite the error

### What's Puzzling

1. Setting `--scale-factor` globally, locally, and on all PDF.js elements doesn't resolve the error
2. The error suggests the variable isn't found where PDF.js expects it
3. PDF.js may be creating internal containers that aren't caught by our selectors
4. Timing issues between React rendering and PDF.js internal initialization

### Potential Root Causes

1. **Internal PDF.js Containers**: PDF.js may create shadow DOM or internal containers not accessible via standard DOM queries
2. **Timing Race Condition**: PDF.js may check for the CSS variable before our React code sets it
3. **CSS Specificity Issues**: The variable may need to be set with higher specificity
4. **PDF.js Version Compatibility**: The error might be specific to certain PDF.js/react-pdf-viewer versions
5. **React Strict Mode**: Development mode may cause double-rendering issues

## Expert Questions

### 1. Library-Specific Questions

- Are there specific configuration options in @react-pdf-viewer to set the scale factor?
- Does @react-pdf-viewer provide any events or callbacks for when PDF.js containers are created?
- Is there a way to pass CSS variables directly to the PDF.js Worker?

### 2. Debugging Questions

- How can we identify the exact DOM element where PDF.js expects the `--scale-factor` variable?
- Is there a way to inspect PDF.js internal containers or shadow DOM?
- Can we hook into PDF.js events to set the variable at the exact right moment?

### 3. Alternative Approaches

- Should we use a different PDF viewer library that doesn't have this issue?
- Can we suppress this specific PDF.js error without affecting functionality?
- Is there a way to configure PDF.js directly to not require this CSS variable?

## Code References

- Main file: `/Users/vedan/Projects/clauseiq-project/frontend/src/components/InteractivePDFViewer.tsx`
- All attempted fixes are documented in the conversation history
- PDF renders correctly at: http://localhost:3000 (when running)

## Next Steps Needed

1. **Expert Library Knowledge**: Consultation with @react-pdf-viewer or PDF.js experts
2. **Deep Debugging**: Browser developer tools inspection of PDF.js internal DOM structure
3. **Alternative Solutions**: Research into different approaches or library alternatives
4. **Version Analysis**: Testing with different versions of the PDF viewer libraries

---

**Status**: Functional but with persistent console error requiring expert intervention.
