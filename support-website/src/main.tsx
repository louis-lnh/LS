import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import heroImage from './assets/lifesteal-hero.png'
import logoImage from './assets/shd-logo.png'
import rulesMarkdown from './content/rules.md?raw'

type PageId =
  | 'home'
  | 'minecraft'
  | 'support'
  | 'valorant'
  | 'info'
  | 'signup'
  | 'minecraft-support'
  | 'general-support'
  | 'ban-appeal'
  | 'player-report'
  | 'status'
  | 'legal'
  | 'privacy'
  | 'terms'
  | 'imprint'

type SectionId = 'minecraft' | 'support' | 'valorant' | 'info'
type SignupField =
  | 'discordName'
  | 'discordId'
  | 'minecraftName'
  | 'age'
  | 'region'
  | 'timezone'
  | 'foundLifesteal'
  | 'experience'
  | 'motivation'
  | 'team'
  | 'content'
  | 'rules'

type SignupState = Record<SignupField, string>
type SubmittedApplication = {
  applicationId: number
  applicationCode: string
  status: string
}
type SignupStep = 'form' | 'rules' | 'submitted'
type RuleBlock =
  | { type: 'h2' | 'h3'; text: string; id?: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'hr' }
type RuleIndexItem = { id: string; number: string; title: string }

type MinecraftFormId = 'ban-appeal' | 'player-report' | 'minecraft-support'
type MinecraftFormField = {
  id: string
  label: string
  placeholder: string
  required?: boolean
  kind?: 'input' | 'textarea' | 'select'
  options?: string[]
}
type MinecraftFormConfig = {
  label: string
  title: string
  description: string
  endpoint: string
  noticeLabel: string
  noticeBody: string
  sections: Array<{ label: string; title: string; fields: MinecraftFormField[] }>
  acknowledgement: string
  resultTitle: string
  ticketInstruction: string
}
type SupportIntakeResponse = {
  ok?: boolean
  error?: string
  code?: string
  submissionId?: number
  referenceCode?: string
  status?: string
  requiresTicket?: boolean
}

const primarySections: Array<{ id: SectionId; label: string; title: string }> = [
  { id: 'minecraft', label: 'Minecraft', title: 'Minecraft Support' },
  { id: 'info', label: 'Info', title: 'SHD Info' },
]

const legalItems: Array<{ id: PageId; label: string }> = [
  { id: 'legal', label: 'Legal' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'imprint', label: 'Imprint' },
]

const sectionForms: Record<SectionId, Array<{ id: PageId; label: string }>> = {
  minecraft: [
    { id: 'signup', label: 'Lifesteal Signup' },
    { id: 'ban-appeal', label: 'Ban Appeal' },
    { id: 'player-report', label: 'Player Report' },
    { id: 'minecraft-support', label: 'Minecraft Support' },
  ],
  support: [],
  valorant: [],
  info: [
    { id: 'status', label: 'Status' },
    { id: 'privacy', label: 'Privacy' },
  ],
}

const pageSections: Partial<Record<PageId, SectionId>> = {
  minecraft: 'minecraft',
  signup: 'minecraft',
  'minecraft-support': 'minecraft',
  support: 'support',
  'general-support': 'support',
  valorant: 'valorant',
  'ban-appeal': 'minecraft',
  'player-report': 'minecraft',
  info: 'info',
  status: 'info',
  legal: 'info',
  privacy: 'info',
  terms: 'info',
  imprint: 'info',
}

const routeItems: Array<{ id: PageId; label: string }> = [
  { id: 'home', label: 'Home' },
  ...primarySections.map((section) => ({ id: section.id, label: section.label })),
  ...Object.values(sectionForms).flat(),
  ...legalItems,
]

const initialSignup: SignupState = {
  discordName: '',
  discordId: '',
  minecraftName: '',
  age: '',
  region: '',
  timezone: '',
  foundLifesteal: '',
  experience: '',
  motivation: '',
  team: '',
  content: '',
  rules: '',
}

const supportApiBase = (import.meta.env.VITE_SUPPORT_API_BASE_URL ?? 'http://localhost:3000/api/v1/public').replace(/\/$/, '')

function fieldLabel(path: unknown) {
  const field = Array.isArray(path) ? path[0] : path
  const labels: Record<string, string> = {
    foundLifesteal: 'How did you find Lifesteal',
    experience: 'Lifesteal or SMP experience',
    motivation: 'Why do you want to join',
    discordUsername: 'Discord username',
    minecraftName: 'Minecraft Java name',
    region: 'Region',
  }
  return labels[String(field)] ?? String(field ?? 'Field')
}

function cleanApiError(message: string) {
  try {
    const issues = JSON.parse(message) as Array<{ message?: string; path?: unknown[] }>
    if (Array.isArray(issues) && issues.length > 0) {
      return issues
        .map((issue) => `${fieldLabel(issue.path)}: ${issue.message ?? 'Please check this field.'}`)
        .join(' ')
    }
  } catch {
    // Fall through to plain server message.
  }
  return message || 'Application submission failed.'
}

type SupportSubmissionResponse = {
  ok?: boolean
  code?: string
  error?: string
  applicationId?: number
  applicationCode?: string
  applicationStatus?: string
  status?: string
}

