// Intelligent CSV column detection and mapping
export interface ColumnMapping {
  type: string | null;
  vendor: string | null;
  ramSpeed: string | null;
  supportedSpeed: string | null;
  size: string | null;
  module: string | null;
  chip: string | null;
  ssDs: string | null;
  xmp: string | null;
  expo: string | null;
  dimmSocketSupport: string | null;
  oc: string | null;
  bios: string | null;
  note: string | null;
  // Allow unknown columns to pass through
  unknown: string[];
}

// Fuzzy string matching function
function fuzzyMatch(str: string, patterns: string[]): number {
  const normalizedStr = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  let bestScore = 0;
  
  for (const pattern of patterns) {
    const normalizedPattern = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Exact match gets highest score
    if (normalizedStr === normalizedPattern) {
      return 100;
    }
    
    // Check if pattern is contained in string
    if (normalizedStr.includes(normalizedPattern)) {
      bestScore = Math.max(bestScore, 80);
    }
    
    // Check if string is contained in pattern
    if (normalizedPattern.includes(normalizedStr)) {
      bestScore = Math.max(bestScore, 70);
    }
    
    // Check for partial matches (avoid string iteration to support older TS targets)
    let commonChars = 0;
    for (let i = 0; i < normalizedStr.length; i++) {
      const ch = normalizedStr.charAt(i);
      if (normalizedPattern.includes(ch)) {
        commonChars++;
      }
    }
    const similarity = (commonChars / Math.max(normalizedStr.length, normalizedPattern.length)) * 60;
    bestScore = Math.max(bestScore, similarity);
  }
  
  return bestScore;
}

// Find best matching column for a given field
function findBestMatch(columns: string[], patterns: string[]): string | null {
  let bestColumn: string | null = null;
  let bestScore = 0;
  
  for (const column of columns) {
    const score = fuzzyMatch(column, patterns);
    if (score > bestScore && score > 30) { // Minimum threshold
      bestScore = score;
      bestColumn = column;
    }
  }
  
  return bestColumn;
}

export function detectColumnMapping(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    type: null,
    vendor: null,
    ramSpeed: null,
    supportedSpeed: null,
    size: null,
    module: null,
    chip: null,
    ssDs: null,
    xmp: null,
    expo: null,
    dimmSocketSupport: null,
    oc: null,
    bios: null,
    note: null,
    unknown: []
  };

  // Define patterns for each field (ordered by priority)
  const fieldPatterns: Record<Exclude<keyof ColumnMapping, 'unknown'>, string[]> = {
    type: ['type', 'memory type', 'ddr', 'ram type'],
    vendor: ['vendor', 'brand', 'manufacturer', 'maker', 'company'],
    ramSpeed: ['ram speed', 'speed', 'frequency', 'mhz', 'ram_speed', 'ramSpeed'],
    supportedSpeed: ['supported speed', 'supported_speed', 'supportedSpeed', 'compatible speed'],
    size: ['size', 'capacity', 'gb', 'memory size', 'module size'],
    module: ['module', 'model', 'part number', 'sku', 'product', 'partnumber', 'model number'],
    chip: ['chip', 'die', 'memory chip', 'ic', 'die type'],
    ssDs: ['ss/ds', 'ssds', 'ss_ds', 'single sided', 'double sided', 'rank', 'sided'],
    xmp: ['xmp', 'intel xmp', 'extreme memory profile'],
    expo: ['expo', 'amd expo', 'extended profiles for overclocking'],
    dimmSocketSupport: ['dimm', 'socket', 'pin', 'dimm socket', 'socket support', 'dimm_socket'],
    oc: ['oc', 'overclock', 'overclocking', 'overclockable'],
    bios: ['bios', 'firmware', 'version', 'bios version'],
    note: ['note', 'notes', 'comment', 'comments', 'description', 'remarks']
  };

  // Track which columns have been mapped
  const mappedColumns = new Set<string>();

  // Map known fields
  (Object.keys(fieldPatterns) as Array<Exclude<keyof ColumnMapping, 'unknown'>>).forEach((fieldKey) => {
    const patterns = fieldPatterns[fieldKey];
    const bestMatch = findBestMatch(columns, patterns);
    if (bestMatch) {
      (mapping as any)[fieldKey] = bestMatch;
      mappedColumns.add(bestMatch);
    }
  });

  // Add unmapped columns to unknown array
  mapping.unknown = columns.filter(col => !mappedColumns.has(col));

  return mapping;
}

