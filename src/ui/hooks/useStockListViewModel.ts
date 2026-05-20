import { useEffect, useMemo, useState } from 'react';
import type { Materiel } from '../../types';
import { useDebouncedValue } from './useDebouncedValue';
import { filterStockList, type StockStatusFilter } from '../../core/stock/stockListFilters';

type Options = {
  pageSize?: number;
  initialStatusFilter?: StockStatusFilter;
};

export function useStockListViewModel(materiels: Materiel[], options?: Options) {
  const pageSize = options?.pageSize ?? 80;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>(
    options?.initialStatusFilter ?? 'tous'
  );
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const debouncedSearch = useDebouncedValue(search, 220);

  const filtered = useMemo(
    () => filterStockList(materiels, statusFilter, debouncedSearch),
    [materiels, statusFilter, debouncedSearch]
  );

  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [filtered.length, pageSize, statusFilter, debouncedSearch]);

  const showMore = () => {
    if (visibleCount < filtered.length) {
      setVisibleCount(c => Math.min(c + pageSize, filtered.length));
    }
  };

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered,
    visible,
    visibleCount,
    showMore,
  };
}