function supportSubmissionError(body: SupportSubmissionResponse) {
  if (body.code === 'APPLICATION_ALREADY_OPEN' && body.applicationCode) {
    return `You already have an open Lifesteal application. Continue in your Discord ticket with application key ${body.applicationCode}.`
  }
  return cleanApiError(body.error ?? 'Application submission failed.')
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseRules(markdown: string) {
  const blocks: RuleBlock[] = []
  const index: RuleIndexItem[] = []
  const listItems: string[] = []
  let title = 'SHD Lifesteal Rules'

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: 'ul', items: [...listItems] })
      listItems.length = 0
    }
  }

  markdown.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      return
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushList()
      const level = heading[1].length
      const text = heading[2].trim()
      if (level === 1 && blocks.length === 0) {
        title = text
        return
      }
      const id = level === 1 || text.match(/^\d+\./) ? slugify(text) : undefined
      if (id) {
        const number = text.match(/^(\d+)\./)?.[1] ?? ''
        index.push({ id, number: number.padStart(2, '0'), title: text.replace(/^\d+\.\s*/, '') })
      }
      blocks.push({ type: level === 1 ? 'h2' : 'h3', text, id })
      return
    }

    if (line === '---') {
      flushList()
      blocks.push({ type: 'hr' })
      return
    }

    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ''))
      return
    }

    flushList()
    blocks.push({ type: 'p', text: line })
  })

  flushList()
  return { title, blocks, index }
}

const parsedRules = parseRules(rulesMarkdown)

function pageFromPath(): PageId {
  const value = window.location.pathname.replace(/^\/+/, '').split('/')[0]
  return routeItems.some((item) => item.id === value) ? value as PageId : 'home'
}

function pathForPage(page: PageId) {
  return page === 'home' ? '/' : `/${page}`
}

function sectionTitle(section: SectionId | undefined) {
  return primarySections.find((item) => item.id === section)?.title ?? 'SHD Support'
}

function headerTitle(page: PageId, section: SectionId | undefined) {
  if (page === 'signup') return 'Lifesteal Signup'
  if (page === 'minecraft-support') return 'Minecraft Support'
  if (page === 'general-support') return 'General Support'
  if (page === 'ban-appeal') return 'Minecraft Ban Appeal'
  if (page === 'player-report') return 'Minecraft Player Report'
  return sectionTitle(section)
}

