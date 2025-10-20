import { DieInfo } from '@/types/ram';

export const dieKnowledgeBase: Record<string, DieInfo> = {
  // Fallback when die cannot be identified
  'Unknown': {
    dieType: 'Unknown',
    manufacturer: 'Unknown',
    rank: 'Single',
    density: 'Unknown',
    description: 'Die type could not be determined from available data. Treat specs and OC potential as variable.',
    performance: 'Unknown',
    overclocking: 'Unknown'
  },
  // DDR5-only dies (mainstream ICs)
  'Hynix A-Die (DDR5)': {
    dieType: 'Hynix A-Die (DDR5)',
    manufacturer: 'Hynix',
    rank: 'Single',
    density: '16Gb',
    description: 'First-wave DDR5 IC highly regarded for tight timings and strong OC headroom, popular for DDR5-6000–7200 kits.',
    performance: 'Premium',
    overclocking: 'Excellent'
  },
  'Hynix M-Die (DDR5)': {
    dieType: 'Hynix M-Die (DDR5)',
    manufacturer: 'Hynix',
    rank: 'Single',
    density: '24Gb',
    description: 'Newer high-density DDR5 IC enabling 24GB/48GB modules; very capable with high frequencies and good timings.',
    performance: 'High',
    overclocking: 'Good'
  },
  'Samsung D-Die (DDR5)': {
    dieType: 'Samsung D-Die (DDR5)',
    manufacturer: 'Samsung',
    rank: 'Single',
    density: '16Gb',
    description: 'Early Samsung DDR5 IC; decent frequencies with moderate timings; responds to tuning but trails top Hynix bins.',
    performance: 'High',
    overclocking: 'Good'
  },
  'Samsung V-Die (DDR5)': {
    dieType: 'Samsung V-Die (DDR5)',
    manufacturer: 'Samsung',
    rank: 'Single',
    density: '16Gb',
    description: 'Later-gen Samsung DDR5 IC with improved stability and frequency scaling compared to D-Die.',
    performance: 'High',
    overclocking: 'Good'
  },
  'Micron A-Die (DDR5)': {
    dieType: 'Micron A-Die (DDR5)',
    manufacturer: 'Micron',
    rank: 'Single',
    density: '16Gb',
    description: 'Widely used DDR5 IC; strong compatibility and solid XMP/EXPO behavior; moderate OC headroom.',
    performance: 'High',
    overclocking: 'Fair'
  },
  'Micron Rev.B (DDR5)': {
    dieType: 'Micron Rev.B (DDR5)',
    manufacturer: 'Micron',
    rank: 'Single',
    density: '16Gb',
    description: 'Refined Micron DDR5 revision with incremental gains in stability and frequency over early lots.',
    performance: 'High',
    overclocking: 'Good'
  }
};

export function getDieInfo(chip: string): DieInfo | null {
  // Try exact match first
  if (dieKnowledgeBase[chip]) {
    return dieKnowledgeBase[chip];
  }

  // Try partial matches
  const normalizedChip = chip.toLowerCase();
  for (const [key, value] of Object.entries(dieKnowledgeBase)) {
    if (key.toLowerCase().includes(normalizedChip) || normalizedChip.includes(key.toLowerCase())) {
      return value;
    }
  }

  return null;
}

export function getRankInfo(ssDs: 'SS' | 'DS'): { rank: string; description: string } {
  if (ssDs === 'SS') {
    return {
      rank: 'Single-Sided',
      description: 'Memory chips are placed on one side of the PCB. Usually single-rank, better for overclocking.'
    };
  } else {
    return {
      rank: 'Double-Sided',
      description: 'Memory chips are placed on both sides of the PCB. Usually dual-rank, provides better performance in some workloads.'
    };
  }
}
