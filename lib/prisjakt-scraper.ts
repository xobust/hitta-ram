import { PrisjaktProduct, AvailabilityStatus } from '@/types/ram';

// Filter out results with "Prisjakt" as the store (not actual stores)
function filterPrisjaktStore(products: PrisjaktProduct[]): PrisjaktProduct[] {
  return products.filter(p => !/(prisjakt)/i.test(p.store));
}

// Very lightweight HTML scraping that prefers structured data (JSON-LD)
// Falls back to naive regex extraction if needed. This is a best-effort
// temporary solution until an official API key is available.
export async function scrapePrisjaktSearch(query: string): Promise<PrisjaktProduct[]> {
  try {
    // The search page uses `query=`
    const url = `https://www.prisjakt.nu/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      return [];
    }

    const html = await res.text();

    // 1) Try focused extraction of primary result card first (most reliable for search pages)
    const focused = filterPrisjaktStore(extractPrimarySearchItems(html));
    if (focused.length > 0) return focused;

    // 2) Try to parse JSON-LD product data
    const productsFromJsonLd = filterPrisjaktStore(extractProductsFromJsonLd(html));
    if (productsFromJsonLd.length > 0) return productsFromJsonLd;

    // 3) Fallback: naive scraping for price/name/store snippets
    const fallback = filterPrisjaktStore(extractProductsNaively(html));
    if (fallback.length > 0) return fallback;

    // 3) Final fallback: find first product page link and scrape it
    const productLink = (html.match(/href=\"(\/produkt\.php\?p=\d+)\"/i)?.[1]) || '';
    if (productLink) {
      const productsFromProductPage = await scrapePrisjaktProduct(`https://www.prisjakt.nu${productLink}`);
      return filterPrisjaktStore(productsFromProductPage);
    }
    return [];
  } catch {
    return [];
  }
}

