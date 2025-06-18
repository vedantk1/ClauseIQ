/**
 * Loading state component for documents page
 * Extracted from main documents page - self-contained loading skeleton
 */

import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";

export const DocumentsLoading = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="space-y-2">
          <Skeleton variant="rect" className="h-8 w-48" />
          <Skeleton variant="rect" className="h-4 w-64" />
        </div>
        <Skeleton variant="rect" className="h-10 w-32" />
      </div>

      {/* Controls Skeleton */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <Skeleton variant="rect" className="h-10 flex-1 max-w-md" />
        <div className="flex gap-2">
          <Skeleton variant="rect" className="h-10 w-24" />
          <Skeleton variant="rect" className="h-10 w-20" />
        </div>
      </div>

      {/* Documents Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton variant="rect" className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="rect" className="h-4 w-3/4" />
                  <Skeleton variant="rect" className="h-3 w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton variant="rect" className="h-3 w-full" />
                <Skeleton variant="rect" className="h-3 w-2/3" />
              </div>
              <Skeleton variant="rect" className="h-9 w-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
