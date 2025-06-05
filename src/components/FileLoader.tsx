
import React, { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FileLoaderProps {
  onFileLoad: (content: string, filename: string) => void;
  isLoading: boolean;
}

export const FileLoader: React.FC<FileLoaderProps> = ({ onFileLoad, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.md')) {
      toast({
        title: "Invalid file type",
        description: "Please select a .md (markdown) file",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFileLoad(content, file.name);
    };
    reader.readAsText(file);
  }, [onFileLoad]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  return (
    <CardContent className="p-8">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center transition-all
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".md"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isLoading}
        />
        
        <div className="space-y-4">
          {isLoading ? (
            <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
          ) : (
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
          )}
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isLoading ? 'Processing BRD Document...' : 'Upload your BRD file'}
            </h3>
            <p className="text-gray-600">
              {isLoading 
                ? 'Analyzing sections and generating summaries...'
                : 'Drag and drop your .md file here or click to browse'
              }
            </p>
          </div>

          {!isLoading && (
            <Button variant="outline" className="mt-4">
              <FileText className="mr-2 h-4 w-4" />
              Choose File
            </Button>
          )}
        </div>
      </div>
    </CardContent>
  );
};