// Scrape a Prisjakt product page (single product with multiple offers)
// Accepts either a full URL or a product id (p=xxxxx)
export async function scrapePrisjaktProduct(urlOrId: string): Promise<PrisjaktProduct[]> {
  try {
    const url = urlOrId.startsWith('http')
      ? urlOrId
      : `https://www.prisjakt.nu/produkt.php?p=${encodeURIComponent(urlOrId.replace(/[^0-9]/g, ''))}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Reuse JSON-LD extraction; product pages typically include detailed offers
    const products = filterPrisjaktStore(extractProductsFromJsonLd(html));
    if (products.length > 0) return products;

    // Naive fallback to try to capture at least the primary price on the page
    const offers = filterPrisjaktStore(extractOffersFromProductPageNaively(html, url));
    if (offers.length > 0) return offers;
    
    const name = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').trim());
    const priceRaw = (html.match(/([0-9][0-9\s]{1,7}(?:[\.,][0-9]{2})?)\s*(kr|sek)/i)?.[0] || '').trim();
    const price = priceRaw ? Number(priceRaw.replace(/[^0-9.,]/g, '').replace(',', '.')) : NaN;

    if (name && Number.isFinite(price) && price > 0) {
      return [{
        id: url,
        name: (name),
        price: price as unknown as number,
        currency: 'SEK',
        store: 'Prisjakt',
        storeUrl: url,
        availability: 'in_stock',
      }];
    }
    return [];
  } catch {
    return [];
  }
}

function extractProductsFromJsonLd(html: string): PrisjaktProduct[] {
  const results: PrisjaktProduct[] = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const jsonText = match[1].trim();
    try {
      const data = JSON.parse(jsonText);
      const items: any[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        collectProductsFromLdObject(item, results);
      }
    } catch {
      // ignore malformed json
    }
  }
  return dedupeProducts(results);
}

function collectProductsFromLdObject(obj: any, out: PrisjaktProduct[]) {
  if (!obj || typeof obj !== 'object') return;

  // If this object is a Product
  if ((obj['@type'] === 'Product' || (Array.isArray(obj['@type']) && obj['@type'].includes('Product'))) && obj.name) {
    const offers = normalizeOffers(obj.offers);
    if (offers.length === 0) {
      // Skip products without price info
    } else {
      const validOffers: PrisjaktProduct[] = [];
      for (const offer of offers) {
        const numericPrice = typeof offer.price === 'number' ? offer.price : Number(String(offer.price).replace(/[^0-9.,]/g, '').replace(',', '.'));
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) continue;
        validOffers.push({
          id: (obj.sku || obj.url || obj.name) + '::' + (offer.url || offer.seller?.name || ''),
          name: obj.name,
          price: numericPrice,
          currency: offer.priceCurrency || 'SEK',
          store: offer.seller?.name || 'Unknown',
          storeUrl: offer.url || obj.url || '',
          availability: toAvailability(offer.availability),
          imageUrl: Array.isArray(obj.image) ? obj.image[0] : obj.image,
        });
      }
      if (validOffers.length > 0) {
        out.push(...validOffers);
      }
    }
  }

  // Recurse into known containers
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        for (const v of val) collectProductsFromLdObject(v, out);
      } else {
        collectProductsFromLdObject(val, out);
      }
    }
  }
}

function normalizeOffers(offers: any): any[] {
  if (!offers) return [];
  if (Array.isArray(offers)) return offers;
  return [offers];
}

function toAvailability(avail: string | undefined): AvailabilityStatus {
  if (!avail) return 'not_available';
  const s = avail.toLowerCase();
  if (s.includes('instock') || s.includes('in_stock') || s.includes('in stock') || s.includes('available')) {
    return 'in_stock';
  }
  if (s.includes('preorder') || s.includes('pre-order') || s.includes('backorder')) {
    return 'incoming';
  }
  return 'not_available';
}

function extractProductsNaively(html: string): PrisjaktProduct[] {
  const results: PrisjaktProduct[] = [];

  // Try to find blocks that look like product tiles with a price number
  const productBlockRegex = /<a[^>]+href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = productBlockRegex.exec(html)) !== null) {
    const href = decodeHtml(m[1]);
    const block = m[2];

    // Simple name and price extraction
    const name = stripTags((block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '').trim()) ||
                 stripTags((block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || '').trim());
    const priceRaw = (block.match(/([0-9][0-9\s]{1,7}(?:[\.,][0-9]{2})?)\s*(kr|sek)/i)?.[0] || '').trim();

    if (!name) continue;
    const price = priceRaw ? Number(priceRaw.replace(/[^0-9.,]/g, '').replace(',', '.')) : NaN;
    if (!Number.isFinite(price) || price <= 0) continue;

    results.push({
      id: href || name,
      name: name,
      price: price as unknown as number,
      currency: 'SEK',
      store: 'Prisjakt',
      storeUrl: href.startsWith('http') ? href : `https://www.prisjakt.nu${href}`,
      availability: 'in_stock',
    });
  }

  return dedupeProducts(results).slice(0, 10);
}

