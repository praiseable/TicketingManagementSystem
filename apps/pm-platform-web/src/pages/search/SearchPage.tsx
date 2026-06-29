import { useState } from 'react';
import { SearchFilters } from '@/components/search/SearchFilters';
import { SearchInput } from '@/components/search/SearchInput';
import { SearchResults } from '@/components/search/SearchResults';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearch } from '@/hooks/useSearch';
export function SearchPage() { const [q, setQ] = useState(''); const debounced = useDebounce(q, 200); const { data } = useSearch(debounced); return <div className="space-y-4"><h1 className="text-3xl font-bold">Search</h1><SearchInput value={q} onChange={setQ} /><SearchFilters onClear={() => setQ('')} /><SearchResults results={data} /></div>; }
