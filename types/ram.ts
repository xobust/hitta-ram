export interface RAMModule {
  type: string;
  vendor: string;
  ramSpeed: string;
  supportedSpeed: string;
  size: string; // raw size string from CSV (e.g., "16GB")
  perStickSizeGB?: number;
  totalSizeGB?: number;
  module: string;
  chip: string;
  ssDs: 'SS' | 'DS';
  rank?: 'Single' | 'Dual' | 'Unknown';
  xmp: string;
  expo: string;
  xmpBool?: boolean;
  expoBool?: boolean;
  dimmSocketSupport: string;
  oc: string;
  bios: string;
  note: string;
  // Allow unknown columns to pass through
  [key: string]: any;
}

export type AvailabilityStatus = 'in_stock' | 'incoming' | 'not_available';

export interface RAMModuleWithPrice extends RAMModule {
  price?: number;
  currency?: string;
  availability?: AvailabilityStatus;
  store?: string;
  storeUrl?: string;
  lastUpdated?: Date;
}

export interface DieInfo {
  dieType: string;
  manufacturer: string;
  rank: 'Single' | 'Dual' | 'Quad';
  density: string;
  description: string;
  performance: 'Low' | 'Medium' | 'High' | 'Premium' | 'Unknown';
  overclocking: 'Poor' | 'Fair' | 'Good' | 'Excellent' | 'Unknown';
}

export interface PrisjaktProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  store: string;
  storeUrl: string;
  availability: AvailabilityStatus;
  imageUrl?: string;
}

export interface CacheEntry {
  data: PrisjaktProduct[];
  timestamp: number;
  ttl: number;
}
