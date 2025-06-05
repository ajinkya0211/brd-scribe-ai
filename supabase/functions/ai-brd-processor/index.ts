
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

  try {
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
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

async function processAIEdit(data: { prompt: string; document_id: string }) {
  console.log('Processing AI edit for document:', data.document_id);

  try {
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

    // Use AI to determine what changes to make with improved prompts
    const aiResponse = await callOpenAIWithRetry([
      {
        role: 'system',
        content: `You are an expert business analyst. You will analyze a Business Requirements Document (BRD) and user requests to make precise edits.

CRITICAL: You must respond with ONLY valid JSON in exactly this format:
{
  "sectionsToUpdate": [{"title": "exact section title", "reasoning": "brief explanation"}],
  "updatedSections": [{"title": "exact section title", "content": "complete new content for this section"}],
  "summaryOfChanges": ["specific change 1", "specific change 2"]
}

Rules:
1. Only include sections that actually need changes
2. Use exact section titles from the document
3. Provide complete content for updated sections
4. Be specific and concise in change summaries
5. Respond with ONLY the JSON object, no other text`
      },
      {
        role: 'user',
        content: `Current BRD sections:
${sections.map(s => `Title: "${s.title}"\nContent: ${s.content.slice(0, 500)}...\n`).join('\n')}

User request: "${data.prompt}"

Analyze which sections need updates and provide the complete updated content in the required JSON format.`
      }
    ]);

    const parsedResponse = parseAIResponse(aiResponse);

    // Update sections in database
    for (const updatedSection of parsedResponse.updatedSections) {
      const sectionToUpdate = sections.find(s => s.title === updatedSection.title);
      if (sectionToUpdate) {
        const newSummary = await generateAISummary(updatedSection.content);
        await supabase
          .from('brd_sections')
          .update({ 
            content: updatedSection.content,
            summary: newSummary
          })
          .eq('id', sectionToUpdate.id);
      }
    }

    // Rebuild document content
    let newContent = document.current_content;
    for (const updatedSection of parsedResponse.updatedSections) {
      const section = sections.find(s => s.title === updatedSection.title);
      if (section && section.start_index !== null && section.end_index !== null) {
        const lines = newContent.split('\n');
        const before = lines.slice(0, section.start_index);
        const after = lines.slice(section.end_index + 1);
        const newSectionContent = `${'#'.repeat(section.level)} ${updatedSection.title}\n${updatedSection.content}`;
        newContent = [...before, newSectionContent, ...after].join('\n');
      }
    }

    // Update document in database
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
  } catch (error) {
    console.error('Error in processAIEdit:', error);
    throw error;
  }
}

async function generateSummary(data: { content: string }) {
  try {
    const summary = await generateAISummary(data.content);
    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

async function generateAISummary(content: string): Promise<string> {
  if (!content.trim()) return 'Empty section';
  
  try {
    const response = await callOpenAIWithRetry([
      {
        role: 'system',
        content: 'You are a business analyst. Create a concise 1-2 sentence summary of the following BRD section content. Focus on the key requirements and objectives.'
      },
      {
        role: 'user',
        content: content.slice(0, 1000) // Limit content length
      }
    ]);

    return response.slice(0, 200); // Limit summary length
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return 'Summary generation failed';
  }
}

async function callOpenAIWithRetry(messages: any[], maxRetries: number = 3): Promise<string> {
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`OpenAI API call attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response structure from OpenAI');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error(`OpenAI API attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`OpenAI API failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error('Unexpected error in OpenAI retry logic');
}

function parseAIResponse(responseText: string): any {
  try {
    // Clean up the response text
    let cleanedResponse = responseText.trim();
    
    // Remove markdown code blocks if present
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Try to find JSON in the response
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }
    
    console.log('Attempting to parse AI response:', cleanedResponse.slice(0, 200) + '...');
    
    const parsed = JSON.parse(cleanedResponse);
    
    // Validate required fields
    if (!parsed.sectionsToUpdate || !Array.isArray(parsed.sectionsToUpdate)) {
      throw new Error('Missing or invalid sectionsToUpdate array');
    }
    if (!parsed.updatedSections || !Array.isArray(parsed.updatedSections)) {
      throw new Error('Missing or invalid updatedSections array');
    }
    if (!parsed.summaryOfChanges || !Array.isArray(parsed.summaryOfChanges)) {
      throw new Error('Missing or invalid summaryOfChanges array');
    }
    
    // Ensure each section has required fields
    for (const section of parsed.updatedSections) {
      if (!section.title || !section.content) {
        throw new Error('Updated section missing title or content');
      }
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Raw response:', responseText);
    
    // Return a fallback response
    return {
      sectionsToUpdate: [],
      updatedSections: [],
      summaryOfChanges: [`Error processing request: ${error.message}`]
    };
  }
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
