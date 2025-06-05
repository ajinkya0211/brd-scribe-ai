
import React, { useState } from 'react';
import { FileLoader } from '@/components/FileLoader';
import { DocumentEditor } from '@/components/DocumentEditor';
import { SidePanel } from '@/components/SidePanel';
import { useBRDProcessor } from '@/hooks/useBRDProcessor';
import { Card } from '@/components/ui/card';

const BRDAssistant = () => {
  const { 
    document, 
    sections, 
    isProcessing, 
    loadDocument, 
    updateDocument, 
    processAIEdit 
  } = useBRDProcessor();

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Smart BRD Assistant
          </h1>
          <p className="text-gray-600 text-lg">
            Intelligent Business Requirements Document Editor with AI-powered content management
          </p>
        </header>

        {!document ? (
          <div className="flex justify-center">
            <Card className="w-full max-w-2xl">
              <FileLoader onFileLoad={loadDocument} isLoading={isProcessing} />
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
            <div className="col-span-3">
              <SidePanel 
                sections={sections}
                onAIEdit={processAIEdit}
                isProcessing={isProcessing}
              />
            </div>
            <div className="col-span-9">
              <DocumentEditor
                content={document}
                onChange={updateDocument}
                sections={sections}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BRDAssistant;