function App() {
  const [page, setPage] = useState<PageId>(() => pageFromPath())
  const current = useMemo(() => routeItems.find((item) => item.id === page) ?? routeItems[0], [page])

  const navigate = (nextPage: PageId) => {
    window.history.pushState(null, '', pathForPage(nextPage))
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return (
    <div className="site-shell">
      <Background />
      <Header current={page} onNavigate={navigate} />
      <main>
        {page === 'home' && <HomePage onNavigate={navigate} />}
        {page === 'minecraft' && <SectionPage section="minecraft" onNavigate={navigate} />}
        {page === 'support' && <SectionPage section="support" onNavigate={navigate} />}
        {page === 'valorant' && <SectionPage section="valorant" onNavigate={navigate} />}
        {page === 'info' && <SectionPage section="info" onNavigate={navigate} />}
        {page === 'signup' && <SignupPage onNavigate={navigate} />}
        {page === 'minecraft-support' && <MinecraftIntakeForm formId="minecraft-support" onNavigate={navigate} />}
        {page === 'general-support' && <ConstructionPage title="Support" label="General Support" detail="General SHD support tickets will open after the Lifesteal launch pass." backTo="support" onNavigate={navigate} />}
        {page === 'ban-appeal' && <MinecraftIntakeForm formId="ban-appeal" onNavigate={navigate} />}
        {page === 'player-report' && <MinecraftIntakeForm formId="player-report" onNavigate={navigate} />}
        {page === 'status' && <ConstructionPage title="Status" label="System Status" detail="Live API health, Minecraft sync health, and known incidents will be shown here." />}
        {page === 'legal' && <LegalPage title="Legal" label="Legal Notice" sections={legalSections.legal} />}
        {page === 'privacy' && <LegalPage title="Privacy" label="Data Protection" sections={legalSections.privacy} />}
        {page === 'terms' && <LegalPage title="Terms" label="Terms of Service" sections={legalSections.terms} />}
        {page === 'imprint' && <LegalPage title="Imprint" label="Provider Information" sections={legalSections.imprint} />}
      </main>
      <Footer current={current.label} onNavigate={navigate} />
    </div>
  )
}

function Background() {
  return (
    <>
      <img className="site-bg" src={heroImage} alt="" />
      <div className="site-bg-shade" />
    </>
  )
}

function Header({ current, onNavigate }: { current: PageId; onNavigate: (page: PageId) => void }) {
  const activeSection = pageSections[current]
  const isHome = current === 'home'
  const navActions = isHome
    ? primarySections.map((section) => ({ id: section.id as PageId, label: section.label }))
    : activeSection
      ? sectionForms[activeSection]
      : sectionForms.info

  return (
    <header className={isHome ? 'topbar' : 'topbar section-topbar'}>
      <div className="topbar-left">
        {!isHome && (
          <button className="back-button" onClick={() => onNavigate('home')} type="button">
            <span aria-hidden="true">&lt;-</span>
            Home
          </button>
        )}
      </div>
      <button className="brand-button" onClick={() => onNavigate(isHome ? 'home' : activeSection ?? 'home')} type="button">
        <span>{isHome ? 'SHD Support' : headerTitle(current, activeSection)}</span>
      </button>
      <nav aria-label={isHome ? 'Support navigation' : 'Section navigation'}>
        {navActions.map((item) => (
          <button key={item.id} className={current === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)} type="button">
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

function PageIntro({ label, title, children, backTo, onNavigate }: { label: string; title: string; children: React.ReactNode; backTo?: PageId; onNavigate?: (page: PageId) => void }) {
  return (
    <div className="page-intro">
      <div className="intro-actions">
        <span className="chip">{label}</span>
        {backTo && onNavigate && (
          <button className="intro-back-button" onClick={() => onNavigate(backTo)} type="button">
            <span aria-hidden="true">&lt;-</span>
            Back
          </button>
        )}
      </div>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  )
}

function HomePage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return (
    <section className="home-page page-frame">
      <div className="home-copy">
        <img className="hero-logo" src={logoImage} alt="SHD Logo" />
        <span className="chip">Support Portal</span>
        <h1>SHD Support</h1>
        <p className="season-line">SHD Esports</p>
        <button className="info-link-button" onClick={() => onNavigate('info')} type="button">Portal Info</button>
      </div>
      <div className="support-grid" aria-label="Support areas">
        <SupportTile title="Minecraft" state="Lifesteal Open" detail="Lifesteal applications, ban appeals, player reports, and Minecraft support flows." onClick={() => onNavigate('minecraft')} />
        <SupportTile title="Support" state="Locked" detail="General SHD help, account questions, staff contact, and project support requests are reserved for a later portal release." locked />
        <SupportTile title="Valorant" state="Locked" detail="Valorant support, reports, and team-related workflows are reserved for a later portal release." locked />
      </div>
    </section>
  )
}

function SupportTile({ title, state, detail, onClick, locked = false }: { title: string; state: string; detail: string; onClick?: () => void; locked?: boolean }) {
  if (locked) {
    return (
      <article className="support-tile locked-tile" aria-disabled="true">
        <span>{state}</span>
        <strong>{title}</strong>
        <p>{detail}</p>
      </article>
    )
  }

  return (
    <button className="support-tile" onClick={onClick} type="button">
      <span>{state}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </button>
  )
}

const sectionCopy: Record<SectionId, { label: string; title: string; intro: string; empty: string }> = {
  minecraft: {
    label: 'Minecraft',
    title: 'Minecraft Support',
    intro: 'Choose the Minecraft workflow you need. Lifesteal applications, appeals, reports, and general Minecraft support are open.',
    empty: 'No Minecraft workflows are active yet.',
  },
  support: {
    label: 'Support',
    title: 'General Support',
    intro: 'General SHD support lives here for account questions, project contact, and non-game-specific requests.',
    empty: 'No support forms are active for this game yet.',
  },
  valorant: {
    label: 'Valorant',
    title: 'Valorant Support',
    intro: 'Valorant workflows are reserved for a future SHD portal slice.',
    empty: 'No Valorant workflows are active yet.',
  },
  info: {
    label: 'Info',
    title: 'Info',
    intro: 'Portal status, legal information, and general SHD support details live here.',
    empty: 'No info pages are active for this game yet.',
  },
}

function SectionPage({ section, onNavigate }: { section: SectionId; onNavigate: (page: PageId) => void }) {
  const forms = sectionForms[section]
  const copy = sectionCopy[section]

  if (section === 'info') {
    return <InfoPage copy={copy} onNavigate={onNavigate} />
  }

  return (
    <section className="content-page page-frame section-page">
      <PageIntro label={copy.label} title={copy.title}>{copy.intro}</PageIntro>
      <div className="form-card-grid">
        {forms.map((form) => (
          <button className="form-card" key={form.id} onClick={() => onNavigate(form.id)} type="button">
            <span>{sectionLabel(section)}</span>
            <strong>{form.label}</strong>
            <p>{formDescription(form.id)}</p>
          </button>
        ))}
        {forms.length === 0 && <LockedPanel eyebrow="Pending" title={copy.empty} detail="This area is reserved for a future SHD portal release." compact />}
      </div>
    </section>
  )
}

type InfoWorkflow = {
  label: string
  title: string
  body: string
  target?: PageId
  state?: string
}

const infoWorkflowCategories: Array<{ title: string; label: string; workflows: InfoWorkflow[] }> = [
  {
    title: 'Minecraft',
    label: 'Active',
    workflows: [
      {
        label: 'Lifesteal',
        title: 'Application Flow',
        body: 'Rules key, portal form, Discord ticket verification, staff review, and automated access setup.',
        target: 'signup',
        state: 'Open',
      },
      {
        label: 'Moderation',
        title: 'Ban Appeal',
        body: 'Submit a punishment review and continue the conversation in a Discord appeal ticket.',
        target: 'ban-appeal',
        state: 'Open',
      },
      {
        label: 'Moderation',
        title: 'Player Report',
        body: 'Submit a private staff report with incident context, evidence, and witnesses.',
        target: 'player-report',
        state: 'Open',
      },
    ],
  },
  {
    title: 'General',
    label: 'Reserved',
    workflows: [
      {
        label: 'Support',
        title: 'General Support',
        body: 'Account questions, project contact, and non-game-specific SHD support after the Lifesteal launch pass.',
        state: 'Later',
      },
    ],
  },
  {
    title: 'Valorant',
    label: 'Future',
    workflows: [
      {
        label: 'Valorant',
        title: 'Support Workflows',
        body: 'Valorant support, team, report, and appeal flows will live here once that portal slice starts.',
        state: 'Planned',
      },
    ],
  },
]

function InfoPage({ copy, onNavigate }: { copy: { label: string; title: string; intro: string }; onNavigate: (page: PageId) => void }) {
  const [activeCategory, setActiveCategory] = useState(infoWorkflowCategories[0].title)
  const active = infoWorkflowCategories.find((category) => category.title === activeCategory) ?? infoWorkflowCategories[0]

  return (
    <section className="content-page page-frame section-page info-page">
      <PageIntro label={copy.label} title={copy.title}>{copy.intro}</PageIntro>
      <div className="info-quick-actions" aria-label="Portal quick links">
        <button onClick={() => onNavigate('status')} type="button">Status</button>
        <button onClick={() => onNavigate('privacy')} type="button">Privacy</button>
      </div>
      <div className="info-category-grid" aria-label="Support workflow categories">
        {infoWorkflowCategories.map((category) => (
          <button className={active.title === category.title ? 'info-category-card active' : 'info-category-card'} key={category.title} onClick={() => setActiveCategory(category.title)} type="button">
            <span>{category.label}</span>
            <strong>{category.title}</strong>
            <p>{category.workflows.map((workflow) => workflow.title).join(' / ')}</p>
          </button>
        ))}
      </div>
      <section className="workflow-info-panel" aria-label={`${active.title} workflow information`}>
        <header>
          <span>{active.label}</span>
          <h2>{active.title} Workflows</h2>
        </header>
        <div className="workflow-info-list">
          {active.workflows.map((workflow) => (
            <article className="workflow-info-card" key={workflow.title}>
              <div>
                <span>{workflow.label}</span>
                <h3>{workflow.title}</h3>
                <p>{workflow.body}</p>
              </div>
              <button disabled={!workflow.target} onClick={() => workflow.target && onNavigate(workflow.target)} type="button">{workflow.state ?? 'Open'}</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

function sectionLabel(section: SectionId) {
  if (section === 'minecraft') return 'Minecraft'
  if (section === 'valorant') return 'Valorant'
  if (section === 'info') return 'Portal'
  return 'General'
}

function formDescription(page: PageId) {
  const descriptions: Partial<Record<PageId, string>> = {
    signup: 'Apply for the SHD Lifesteal Minecraft season.',
    'minecraft-support': 'Request help for Minecraft access, account, or server issues.',
    'general-support': 'Request help for access, account, or server issues.',
    'ban-appeal': 'Submit a Minecraft punishment appeal with staff-readable context.',
    'player-report': 'Submit a private Minecraft player report with incident details and evidence.',
    status: 'View portal and service status information.',
    privacy: 'Read how support data is handled.',
  }
  return descriptions[page] ?? 'Open this SHD support page.'
}

function SignupPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [form, setForm] = useState<SignupState>(initialSignup)
  const [submitted, setSubmitted] = useState<SubmittedApplication | null>(null)
  const [step, setStep] = useState<SignupStep>('form')
  const [rulesScrolled, setRulesScrolled] = useState(false)
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field: SignupField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const canSubmit = form.discordName.trim() && form.minecraftName.trim() && form.region.trim() && form.foundLifesteal.trim() && form.experience.trim() && form.motivation.trim() && form.rules === 'accepted'

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitError('')
    setStep('rules')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitWithRules = async () => {
    if (!canSubmit || !rulesScrolled || !rulesAccepted || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const rulesResponse = await fetch(`${supportApiBase}/rules/acknowledge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: 'lifesteal' }),
      })
      const rulesBody = await rulesResponse.json() as { ok?: boolean; code?: string; error?: string }
      if (!rulesResponse.ok || !rulesBody.ok || !rulesBody.code) {
        setSubmitError(cleanApiError(rulesBody.error ?? 'Rules acknowledgement failed.'))
        return
      }

      const response = await fetch(`${supportApiBase}/support/lifesteal-signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rulesCode: rulesBody.code,
          discordUsername: form.discordName,
          discordId: form.discordId || null,
          minecraftName: form.minecraftName,
          age: form.age || null,
          region: form.region,
          timezone: form.timezone || null,
          foundLifesteal: form.foundLifesteal,
          experience: form.experience,
          motivation: form.motivation,
          team: form.team || null,
          content: form.content || null,
        }),
      })
      const body = await response.json() as SupportSubmissionResponse
      if (!response.ok || !body.ok || !body.applicationId || !body.applicationCode || !body.status) {
        setSubmitError(supportSubmissionError(body))
        return
      }
      setSubmitted({
        applicationId: body.applicationId,
        applicationCode: body.applicationCode,
        status: body.status,
      })
      setStep('submitted')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setSubmitError(error instanceof Error ? cleanApiError(error.message) : 'Application submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted && step === 'submitted') {
    return (
      <section className="content-page page-frame">
        <PageIntro label="Application Saved" title="Submitted" backTo="minecraft" onNavigate={onNavigate}>
          Your Lifesteal signup is saved. Copy the application key, open a Lifesteal join ticket in Discord, and send the key there.
        </PageIntro>
        <div className="result-panel">
          <span className="section-kicker">Application Key</span>
          <strong>{submitted.applicationCode}</strong>
          <p>The bot will attach this application to your Discord ticket. Staff will review it there and the bot will notify you if you are approved.</p>
          <p>By submitting, you confirmed that you read and understood the Lifesteal rules. Not knowing the rules is not an excuse for breaking them.</p>
          <div className="result-actions">
            <button className="secondary-action" onClick={() => onNavigate('info')} type="button">View Info Hub</button>
            <button className="secondary-action" onClick={() => { setSubmitted(null); setStep('form') }} type="button">New Submission</button>
          </div>
        </div>
      </section>
    )
  }

  if (step === 'rules') {
    return (
      <section className="content-page page-frame">
        <PageIntro label="Rules Review" title={parsedRules.title} backTo="signup" onNavigate={() => setStep('form')}>
          Review the Lifesteal rules before your signup is sent to staff. Scroll through the rules, confirm that you understand them, then submit your application.
        </PageIntro>
        <div className="signup-rules-shell">
          <aside className="signup-rules-index" aria-label="Rules index">
            {parsedRules.index.map((section) => (
              <a href={`#signup-${section.id}`} key={section.id}>
                <span>{section.number || '--'}</span>
                {section.title}
              </a>
            ))}
          </aside>
          <article
            className="signup-rules-document"
            onScroll={(event) => {
              const element = event.currentTarget
              if (element.scrollTop + element.clientHeight >= element.scrollHeight - 16) {
                setRulesScrolled(true)
              }
            }}
          >
            {parsedRules.blocks.map((block, index) => (
              <RuleBlockView block={block} idPrefix="signup-" key={`${block.type}-${index}`} />
            ))}
          </article>
        </div>
        <div className="rules-confirm rules-confirm-panel">
          <label>
            <input checked={rulesAccepted} disabled={!rulesScrolled} onChange={(event) => setRulesAccepted(event.target.checked)} type="checkbox" />
            <span>I read and understand the Lifesteal rules. I understand that not knowing the rules is not an excuse.</span>
          </label>
          {!rulesScrolled && <p className="form-message">Scroll to the bottom of the rules before accepting.</p>}
          <div className="form-actions">
            <button className="secondary-action" onClick={() => setStep('form')} type="button">Back To Form</button>
            <button className="primary-action" disabled={!rulesScrolled || !rulesAccepted || submitting} onClick={submitWithRules} type="button">
              {submitting ? 'Submitting...' : 'Accept Rules And Submit'}
            </button>
            <p className={submitError ? 'form-message error' : 'form-message'}>{submitError || 'Your rules acknowledgement key will be created automatically after acceptance.'}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="content-page page-frame">
      <PageIntro label="Minecraft Application" title="Lifesteal Signup" backTo="minecraft" onNavigate={onNavigate}>
        Apply for the SHD Lifesteal season. Your answers are saved for Discord verification and staff review.
      </PageIntro>
      <form className="signup-form" onSubmit={submit}>
        <div className="form-section">
          <div>
            <span className="section-kicker">Identity</span>
            <h2>Discord and Minecraft</h2>
          </div>
          <FormField label="Discord username" required value={form.discordName} onChange={(value) => update('discordName', value)} placeholder="example: user_name" />
          <FormField label="Discord ID" value={form.discordId} onChange={(value) => update('discordId', value)} placeholder="Optional, but helps staff verify faster" />
          <FormField label="Minecraft Java name" required value={form.minecraftName} onChange={(value) => update('minecraftName', value)} placeholder="Your exact Java username" />
        </div>

        <div className="form-section">
          <div>
            <span className="section-kicker">Availability</span>
            <h2>Region and Time</h2>
          </div>
          <div className="form-row">
            <FormField label="Age" value={form.age} onChange={(value) => update('age', value)} placeholder="Optional" />
            <FormField label="Region" required value={form.region} onChange={(value) => update('region', value)} placeholder="EU, NA, etc." />
            <FormField label="Timezone" value={form.timezone} onChange={(value) => update('timezone', value)} placeholder="CET, EST, GMT..." />
          </div>
        </div>

        <div className="form-section">
          <div>
            <span className="section-kicker">Application</span>
            <h2>Player Context</h2>
          </div>
          <TextArea label="Lifesteal or SMP experience" required value={form.experience} onChange={(value) => update('experience', value)} placeholder="Tell us about previous servers, PvP experience, or survival playstyle." />
          <TextArea label="How did you find Lifesteal?" required value={form.foundLifesteal} onChange={(value) => update('foundLifesteal', value)} placeholder="Discord invite, friend, stream, TikTok, YouTube, SHD member, or somewhere else." />
          <TextArea label="Why do you want to join?" required value={form.motivation} onChange={(value) => update('motivation', value)} placeholder="Keep it honest. Staff mostly needs to know you understand the event." />
          <TextArea label="Applying alone or with a team?" value={form.team} onChange={(value) => update('team', value)} placeholder="Optional. Add team name, teammate usernames, or say that you are applying solo." />
          <TextArea label="Content creator links or extra notes" value={form.content} onChange={(value) => update('content', value)} placeholder="Optional Twitch, YouTube, TikTok, timezone limits, team info, or anything staff should know." />
        </div>

        <div className="rules-confirm">
          <label>
            <input checked={form.rules === 'accepted'} onChange={(event) => update('rules', event.target.checked ? 'accepted' : '')} type="checkbox" />
            <span>I agree to the SHD Support Terms and Privacy notice for submitting and reviewing this application. I understand that the next step will ask me to review and accept the Lifesteal rules.</span>
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-action" disabled={!canSubmit || submitting} type="submit">Continue To Rules</button>
          <p className={submitError ? 'form-message error' : 'form-message'}>{submitError || (canSubmit ? 'Ready for rules review.' : 'Required fields must be completed before continuing.')}</p>
        </div>
      </form>
    </section>
  )
}

const minecraftIntakeForms: Record<MinecraftFormId, MinecraftFormConfig> = {
  'ban-appeal': {
    label: 'Minecraft Appeals',
    title: 'Ban Appeal',
    description: 'Submit a clear punishment appeal for staff review and continue with the reference in Discord.',
    endpoint: 'minecraft-ban-appeal',
    noticeLabel: 'Secure Intake',
    noticeBody: 'Your submission will be saved for staff review. Relevant details are available only to authorized SHD staff through our internal support systems.',
    sections: [
      {
        label: 'Identity',
        title: 'Your Accounts',
        fields: [
          { id: 'discordUsername', label: 'Discord username', placeholder: 'Your current Discord username', required: true },
          { id: 'minecraftName', label: 'Minecraft Java name', placeholder: 'Your exact Java username', required: true },
          { id: 'banId', label: 'Ban or case ID', placeholder: 'The ID shown in your punishment message', required: true },
        ],
      },
      {
        label: 'Punishment',
        title: 'What Happened',
        fields: [
          { id: 'punishmentType', label: 'Punishment type', placeholder: 'Select a punishment', required: true, kind: 'select', options: ['Minecraft ban', 'Discord ban', 'Temporary ban', 'Mute or restriction', 'Other'] },
          { id: 'punishmentDate', label: 'Approximate date', placeholder: 'Example: June 14, 2026' },
          { id: 'punishmentReason', label: 'Reason shown to you', placeholder: 'Paste or describe the punishment reason.', required: true, kind: 'textarea' },
        ],
      },
      {
        label: 'Appeal',
        title: 'Your Explanation',
        fields: [
          { id: 'context', label: 'What happened?', placeholder: 'Explain the situation honestly and in order.', required: true, kind: 'textarea' },
          { id: 'change', label: 'Why should staff reconsider?', placeholder: 'Explain what staff should consider and what would be different going forward.', required: true, kind: 'textarea' },
          { id: 'evidence', label: 'Evidence links', placeholder: 'Optional screenshots, clips, logs, or message links.', kind: 'textarea' },
        ],
      },
    ],
    acknowledgement: 'I confirm this appeal is honest, complete, and submitted without harassment or repeated spam.',
    resultTitle: 'Appeal Submitted',
    ticketInstruction: 'Open a Minecraft appeal ticket in Discord and include this reference so staff can connect the conversation to your appeal.',
  },
  'player-report': {
    label: 'Minecraft Reports',
    title: 'Player Report',
    description: 'Submit an incident report with enough context and evidence for a private staff investigation.',
    endpoint: 'minecraft-player-report',
    noticeLabel: 'Private Report',
    noticeBody: 'Your report and evidence are visible only to authorized staff. The reported player will not receive your submission details.',
    sections: [
      {
        label: 'Reporter',
        title: 'Your Details',
        fields: [
          { id: 'discordUsername', label: 'Discord username', placeholder: 'Your current Discord username', required: true },
          { id: 'minecraftName', label: 'Your Minecraft name', placeholder: 'Your exact Java username', required: true },
          { id: 'reportedPlayer', label: 'Reported player', placeholder: 'Their exact Minecraft or Discord name', required: true },
        ],
      },
      {
        label: 'Incident',
        title: 'Report Context',
        fields: [
          { id: 'category', label: 'Report category', placeholder: 'Select a category', required: true, kind: 'select', options: ['Cheating or prohibited mods', 'Combat or event rule violation', 'Harassment or threats', 'Scam or team abuse', 'Exploit abuse', 'Other'] },
          { id: 'incidentTime', label: 'Date and time', placeholder: 'Include your timezone if possible', required: true },
          { id: 'location', label: 'Where did it happen?', placeholder: 'Server area, event, Discord channel, or ticket' },
          { id: 'description', label: 'What happened?', placeholder: 'Describe the incident in order and separate facts from assumptions.', required: true, kind: 'textarea' },
        ],
      },
      {
        label: 'Evidence',
        title: 'Supporting Material',
        fields: [
          { id: 'evidence', label: 'Evidence links', placeholder: 'Screenshots, unedited clips, logs, or message links.', required: true, kind: 'textarea' },
          { id: 'witnesses', label: 'Witnesses', placeholder: 'Optional usernames of players who directly saw the incident.' },
          { id: 'extra', label: 'Anything else?', placeholder: 'Optional context staff should know.', kind: 'textarea' },
        ],
      },
    ],
    acknowledgement: 'I confirm this report is made in good faith and the evidence has not been misleadingly edited.',
    resultTitle: 'Report Submitted',
    ticketInstruction: 'Your report was sent directly to the private staff review channel. You do not need to open a public ticket.',
  },
  'minecraft-support': {
    label: 'Minecraft Support',
    title: 'Minecraft Support',
    description: 'Submit a technical or account support request for the Minecraft team.',
    endpoint: 'minecraft-support',
    noticeLabel: 'Secure Intake',
    noticeBody: 'Your submission will be saved for staff review. Relevant details are available only to authorized SHD staff through our internal support systems.',
    sections: [
      {
        label: 'Identity',
        title: 'Your Accounts',
        fields: [
          { id: 'discordUsername', label: 'Discord username', placeholder: 'Your current Discord username', required: true },
          { id: 'minecraftName', label: 'Minecraft Java name', placeholder: 'Optional if the issue is not account-specific' },
          { id: 'category', label: 'Support category', placeholder: 'Select a category', required: true, kind: 'select', options: ['Cannot join the server', 'Discord and Minecraft linking', 'Whitelist or application access', 'Missing item or gameplay data', 'Bug or technical issue', 'Other'] },
        ],
      },
      {
        label: 'Request',
        title: 'Issue Details',
        fields: [
          { id: 'summary', label: 'Short summary', placeholder: 'One sentence describing the issue', required: true },
          { id: 'details', label: 'What is happening?', placeholder: 'Describe what you expected, what happened, and when it started.', required: true, kind: 'textarea' },
          { id: 'error', label: 'Error message', placeholder: 'Paste the exact error text if one exists.', kind: 'textarea' },
          { id: 'evidence', label: 'Screenshots or links', placeholder: 'Optional screenshots, clips, or relevant links.', kind: 'textarea' },
        ],
      },
    ],
    acknowledgement: 'I confirm the information is accurate and staff may use it to investigate this support request.',
    resultTitle: 'Support Request Submitted',
    ticketInstruction: 'Keep this reference available. Staff received the request and can use it when continuing the conversation in Discord.',
  },
}

function MinecraftIntakeForm({ formId, onNavigate }: { formId: MinecraftFormId; onNavigate: (page: PageId) => void }) {
  const config = minecraftIntakeForms[formId]
  const [values, setValues] = useState<Record<string, string>>({})
  const [accepted, setAccepted] = useState(false)
  const [submitted, setSubmitted] = useState<SupportIntakeResponse | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const requiredFields = config.sections.flatMap((section) => section.fields).filter((field) => field.required)
  const canSubmit = accepted && requiredFields.every((field) => values[field.id]?.trim()) && !submitting

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const response = await fetch(`${supportApiBase}/support/${config.endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(
          Object.entries(values).map(([key, value]) => [key, value.trim() || null])
        )),
      })
      const body = await response.json() as SupportIntakeResponse
      if (!response.ok || !body.ok || !body.referenceCode) {
        throw new Error(body.error ?? 'Submission failed.')
      }
      setSubmitted(body)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setSubmitError(error instanceof Error ? cleanApiError(error.message) : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section className="content-page page-frame">
        <PageIntro label="Submission Saved" title={config.resultTitle} backTo="minecraft" onNavigate={onNavigate}>
          Your information was saved and is ready for authorized staff review.
        </PageIntro>
        <div className="result-panel">
          <span className="section-kicker">Reference</span>
          <strong>{submitted.referenceCode}</strong>
          <p>{config.ticketInstruction}</p>
          <div className="result-actions">
            <button className="secondary-action" onClick={() => setSubmitted(null)} type="button">Review Form</button>
            <button className="secondary-action" onClick={() => onNavigate('minecraft')} type="button">Minecraft Support</button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="content-page page-frame">
      <PageIntro label={config.label} title={config.title} backTo="minecraft" onNavigate={onNavigate}>
        {config.description}
      </PageIntro>
      <div className="preview-notice live" role="note">
        <span>{config.noticeLabel}</span>
        <p>{config.noticeBody}</p>
      </div>
      <form className="signup-form" onSubmit={submit}>
        {config.sections.map((section) => (
          <div className="form-section" key={section.title}>
            <div>
              <span className="section-kicker">{section.label}</span>
              <h2>{section.title}</h2>
            </div>
            {section.fields.map((field) => (
              <MinecraftFieldControl
                field={field}
                key={field.id}
                value={values[field.id] ?? ''}
                onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))}
              />
            ))}
          </div>
        ))}
        <div className="rules-confirm">
          <label>
            <input checked={accepted} onChange={(event) => setAccepted(event.target.checked)} type="checkbox" />
            <span>{config.acknowledgement}</span>
          </label>
        </div>
        <div className="form-actions">
          <button className="primary-action" disabled={!canSubmit} type="submit">{submitting ? 'Submitting...' : 'Submit Request'}</button>
          <p className={submitError ? 'form-message error' : 'form-message'}>{submitError || (canSubmit ? 'Ready to submit.' : 'Complete the required fields and acknowledgement.')}</p>
        </div>
      </form>
    </section>
  )
}

function MinecraftFieldControl({ field, value, onChange }: { field: MinecraftFormField; value: string; onChange: (value: string) => void }) {
  if (field.kind === 'textarea') {
    return <TextArea label={field.label} required={field.required} value={value} onChange={onChange} placeholder={field.placeholder} />
  }
  if (field.kind === 'select') {
    return (
      <label className="field">
        <span>{field.label}{field.required && <em>required</em>}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{field.placeholder}</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    )
  }
  return <FormField label={field.label} required={field.required} value={value} onChange={onChange} placeholder={field.placeholder} />
}

function RuleBlockView({ block, idPrefix = '' }: { block: RuleBlock; idPrefix?: string }) {
  if (block.type === 'h2') {
    return <h2 id={block.id ? `${idPrefix}${block.id}` : undefined}>{block.text}</h2>
  }

  if (block.type === 'h3') {
    return <h3>{block.text}</h3>
  }

  if (block.type === 'ul') {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  if (block.type === 'hr') {
    return <hr />
  }

  return <p>{block.text}</p>
}

function FormField({ label, value, onChange, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return (
    <label className="field">
      <span>{label}{required && <em>required</em>}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

function TextArea({ label, value, onChange, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return (
    <label className="field">
      <span>{label}{required && <em>required</em>}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={5} />
    </label>
  )
}

function ConstructionPage({ title, label, detail, backTo, onNavigate }: { title: string; label: string; detail: string; backTo?: PageId; onNavigate?: (page: PageId) => void }) {
  return (
    <section className="content-page page-frame">
      <PageIntro label={label} title={title} backTo={backTo} onNavigate={onNavigate}>{detail}</PageIntro>
      <LockedPanel
        eyebrow="Planned Workflow"
        title="Under Construction"
        detail="This workflow is reserved so the portal can launch with clean navigation while staff tools are connected behind it."
      />
    </section>
  )
}

function LockedPanel({ eyebrow, title, detail, compact = false }: { eyebrow: string; title: string; detail: string; compact?: boolean }) {
  return (
    <div className={compact ? 'locked-panel compact' : 'locked-panel'}>
      <span className="locked-eyebrow">{eyebrow}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
      <span className="locked-status"><i aria-hidden="true" /> Access locked</span>
    </div>
  )
}

const legalSections = {
  legal: [
    { title: 'Purpose', body: 'This support portal provides Lifesteal application, appeal, report, and Minecraft support flows for SHD Esports projects.' },
    { title: 'Operator', body: 'SHD Esports, represented by Louis Lenhartz, An der Burg Suelz 27a, 53797 Lohmar, Nordrhein-Westfalen, Germany.' },
    { title: 'Contact', body: 'For support requests, applications, appeals, reports, or general questions about this portal, contact support@shd-esports.com.' },
  ],
  privacy: [
    { title: 'Data We Process', body: 'Support forms may process Discord usernames or IDs, Minecraft usernames or UUIDs, application answers, appeal text, report evidence, staff review notes, and technical logs.' },
    { title: 'Use of Data', body: 'Submitted data is used to review applications, handle support requests, enforce rules, protect community safety, and operate SHD Esports services.' },
    { title: 'Application Approval', body: 'If a Lifesteal application is approved, the bot may link the approved Minecraft username to the applicant Discord account, prepare server access, and enable public gameplay stats for the Lifesteal leaderboard.' },
    { title: 'Retention', body: 'Applications are generally kept for the relevant season, usually around 3 to 4 months. Appeals, reports, support requests, and moderation records may be kept longer when needed for repeat-case review, security, or rule enforcement.' },
    { title: 'Requests', body: 'Players may request access, correction, or deletion of support data through support@shd-esports.com.' },
  ],
  terms: [
    { title: 'Use of the Portal', body: 'The portal is intended for legitimate SHD Esports support requests. Spam, impersonation, false reports, or abuse may lead to denied requests or server restrictions.' },
    { title: 'Applications and Appeals', body: 'Submitting a form does not guarantee acceptance, appeal approval, or access to any SHD service. Staff decisions may depend on server rules, safety, and available capacity.' },
    { title: 'Approved Access', body: 'Approved Lifesteal applications may be processed automatically by the Discord bot. If automation cannot prepare Minecraft access, staff may finish the setup manually in the Discord ticket.' },
    { title: 'Changes', body: 'Support workflows, rules, portal pages, and staff processes may change during the Lifesteal season. Material updates will be reflected on the portal or announced through official SHD channels where appropriate.' },
  ],
  imprint: [
    { title: 'Responsible Entity', body: 'SHD Esports, represented by Louis Lenhartz.' },
    { title: 'Address', body: 'Louis Lenhartz, An der Burg Suelz 27a, 53797 Lohmar, Nordrhein-Westfalen, Germany.' },
    { title: 'Contact', body: 'support@shd-esports.com' },
    { title: 'Editorial Responsibility', body: 'Louis Lenhartz is responsible for the portal content unless another responsible editor is expressly named.' },
  ],
}

function LegalPage({ title, label, sections }: { title: string; label: string; sections: Array<{ title: string; body: string }> }) {
  return (
    <section className="content-page page-frame legal-page">
      <PageIntro label={label} title={title}>
        Required support portal information for visitors and players submitting data.
      </PageIntro>
      <div className="legal-layout">
        <aside className="legal-note">
          <span className="section-kicker">SHD Portal</span>
          <strong>Portal Notice</strong>
          <p>These pages describe the current Lifesteal support portal release for players, applicants, and visitors.</p>
          <span className="legal-status">Current release</span>
        </aside>
        <article className="legal-document">
          {sections.map((section, index) => (
            <section key={section.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </div>
            </section>
          ))}
        </article>
      </div>
    </section>
  )
}

function Footer({ current, onNavigate }: { current: string; onNavigate: (page: PageId) => void }) {
  return (
    <footer className="site-footer">
      <span>{current}</span>
      <div>
        <button onClick={() => onNavigate('minecraft')} type="button">Minecraft</button>
        {legalItems.map((item) => (
          <button key={item.id} onClick={() => onNavigate(item.id)} type="button">{item.label}</button>
        ))}
      </div>
    </footer>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
