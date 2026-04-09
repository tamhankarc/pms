export const DEFAULT_PAGE_SIZE = 10;

export function parsePageParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number = DEFAULT_PAGE_SIZE) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: paginatedItems,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    startIndex,
    endIndex: Math.min(startIndex + pageSize, totalItems),
  };
}
