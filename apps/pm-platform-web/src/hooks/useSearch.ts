import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/api/search.api';
import { queryKeys } from '@/api/queryKeys';
export function useSearch(q: string) { return useQuery({ queryKey: queryKeys.search(q), queryFn: () => searchApi.global(q), enabled: q.length > 1, staleTime: 10_000 }); }