// Enhanced CSV parsing with unknown column support
export function parseCSVData(data: any[], columnMap: ColumnMapping) {
  return data.map((row, index) => {
    const getValue = (columnKey: string | null) => {
      if (!columnKey || !row[columnKey]) return '';
      return String(row[columnKey]).trim();
    };

    const module = getValue(columnMap.module);
    const vendor = getValue(columnMap.vendor);
    
    // Skip rows without essential data
    if (!module || !vendor) return null;

    // Derive sizes
    const sizeRaw = getValue(columnMap.size);
    const perStickSizeGB = parseSizeGB(sizeRaw);
    // Try to derive total size: look for indicators like "K2-32" (2 sticks totaling 32GB) in module or note
    const { totalSizeGB, sticks } = deriveTotalSizeAndSticks(sizeRaw, getValue(columnMap.module), getValue(columnMap.note));

    // Derive rank from SS/DS and possible hints
    const ssdsRaw = getValue(columnMap.ssDs).toUpperCase();
    const rank: 'Single' | 'Dual' | 'Unknown' = ssdsRaw === 'SS' ? 'Single' : ssdsRaw === 'DS' ? 'Dual' : 'Unknown';

    // Normalize XMP/EXPO booleans (v, yes, true -> true)
    const xmpRaw = getValue(columnMap.xmp);
    const expoRaw = getValue(columnMap.expo);
    const xmpBool = toBool(xmpRaw);
    const expoBool = toBool(expoRaw);

    // Normalize die/chip naming (merge duplicates like "Samsung B" -> "Samsung B-die").
    // Default to 'Unknown' when no die information is present.
    const chipRaw = getValue(columnMap.chip);
    const chipNormalized = chipRaw ? normalizeDieName(chipRaw) : 'Unknown';

    // Build the base RAM module object
    const ramModule: any = {
      type: getValue(columnMap.type) || 'DDR5',
      vendor: vendor,
      ramSpeed: getValue(columnMap.ramSpeed),
      supportedSpeed: getValue(columnMap.supportedSpeed) || getValue(columnMap.ramSpeed),
      size: sizeRaw,
      perStickSizeGB,
      totalSizeGB,
      module: module,
      chip: chipNormalized || 'Unknown',
      ssDs: (getValue(columnMap.ssDs) as 'SS' | 'DS') || 'SS',
      rank,
      xmp: xmpRaw,
      expo: expoRaw,
      xmpBool,
      expoBool,
      dimmSocketSupport: getValue(columnMap.dimmSocketSupport),
      oc: getValue(columnMap.oc),
      bios: getValue(columnMap.bios),
      note: getValue(columnMap.note)
    };

    // Add unknown columns as additional properties
    columnMap.unknown.forEach(column => {
      const value = getValue(column);
      if (value) {
        ramModule[`unknown_${column.replace(/[^a-zA-Z0-9]/g, '_')}`] = value;
      }
    });

    return ramModule;
  }).filter(module => module !== null);
}

// Helpers
function parseSizeGB(size: string): number | undefined {
  if (!size) return undefined;
  // Accept formats like "8GB", "24GB", "32 GB", "8g"
  const m = size.toUpperCase().match(/(\d+(?:\.\d+)?)(\s*)G(?:B)?/);
  if (m) return Number(m[1]);
  // Sometimes size could be like "2x16GB" or "16Gx2" -> derive per-stick
  const m2 = size.toUpperCase().match(/(\d+)\s*[Xx]\s*(\d+(?:\.\d+)?)\s*G(?:B)?/);
  if (m2) return Number(m2[2]);
  return undefined;
}

