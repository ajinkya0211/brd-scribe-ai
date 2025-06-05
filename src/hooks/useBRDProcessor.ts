
import { useState, useCallback } from 'react';
import { Section } from '@/types/brd';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useBRDProcessor = () => {
  const [document, setDocument] = useState<string>('');
  const [sections, setSections] = useState<Section[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentId, setDocumentId] = useState<string>('');

  const loadDocument = useCallback(async (content: string, filename: string) => {
    setIsProcessing(true);
    
    try {
      console.log('Loading document:', filename);
      
      // Call the AI processor edge function
      const { data, error } = await supabase.functions.invoke('ai-brd-processor', {
        body: {
          action: 'process_document',
          content,
          filename
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Processing failed: ${error.message || 'Unknown error'}`);
      }

      if (!data) {
        throw new Error('No data returned from processing');
      }

      console.log('Document processed successfully:', data);
      
      setDocument(content);
      setDocumentId(data.document_id);
      setSections(data.sections.map((section: any) => ({
        title: section.title,
        level: section.level,
        content: section.content,
        summary: section.summary,
        startIndex: section.start_index,
        endIndex: section.end_index
      })));
      
      toast({
        title: "Document loaded successfully",
        description: `Processed ${data.sections.length} sections from ${filename}`
      });
    } catch (error) {
      console.error('Error loading document:', error);
      toast({
        title: "Error loading document",
        description: error instanceof Error ? error.message : "Failed to process the BRD file",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const updateDocument = useCallback(async (newContent: string) => {
    if (!documentId) {
      console.warn('No document ID available for update');
      return;
    }
    
    try {
      console.log('Updating document content...');
      
      // Update document in database
      const { error } = await supabase
        .from('brd_documents')
        .update({ current_content: newContent })
        .eq('id', documentId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      setDocument(newContent);
      
      // Re-parse sections locally for immediate UI update
      const parsedSections = parseMarkdownSections(newContent);
      setSections(parsedSections);
      
      console.log('Document updated successfully');
      
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: "Error updating document",
        description: error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive"
      });
    }
  }, [documentId]);

  const processAIEdit = useCallback(async (prompt: string) => {
    if (!documentId) {
      toast({
        title: "No document loaded",
        description: "Please load a document first",
        variant: "destructive"
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: "Empty prompt",
        description: "Please enter a description of the changes you want to make",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('Processing AI edit with prompt:', prompt);
      
      const { data, error } = await supabase.functions.invoke('ai-brd-processor', {
        body: {
          action: 'ai_edit',
          prompt: prompt.trim(),
          document_id: documentId
        }
      });

      if (error) {
        console.error('AI edit function error:', error);
        throw new Error(`AI processing failed: ${error.message || 'Unknown error'}`);
      }

      if (!data) {
        throw new Error('No response from AI processing');
      }

      console.log('AI edit completed successfully:', data);
      
      // Update document content
      setDocument(data.updated_content);
      
      // Reload sections from database to get updated summaries
      const { data: updatedSections, error: sectionsError } = await supabase
        .from('brd_sections')
        .select('*')
        .eq('document_id', documentId)
        .order('start_index');

      if (!sectionsError && updatedSections) {
        setSections(updatedSections.map((section: any) => ({
          title: section.title,
          level: section.level,
          content: section.content,
          summary: section.summary,
          startIndex: section.start_index,
          endIndex: section.end_index
        })));
      }
      
      const changes = data.summary_of_changes || [];
      toast({
        title: "AI edit completed",
        description: changes.length > 0 ? changes.join(', ') : 'Document updated successfully'
      });
      
    } catch (error) {
      console.error('Error processing AI edit:', error);
      toast({
        title: "AI edit failed", 
        description: error instanceof Error ? error.message : "Failed to process your request",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [documentId]);

  const parseMarkdownSections = useCallback((content: string): Section[] => {
    const lines = content.split('\n');
    const parsedSections: Section[] = [];
    let currentSection: Partial<Section> | null = null;
    let contentLines: string[] = [];

    lines.forEach((line, index) => {
      const headerMatch = line.match(/^(#+)\s+(.+)$/);
      
      if (headerMatch) {
        if (currentSection) {
          parsedSections.push({
            ...currentSection,
            content: contentLines.join('\n').trim(),
            endIndex: index - 1
          } as Section);
        }
        
        currentSection = {
          title: headerMatch[2],
          level: headerMatch[1].length,
          startIndex: index
        };
        contentLines = [];
      } else if (currentSection) {
        contentLines.push(line);
      }
    });

    if (currentSection) {
      parsedSections.push({
        ...currentSection,
        content: contentLines.join('\n').trim(),
        endIndex: lines.length - 1
      } as Section);
    }

    return parsedSections;
  }, []);

  return {
    document,
    sections,
    isProcessing,
    loadDocument,
    updateDocument,
    processAIEdit
  };
};
