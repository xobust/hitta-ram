'use client';

import { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import CSVUpload from '@/components/CSVUpload';
import RAMTable from '@/components/RAMTable';
import { RAMModule, RAMModuleWithPrice, PrisjaktProduct } from '@/types/ram';

export default function HomePage() {
  const [ramModules, setRamModules] = useState<RAMModuleWithPrice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [useMockAPI, setUseMockAPI] = useState(false);
  const [columnInfo, setColumnInfo] = useState<{ mapped: string[], unknown: string[] } | null>(null);

  // Server helper: calls API route, which scrapes when no key is provided
  const serverSearch = useCallback(async (moduleNumber: string): Promise<PrisjaktProduct[]> => {
    const res = await fetch('/api/prisjakt/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleNumber, apiKey: useMockAPI ? undefined : apiKey || undefined }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || []) as PrisjaktProduct[];
  }, [apiKey, useMockAPI]);

  const handleDataParsed = useCallback((data: RAMModule[], columnInfo?: { mapped: string[], unknown: string[] }) => {
    const modulesWithPrice: RAMModuleWithPrice[] = data.map(module => ({
      ...module,
      price: undefined,
      currency: undefined,
      availability: undefined,
      store: undefined,
      storeUrl: undefined,
      lastUpdated: undefined,
    }));
    
    setRamModules(modulesWithPrice);
    setColumnInfo(columnInfo || null);
    setError(null);
    
    let successMessage = `Successfully loaded ${data.length} RAM modules from CSV`;
    if (columnInfo) {
      if (columnInfo.unknown.length > 0) {
        successMessage += `. Found ${columnInfo.unknown.length} additional columns: ${columnInfo.unknown.join(', ')}`;
      }
    }
    setSuccess(successMessage);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setSuccess(null);
  }, []);

  const handleRefreshPrices = useCallback(async (moduleNumber: string) => {
    setIsLoading(true);
    try {
      const products = await serverSearch(moduleNumber);
      
      if (products.length > 0) {
        // Find the best price (lowest available price)
        const bestProduct = products
          .filter(p => p.availability)
          .sort((a, b) => a.price - b.price)[0] || products[0];

        setRamModules(prev => prev.map(module => 
          module.module === moduleNumber 
            ? {
                ...module,
                price: bestProduct.price,
                currency: bestProduct.currency,
                availability: bestProduct.availability,
                store: bestProduct.store,
                storeUrl: bestProduct.storeUrl,
                lastUpdated: new Date(),
              }
            : module
        ));
      }
    } catch (error) {
      console.error('Error fetching price:', error);
    } finally {
      setIsLoading(false);
    }
  }, [serverSearch]);

  const handleRefreshAllPrices = useCallback(async (modulesToRefresh: RAMModuleWithPrice[]) => {
    setIsLoading(true);
    try {
      // Process each module sequentially to update UI as results come in
      for (let i = 0; i < modulesToRefresh.length; i++) {
        const module = modulesToRefresh[i];
        
        try {
          const products = await serverSearch(module.module);
          
          if (products.length > 0) {
            const bestProduct = products
              .filter(p => p.availability === 'in_stock')
              .sort((a, b) => a.price - b.price)[0] || products[0];
            
            // Update this specific module immediately
            setRamModules((prev) => 
              prev.map((m) => 
                m.module === module.module
                  ? {
                      ...m,
                      price: bestProduct.price,
                      currency: bestProduct.currency,
                      availability: bestProduct.availability,
                      store: bestProduct.store,
                      storeUrl: bestProduct.storeUrl,
                      lastUpdated: new Date(),
                    }
                  : m
              )
            );
          } else {
            // Mark as not found if no products returned
            setRamModules((prev) => 
              prev.map((m) => 
                m.module === module.module
                  ? {
                      ...m,
                      price: undefined,
                      store: 'Not Found',
                      lastUpdated: new Date(),
                    }
                  : m
              )
            );
          }
        } catch (err) {
          // Mark individual failures as not found
          setRamModules((prev) => 
            prev.map((m) => 
              m.module === module.module
                ? {
                    ...m,
                    price: undefined,
                    store: 'Not Found',
                    lastUpdated: new Date(),
                  }
                : m
            )
          );
        }
      }
      
      setSuccess(`${modulesToRefresh.length} prices refreshed successfully`);
    } catch (error) {
      setError('Error refreshing prices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [serverSearch]);

  return (
    <div className="space-y-8">
      {/* API Configuration */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Configuration</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useMockAPI}
                onChange={(e) => setUseMockAPI(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Use Mock API (for testing)</span>
            </label>
          </div>
          
          {!useMockAPI && (
            <div>
              <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-2">
                Prisjakt API Key
              </label>
              <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Prisjakt API key"
                className="input-field w-full max-w-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from{' '}
                <a 
                  href="https://partners.prisjakt.nu/docs/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Prisjakt Partners
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">{success}</span>
          </div>
        </div>
      )}

      {/* CSV Upload */}
      {ramModules.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Motherboard RAM List</h2>
          <CSVUpload onDataParsed={handleDataParsed} onError={handleError} />
        </div>
      )}

      {/* RAM Table */}
      {ramModules.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">RAM Modules</h2>
              <p className="text-sm text-gray-600 mt-1">
                {ramModules.length} modules loaded • Click "Find Price" to search for prices
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setRamModules([]);
                  setColumnInfo(null);
                  setError(null);
                  setSuccess(null);
                }}
                className="btn-secondary"
              >
                Upload New File
              </button>
            </div>
          </div>

          <RAMTable
            data={ramModules}
            onRefreshPrices={handleRefreshPrices}
            onRefreshAllPrices={handleRefreshAllPrices}
            isLoading={isLoading}
          />

          {/* Column Information */}
          {columnInfo && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">CSV Column Detection</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-blue-800 mb-1">Mapped Columns ({columnInfo.mapped.length})</h4>
                  <p className="text-blue-700">
                    {columnInfo.mapped.length > 0 ? columnInfo.mapped.join(', ') : 'None detected'}
                  </p>
                </div>
                {columnInfo.unknown.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-800 mb-1">Additional Columns ({columnInfo.unknown.length})</h4>
                    <p className="text-blue-700">
                      {columnInfo.unknown.join(', ')}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      These columns are preserved and displayed in the table
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <h3 className="font-medium mb-2">About Die Types and Ranks</h3>
            <ul className="space-y-1 text-xs">
              <li><strong>Die Type:</strong> The memory chip manufacturer and revision (e.g., Samsung B-Die, Hynix A-Die)</li>
              <li><strong>SS/DS:</strong> Single-Sided (SS) or Double-Sided (DS) - physical layout of memory chips</li>
              <li><strong>Rank:</strong> Single-rank modules have better overclocking potential, dual-rank provides better performance in some workloads</li>
              <li><strong>Performance Levels:</strong> Premium &gt; High &gt; Medium &gt; Low (based on overclocking potential and timings)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
