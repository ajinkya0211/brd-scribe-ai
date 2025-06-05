
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, Download } from 'lucide-react';
import { Section } from '@/types/brd';
import { toast } from '@/hooks/use-toast';

interface DocumentEditorProps {
  content: string;
  onChange: (content: string) => void;
  sections: Section[];
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ 
  content, 
  onChange, 
  sections 
}) => {
  const [localContent, setLocalContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setLocalContent(content);
    setHasUnsavedChanges(false);
  }, [content]);

  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent);
    setHasUnsavedChanges(newContent !== content);
  };

  const handleSave = () => {
    onChange(localContent);
    setHasUnsavedChanges(false);
    toast({
      title: "Document saved",
      description: "Your changes have been saved successfully"
    });
  };

  const handleDownload = () => {
    const blob = new Blob([localContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brd-document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Document downloaded",
      description: "BRD file has been downloaded successfully"
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <h2 className="text-xl font-semibold">Document Editor</h2>
          <p className="text-sm text-gray-600">
            {sections.length} sections • {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleSave} 
            disabled={!hasUnsavedChanges}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button onClick={handleDownload} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <textarea
          value={localContent}
          onChange={(e) => handleContentChange(e.target.value)}
          className="w-full h-full p-6 border-0 resize-none outline-none font-mono text-sm leading-relaxed"
          placeholder="Your BRD content will appear here..."
          style={{ minHeight: '500px' }}
        />
      </CardContent>
    </Card>
  );
};
