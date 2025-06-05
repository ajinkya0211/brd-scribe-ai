
import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Section } from '@/types/brd';
import { Bot, Hash, Loader2, Send } from 'lucide-react';
import { SectionHierarchy } from '@/components/SectionHierarchy';

interface SidePanelProps {
  sections: Section[];
  onAIEdit: (prompt: string) => Promise<void>;
  isProcessing: boolean;
}

export const SidePanel: React.FC<SidePanelProps> = ({ 
  sections, 
  onAIEdit, 
  isProcessing 
}) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmitPrompt = async () => {
    if (!prompt.trim()) return;
    
    try {
      await onAIEdit(prompt);
      setPrompt('');
    } catch (error) {
      console.error('AI edit failed:', error);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          BRD Assistant
        </h2>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-4">
        <Tabs defaultValue="hierarchy" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hierarchy">Structure</TabsTrigger>
            <TabsTrigger value="ai-edit">AI Edit</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hierarchy" className="flex-1 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Document Overview</span>
                <Badge variant="secondary">
                  <Hash className="h-3 w-3 mr-1" />
                  {sections.length}
                </Badge>
              </div>
              <SectionHierarchy sections={sections} />
            </div>
          </TabsContent>
          
          <TabsContent value="ai-edit" className="flex-1 mt-4">
            <div className="space-y-4 h-full flex flex-col">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  AI Editing Prompt
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what changes you want to make to the BRD..."
                  className="min-h-[120px] resize-none"
                  disabled={isProcessing}
                />
              </div>
              
              <Button 
                onClick={handleSubmitPrompt}
                disabled={!prompt.trim() || isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Apply Changes
                  </>
                )}
              </Button>
              
              <div className="text-xs text-gray-500 space-y-1">
                <p>💡 Example prompts:</p>
                <ul className="space-y-1 ml-2">
                  <li>• "Add mobile security requirements"</li>
                  <li>• "Update risk analysis with cloud risks"</li>
                  <li>• "Expand user acceptance criteria"</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
