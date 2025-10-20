import { NextRequest, NextResponse } from 'next/server';
import { PrisjaktAPI } from '@/lib/prisjakt-api';
import { scrapePrisjaktSearch } from '@/lib/prisjakt-scraper';
import { scrapePrisjaktProduct } from '@/lib/prisjakt-scraper';

// Remove version numbers from product names (e.g., "ver 5.53.13")
function cleanProductName(name: string): string {
  return name.replace(/\s+ver\s+[\d.]+/gi, '').trim();
}

export async function POST(request: NextRequest) {
  try {
    const { moduleNumber, apiKey } = await request.json();

    if (!moduleNumber) {
      return NextResponse.json(
        { error: 'Module number is required' },
        { status: 400 }
      );
    }

    const cleanModuleNumber = cleanProductName(moduleNumber);

    // If no API key provided, fall back to scraping
    if (!apiKey) {
      // Search with the exact module number (SKU)
      console.log(`Searching for: "${cleanModuleNumber}"`);
      
      const products = await scrapePrisjaktSearch(cleanModuleNumber);
      
      if (products.length === 1) {
        const refinedProducts = await scrapePrisjaktProduct(products[0].storeUrl);
        return NextResponse.json({ products: refinedProducts });
      }

      return NextResponse.json({ products });
    }

    const api = new PrisjaktAPI(apiKey);
    const products = await api.searchRAM(moduleNumber);

    return NextResponse.json({ products });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Failed to search for RAM modules' },
      { status: 500 }
    );
  }
}
