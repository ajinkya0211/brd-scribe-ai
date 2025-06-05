
import { useState, useCallback } from 'react';
import { Section, AIEditResponse } from '@/types/brd';
import { toast } from '@/hooks/use-toast';

export const useBRDProcessor = () => {
  const [document, setDocument] = useState<string>('');
  const [sections, setSections] = useState<Section[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const parseMarkdownSections = useCallback((content: string): Section[] => {
    const lines = content.split('\n');
    const parsedSections: Section[] = [];
    let currentSection: Partial<Section> | null = null;
    let contentLines: string[] = [];

    lines.forEach((line, index) => {
      const headerMatch = line.match(/^(#+)\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section if exists
        if (currentSection) {
          parsedSections.push({
            ...currentSection,
            content: contentLines.join('\n').trim(),
            endIndex: index - 1
          } as Section);
        }
        
        // Start new section
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

    // Don't forget the last section
    if (currentSection) {
      parsedSections.push({
        ...currentSection,
        content: contentLines.join('\n').trim(),
        endIndex: lines.length - 1
      } as Section);
    }

    return parsedSections;
  }, []);

  const generateSummary = useCallback(async (content: string): Promise<string> => {
    // Simulate AI summary generation
    return new Promise((resolve) => {
      setTimeout(() => {
        const words = content.split(' ').slice(0, 20);
        resolve(`Summary: ${words.join(' ')}...`);
      }, 500);
    });
  }, []);

  const loadDocument = useCallback(async (content: string, filename: string) => {
    setIsProcessing(true);
    
    try {
      console.log('Loading document:', filename);
      
      // Parse sections
      const parsedSections = parseMarkdownSections(content);
      console.log('Parsed sections:', parsedSections);
      
      // Generate summaries for each section
      const sectionsWithSummaries = await Promise.all(
        parsedSections.map(async (section) => ({
          ...section,
          summary: await generateSummary(section.content)
        }))
      );
      
      setDocument(content);
      setSections(sectionsWithSummaries);
      
      toast({
        title: "Document loaded successfully",
        description: `Processed ${sectionsWithSummaries.length} sections from ${filename}`
      });
    } catch (error) {
      console.error('Error loading document:', error);
      toast({
        title: "Error loading document",
        description: "Failed to process the BRD file",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [parseMarkdownSections, generateSummary]);

  const updateDocument = useCallback((newContent: string) => {
    setDocument(newContent);
    
    // Re-parse sections when document is manually updated
    const updatedSections = parseMarkdownSections(newContent);
    setSections(updatedSections.map(section => ({
      ...section,
      summary: sections.find(s => s.title === section.title)?.summary || ''
    })));
  }, [parseMarkdownSections, sections]);

  const processAIEdit = useCallback(async (prompt: string) => {
    setIsProcessing(true);
    
    try {
      console.log('Processing AI edit with prompt:', prompt);
      
      // Simulate AI planning and editing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock AI response
      const mockResponse: AIEditResponse = {
        sectionsToUpdate: [
          {
            title: sections[0]?.title || "Introduction",
            reasoning: "User requested changes that affect this section"
          }
        ],
        updatedSections: [
          {
            title: sections[0]?.title || "Introduction",
            content: `${sections[0]?.content || ''}\n\n**AI Generated Addition:** ${prompt}`
          }
        ],
        summaryOfChanges: [
          `Added content based on prompt: "${prompt}"`
        ]
      };
      
      // Apply changes to document
      let updatedDocument = document;
      mockResponse.updatedSections.forEach(updatedSection => {
        const sectionIndex = sections.findIndex(s => s.title === updatedSection.title);
        if (sectionIndex !== -1) {
          const section = sections[sectionIndex];
          const before = document.substring(0, section.startIndex || 0);
          const after = document.substring(section.endIndex || 0);
          updatedDocument = before + `# ${updatedSection.title}\n${updatedSection.content}\n` + after;
        }
      });
      
      setDocument(updatedDocument);
      
      // Re-parse sections
      const updatedSections = parseMarkdownSections(updatedDocument);
      setSections(updatedSections);
      
      toast({
        title: "AI edit completed",
        description: mockResponse.summaryOfChanges.join(', ')
      });
      
    } catch (error) {
      console.error('Error processing AI edit:', error);
      toast({
        title: "AI edit failed", 
        description: "Failed to process your request",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [document, sections, parseMarkdownSections]);

  return {
    document,
    sections,
    isProcessing,
    loadDocument,
    updateDocument,
    processAIEdit
  };
};
