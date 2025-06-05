
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FileText, ChevronRight } from 'lucide-react';
import { Section } from '@/types/brd';

interface SectionHierarchyProps {
  sections: Section[];
}

export const SectionHierarchy: React.FC<SectionHierarchyProps> = ({ sections }) => {
  const renderSection = (section: Section, index: number) => {
    const indentLevel = Math.max(0, section.level - 1);
    
    return (
      <div
        key={index}
        className={`
          p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors
          ${indentLevel > 0 ? `ml-${indentLevel * 4}` : ''}
        `}
        style={{ marginLeft: `${indentLevel * 16}px` }}
      >
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-1 mt-0.5">
            {indentLevel > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
            <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm text-gray-900 truncate">
                {section.title}
              </h4>
              <Badge variant="outline" className="text-xs">
                H{section.level}
              </Badge>
            </div>
            
            {section.summary && (
              <p className="text-xs text-gray-600 line-clamp-2">
                {section.summary}
              </p>
            )}
            
            <div className="text-xs text-gray-400 mt-1">
              {section.content?.length || 0} characters
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {sections.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No sections detected</p>
        </div>
      ) : (
        sections.map(renderSection)
      )}
    </div>
  );
};
