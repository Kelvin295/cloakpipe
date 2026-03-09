/**
 * Client-side document chunking and keyword retrieval engine.
 * Uses TF-IDF scoring for relevance ranking without requiring embeddings.
 */

export interface Chunk {
  id: string
  docId: string
  content: string
  pseudonymizedContent: string
  chunkIndex: number
  pageNumber: number
}

export interface RetrievalResult {
  chunk: Chunk
  score: number
}

const CHUNK_SIZE = 512
const CHUNK_OVERLAP = 64
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its', 'this',
  'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
  'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
  'not', 'no', 'so', 'if', 'as', 'then', 'than', 'too', 'very',
])

/** Split text into overlapping chunks by character count, respecting sentence boundaries */
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (text.length <= chunkSize) return [text.trim()].filter(Boolean)

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)

    // Try to break at sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end)
      const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'), slice.lastIndexOf('?\n'), slice.lastIndexOf('!\n'))
      if (lastPeriod > chunkSize * 0.3) {
        end = start + lastPeriod + 1
      }
    }

    const chunk = text.slice(start, end).trim()
    if (chunk) chunks.push(chunk)

    start = end - overlap
    if (start >= text.length) break
  }

  return chunks
}

/** Tokenize text into lowercase terms, removing stop words */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
}

/** Compute term frequency for a document */
function termFrequency(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const term of terms) {
    tf.set(term, (tf.get(term) || 0) + 1)
  }
  // Normalize by doc length
  for (const [term, count] of tf) {
    tf.set(term, count / terms.length)
  }
  return tf
}

/** TF-IDF based search across chunks */
export function search(query: string, chunks: Chunk[], topK = 5): RetrievalResult[] {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) return []

  // Build IDF from corpus
  const docCount = chunks.length
  const docFreq = new Map<string, number>()

  const chunkTerms = chunks.map(c => {
    const terms = tokenize(c.pseudonymizedContent || c.content)
    for (const term of new Set(terms)) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1)
    }
    return terms
  })

  // Score each chunk
  const results: RetrievalResult[] = chunks.map((chunk, i) => {
    const tf = termFrequency(chunkTerms[i])
    let score = 0

    for (const qTerm of queryTerms) {
      const tfVal = tf.get(qTerm) || 0
      if (tfVal === 0) continue
      const df = docFreq.get(qTerm) || 1
      const idf = Math.log(1 + docCount / df)
      score += tfVal * idf
    }

    // Boost for exact phrase match
    const lowerContent = (chunk.pseudonymizedContent || chunk.content).toLowerCase()
    const lowerQuery = query.toLowerCase()
    if (lowerContent.includes(lowerQuery)) {
      score *= 2
    }

    return { chunk, score }
  })

  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** Parse page numbers from text content (simple heuristic for PDFs) */
export function detectPages(text: string): Map<number, string> {
  const pages = new Map<number, string>()
  // Common page break patterns
  const parts = text.split(/(?:\f|--- ?Page \d+ ?---|\[Page \d+\])/i)
  parts.forEach((part, i) => {
    if (part.trim()) pages.set(i + 1, part.trim())
  })
  if (pages.size === 0) pages.set(1, text)
  return pages
}

/** Build context prompt from retrieved chunks */
export function buildContextPrompt(results: RetrievalResult[], query: string): string {
  if (results.length === 0) return query

  const context = results
    .map((r, i) => `[Source ${i + 1}]\n${r.chunk.pseudonymizedContent || r.chunk.content}`)
    .join('\n\n')

  return `Use the following context to answer the question. If the answer isn't in the context, say so.\n\n---\n${context}\n---\n\nQuestion: ${query}`
}
