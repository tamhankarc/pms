import Link from "next/link";

function buildHref(
  basePath: string,
  searchParams: Record<string, string | undefined>,
  page: number,
  pageParam: string,
  anchor?: string,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value && key !== pageParam) {
      params.set(key, value);
    }
  });

  if (page > 1) {
    params.set(pageParam, String(page));
  }

  const query = params.toString();
  const href = query ? `${basePath}?${query}` : basePath;
  return anchor ? `${href}${anchor}` : href;
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];

  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }

  return { start, end, pages };
}

function navClass(disabled = false) {
  return [
    "inline-flex h-10 min-w-[96px] items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
    disabled
      ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-300"
      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
  ].join(" ");
}

function pageClass(active = false) {
  return active
    ? "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-600 bg-brand-600 text-sm font-semibold text-white shadow-sm"
    : "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50";
}

export function PaginationControls({
  basePath,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  searchParams,
  pageParam = "page",
  anchor,
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
  pageParam?: string;
  anchor?: string;
}) {
  if (totalPages <= 1) return null;

  const { start, end, pages } = getVisiblePages(currentPage, totalPages);
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="text-center text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-900">{rangeStart}</span>
            <span className="font-semibold text-slate-900">–</span>
            <span className="font-semibold text-slate-900">{rangeEnd}</span> of <span className="font-semibold text-slate-900">{totalItems}</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href={buildHref(basePath, searchParams, currentPage - 1, pageParam, anchor)}
              className={navClass(currentPage <= 1)}
            >
              Previous
            </Link>

            {start > 1 ? (
              <>
                <Link href={buildHref(basePath, searchParams, 1, pageParam, anchor)} className={pageClass(false)}>
                  1
                </Link>
                {start > 2 ? <span className="px-1 text-sm text-slate-400">…</span> : null}
              </>
            ) : null}

            {pages.map((page) => (
              <Link
                key={page}
                href={buildHref(basePath, searchParams, page, pageParam, anchor)}
                className={pageClass(page === currentPage)}
              >
                {page}
              </Link>
            ))}

            {end < totalPages ? (
              <>
                {end < totalPages - 1 ? <span className="px-1 text-sm text-slate-400">…</span> : null}
                <Link href={buildHref(basePath, searchParams, totalPages, pageParam, anchor)} className={pageClass(false)}>
                  {totalPages}
                </Link>
              </>
            ) : null}

            <Link
              href={buildHref(basePath, searchParams, currentPage + 1, pageParam, anchor)}
              className={navClass(currentPage >= totalPages)}
            >
              Next
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
