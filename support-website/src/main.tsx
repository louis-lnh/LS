import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import heroImage from './assets/lifesteal-hero.png'
import logoImage from './assets/shd-logo.png'

type PageId =
  | 'home'
  | 'applications'
  | 'support'
  | 'reports-appeals'
  | 'info'
  | 'signup'
  | 'general-support'
  | 'ban-appeal'
  | 'player-report'
  | 'status'
  | 'legal'
  | 'privacy'
  | 'terms'
  | 'imprint'

type SectionId = 'applications' | 'support' | 'reports-appeals' | 'info'
type SignupField =
  | 'rulesCode'
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

const primarySections: Array<{ id: SectionId; label: string; title: string }> = [
  { id: 'applications', label: 'Applications', title: 'SHD Applications' },
  { id: 'support', label: 'Support', title: 'SHD Support' },
  { id: 'reports-appeals', label: 'Reports/Appeals', title: 'SHD Reports & Appeals' },
  { id: 'info', label: 'Info', title: 'SHD Info' },
]

const legalItems: Array<{ id: PageId; label: string }> = [
  { id: 'legal', label: 'Legal' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'imprint', label: 'Imprint' },
]

const sectionForms: Record<SectionId, Array<{ id: PageId; label: string }>> = {
  applications: [{ id: 'signup', label: 'MC - Signup' }],
  support: [{ id: 'general-support', label: 'MC - Support' }],
  'reports-appeals': [
    { id: 'ban-appeal', label: 'MC - Ban Appeal' },
    { id: 'player-report', label: 'MC - Player Report' },
  ],
  info: [
    { id: 'status', label: 'Status' },
    { id: 'privacy', label: 'Privacy' },
  ],
}

