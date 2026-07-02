import axios from 'axios';
import { OpenSATQuestion, FilteredQuestion, QuestionFilterParams } from '../types';

let cachedQuestions: FilteredQuestion[] = [];
let isCached = false;

const OPENSAT_URL = process.env.OPENSAT_API_URL ||
  'https://pinesat.duckdns.org/api/questions';

/** Handle both bare-array and wrapped-object response shapes from the API */
function extractArray(data: any, section: string): OpenSATQuestion[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[section])) return data[section];
  if (Array.isArray(data?.questions)) return data.questions;
  // Last resort: collect any top-level array value
  for (const val of Object.values(data ?? {})) {
    if (Array.isArray(val)) return val as OpenSATQuestion[];
  }
  console.warn(`Could not extract ${section} array from response:`, JSON.stringify(data).slice(0, 200));
  return [];
}

export async function loadOpenSATData(): Promise<void> {
  if (isCached && cachedQuestions.length > 0) {
    console.log(`Using cached OpenSAT data (${cachedQuestions.length} questions)`);
    return;
  }

  try {
    console.log('Fetching OpenSAT data from pinesat.com...');
    const [mathRes, englishRes] = await Promise.all([
      axios.get(`${OPENSAT_URL}?section=math`),
      axios.get(`${OPENSAT_URL}?section=english`),
    ]);

    const mathArray = extractArray(mathRes.data, 'math');
    const englishArray = extractArray(englishRes.data, 'english');

    const mathQs: FilteredQuestion[] = mathArray.map((q: OpenSATQuestion) => ({ ...q, section: 'math' }));
    const englishQs: FilteredQuestion[] = englishArray.map((q: OpenSATQuestion) => ({ ...q, section: 'english' }));
    cachedQuestions = [...mathQs, ...englishQs];

    isCached = true;
    console.log(`Loaded ${mathQs.length} math + ${englishQs.length} english questions (${cachedQuestions.length} total)`);
  } catch (error) {
    console.error('Failed to load OpenSAT data (questions unavailable until retry):', (error as any)?.message ?? error);
  }
}

export function getFilteredQuestions(params: QuestionFilterParams): FilteredQuestion[] {
  if (!isCached || cachedQuestions.length === 0) {
    throw new Error('OpenSAT data not loaded. Call loadOpenSATData() first.');
  }

  let filtered = [...cachedQuestions];

  // Filter by section (math / english)
  if (params.section && params.section.trim() !== '') {
    filtered = filtered.filter(q =>
      q.section?.toLowerCase() === params.section!.toLowerCase()
    );
  }

  // Filter by domain
  if (params.domain && params.domain.trim() !== '') {
    filtered = filtered.filter(q =>
      q.domain.toLowerCase().includes(params.domain!.toLowerCase())
    );
  }

  // Filter by difficulty
  if (params.difficulty && params.difficulty.trim() !== '') {
    filtered = filtered.filter(q =>
      q.difficulty.toLowerCase() === params.difficulty!.toLowerCase()
    );
  }

  // Shuffle so repeated calls with the same params give variety
  const shuffled = filtered.sort(() => Math.random() - 0.5);

  const limit = params.limit || 10;
  return shuffled.slice(0, limit);
}

export function getQuestionById(id: string): FilteredQuestion | undefined {
  return cachedQuestions.find(q => q.id === id);
}

export function getAllDomains(): string[] {
  if (!isCached || cachedQuestions.length === 0) return [];
  const domains = new Set(cachedQuestions.map(q => q.domain));
  return Array.from(domains).sort();
}

export function getAllSections(): string[] {
  return ['math', 'english'];
}

export function getCacheStatus(): { isCached: boolean; count: number } {
  return { isCached, count: cachedQuestions.length };
}
