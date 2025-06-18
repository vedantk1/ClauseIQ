/**
 * Auth loading component
 * Extracted from documents page - simple loading spinner for auth check
 */

export const AuthLoading = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple"></div>
    </div>
  );
};
