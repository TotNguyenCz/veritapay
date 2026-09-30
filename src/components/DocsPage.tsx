import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BookOpen, ChevronRight, Menu, X, ArrowLeft, ExternalLink } from 'lucide-react'
import { VeritaPayLockup } from '@/components/shared/VeritaPayLogo'

// Import raw markdown — Vite ?raw suffix, no plugin needed
import readmeMd        from '../../docs/README.md?raw'
import overviewMd      from '../../docs/PROJECT_OVERVIEW.md?raw'
import techStackMd     from '../../docs/TECH_STACK.md?raw'
import designSystemMd  from '../../docs/DESIGN_SYSTEM.md?raw'
import codingStdMd     from '../../docs/CODING_STANDARDS.md?raw'
import workflowMd      from '../../docs/WORKFLOW.md?raw'

interface DocEntry {
  slug: string
  label: string
  icon: string
  content: string
  description: string
}

const DOCS: DocEntry[] = [
  {
    slug: 'overview',
    label: 'Getting Started',
    icon: '🚀',
    content: readmeMd,
    description: 'Quick start và links quan trọng',
  },
  {
    slug: 'project',
    label: 'Project Overview',
    icon: '🎯',
    content: overviewMd,
    description: 'Mục tiêu, tính năng, kiến trúc tổng quan',
  },
  {
    slug: 'tech-stack',
    label: 'Tech Stack',
    icon: '⚙️',
    content: techStackMd,
    description: 'Dependencies, cấu trúc thư mục, scripts',
  },
  {
    slug: 'design-system',
    label: 'Design System',
    icon: '🎨',
    content: designSystemMd,
    description: 'Tokens, components, typography, UI/UX',
  },
  {
    slug: 'coding-standards',
    label: 'Coding Standards',
    icon: '📐',
    content: codingStdMd,
    description: 'Style, naming, patterns, rules',
  },
  {
    slug: 'workflow',
    label: 'Workflow',
    icon: '🔄',
    content: workflowMd,
    description: 'Commit rules, review process, quality gates',
  },
]

interface Props {
  onBack: () => void
  initialSlug?: string
}

export function DocsPage({ onBack, initialSlug }: Props) {
  const [activeSlug, setActiveSlug] = useState(initialSlug ?? 'overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const activeDoc = DOCS.find((d) => d.slug === activeSlug) ?? DOCS[0]

  // Scroll to top when doc changes
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeSlug])

  // Close sidebar on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && setSidebarOpen(false)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-gradient)' }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-40 border-b h-14 flex items-center px-4 gap-3 shrink-0"
        style={{
          background: 'var(--surface-strong)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="lg:hidden p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--muted)' }}
          aria-label="Toggle navigation"
        >
          {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <VeritaPayLockup size="sm" />

        <div
          className="mx-2 h-5 w-px shrink-0"
          style={{ background: 'var(--border)' }}
        />

        <div className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          <BookOpen className="size-3.5 shrink-0" />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Docs</span>
        </div>

        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-1 ml-1" style={{ color: 'var(--subtle)' }}>
          <ChevronRight className="size-3.5" />
          <span className="text-sm">{activeDoc.label}</span>
        </div>

        <div className="flex-1" />

        {/* Back to app */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
          style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}
        >
          <ArrowLeft className="size-3.5" />
          Back to App
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={[
            'fixed lg:sticky top-14 z-30 h-[calc(100dvh-3.5rem)] w-64 shrink-0 flex flex-col',
            'border-r overflow-y-auto transition-transform duration-200',
            'lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
          style={{
            background: 'var(--surface-strong)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>
              Documentation
            </p>
            <nav className="flex flex-col gap-0.5">
              {DOCS.map((doc) => {
                const isActive = doc.slug === activeSlug
                return (
                  <button
                    key={doc.slug}
                    onClick={() => { setActiveSlug(doc.slug); setSidebarOpen(false) }}
                    className="w-full text-left flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all"
                    style={
                      isActive
                        ? { background: 'var(--accent)', color: 'var(--accent-fg)' }
                        : { color: 'var(--muted)', background: 'transparent' }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--surface-muted)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span className="text-base leading-none mt-0.5 shrink-0">{doc.icon}</span>
                    <span>
                      <span className="block font-semibold leading-snug">{doc.label}</span>
                      <span
                        className="block text-xs leading-snug mt-0.5 opacity-70"
                      >
                        {doc.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Sidebar footer */}
          <div className="mt-auto p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <a
              href="https://github.com/TotNguyenCz/veritapay"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 transition-colors"
              style={{ color: 'var(--muted)', background: 'var(--surface-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}
            >
              <ExternalLink className="size-3.5 shrink-0" />
              View on GitHub
            </a>
          </div>
        </aside>

        {/* Main content */}
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto h-[calc(100dvh-3.5rem)]"
        >
          <div className="max-w-3xl mx-auto px-6 py-10">
            {/* Doc header */}
            <div className="mb-8 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{activeDoc.icon}</span>
                <h1
                  className="text-2xl font-bold"
                  style={{ color: 'var(--ink)', fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {activeDoc.label}
                </h1>
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{activeDoc.description}</p>
            </div>

            {/* Markdown content */}
            <div className="docs-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {activeDoc.content}
              </ReactMarkdown>
            </div>

            {/* Prev / Next navigation */}
            <div className="mt-12 pt-6 border-t flex gap-4" style={{ borderColor: 'var(--border)' }}>
              {(() => {
                const idx = DOCS.findIndex((d) => d.slug === activeSlug)
                const prev = DOCS[idx - 1]
                const next = DOCS[idx + 1]
                return (
                  <>
                    {prev ? (
                      <button
                        onClick={() => setActiveSlug(prev.slug)}
                        className="flex-1 flex items-center gap-2 rounded-xl p-4 border text-left transition-all"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)', color: 'var(--muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        <ArrowLeft className="size-4 shrink-0" />
                        <span>
                          <span className="block text-xs opacity-60 mb-0.5">Previous</span>
                          <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{prev.icon} {prev.label}</span>
                        </span>
                      </button>
                    ) : <div className="flex-1" />}
                    {next ? (
                      <button
                        onClick={() => setActiveSlug(next.slug)}
                        className="flex-1 flex items-center justify-end gap-2 rounded-xl p-4 border text-right transition-all"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)', color: 'var(--muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        <span>
                          <span className="block text-xs opacity-60 mb-0.5">Next</span>
                          <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{next.icon} {next.label}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0" />
                      </button>
                    ) : <div className="flex-1" />}
                  </>
                )
              })()}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
