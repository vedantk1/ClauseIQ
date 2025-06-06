# Component Migration Guide

## Overview

This guide helps you migrate existing components to use the new v2 architecture with proper TypeScript types and centralized state management.

## Migration Steps

### 1. Update Imports

**Before (v1):**

```tsx
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
```

**After (v2):**

```tsx
import { useAuth } from "@/context/AuthContext.v2";
import { useAnalysis } from "@/context/AnalysisContext.v2";
```

### 2. Use New UI Components

**Before:**

```tsx
<button className="...">Click me</button>
```

**After:**

```tsx
import { Button } from "@/components/ui";

<Button variant="primary" size="md">
  Click me
</Button>;
```

### 3. Update State Access Patterns

**Before (direct context):**

```tsx
const { user, isLoading } = useAuth();
```

**After (same, but with proper types):**

```tsx
const { user, isLoading } = useAuth(); // Now with full TypeScript support
```

### 4. Error Handling

**Before:**

```tsx
try {
  await someApiCall();
} catch (error) {
  setError(error.message);
}
```

**After:**

```tsx
import { handleAPIError } from "@/lib/api";

try {
  await someApiCall();
} catch (error) {
  handleAPIError(error, "Operation failed");
}
```

## Available v2 Components

### Auth Components

- `AuthContext.v2.tsx` - Enhanced auth context with proper types
- `AuthGuard.v2.tsx` - Improved auth guard with fallback support
- `AuthForm.tsx` - Updated to use new UI components

### UI Components (all new)

- `Button` - Standardized button with variants
- `Input` - Enhanced input with validation
- `Modal` - Accessible modal component
- `Toast` - Toast notification system
- `Dropdown` - Accessible dropdown menu
- `Card` - Flexible card layout
- `LoadingStates` - Standardized loading indicators
- `ErrorBoundary` - Enhanced error boundary

### Layout Components

- `NavBar.v2.tsx` - Updated navigation with new auth context

## Migration Examples

### Example 1: Basic Component Migration

**Before:**

```tsx
import { useAuth } from "@/context/AuthContext";

export default function UserProfile() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <h1>{user?.full_name}</h1>
      <button className="btn-primary">Edit Profile</button>
    </div>
  );
}
```

**After:**

```tsx
import { useAuth } from "@/context/AuthContext.v2";
import { Button, Card, LoadingSpinner } from "@/components/ui";

export default function UserProfile() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold mb-4">{user?.full_name}</h1>
      <Button variant="primary" size="md">
        Edit Profile
      </Button>
    </Card>
  );
}
```

### Example 2: Form Migration

**Before:**

```tsx
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function UpdateProfile() {
  const [name, setName] = useState("");
  const { updateUser } = useAuth();

  return (
    <form>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full Name"
        className="border p-2 rounded"
      />
      <button type="submit" className="btn-primary">
        Update
      </button>
    </form>
  );
}
```

**After:**

```tsx
import { useState } from "react";
import { useAuth } from "@/context/AuthContext.v2";
import { Button, Input, Card } from "@/components/ui";

export default function UpdateProfile() {
  const [name, setName] = useState("");
  const { updateUser } = useAuth();

  return (
    <Card className="p-6">
      <form className="space-y-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
          label="Full Name"
        />
        <Button type="submit" variant="primary" className="w-full">
          Update Profile
        </Button>
      </form>
    </Card>
  );
}
```

## Testing Migration

### Before Migration

1. Document current component behavior
2. Take screenshots of UI states
3. Note any existing bugs or issues

### After Migration

1. Test all interactive elements
2. Verify loading states work properly
3. Check error handling
4. Ensure accessibility is maintained
5. Validate TypeScript compilation

## Rollback Plan

If migration causes issues:

1. **Immediate Rollback**: Revert import statements

   ```tsx
   // Change back to
   import { useAuth } from "@/context/AuthContext";
   ```

2. **Component Rollback**: Use original component files
3. **Full Rollback**: Switch back to old layout.tsx provider setup

## Common Migration Issues

### 1. Type Errors

**Issue**: TypeScript errors after migration
**Solution**: Check shared types are properly imported and up to date

### 2. Missing UI Component Props

**Issue**: UI component doesn't have expected prop
**Solution**: Check component documentation in `/components/ui/index.ts`

### 3. State Not Updating

**Issue**: State changes don't reflect in UI
**Solution**: Verify you're using the correct v2 context providers

### 4. Styling Issues

**Issue**: New components don't match design
**Solution**: Use `className` prop to override default styles

## Best Practices

1. **Migrate Incrementally**: Don't migrate everything at once
2. **Test Thoroughly**: Each migrated component should be tested
3. **Keep v1 Backup**: Don't delete original files until migration is complete
4. **Update Tests**: Ensure test files are updated for new components
5. **Document Changes**: Update component documentation

## Next Steps

After completing component migration:

1. **Phase 6**: Testing Infrastructure Updates
2. **Performance Optimization**: Implement React.memo and useMemo where needed
3. **Accessibility Audit**: Ensure all components meet WCAG guidelines
4. **Documentation**: Create comprehensive component docs