// Extract the main search result card using DOM structure
function extractPrimarySearchItems(html: string): PrisjaktProduct[] {
  const results: PrisjaktProduct[] = [];

  // Find the product link: <a class="productName" ... href="/produkt.php?p=...">
  const productLinkMatch = html.match(/<a[^>]*class=\"[^\"]*productName[^\"]*\"[^>]*href=\"(\/produkt\.php\?p=\d+)\"[^>]*>([\s\S]*?)<\/a>/i);
  if (!productLinkMatch) return results;

  const productLink = productLinkMatch[1];
  const titleBlock = productLinkMatch[2];
  const title = stripTags(titleBlock).replace(/\s+/g, ' ').trim();

  // Find price: <p class="text-m font-heaviest">2 095 kr</p> or with &nbsp;
  const priceMatch = html.match(/<p[^>]*class=\"[^\"]*text-m[^\"]*font-heaviest[^\"]*\"[^>]*>([0-9\s&nbsp;]+)\s*(kr|sek)<\/p>/i);
  if (!priceMatch) return results;
  const price = Number(priceMatch[1].replace(/&nbsp;/g, '').replace(/[^0-9.,]/g, '').replace(',', '.'));

  // Find store: <p class="text-xs ...">hos<span class="font-heaviest"> <!-- -->MJ Multimedia</span></p>
  const storeMatch = html.match(/hos<span[^>]*class=\"[^\"]*font-heaviest[^\"]*\"[^>]*>\s*(?:<!--[^>]*-->\s*)?([^<]+)<\/span>/i);
  if (!storeMatch) return results;
  let store = stripTags(storeMatch[1]).replace(/\s+/g, ' ').trim();

  // Filter out generic labels
  if (/(prisjakt|butik|annons|kr)/i.test(store)) return results;

  if (Number.isFinite(price) && price > 0 && store && title) {
    results.push({
      id: productLink,
      name: title,
      price,
      currency: 'SEK',
      store,
      storeUrl: `https://www.prisjakt.nu${productLink}`,
      availability: 'in_stock', // Search results show lowest available price
    });
  }

  return results;
}

// Extract offers from product page using DOM structure
function extractOffersFromProductPageNaively(html: string, pageUrl: string): PrisjaktProduct[] {
  const out: PrisjaktProduct[] = [];
  const name = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').trim());
  if (!name) return out;

  // Find all offer rows by looking for go-to-shop links
  const offerRegex = /<a[^>]*href=\"(https:\/\/www\.prisjakt\.nu\/go-to-shop\/[^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
  let offerMatch: RegExpExecArray | null;
  
  while ((offerMatch = offerRegex.exec(html)) !== null) {
    const storeUrl = offerMatch[1];
    const offerHtml = offerMatch[2];
    
    // Extract store name from StoreInfoTitle or picture alt
    let store = offerHtml.match(/<span[^>]*class=\"[^\"]*StoreInfoTitle[^\"]*\"[^>]*>([^<]+)<\/span>/i)?.[1]?.trim() || '';
    if (!store) store = offerHtml.match(/<picture[^>]*alt=\"([^\"]+)\"/i)?.[1]?.trim() || '';
    
    store = stripTags(store).replace(/\s+/g, ' ').trim();
    
    // Filter out generic labels
    if (!store || /(prisjakt|gå till butik|butik|rank|omdöme|produkt|kr|annons|visa\s+\d+)/i.test(store)) {
      continue;
    }
    
    // Extract price from data-test="PriceLabel"
    const priceMatch = offerHtml.match(/data-test=\"PriceLabel\"[^>]*>([0-9\s&nbsp;]+)\s*(kr|sek)<\//i);
    if (!priceMatch) continue;
    
    const numericPrice = Number(priceMatch[1].replace(/&nbsp;/g, '').replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) continue;
    
    // Detect stock status from icon classes
    const isInStock = /iconstockinstock/i.test(offerHtml);
    const isIncoming = /iconstockincoming/i.test(offerHtml);
    const isOutOfStock = /iconstockoutofstock/i.test(offerHtml);
    
    let availability: AvailabilityStatus = 'not_available';
    if (isInStock) {
      availability = 'in_stock';
    } else if (isIncoming) {
      availability = 'incoming';
    }
    
    out.push({
      id: `${pageUrl}::${store}`,
      name: name,
      price: numericPrice,
      currency: 'SEK',
      store,
      storeUrl,
      availability,
    });
  }

  // Dedupe by store, keeping lowest price
  const byStore = new Map<string, PrisjaktProduct>();
  for (const p of out) {
    const key = p.store.toLowerCase();
    const prev = byStore.get(key);
    if (!prev || p.price < prev.price) byStore.set(key, p);
  }
  
  const offers = Array.from(byStore.values());
  
  // If page indicates no stock anywhere, mark all offers as not available
  if (/Ingen butik har produkten i lager/i.test(html)) {
    for (const o of offers) o.availability = 'not_available';
  }
  
  return offers;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function dedupeProducts(list: PrisjaktProduct[]): PrisjaktProduct[] {
  const seen = new Set<string>();
  const out: PrisjaktProduct[] = [];
  for (const p of list) {
    const key = `${p.name}|${p.store}|${p.storeUrl}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}