function deriveTotalSizeAndSticks(sizeRaw: string, moduleStr: string, note: string): { totalSizeGB?: number, sticks?: number } {
  // From size like "2/4" in the CSV (common in DIMM slots column) isn't reliable; prefer module codes
  // Try patterns in module string like K2-32 (2 sticks 32GB total), K4-64, 2x16, 4x8
  const s = `${sizeRaw} ${moduleStr} ${note}`.toUpperCase();

  // 2x16GB style
  let m = s.match(/(\d+)\s*[Xx]\s*(\d+(?:\.\d+)?)\s*G(?:B)?/);
  if (m) {
    const sticks = Number(m[1]);
    const per = Number(m[2]);
    return { totalSizeGB: sticks * per, sticks };
  }

  // K2-32 or K4-64 style
  m = s.match(/K(\d+)\s*[- ]\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const sticks = Number(m[1]);
    const total = Number(m[2]);
    return { totalSizeGB: total, sticks };
  }

  // If size itself is like 32GB and perStick was parsed, we can infer sticks
  const per = parseSizeGB(sizeRaw);
  const totalMatch = s.match(/(\d+(?:\.\d+)?)\s*G(?:B)?/);
  if (per && totalMatch) {
    const total = Number(totalMatch[1]);
    if (total > per && total % per === 0) {
      return { totalSizeGB: total, sticks: total / per } as any;
    }
  }

  return { totalSizeGB: per, sticks: 1 };
}

function toBool(val: string): boolean | undefined {
  if (!val) return undefined;
  const v = val.trim().toLowerCase();
  if (['v', 'yes', 'y', 'true', 't', '1', 'supported', 'ok'].includes(v)) return true;
  if (['no', 'n', 'false', 'f', '0'].includes(v)) return false;
  return undefined;
}

// Normalize die/chip value to merge duplicates and unify casing
function normalizeDieName(input: string): string {
  if (!input) return '';
  const raw = input.trim();
  const s = raw.toLowerCase();

  // Manufacturer detection
  let maker: string | null = null;
  if (s.includes('hynix')) maker = 'Hynix';
  else if (s.includes('sk hynix')) maker = 'Hynix';
  else if (s.includes('samsung')) maker = 'Samsung';
  else if (s.includes('micron')) maker = 'Micron';
  else if (s.includes('spectek') || s.includes('spectek')) maker = 'SpecTek';
  else if (s.includes('spectek') || s.includes('spectek')) maker = 'SpecTek';
  else if (/^hynix$|^samsung$|^micron$|^sk\s*hynix$/.test(s)) {
    // will be handled below
  }

  // Letter-grade dies like A/B/C/D/M/V/G/P
  const letterMatch = s.match(/[-]?\b([abcmdvgp])\b(?:-?die)?/);
  // Forms like "A-die", "B-die", "M-die"
  const letterDieMatch = s.match(/\b([abcmdvgp])-?die\b/);
  const letter = (letterDieMatch || letterMatch)?.[1]?.toUpperCase();

  // SpecTek Y-codes (e.g., Y32A, Y4CA)
  const yCodeMatch = s.match(/\b(y\d{2}[a-z])\b/i);
  const yCode = yCodeMatch ? yCodeMatch[1].toUpperCase() : undefined;

  // If only manufacturer present
  if (!letter && !yCode) {
    if (maker) return `${maker} (unknown)`;
    // Attempt to title-case fallback
    return titleCase(raw);
  }

  // Compose normalized name
  let type: string | undefined;
  if (yCode) type = yCode; // SpecTek codes stay as is
  else if (letter) type = `${letter}-die`;

  // Derive maker from common prefixes if missing
  if (!maker) {
    if (s.startsWith('samsung')) maker = 'Samsung';
    else if (s.startsWith('micron')) maker = 'Micron';
    else if (s.startsWith('sk') || s.includes('hynix')) maker = 'Hynix';
    else if (s.includes('spectek')) maker = 'SpecTek';
  }

  return [maker ?? titleCase(raw.split(/\s|-/)[0]), type ?? titleCase(raw.replace(/^[^\s]+\s*/, ''))]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s|-/)
    .map(s => s ? s[0].toUpperCase() + s.slice(1) : s)
    .join(' ');
}
