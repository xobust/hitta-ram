'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import Papa, { ParseResult, ParseError, LocalFile } from 'papaparse';
import { RAMModule } from '@/types/ram';
import { detectColumnMapping, parseCSVData } from '@/lib/csv-parser';

interface CSVUploadProps {
  onDataParsed: (data: RAMModule[], columnInfo?: { mapped: string[], unknown: string[] }) => void;
  onError: (error: string) => void;
}

export default function CSVUpload({ onDataParsed, onError }: CSVUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const parseCSV = useCallback((file: File) => {
    setIsProcessing(true);
    
    (Papa as any).parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<any>) => {
        try {
          const data = results.data as any[];
          
          if (data.length === 0) {
            onError('CSV file appears to be empty or has no valid data rows.');
            return;
          }

          // Get the first row to analyze column structure
          const firstRow = data[0];
          const columns = Object.keys(firstRow);
          
          // Intelligent column mapping with fuzzy matching
          const columnMap = detectColumnMapping(columns);
          
          // Validate that we have essential columns
          if (!columnMap.module || !columnMap.vendor) {
            onError(`Missing essential columns. Found: ${columns.join(', ')}. Required: Module and Vendor columns.`);
            return;
          }

          // Transform the data using detected column mapping (includes unknown columns)
          const ramModules = parseCSVData(data, columnMap);

          if (ramModules.length === 0) {
            onError('No valid RAM modules found in the CSV file. Please check that Module and Vendor columns contain data.');
            return;
          }

          // Prepare column information for display
          const mappedColumns = Object.values(columnMap).filter(col => col && !columnMap.unknown.includes(col)) as string[];
          const columnInfo = {
            mapped: mappedColumns,
            unknown: columnMap.unknown
          };

          onDataParsed(ramModules, columnInfo);
        } catch (error) {
          onError(`Error parsing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsProcessing(false);
        }
      },
      error: (error: ParseError) => {
        onError(`CSV parsing error: ${error.message}`);
        setIsProcessing(false);
      }
    });
  }, [onDataParsed, onError]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onError('Please select a CSV file.');
      return;
    }
    parseCSV(file);
  }, [parseCSV, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center space-y-4">
          {isProcessing ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          ) : (
            <Upload className="h-12 w-12 text-gray-400" />
          )}
          
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {isProcessing ? 'Processing CSV...' : 'Upload Motherboard RAM List'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Drag and drop your CSV file here, or click to browse
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <FileText className="h-4 w-4" />
            <span>CSV format required</span>
          </div>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileInputChange}
            className="hidden"
            id="csv-upload"
            disabled={isProcessing}
          />
          
          <label
            htmlFor="csv-upload"
            className={`btn-primary cursor-pointer ${isProcessing ? 'opacity-50' : ''}`}
          >
            Choose File
          </label>
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">CSV Format Support:</p>
            <p className="mt-1">
              <strong>Required:</strong> Module and Vendor columns<br/>
              <strong>Auto-detected:</strong> Type, RAM Speed, Size, Chip, SS/DS, XMP, EXPO, etc.<br/>
              <strong>Flexible:</strong> Column names are intelligently matched (e.g., "Brand" → "Vendor")<br/>
              <strong>Additional columns:</strong> Any extra columns are preserved and displayed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
