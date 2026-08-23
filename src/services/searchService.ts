export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

const API_KEY = import.meta.env.VITE_BRAVE_API_KEY || '';

export async function searchBrave(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  if (!API_KEY) {
    // Mock fallback for hackathon/demo without an API key
    return [
      {
        title: `Mock result for "${query}"`,
        url: `https://example.com/?q=${encodeURIComponent(query)}`,
        description: 'Brave Search API key is not configured. Add VITE_BRAVE_API_KEY to your .env file to enable live search.',
      },
      {
        title: 'Brave Search API — Free tier',
        url: 'https://api.search.brave.com/',
        description: '$5 of free credit monthly. Sign up, create an API key, and set VITE_BRAVE_API_KEY.',
      },
    ];
  }

  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, {
    headers: {
      'X-Subscription-Token': API_KEY,
      Accept: 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Brave Search error: ${res.status}`);

  const data = await res.json();
  return (data.web?.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}
