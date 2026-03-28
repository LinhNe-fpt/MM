/** Skeleton cho trang danh sách — giảm nhảy layout khi đang tải */
export function PageListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-4 md:p-6 space-y-3 w-full max-w-[min(100%,96rem)] mx-auto animate-pulse" aria-busy="true" aria-label="Đang tải">
      <div className="h-9 md:h-10 w-56 rounded-md bg-muted" />
      <div className="h-12 w-full rounded-lg bg-muted" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-muted" />
        ))}
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-[4.25rem] rounded-xl bg-muted/80 border border-border/40" />
        ))}
      </div>
    </div>
  );
}

export function PageDashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1500px] mx-auto animate-pulse" aria-busy="true" aria-label="Đang tải">
      <div className="h-8 w-56 rounded-md bg-muted" />
      <div className="h-4 w-72 rounded bg-muted/70" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted border border-border/40" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-10 gap-5">
        <div className="xl:col-span-7 space-y-4">
          <div className="h-[210px] rounded-xl bg-muted border border-border/40" />
          <div className="h-48 rounded-xl bg-muted border border-border/40" />
        </div>
        <div className="xl:col-span-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted border border-border/40" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageWarehouseSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto animate-pulse" aria-busy="true" aria-label="Đang tải">
      <div className="h-20 rounded-2xl bg-muted border border-border/40" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-28 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-12 rounded-xl bg-muted border border-border/40" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[1, 2].map((i) => (
          <div key={i} className="h-64 rounded-2xl bg-muted border border-border/40" />
        ))}
      </div>
    </div>
  );
}