const pageSections: Partial<Record<PageId, SectionId>> = {
  applications: 'applications',
  signup: 'applications',
  support: 'support',
  'general-support': 'support',
  'reports-appeals': 'reports-appeals',
  'ban-appeal': 'reports-appeals',
  'player-report': 'reports-appeals',
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
  rulesCode: '',
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
    rulesCode: 'Rules acknowledgement key',
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
  if (page === 'general-support') return 'Minecraft Support'
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
        {page === 'applications' && <SectionPage section="applications" onNavigate={navigate} />}
        {page === 'support' && <SectionPage section="support" onNavigate={navigate} />}
        {page === 'reports-appeals' && <SectionPage section="reports-appeals" onNavigate={navigate} />}
        {page === 'info' && <SectionPage section="info" onNavigate={navigate} />}
        {page === 'signup' && <SignupPage />}
        {page === 'general-support' && <ConstructionPage title="Support" label="Minecraft Support" detail="General Minecraft support tickets will open after the first portal release." />}
        {page === 'ban-appeal' && <ConstructionPage title="Ban Appeal" label="Minecraft Appeals" detail="Ban appeal intake will be connected to the staff queue in the next support pass." />}
        {page === 'player-report' && <ConstructionPage title="Player Report" label="Minecraft Reports" detail="Player reports and evidence intake are reserved for the moderation workflow." />}
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

function PageIntro({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="page-intro">
      <span className="chip">{label}</span>
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
        <SupportTile title="Applications" state="Open MVP" detail="Apply for current and future SHD projects, teams, and community events." onClick={() => onNavigate('applications')} />
        <SupportTile title="Support" state="Under Construction" detail="General help, account questions, staff contact, and project support requests." onClick={() => onNavigate('support')} />
        <SupportTile title="Reports / Appeals" state="Under Construction" detail="Appeal punishments, report players, and send staff evidence through one flow." onClick={() => onNavigate('reports-appeals')} />
      </div>
    </section>
  )
}

function SupportTile({ title, state, detail, onClick }: { title: string; state: string; detail: string; onClick: () => void }) {
  return (
    <button className="support-tile" onClick={onClick} type="button">
      <span>{state}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </button>
  )
}

const sectionCopy: Record<SectionId, { label: string; title: string; intro: string; empty: string }> = {
  applications: {
    label: 'Applications',
    title: 'Apply',
    intro: 'Choose a game or SHD project, then pick the application form that fits what you want to join.',
    empty: 'No application forms are active for this game yet.',
  },
  support: {
    label: 'Support',
    title: 'Support',
    intro: 'Choose a game or SHD project, then select the support workflow you need.',
    empty: 'No support forms are active for this game yet.',
  },
  'reports-appeals': {
    label: 'Reports & Appeals',
    title: 'Reports',
    intro: 'Choose a game or SHD project, then select a report or appeal workflow.',
    empty: 'No report or appeal forms are active for this game yet.',
  },
  info: {
    label: 'Info',
    title: 'Info',
    intro: 'Portal status, legal information, and general SHD support details live here.',
    empty: 'No info pages are active for this game yet.',
  },
}

function SectionPage({ section, onNavigate }: { section: SectionId; onNavigate: (page: PageId) => void }) {
  const [game, setGame] = useState(section === 'info' ? 'general' : '')
  const forms = sectionForms[section]
  const copy = sectionCopy[section]
  const isInfo = section === 'info'
  const showMinecraftForms = game === 'minecraft'
  const showGeneralInfo = isInfo && game === 'general'

  return (
    <section className="content-page page-frame section-page">
      <PageIntro label={copy.label} title={copy.title}>{copy.intro}</PageIntro>
      <div className="game-selector-panel">
        <label className="field game-select">
          <span>{isInfo ? 'Info Type' : 'Game'}</span>
          <select value={game} onChange={(event) => setGame(event.target.value)}>
            {!isInfo && <option value="">Select your Game</option>}
            {isInfo && <option value="general">General Info</option>}
            <option value="minecraft">Minecraft</option>
          </select>
        </label>
      </div>
      <div className="form-card-grid">
        {showGeneralInfo && forms.map((form) => (
          <button className="form-card" key={form.id} onClick={() => onNavigate(form.id)} type="button">
            <span>General Info</span>
            <strong>{form.label}</strong>
            <p>{formDescription(form.id)}</p>
          </button>
        ))}
        {showMinecraftForms && forms.map((form) => (
          <button className="form-card" key={form.id} onClick={() => onNavigate(form.id)} type="button">
            <span>{form.label.startsWith('MC') ? 'Minecraft' : 'Portal'}</span>
            <strong>{form.label.replace('MC - ', '')}</strong>
            <p>{formDescription(form.id)}</p>
          </button>
        ))}
        {!game && <LockedPanel eyebrow="Select" title="Select your game to continue" detail="Forms stay locked until a game or project is selected." compact />}
        {game && !showMinecraftForms && !showGeneralInfo && <LockedPanel eyebrow="Pending" title={copy.empty} detail="This area is reserved for a future SHD portal release." compact />}
      </div>
    </section>
  )
}

function formDescription(page: PageId) {
  const descriptions: Partial<Record<PageId, string>> = {
    signup: 'Apply for the SHD Lifesteal Minecraft season.',
    'general-support': 'Request help for Minecraft-related access, account, or server issues.',
    'ban-appeal': 'Appeal a Minecraft punishment once the review flow is live.',
    'player-report': 'Report a Minecraft player with staff-readable context and evidence.',
    status: 'View portal and service status information.',
    privacy: 'Read how support data is handled.',
  }
  return descriptions[page] ?? 'Open this SHD support page.'
}

function SignupPage() {
  const [form, setForm] = useState<SignupState>(initialSignup)
  const [submitted, setSubmitted] = useState<SubmittedApplication | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field: SignupField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const canSubmit = form.rulesCode.trim() && form.discordName.trim() && form.minecraftName.trim() && form.region.trim() && form.foundLifesteal.trim() && form.experience.trim() && form.motivation.trim() && form.rules === 'accepted'

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const response = await fetch(`${supportApiBase}/support/lifesteal-signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rulesCode: form.rulesCode,
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
      const body = await response.json() as { ok?: boolean; error?: string; applicationId?: number; applicationCode?: string; status?: string }
      if (!response.ok || !body.ok || !body.applicationId || !body.applicationCode || !body.status) {
        throw new Error(body.error ?? 'Application submission failed.')
      }
      setSubmitted({
        applicationId: body.applicationId,
        applicationCode: body.applicationCode,
        status: body.status,
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? cleanApiError(error.message) : 'Application submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section className="content-page page-frame">
        <PageIntro label="Application Saved" title="Submitted">
          Your Lifesteal signup is saved. Use the application key in your Discord ticket so the bot can verify the ticket belongs to you.
        </PageIntro>
        <div className="result-panel">
          <span className="section-kicker">Application Key</span>
          <strong>{submitted.applicationCode}</strong>
          <p>Open your Lifesteal ticket in Discord and send this key. The bot will verify your application and notify staff.</p>
          <button className="secondary-action" onClick={() => setSubmitted(null)} type="button">Edit Submission</button>
        </div>
      </section>
    )
  }

  return (
    <section className="content-page page-frame">
      <PageIntro label="Minecraft Application" title="Lifesteal Signup">
        Submit the first version of your Lifesteal application. This MVP keeps the form ready while the permanent backend and staff queue are being connected.
      </PageIntro>
      <form className="signup-form" onSubmit={submit}>
        <div className="form-section">
          <div>
            <span className="section-kicker">Rules Verification</span>
            <h2>Rules Key</h2>
          </div>
          <FormField label="Rules acknowledgement key" required value={form.rulesCode} onChange={(value) => update('rulesCode', value)} placeholder="SHD-RULES-XXXXXX" />
        </div>

        <div className="form-section">
          <div>
            <span className="section-kicker">Identity</span>
            <h2>Discord and Minecraft</h2>
          </div>
          <FormField label="Discord username" required value={form.discordName} onChange={(value) => update('discordName', value)} placeholder="example: prime_louis" />
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
            <span>I agree to the SHD Support Terms and Privacy notice for submitting and reviewing this application.</span>
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-action" disabled={!canSubmit || submitting} type="submit">{submitting ? 'Submitting...' : 'Submit Application'}</button>
          <p className={submitError ? 'form-message error' : 'form-message'}>{submitError || (canSubmit ? 'Ready for review.' : 'Required fields must be completed before submission.')}</p>
        </div>
      </form>
    </section>
  )
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

function ConstructionPage({ title, label, detail }: { title: string; label: string; detail: string }) {
  return (
    <section className="content-page page-frame">
      <PageIntro label={label} title={title}>{detail}</PageIntro>
      <LockedPanel
        eyebrow="Locked MVP"
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
    { title: 'Purpose', body: 'This support portal provides application, appeal, report, status, and player support flows for SHD Esports projects.' },
    { title: 'Contact', body: 'Temporary contact: louis.lenhartz.ll@icloud.com. Dedicated SHD support addresses will replace this before full public launch.' },
  ],
  privacy: [
    { title: 'Data We Process', body: 'Support forms may process Discord usernames or IDs, Minecraft usernames or UUIDs, application answers, appeal text, report evidence, staff review notes, and technical logs.' },
    { title: 'Use of Data', body: 'Submitted data is used to review applications, handle support requests, enforce rules, protect community safety, and operate SHD Esports services.' },
    { title: 'Application Approval', body: 'If a Lifesteal application is approved, the bot may link the approved Minecraft username to the applicant Discord account, prepare server access, and enable public gameplay stats for the Lifesteal leaderboard.' },
    { title: 'Requests', body: 'Players may request correction or deletion through the support contact while the permanent portal workflow is under construction.' },
  ],
  terms: [
    { title: 'Use of the Portal', body: 'The portal is intended for legitimate SHD Esports support requests. Spam, impersonation, false reports, or abuse may lead to denied requests or server restrictions.' },
    { title: 'Applications and Appeals', body: 'Submitting a form does not guarantee acceptance, appeal approval, or access to any SHD service. Staff decisions may depend on server rules, safety, and available capacity.' },
    { title: 'Approved Access', body: 'Approved Lifesteal applications may be processed automatically by the Discord bot. If automation cannot prepare Minecraft access, staff may finish the setup manually in the Discord ticket.' },
  ],
  imprint: [
    { title: 'Operator', body: 'SHD Esports support portal. Full provider details and dedicated business contact information will be completed before the final public launch.' },
    { title: 'Temporary Contact', body: 'louis.lenhartz.ll@icloud.com' },
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
          <strong>MVP Notice</strong>
          <p>These pages are active for the portal MVP and will be expanded before the full public support launch.</p>
          <span className="legal-status">Current draft</span>
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
        <button onClick={() => onNavigate('applications')} type="button">Applications</button>
        <button onClick={() => onNavigate('support')} type="button">Support</button>
        <button onClick={() => onNavigate('reports-appeals')} type="button">Reports</button>
        {legalItems.map((item) => (
          <button key={item.id} onClick={() => onNavigate(item.id)} type="button">{item.label}</button>
        ))}
      </div>
    </footer>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
