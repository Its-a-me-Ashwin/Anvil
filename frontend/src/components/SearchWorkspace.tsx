import { useState } from 'react';
import { Search, ExternalLink, Plus, AlertCircle } from 'lucide-react';
import { searchBrave, type SearchResult } from '../services/searchService';

export default function SearchWorkspace() {
  const [query, setQuery] = useState('compact cycloidal reducer bearing');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await searchBrave(query);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-anvil-bg">
      <form onSubmit={handleSearch} className="h-11 flex items-center gap-2 px-3 bg-anvil-panel border-b border-anvil-border shrink-0">
        <Search className="w-4 h-4 text-anvil-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the web..."
          className="flex-1 bg-transparent border-none outline-none text-sm text-anvil-text placeholder-anvil-muted"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 rounded bg-anvil-accent hover:bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
        >
          {loading ? '...' : 'Search'}
        </button>
      </form>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={i} className="p-3 rounded-lg bg-anvil-panel border border-anvil-border hover:border-anvil-accent transition group">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-anvil-accent hover:underline flex items-center gap-1"
                >
                  {r.title}
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                </a>
              </div>
              <p className="text-[10px] text-anvil-muted mt-0.5 truncate">{r.url}</p>
              <p className="text-xs text-anvil-text mt-1.5 leading-relaxed">{r.description}</p>
              <button className="mt-2 flex items-center gap-1 text-[11px] text-anvil-muted hover:text-white transition">
                <Plus className="w-3 h-3" />
                Add to context
              </button>
            </div>
          ))}
        </div>

        {results.length === 0 && !loading && !error && (
          <div className="text-center text-anvil-muted mt-12">
            <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Search powered by Brave Search API</p>
            <p className="text-xs mt-1">Set VITE_BRAVE_API_KEY in .env for live results</p>
          </div>
        )}
      </div>
    </div>
  );
}
