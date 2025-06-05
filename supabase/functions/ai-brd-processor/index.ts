
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...data } = await req.json();
    console.log('AI BRD Processor called with action:', action);

    switch (action) {
      case 'process_document':
        return await processDocument(data);
      case 'ai_edit':
        return await processAIEdit(data);
      case 'generate_summary':
        return await generateSummary(data);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error in ai-brd-processor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processDocument(data: { content: string; filename: string }) {
  console.log('Processing document:', data.filename);

  // Save document to database
  const { data: document, error: docError } = await supabase
    .from('brd_documents')
    .insert({
      filename: data.filename,
      original_content: data.content,
      current_content: data.content
    })
    .select()
    .single();

  if (docError) {
    throw new Error(`Failed to save document: ${docError.message}`);
  }

  // Parse sections
  const sections = parseMarkdownSections(data.content);
  console.log('Parsed sections:', sections.length);

  // Generate summaries for each section using AI
  const sectionsWithSummaries = await Promise.all(
    sections.map(async (section) => {
      const summary = await generateAISummary(section.content);
      return { ...section, summary, document_id: document.id };
    })
  );

  // Save sections to database
  const { error: sectionsError } = await supabase
    .from('brd_sections')
    .insert(sectionsWithSummaries);

  if (sectionsError) {
    throw new Error(`Failed to save sections: ${sectionsError.message}`);
  }

  return new Response(
    JSON.stringify({ 
      document_id: document.id,
      sections: sectionsWithSummaries,
      message: 'Document processed successfully'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function processAIEdit(data: { prompt: string; document_id: string }) {
  console.log('Processing AI edit for document:', data.document_id);

  // Get document and sections
  const { data: document, error: docError } = await supabase
    .from('brd_documents')
    .select('*')
    .eq('id', data.document_id)
    .single();

  if (docError || !document) {
    throw new Error('Document not found');
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('brd_sections')
    .select('*')
    .eq('document_id', data.document_id)
    .order('start_index');

  if (sectionsError) {
    throw new Error('Failed to load sections');
  }

  // Use AI to determine what changes to make
  const aiResponse = await callOpenAI([
    {
      role: 'system',
      content: `You are an expert business analyst. Given a BRD document and user prompt, determine what sections need to be updated and provide the updated content.

Response format (JSON):
{
  "sectionsToUpdate": [{"title": "section title", "reasoning": "why this section needs updating"}],
  "updatedSections": [{"title": "section title", "content": "new content"}],
  "summaryOfChanges": ["change 1", "change 2"]
}`
    },
    {
      role: 'user',
      content: `Current document sections: ${JSON.stringify(sections.map(s => ({ title: s.title, content: s.content })))}

User request: "${data.prompt}"

Please provide the updated sections in JSON format.`
    }
  ]);

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(aiResponse);
  } catch {
    throw new Error('Invalid AI response format');
  }

  // Update sections in database
  const updatedDocument = document.current_content;
  for (const updatedSection of parsedResponse.updatedSections) {
    const sectionToUpdate = sections.find(s => s.title === updatedSection.title);
    if (sectionToUpdate) {
      await supabase
        .from('brd_sections')
        .update({ 
          content: updatedSection.content,
          summary: await generateAISummary(updatedSection.content)
        })
        .eq('id', sectionToUpdate.id);
    }
  }

  // Update document content
  let newContent = document.current_content;
  for (const updatedSection of parsedResponse.updatedSections) {
    const sectionIndex = sections.findIndex(s => s.title === updatedSection.title);
    if (sectionIndex !== -1) {
      const section = sections[sectionIndex];
      const before = newContent.substring(0, section.start_index || 0);
      const after = newContent.substring(section.end_index || 0);
      newContent = before + `${'#'.repeat(section.level)} ${updatedSection.title}\n${updatedSection.content}\n` + after;
    }
  }

  await supabase
    .from('brd_documents')
    .update({ current_content: newContent })
    .eq('id', data.document_id);

  // Save edit history
  await supabase
    .from('ai_edits')
    .insert({
      document_id: data.document_id,
      prompt: data.prompt,
      sections_updated: parsedResponse.sectionsToUpdate,
      summary_of_changes: parsedResponse.summaryOfChanges
    });

  return new Response(
    JSON.stringify({
      updated_content: newContent,
      sections_updated: parsedResponse.sectionsToUpdate,
      summary_of_changes: parsedResponse.summaryOfChanges
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generateSummary(data: { content: string }) {
  const summary = await generateAISummary(data.content);
  return new Response(
    JSON.stringify({ summary }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generateAISummary(content: string): Promise<string> {
  if (!content.trim()) return 'Empty section';
  
  const response = await callOpenAI([
    {
      role: 'system',
      content: 'You are a business analyst. Create a concise 1-2 sentence summary of the following BRD section content.'
    },
    {
      role: 'user',
      content: content.slice(0, 1000) // Limit content length
    }
  ]);

  return response.slice(0, 200); // Limit summary length
}

async function callOpenAI(messages: any[]): Promise<string> {
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseMarkdownSections(content: string) {
  const lines = content.split('\n');
  const sections: any[] = [];
  let currentSection: any = null;
  let contentLines: string[] = [];

  lines.forEach((line, index) => {
    const headerMatch = line.match(/^(#+)\s+(.+)$/);
    
    if (headerMatch) {
      if (currentSection) {
        sections.push({
          ...currentSection,
          content: contentLines.join('\n').trim(),
          end_index: index - 1
        });
      }
      
      currentSection = {
        title: headerMatch[2],
        level: headerMatch[1].length,
        start_index: index
      };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    }
  });

  if (currentSection) {
    sections.push({
      ...currentSection,
      content: contentLines.join('\n').trim(),
      end_index: lines.length - 1
    });
  }

  return sections;
}
