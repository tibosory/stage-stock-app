import { getSupabase } from '../../lib/supabase';

type JsonMap = Record<string, unknown>;

async function invokeJsonFunction<T extends JsonMap>(name: string, payload: JsonMap): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke(name, { body: payload });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error(`Function ${name} returned invalid JSON`);
  return data as T;
}

export async function analyzeMaterialImage(params: {
  organizationId: string;
  imagePath: string;
  hints?: string[];
}) {
  return invokeJsonFunction<{
    category_suggestion?: string;
    extracted_fields?: JsonMap;
    confidence?: number;
  }>('ai-analyze-material-image', params);
}

export async function parseNaturalLanguageQuery(params: {
  organizationId: string;
  query: string;
}) {
  return invokeJsonFunction<{
    filters: JsonMap;
    sort?: string;
    limit?: number;
  }>('ai-parse-query', params);
}

export async function generateReportSummary(params: {
  organizationId: string;
  scope: 'stock' | 'tour' | 'issues';
  payload: JsonMap;
}) {
  return invokeJsonFunction<{
    summary: string;
    highlights: string[];
    risks: string[];
  }>('ai-generate-report-summary', params);
}
