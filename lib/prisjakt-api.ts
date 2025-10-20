import { PrisjaktProduct, CacheEntry } from '@/types/ram';

// In-memory cache for development
const cache = new Map<string, CacheEntry>();

export class PrisjaktAPI {
  private apiKey: string;
  private baseUrl = 'https://api.prisjakt.nu';
  private cache: Map<string, CacheEntry>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.cache = cache;
  }

  async searchRAM(moduleNumber: string): Promise<PrisjaktProduct[]> {
    const cacheKey = `ram_${moduleNumber}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    try {
      // Search for the specific module number
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: moduleNumber,
          category: 'memory',
          limit: 20
        })
      });

      if (!response.ok) {
        throw new Error(`Prisjakt API error: ${response.status}`);
      }

      const data = await response.json();
      const products: PrisjaktProduct[] = data.products?.map((product: any) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency || 'SEK',
        store: product.store?.name || 'Unknown',
        storeUrl: product.store?.url || '',
        availability: product.availability || false,
        imageUrl: product.image_url
      })) || [];

      // Cache the results for 1 hour
      this.cache.set(cacheKey, {
        data: products,
        timestamp: Date.now(),
        ttl: 3600000 // 1 hour in milliseconds
      });

      return products;
    } catch (error) {
      console.error('Error searching Prisjakt API:', error);
      return [];
    }
  }

  async searchRAMBySpecs(vendor: string, size: string, speed: string): Promise<PrisjaktProduct[]> {
    const cacheKey = `ram_specs_${vendor}_${size}_${speed}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    try {
      const query = `${vendor} ${size} DDR5 ${speed}`;
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          category: 'memory',
          limit: 20
        })
      });

      if (!response.ok) {
        throw new Error(`Prisjakt API error: ${response.status}`);
      }

      const data = await response.json();
      const products: PrisjaktProduct[] = data.products?.map((product: any) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency || 'SEK',
        store: product.store?.name || 'Unknown',
        storeUrl: product.store?.url || '',
        availability: product.availability || false,
        imageUrl: product.image_url
      })) || [];

      // Cache the results for 1 hour
      this.cache.set(cacheKey, {
        data: products,
        timestamp: Date.now(),
        ttl: 3600000 // 1 hour in milliseconds
      });

      return products;
    } catch (error) {
      console.error('Error searching Prisjakt API by specs:', error);
      return [];
    }
  }

  // Clear cache (useful for testing or manual refresh)
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Mock API for development when no API key is provided
export class MockPrisjaktAPI {
  async searchRAM(moduleNumber: string): Promise<PrisjaktProduct[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return [
      {
        id: '1',
        name: `${moduleNumber} - Mock Product`,
        price: Math.floor(Math.random() * 2000) + 500,
        currency: 'SEK',
        store: 'Mock Store',
        storeUrl: 'https://example.com',
        availability: true,
        imageUrl: 'https://via.placeholder.com/150'
      },
      {
        id: '2',
        name: `${moduleNumber} - Alternative Store`,
        price: Math.floor(Math.random() * 2000) + 500,
        currency: 'SEK',
        store: 'Alternative Store',
        storeUrl: 'https://example2.com',
        availability: true
      }
    ];
  }

  async searchRAMBySpecs(vendor: string, size: string, speed: string): Promise<PrisjaktProduct[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return [
      {
        id: '3',
        name: `${vendor} ${size} DDR5 ${speed} - Mock Product`,
        price: Math.floor(Math.random() * 2000) + 500,
        currency: 'SEK',
        store: 'Mock Store',
        storeUrl: 'https://example.com',
        availability: true
      }
    ];
  }

  clearCache(): void {}
  getCacheStats(): { size: number; entries: string[] } {
    return { size: 0, entries: [] };
  }
}
