import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant navigation feedback for every dashboard route.
 * Next.js renders this skeleton the moment a sidebar link is clicked,
 * so the UI never looks frozen while the destination loads its data.
 */
export default function DashboardLoading() {
  return (
    <div className="flex-1" aria-busy="true" aria-label="Loading">
      <header className="border-b bg-white px-6 py-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </header>
      <main className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {["reports", "appointments", "upcoming", "completed"].map((key) => (
            <div key={key} className="rounded-xl border bg-white p-6 shadow-sm">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-12" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {["panel-a", "panel-b"].map((key) => (
            <div key={key} className="rounded-xl border bg-white p-6 shadow-sm">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
