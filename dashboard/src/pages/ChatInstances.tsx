import { useState } from 'react'
import { Bot, Plus, Copy, Trash2, Globe, Lock, X, Database, Settings2, ExternalLink } from 'lucide-react'
import { usePowerSync, useQuery } from '@powersync/react'
import { format } from 'date-fns'

interface ChatInstance {
  id: string; name: string; description: string; kb_ids: string; model: string;
  system_prompt: string; temperature: number; max_tokens: number;
  is_public: number; share_token: string; created_at: string; updated_at: string
}

interface KnowledgeBaseRow {
  id: string; name: string; document_count: number; chunk_count: number
}

const MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet', provider: 'anthropic' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini' },
  { id: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro', provider: 'gemini' },
  { id: 'glm-4.5-flash', label: 'GLM-4.5 Flash', provider: 'glm' },
  { id: 'glm-4.5', label: 'GLM-4.5', provider: 'glm' },
  { id: 'glm-4.6', label: 'GLM-4.6', provider: 'glm' },
]

export function ChatInstances() {
  const db = usePowerSync()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedKbs, setSelectedKbs] = useState<string[]>([])
  const [model, setModel] = useState('gpt-4o')
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant. Answer questions based on the provided knowledge base context.')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(4096)
  const [isPublic, setIsPublic] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const { data: instances } = useQuery<ChatInstance>(
    `SELECT * FROM chat_instances WHERE org_id = ? ORDER BY updated_at DESC`,
    ['org-001']
  )

  const { data: knowledgeBases } = useQuery<KnowledgeBaseRow>(
    `SELECT id, name, document_count, chunk_count FROM knowledge_bases WHERE org_id = ? ORDER BY name ASC`,
    ['org-001']
  )

  function resetForm() {
    setName('')
    setDescription('')
    setSelectedKbs([])
    setModel('gpt-4o')
    setSystemPrompt('You are a helpful assistant. Answer questions based on the provided knowledge base context.')
    setTemperature(0.7)
    setMaxTokens(4096)
    setIsPublic(false)
    setEditing(null)
  }

  function loadInstance(inst: ChatInstance) {
    setName(inst.name)
    setDescription(inst.description || '')
    setSelectedKbs(inst.kb_ids ? JSON.parse(inst.kb_ids) : [])
    setModel(inst.model)
    setSystemPrompt(inst.system_prompt || '')
    setTemperature(inst.temperature)
    setMaxTokens(inst.max_tokens)
    setIsPublic(inst.is_public === 1)
    setEditing(inst.id)
    setShowCreate(true)
  }

  async function handleSave() {
    if (!name.trim()) return
    const now = new Date().toISOString()
    const kbIdsJson = JSON.stringify(selectedKbs)
    const shareToken = crypto.randomUUID().slice(0, 12)

    if (editing) {
      await db.execute(
        `UPDATE chat_instances SET name = ?, description = ?, kb_ids = ?, model = ?, system_prompt = ?, temperature = ?, max_tokens = ?, is_public = ?, updated_at = ? WHERE id = ?`,
        [name.trim(), description.trim(), kbIdsJson, model, systemPrompt, temperature, maxTokens, isPublic ? 1 : 0, now, editing]
      )
    } else {
      const id = crypto.randomUUID()
      await db.execute(
        `INSERT INTO chat_instances (id, org_id, name, description, kb_ids, model, system_prompt, temperature, max_tokens, is_public, share_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, 'org-001', name.trim(), description.trim(), kbIdsJson, model, systemPrompt, temperature, maxTokens, isPublic ? 1 : 0, shareToken, now, now]
      )
    }

    resetForm()
    setShowCreate(false)
  }

  async function handleDelete(id: string) {
    await db.execute(`DELETE FROM chat_instances WHERE id = ?`, [id])
  }

  function toggleKb(kbId: string) {
    setSelectedKbs(prev =>
      prev.includes(kbId) ? prev.filter(id => id !== kbId) : [...prev, kbId]
    )
  }

  function copyShareLink(token: string) {
    const url = `${window.location.origin}/chat/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  function getKbNames(kbIdsJson: string): string[] {
    try {
      const ids: string[] = JSON.parse(kbIdsJson)
      return ids.map(id => (knowledgeBases || []).find(kb => kb.id === id)?.name || 'Unknown').filter(Boolean)
    } catch { return [] }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Chat Instances</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Create shareable RAG chatbots backed by your knowledge bases
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white text-[13px] font-medium hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Instance
        </button>
      </div>

      {/* Create/Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-[var(--card)] border border-[var(--border)] w-[560px] max-h-[85vh] overflow-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">{editing ? 'Edit Instance' : 'Create Chat Instance'}</h2>
              <button onClick={() => { setShowCreate(false); resetForm() }} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Instance Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Legal Assistant, HR Bot"
                  className="w-full px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What does this chatbot do?"
                  className="w-full px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]"
                />
              </div>

              {/* Knowledge Bases */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">
                  Knowledge Bases
                </label>
                {(knowledgeBases || []).length === 0 ? (
                  <p className="text-[11px] text-[var(--muted-foreground)]">No knowledge bases yet. Create one first.</p>
                ) : (
                  <div className="space-y-1">
                    {(knowledgeBases || []).map(kb => (
                      <label
                        key={kb.id}
                        className={`flex items-center gap-2 px-3 py-2 border cursor-pointer transition-colors ${
                          selectedKbs.includes(kb.id)
                            ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                            : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted-foreground)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedKbs.includes(kb.id)}
                          onChange={() => toggleKb(kb.id)}
                          className="accent-[var(--primary)]"
                        />
                        <Database className="w-3 h-3 text-[var(--muted-foreground)]" />
                        <span className="text-[12px] flex-1">{kb.name}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                          {kb.document_count} docs · {kb.chunk_count} chunks
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Model */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Model</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] text-[13px] text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--primary)]"
                >
                  {MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* System Prompt */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">System Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] text-[13px] resize-none focus:outline-none focus:border-[var(--primary)] font-mono placeholder:text-[var(--muted-foreground)]"
                />
              </div>

              {/* Temperature + Max Tokens */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">
                    Temperature <span className="font-mono text-[var(--foreground)]">{temperature}</span>
                  </label>
                  <input
                    type="range"
                    min="0" max="2" step="0.1"
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={e => setMaxTokens(parseInt(e.target.value) || 4096)}
                    className="w-full px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] text-[13px] font-mono focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Visibility */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  <span className="text-[12px]">Public</span>
                </label>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {isPublic ? 'Anyone with the link can chat' : 'Only authenticated users can access'}
                </span>
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!name.trim() || selectedKbs.length === 0}
                className="w-full py-2 bg-[var(--primary)] text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-40"
              >
                {editing ? 'Save Changes' : 'Create Instance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instances list */}
      {(instances || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center h-80 text-center">
          <Bot className="w-10 h-10 text-[var(--primary)] mb-4 opacity-60" />
          <h2 className="text-base font-semibold mb-1">No Chat Instances</h2>
          <p className="text-xs text-[var(--muted-foreground)] max-w-sm">
            Create a chatbot instance backed by your knowledge bases.
            Each instance gets a shareable link with privacy protection built in.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(instances || []).map(inst => {
            const kbNames = getKbNames(inst.kb_ids)
            const modelInfo = MODELS.find(m => m.id === inst.model)
            return (
              <div key={inst.id} className="bg-[var(--card)] border border-[var(--border)] p-4 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bot className="w-5 h-5 text-[var(--primary)]" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[13px]">{inst.name}</span>
                        {inst.is_public ? (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
                            <Globe className="w-2.5 h-2.5" /> Public
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-[var(--secondary)] text-[var(--muted-foreground)]">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--secondary)] text-[var(--muted-foreground)]">
                          {modelInfo?.label || inst.model}
                        </span>
                      </div>
                      {inst.description && (
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{inst.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {kbNames.map(name => (
                          <span key={name} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                            <Database className="w-2.5 h-2.5" />
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyShareLink(inst.share_token)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      title="Copy share link"
                    >
                      <Copy className="w-3 h-3" />
                      {copied === inst.share_token ? 'Copied' : 'Share'}
                    </button>
                    <button
                      onClick={() => window.open(`/?instance=${inst.id}`, '_blank')}
                      className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"
                      title="Open chat"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => loadInstance(inst)}
                      className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"
                      title="Edit"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(inst.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-4 text-[10px] text-[var(--muted-foreground)]">
                  <span>Temp: <span className="font-mono">{inst.temperature}</span></span>
                  <span>Max tokens: <span className="font-mono">{inst.max_tokens}</span></span>
                  <span>Created: {format(new Date(inst.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
