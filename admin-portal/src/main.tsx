import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  ArrowLeft,
  Ban,
  Bot,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  Crosshair,
  ExternalLink,
  FileWarning,
  Gamepad2,
  Headphones,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  Megaphone,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserRoundSearch,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import './styles.css'
import logo from './assets/shd-logo-no-text.png'
import logoWithText from './assets/shd-logo.png'
import {
  adminDemoMode,
  AdminApiError,
  addAdminSubmissionNote,
  beginDiscordLogin,
  claimAdminSubmission,
  createAdminLifestealEvent,
  createAdminPlayer,
  decideAdminSubmission,
  demoAdminUser,
  endAdminSession,
  deleteAdminLifestealEvent,
  deleteAdminPlayer,
  getAdminAudit,
  getAdminLifestealEvents,
  getAdminPlayers,
  getAdminSubmissions,
  getAdminOverview,
  getAdminSession,
  getLifestealStaffChat,
  getSubmissionTicketActivity,
  resendAdminLifestealEventAnnouncement,
  sendSubmissionTicketMessage,
  sendLifestealStaffChatMessage,
  updateAdminLifestealEvent,
  updateAdminPlayer,
  type AdminApiSubmission,
  type AdminAuditPayload,
  type AdminLifestealEvent,
  type AdminOverview,
  type AdminPlayer,
  type AdminPlayerBadge,
  type AdminPlayerStatus,
  type CreateAdminPlayerPayload,
  type UpsertAdminLifestealEventPayload,
  type AdminUser,
  type StaffChatMessage,
  type TicketActivityMessage,
} from './api'

type SubmissionType = 'Application' | 'Appeal' | 'Player Report' | 'Support'
type SubmissionStatus = 'New' | 'In review' | 'Waiting on player' | 'Approved' | 'Denied'
type WorkspaceId = 'global' | 'lifesteal' | 'general' | 'valorant'
type AdminView =
  | 'global-overview'
  | 'global-inbox'
  | 'global-staff'
  | 'global-integrations'
  | 'global-audit'
  | 'lifesteal-overview'
  | 'lifesteal-queue'
  | 'lifesteal-players'
  | 'lifesteal-events'
  | 'lifesteal-applications'
  | 'lifesteal-appeals'
  | 'lifesteal-reports'
  | 'lifesteal-support'
  | 'lifesteal-staff-chat'
  | 'general-overview'
  | 'general-inbox'
  | 'valorant-overview'
  | 'valorant-inbox'
type Submission = {
  id: string
  type: SubmissionType
  status: SubmissionStatus
  title: string
  discord: string
  minecraft: string
  submitted: string
  priority: 'Normal' | 'High'
  claimedBy?: string
  claimedById?: string
  summary: string
  fields: Array<{ label: string; value: string }>
  notes: Array<{ author: string; body: string; time: string }>
  activity: Array<{ type: 'player' | 'staff' | 'system'; author: string; body: string; time: string }>
  ticketThreadId?: string | null
  requiresTicket?: boolean
}

type UiActivityItem = { type: 'player' | 'staff' | 'system'; author: string; body: string; time: string; id?: string; avatarUrl?: string | null }

function relativeTime(timestamp: number, now = Date.now()) {
  const elapsed = Math.max(0, now - timestamp)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || 'SH'
}

function minecraftHeadUrl(name: string) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/96`
}

function portalMessageParts(content: string) {
  const match = content.match(/^\*\*(.+? via Admin Portal)\*\*\n([\s\S]*)$/)
  return match ? { label: match[1], body: match[2] } : { label: '', body: content }
}

function ChatAvatar({ name, src }: { name: string; src?: string | null }) {
  return <div className="chat-avatar">{src ? <img alt="" src={src} /> : initials(name)}</div>
}

function submissionFromApi(submission: AdminApiSubmission): Submission {
  return {
    id: submission.id,
    type: submission.type,
    status: submission.status,
    title: submission.title,
    discord: submission.discord,
    minecraft: submission.minecraft,
    submitted: relativeTime(submission.createdAt),
    priority: submission.priority,
    claimedBy: submission.claimedBy ?? undefined,
    claimedById: submission.claimedById ?? undefined,
    summary: submission.summary,
    fields: submission.fields,
    notes: submission.notes.map((item) => ({ ...item, time: relativeTime(item.time) })),
    activity: submission.activity.map((item) => ({ ...item, time: relativeTime(item.time) })),
    ticketThreadId: submission.ticketThreadId,
    requiresTicket: submission.requiresTicket,
  }
}

const seedStaffName = 'PrimeLuigi'

const viewPaths: Record<AdminView, string> = {
  'global-overview': '/',
  'global-inbox': '/inbox',
  'global-staff': '/staff',
  'global-integrations': '/integrations',
  'global-audit': '/audit',
  'lifesteal-overview': '/lifesteal',
  'lifesteal-queue': '/lifesteal/queue',
  'lifesteal-players': '/lifesteal/players',
  'lifesteal-events': '/lifesteal/events',
  'lifesteal-applications': '/lifesteal/applications',
  'lifesteal-appeals': '/lifesteal/appeals',
  'lifesteal-reports': '/lifesteal/reports',
  'lifesteal-support': '/lifesteal/support',
  'lifesteal-staff-chat': '/lifesteal/staff-chat',
  'general-overview': '/general',
  'general-inbox': '/general/inbox',
  'valorant-overview': '/valorant',
  'valorant-inbox': '/valorant/inbox',
}

function viewFromPath(): AdminView {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const legacyPaths: Record<string, AdminView> = {
    '/overview': 'lifesteal-overview',
    '/players': 'lifesteal-players',
    '/events': 'lifesteal-events',
    '/applications': 'lifesteal-applications',
    '/appeals': 'lifesteal-appeals',
    '/reports': 'lifesteal-reports',
    '/support': 'lifesteal-support',
  }
  return legacyPaths[path]
    ?? (Object.entries(viewPaths).find(([, value]) => value === path)?.[0] as AdminView)
    ?? 'global-overview'
}

function workspaceFromView(view: AdminView): WorkspaceId {
  if (view.startsWith('lifesteal-')) return 'lifesteal'
  if (view.startsWith('general-')) return 'general'
  if (view.startsWith('valorant-')) return 'valorant'
  return 'global'
}

const seedSubmissions: Submission[] = [
  {
    id: 'SHD-APP-K8F2QZ',
    type: 'Application',
    status: 'New',
    title: 'Lifesteal Season 1 application',
    discord: 'voidism',
    minecraft: 'xvoidism',
    submitted: '8 min ago',
    priority: 'Normal',
    summary: 'Experienced SMP player applying with a duo and available most evenings in CEST.',
    fields: [
      { label: 'Region / timezone', value: 'EU / CEST' },
      { label: 'Experience', value: 'Three competitive SMP seasons, strong survival and building focus, intermediate PvP.' },
      { label: 'Motivation', value: 'Looking for a long-form competitive season with meaningful objectives and team politics.' },
      { label: 'Team', value: 'Applying with TlzMax5454' },
      { label: 'Rules key', value: 'SHD-RULES-JQ8K2M' },
    ],
    notes: [],
    activity: [
      { type: 'system', author: 'Support Portal', body: 'Application submitted and validation completed.', time: '15:18' },
      { type: 'player', author: 'voidism', body: 'SHD-APP-K8F2QZ', time: '15:22' },
      { type: 'system', author: 'Discord Bot', body: 'Discord identity verified. Ticket attached.', time: '15:22' },
    ],
  },
  {
    id: 'SHD-APL-3JD91P',
    type: 'Appeal',
    status: 'In review',
    title: 'Combat logging ban appeal',
    discord: 'northstar.',
    minecraft: 'NorthStarMC',
    submitted: '24 min ago',
    priority: 'High',
    claimedBy: 'TlzMax5454',
    summary: 'Player claims their connection dropped during combat and provided a router outage screenshot.',
    fields: [
      { label: 'Case ID', value: 'BAN-1042' },
      { label: 'Punishment', value: 'Minecraft ban' },
      { label: 'Reason shown', value: 'Combat logging during an active tag' },
      { label: 'Player context', value: 'My internet went down for around 12 minutes. I did not intentionally disconnect.' },
      { label: 'Evidence', value: 'status.isp.example/outage-1406' },
    ],
    notes: [
      { author: 'TlzMax5454', body: 'Checking combat timestamps against the server disconnect log.', time: '15:07' },
    ],
    activity: [
      { type: 'system', author: 'Support Portal', body: 'Appeal submitted.', time: '14:52' },
      { type: 'player', author: 'northstar.', body: 'I added the outage screenshot. Let me know if another timestamp is needed.', time: '14:58' },
      { type: 'staff', author: 'TlzMax5454', body: 'Review claimed. We are checking the server logs.', time: '15:03' },
    ],
  },
  {
    id: 'SHD-RPT-M4Q7VN',
    type: 'Player Report',
    status: 'New',
    title: 'Suspected minimap use',
    discord: 'emberlane',
    minecraft: 'EmberLane',
    submitted: '41 min ago',
    priority: 'High',
    summary: 'Reporter believes another player repeatedly located hidden bases without a visible trail.',
    fields: [
      { label: 'Reported player', value: 'QuartzPvP' },
      { label: 'Category', value: 'Cheating or prohibited mods' },
      { label: 'Incident time', value: '14 June 2026, 14:20 CEST' },
      { label: 'Location', value: 'Overworld, approximately 8,200 / -3,400' },
      { label: 'Evidence', value: 'Three unedited video clips and server chat timestamps' },
    ],
    notes: [],
    activity: [
      { type: 'system', author: 'Support Portal', body: 'Private player report submitted. Reporter identity restricted to staff.', time: '14:35' },
    ],
  },
  {
    id: 'SHD-SUP-T2PX6A',
    type: 'Support',
    status: 'Waiting on player',
    title: 'Whitelist access not updating',
    discord: 'novaforge',
    minecraft: 'NovaForge',
    submitted: '1h ago',
    priority: 'Normal',
    claimedBy: seedStaffName,
    summary: 'Application is approved but the player still receives a whitelist error when joining.',
    fields: [
      { label: 'Category', value: 'Whitelist or application access' },
      { label: 'Error', value: 'You are not whitelisted on this server!' },
      { label: 'Expected', value: 'Join access after application approval.' },
      { label: 'Last attempt', value: '14 June 2026, 14:02 CEST' },
    ],
    notes: [
      { author: seedStaffName, body: 'RCON was offline during the first approval attempt. Asked player to retry.', time: '14:18' },
    ],
    activity: [
      { type: 'system', author: 'Support Portal', body: 'Support request submitted.', time: '14:06' },
      { type: 'staff', author: seedStaffName, body: 'Please try joining once more. The whitelist sync has been retried.', time: '14:19' },
      { type: 'system', author: 'Discord Bot', body: 'Message posted to linked support ticket.', time: '14:19' },
    ],
  },
  {
    id: 'SHD-APP-7UZ5CY',
    type: 'Application',
    status: 'Approved',
    title: 'Lifesteal Season 1 application',
    discord: 'riverbytes',
    minecraft: 'RiverBytes',
    submitted: 'Yesterday',
    priority: 'Normal',
    claimedBy: seedStaffName,
    summary: 'Approved solo applicant. Minecraft account linked and whitelist sync completed.',
    fields: [
      { label: 'Region / timezone', value: 'NA / EST' },
      { label: 'Experience', value: 'Vanilla survival, building, light PvP.' },
      { label: 'Motivation', value: 'Interested in collaborative events and objective progression.' },
      { label: 'Team', value: 'Solo' },
    ],
    notes: [],
    activity: [
      { type: 'system', author: 'Discord Bot', body: 'Application approved, account linked, public status enabled.', time: 'Yesterday, 21:14' },
    ],
  },
]

const typeIcons = {
  Application: UserCheck,
  Appeal: Ban,
  'Player Report': FileWarning,
  Support: LifeBuoy,
}

function App() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [authState, setAuthState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    getAdminSession()
      .then((session) => {
        setUser(session)
        setAuthState('ready')
      })
      .catch(() => setAuthState('error'))
  }, [])

  const authError = new URLSearchParams(window.location.search).get('auth')

  if (authState === 'loading') return <AuthLoading />
  if (!user) {
    return <LoginScreen
      authError={authState === 'error' ? 'api_error' : authError}
      onSignIn={() => {
        if (adminDemoMode) setUser(demoAdminUser)
        else beginDiscordLogin()
      }}
    />
  }
  return <AdminWorkspace
    user={user}
    onSignOut={async () => {
      await endAdminSession().catch(() => null)
      setUser(null)
    }}
  />
}

function AuthLoading() {
  return <main className="auth-loading"><img src={logo} alt="" /><span className="eyebrow">SHD Internal</span><strong>Checking staff session...</strong></main>
}

function LoginScreen({ authError, onSignIn }: { authError: string | null; onSignIn: () => void }) {
  const errorMessages: Record<string, string> = {
    denied: 'Your Discord account does not have an approved staff role.',
    not_member: 'Your Discord account is not a member of the configured SHD guild.',
    invalid_state: 'The login request expired or could not be verified. Please try again.',
    unavailable: 'Discord OAuth is not configured on the bot yet.',
    error: 'Discord login failed. Please try again or check the bot logs.',
    api_error: 'The admin API could not be reached.',
  }
  return (
    <main className="login-shell">
      <section className="login-panel">
        <img className="login-wordmark" src={logoWithText} alt="SHD" />
        <span className="eyebrow">SHD Internal</span>
        <h1>Staff Review</h1>
        <p>Use your Discord staff identity to access applications, appeals, reports, and support requests.</p>
        <button className="discord-button" onClick={onSignIn} type="button">
          <MessageSquareText size={18} />
          {adminDemoMode ? 'Continue in demo mode' : 'Continue with Discord'}
        </button>
        {authError && <p className="login-error">{errorMessages[authError] ?? 'Access could not be verified.'}</p>}
        <div className="login-security">
          <LockKeyhole size={16} />
          <span>Guild membership and staff roles will control access.</span>
        </div>
      </section>
      <aside className="login-context">
        <span className="eyebrow">{adminDemoMode ? 'Frontend Prototype' : 'Discord Protected'}</span>
        <strong>One review surface.</strong>
        <p>Discord stays the player conversation. This portal holds review state, claims, decisions, notes, and audit context.</p>
      </aside>
    </main>
  )
}

function AdminWorkspace({ onSignOut, user }: { onSignOut: () => void; user: AdminUser }) {
  const [submissions, setSubmissions] = useState<Submission[]>(adminDemoMode ? seedSubmissions : [])
  const [submissionState, setSubmissionState] = useState<'loading' | 'ready' | 'error'>(adminDemoMode ? 'ready' : 'loading')
  const [claimState, setClaimState] = useState<'idle' | 'loading'>('idle')
  const [actionState, setActionState] = useState<'idle' | 'note' | 'decision'>('idle')
  const [claimError, setClaimError] = useState('')
  const [ticketActivity, setTicketActivity] = useState<TicketActivityMessage[]>([])
  const [ticketActivityState, setTicketActivityState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [ticketActivityError, setTicketActivityError] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketSendState, setTicketSendState] = useState<'idle' | 'sending'>('idle')
  const [timeNow, setTimeNow] = useState(Date.now())
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [overviewState, setOverviewState] = useState<'loading' | 'ready' | 'error'>(adminDemoMode ? 'ready' : 'loading')
  const [auditPayload, setAuditPayload] = useState<AdminAuditPayload | null>(null)
  const [auditState, setAuditState] = useState<'loading' | 'ready' | 'error'>(adminDemoMode ? 'ready' : 'loading')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('shd-admin-sidebar') === 'collapsed')
  const [queueWidth, setQueueWidth] = useState(() => Number(localStorage.getItem('shd-admin-queue-width')) || 352)
  const [activityWidth, setActivityWidth] = useState(() => Number(localStorage.getItem('shd-admin-activity-width')) || 320)
  const [activityVisible, setActivityVisible] = useState(() => localStorage.getItem('shd-admin-activity') !== 'hidden')
  const [view, setView] = useState<AdminView>(() => viewFromPath())
  const [selectedId, setSelectedId] = useState(adminDemoMode ? seedSubmissions[0].id : '')
  const [filter, setFilter] = useState<'All' | SubmissionType>('All')
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [mobileDetail, setMobileDetail] = useState(false)
  const workspace = workspaceFromView(view)
  const reviewerName = user.displayName
  const workspaceStyle = {
    '--queue-width': `${queueWidth}px`,
    '--activity-width': `${activityWidth}px`,
  } as CSSProperties

  useEffect(() => {
    if (user.workspaces.includes(workspace)) return
    const fallback: AdminView = user.workspaces.includes('global') ? 'global-overview' : 'lifesteal-overview'
    window.history.replaceState(null, '', viewPaths[fallback])
    setView(fallback)
  }, [user.workspaces, workspace])

  const refreshSubmissions = async (silent = false) => {
    if (adminDemoMode || !user.workspaces.includes('lifesteal')) return
    if (!silent) setSubmissionState('loading')
    try {
      const items = await getAdminSubmissions()
      const normalized = items.map(submissionFromApi)
      setSubmissions(normalized)
      setSelectedId((current) => normalized.some((item) => item.id === current) ? current : normalized[0]?.id ?? '')
      setSubmissionState('ready')
    } catch {
      setSubmissionState('error')
    }
  }

  const refreshOverview = async (silent = false) => {
    if (adminDemoMode || !user.workspaces.includes('global')) return
    if (!silent) setOverviewState('loading')
    try {
      const data = await getAdminOverview()
      setOverview(data)
      setOverviewState('ready')
    } catch {
      setOverviewState('error')
    }
  }

  const refreshAudit = async (silent = false) => {
    if (adminDemoMode || !user.workspaces.includes('global') || !user.permissions.includes('global:audit')) return
    if (!silent) setAuditState('loading')
    try {
      const data = await getAdminAudit()
      setAuditPayload(data)
      setAuditState('ready')
    } catch {
      setAuditState('error')
    }
  }

  useEffect(() => {
    refreshSubmissions()
    if (adminDemoMode || !user.workspaces.includes('lifesteal')) return
    const timer = window.setInterval(() => refreshSubmissions(true), 10_000)
    return () => window.clearInterval(timer)
  }, [user.workspaces])

  useEffect(() => {
    refreshOverview()
    if (adminDemoMode || !user.workspaces.includes('global')) return
    const timer = window.setInterval(() => refreshOverview(true), 15_000)
    return () => window.clearInterval(timer)
  }, [user.workspaces])

  useEffect(() => {
    refreshAudit()
    if (adminDemoMode || !user.workspaces.includes('global') || !user.permissions.includes('global:audit')) return
    const timer = window.setInterval(() => refreshAudit(true), 20_000)
    return () => window.clearInterval(timer)
  }, [user.workspaces, user.permissions])

  useEffect(() => {
    const onPopState = () => {
      setView(viewFromPath())
      setMobileDetail(false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (nextView: AdminView) => {
    window.history.pushState(null, '', viewPaths[nextView])
    setView(nextView)
    setMobileDetail(false)
    setMobileNav(false)
  }

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      localStorage.setItem('shd-admin-sidebar', next ? 'collapsed' : 'expanded')
      return next
    })
  }

  const toggleActivity = () => {
    setActivityVisible((visible) => {
      const next = !visible
      localStorage.setItem('shd-admin-activity', next ? 'visible' : 'hidden')
      return next
    })
  }

  const startResize = (pane: 'queue' | 'activity', event: ReactPointerEvent<HTMLButtonElement>) => {
    if (window.innerWidth <= 900) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = pane === 'queue' ? queueWidth : activityWidth
    let lastWidth = startWidth
    document.body.classList.add('resizing-layout')

    const move = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX
      const next = pane === 'queue'
        ? Math.min(520, Math.max(280, startWidth + delta))
        : Math.min(460, Math.max(260, startWidth - delta))
      lastWidth = next
      if (pane === 'queue') setQueueWidth(next)
      else setActivityWidth(next)
    }
    const stop = () => {
      localStorage.setItem(pane === 'queue' ? 'shd-admin-queue-width' : 'shd-admin-activity-width', String(lastWidth))
      document.body.classList.remove('resizing-layout')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  const selected = submissions.find((submission) => submission.id === selectedId) ?? submissions[0]
  const canReview = adminDemoMode || user.permissions.includes('lifesteal:review')
  const canTicket = adminDemoMode || user.permissions.includes('lifesteal:ticket')
  const selectedDecided = selected ? ['Approved', 'Denied'].includes(selected.status) : false
  const selectedOwned = selected ? (selected.claimedById ? selected.claimedById === user.id : selected.claimedBy === reviewerName) : false
  const selectedSupportsAdminActions = Boolean(selected)
  const canWriteSelected = Boolean(selected && selectedSupportsAdminActions && canReview && (adminDemoMode || (selectedOwned && !selectedDecided)))
  const canMessageTicket = Boolean(selected?.ticketThreadId && canTicket && (adminDemoMode || (selectedOwned && !selectedDecided)))
  const openSubmissionCount = submissions.filter((submission) => !['Approved', 'Denied'].includes(submission.status)).length
  const liveTicketActivity: UiActivityItem[] = ticketActivity.map((item) => ({
    id: item.id,
    type: item.type,
    author: item.authorName,
    body: item.content,
    time: relativeTime(item.createdAt, timeNow),
    avatarUrl: item.authorAvatarUrl,
  }))
  const combinedActivity: UiActivityItem[] = selected ? [...selected.activity, ...liveTicketActivity] : []
  const ticketSyncLabel = adminDemoMode
    ? 'Live update mock'
    : !selected?.ticketThreadId
      ? 'No linked ticket'
      : ticketActivityState === 'loading'
        ? 'Loading Discord thread'
        : ticketActivityState === 'error'
          ? 'Ticket sync issue'
          : 'Discord thread connected'
  const viewType: Partial<Record<AdminView, SubmissionType>> = {
    'lifesteal-applications': 'Application',
    'lifesteal-appeals': 'Appeal',
    'lifesteal-reports': 'Player Report',
    'lifesteal-support': 'Support',
  }
  const activeType = viewType[view]
  const queueTitle: Partial<Record<SubmissionType, string>> = {
    Application: 'Applications',
    Appeal: 'Appeals',
    'Player Report': 'Player Reports',
    Support: 'Support Requests',
  }
  const visible = useMemo(() => submissions.filter((submission) => {
    const matchesFilter = activeType ? submission.type === activeType : filter === 'All' || submission.type === filter
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [submission.id, submission.title, submission.discord, submission.minecraft]
      .some((value) => value.toLowerCase().includes(query))
    return matchesFilter && matchesSearch
  }), [submissions, activeType, filter, search])

  useEffect(() => {
    const timer = window.setInterval(() => setTimeNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const loadTicketActivity = async (silent = false) => {
    if (!selected) return
    if (!silent) {
      setTicketActivity([])
      setTicketActivityError('')
    }
    if (adminDemoMode || !selected.ticketThreadId) {
      setTicketActivityState('idle')
      return
    }
    if (!silent) setTicketActivityState('loading')
    try {
      const payload = await getSubmissionTicketActivity(selected.id)
      setTicketActivity(payload.messages)
      setTicketActivityState('ready')
    } catch (error) {
      setTicketActivityError(error instanceof AdminApiError ? error.message : 'Could not load Discord ticket activity.')
      setTicketActivityState('error')
    }
  }

  useEffect(() => {
    loadTicketActivity()
    if (adminDemoMode || !selected?.ticketThreadId) return
    const timer = window.setInterval(() => loadTicketActivity(true), 8_000)
    return () => window.clearInterval(timer)
  }, [selected?.id, selected?.ticketThreadId])

  const updateSelected = (updater: (submission: Submission) => Submission) => {
    if (!selected) return
    setSubmissions((current) => current.map((submission) => submission.id === selected.id ? updater(submission) : submission))
  }

  const claim = async () => {
    if (!selected || claimState === 'loading') return
    if (!canReview) {
      setClaimError('Review permission required.')
      return
    }
    setClaimError('')
    if (adminDemoMode) {
      updateSelected((submission) => ({
        ...submission,
        status: submission.status === 'New' ? 'In review' : submission.status,
        claimedBy: reviewerName,
        activity: [...submission.activity, {
          type: 'staff',
          author: reviewerName,
          body: 'Review claimed in the admin portal.',
          time: 'Just now',
        }],
      }))
      return
    }
    setClaimState('loading')
    try {
      const claimed = submissionFromApi(await claimAdminSubmission(selected.id))
      setSubmissions((current) => current.map((item) => item.id === claimed.id ? claimed : item))
    } catch (error) {
      setClaimError(error instanceof AdminApiError ? error.message : 'Could not claim this review.')
      if (error instanceof AdminApiError && error.claimedBy) {
        setSubmissions((current) => current.map((item) =>
          item.id === selected.id
            ? { ...item, claimedBy: error.claimedBy, claimedById: error.claimedById, status: 'In review' }
            : item
        ))
      }
    } finally {
      setClaimState('idle')
    }
  }

  const decide = async (status: SubmissionStatus, body: string) => {
    if (!selected || !canWriteSelected || actionState !== 'idle') return
    setClaimError('')
    if (adminDemoMode) {
      updateSelected((submission) => ({
        ...submission,
        status,
        claimedBy: submission.claimedBy ?? reviewerName,
        activity: [...submission.activity, { type: 'staff', author: reviewerName, body, time: 'Just now' }],
      }))
      return
    }
    const apiStatus = status === 'Waiting on player' ? 'waiting_on_player' : status === 'Denied' ? 'denied' : status === 'Approved' ? 'approved' : 'resolved'
    setActionState('decision')
    try {
      const updated = submissionFromApi(await decideAdminSubmission(selected.id, apiStatus, body))
      setSubmissions((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (error) {
      setClaimError(error instanceof AdminApiError ? error.message : 'Could not update this review.')
    } finally {
      setActionState('idle')
    }
  }

  const addNote = async () => {
    const text = note.trim()
    if (!selected || !canWriteSelected || !text || actionState !== 'idle') return
    setClaimError('')
    updateSelected((submission) => ({
      ...submission,
      notes: adminDemoMode ? [...submission.notes, { author: reviewerName, body: text, time: 'Just now' }] : submission.notes,
    }))
    if (adminDemoMode) {
      setNote('')
      return
    }
    setActionState('note')
    try {
      const updated = submissionFromApi(await addAdminSubmissionNote(selected.id, text))
      setSubmissions((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNote('')
    } catch (error) {
      setClaimError(error instanceof AdminApiError ? error.message : 'Could not add this staff note.')
    } finally {
      setActionState('idle')
    }
  }

  const sendTicketMessage = async () => {
    const content = ticketMessage.trim()
    if (!selected || !content || ticketSendState === 'sending') return
    setTicketActivityError('')
    if (adminDemoMode) {
      updateSelected((submission) => ({
        ...submission,
        activity: [...submission.activity, { type: 'staff', author: reviewerName, body: content, time: 'Just now' }],
      }))
      setTicketMessage('')
      return
    }
    setTicketSendState('sending')
    try {
      const sent = await sendSubmissionTicketMessage(selected.id, content)
      setTicketActivity((current) => [...current, sent])
      setTicketActivityState('ready')
      setTicketMessage('')
    } catch (error) {
      setTicketActivityError(error instanceof AdminApiError ? error.message : 'Could not send a Discord ticket message.')
      setTicketActivityState('error')
    } finally {
      setTicketSendState('idle')
    }
  }

  return (
    <div className={`admin-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar active={view} collapsed={sidebarCollapsed} openSubmissionCount={openSubmissionCount} workspace={workspace} user={user} mobileOpen={mobileNav} onClose={() => setMobileNav(false)} onNavigate={navigate} onSignOut={onSignOut} onToggleCollapse={toggleSidebar} />
      <header className="mobile-header">
        <button aria-label="Open navigation" onClick={() => setMobileNav(true)} type="button"><Menu /></button>
        <span>{workspace === 'global' ? 'SHD Admin' : workspace}</span>
        <div className="avatar">PL</div>
      </header>
      {view === 'global-overview' && <GlobalOverviewPage overview={overview} state={overviewState} submissions={submissions} onNavigate={navigate} />}
      {view === 'global-inbox' && <UnifiedInboxPage submissions={submissions} onNavigate={navigate} />}
      {view === 'global-staff' && <StaffAccessPage user={user} />}
      {view === 'global-integrations' && <IntegrationsPage />}
      {view === 'global-audit' && <AuditPage audit={auditPayload} state={auditState} submissions={submissions} />}
      {view === 'lifesteal-overview' && <LifestealOverviewPage submissions={submissions} onNavigate={navigate} />}
      {view === 'lifesteal-players' && <PlayersPage />}
      {view === 'lifesteal-events' && <LifestealEventsPage user={user} />}
      {view === 'lifesteal-staff-chat' && <LifestealStaffChatPage user={user} />}
      {view === 'general-overview' && <ProjectOverviewPage project="General Support" onOpenInbox={() => navigate('general-inbox')} />}
      {view === 'general-inbox' && <WorkspaceInboxPage project="General Support" />}
      {view === 'valorant-overview' && <ProjectOverviewPage project="Valorant" onOpenInbox={() => navigate('valorant-inbox')} />}
      {view === 'valorant-inbox' && <WorkspaceInboxPage project="Valorant" />}
      {['lifesteal-queue', 'lifesteal-applications', 'lifesteal-appeals', 'lifesteal-reports', 'lifesteal-support'].includes(view) && <main className={`workspace ${mobileDetail ? 'show-detail' : ''} ${activityVisible ? '' : 'activity-hidden'}`} style={workspaceStyle}>
        <section className="queue-pane">
          <header className="queue-header">
            <div>
              <span className="eyebrow">{activeType ?? 'Review Queue'}</span>
              <h1>{activeType ? queueTitle[activeType] : 'Submissions'}</h1>
            </div>
            <span className="queue-total">{visible.length}</span>
          </header>
          <div className="queue-tools">
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player or reference" />
            </label>
            {!activeType && <div className="filter-row" aria-label="Submission filters">
              {(['All', 'Application', 'Appeal', 'Player Report', 'Support'] as const).map((item) => (
                <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} type="button" key={item}>{item}</button>
              ))}
            </div>}
          </div>
          <div className="queue-list">
            {submissionState === 'loading' && <div className="empty-state"><Activity /><strong>Loading protected submissions...</strong></div>}
            {submissionState === 'error' && <div className="empty-state error"><FileWarning /><strong>Could not load submissions</strong><span>Check the bot API and admin session.</span></div>}
            {visible.map((submission) => (
              <QueueItem
                active={submission.id === selected.id}
                key={submission.id}
                onSelect={() => {
                  setSelectedId(submission.id)
                  setClaimError('')
                  setMobileDetail(true)
                }}
                submission={submission}
              />
            ))}
            {submissionState === 'ready' && visible.length === 0 && <div className="empty-state"><Inbox /><strong>No matching submissions</strong></div>}
          </div>
        </section>
        <button className="pane-resizer queue-resizer" aria-label="Resize submission queue" onPointerDown={(event) => startResize('queue', event)} type="button"><span /></button>
        {selected ? <><section className="review-pane">
          <ReviewHeader actionsLive={selectedSupportsAdminActions && canReview} actionLoading={actionState === 'decision'} activityVisible={activityVisible} claimLoading={claimState === 'loading'} staffId={user.id} staffName={reviewerName} submission={selected} onBack={() => setMobileDetail(false)} onClaim={claim} onDecide={decide} onToggleActivity={toggleActivity} />
          {claimError && <div className="review-alert"><FileWarning size={15} /><span>{claimError}</span><button aria-label="Dismiss claim error" onClick={() => setClaimError('')} type="button"><X size={14} /></button></div>}
          <div className="review-scroll">
            <section className="review-overview">
              <div className="identity-block">
                <img className="player-avatar" alt="" src={minecraftHeadUrl(selected.minecraft)} />
                <div>
                  <span className="eyebrow">Applicant</span>
                  <h2>{selected.minecraft}</h2>
                  <p>@{selected.discord}</p>
                </div>
              </div>
              <div className="quick-facts">
                <Fact label="Reference" value={selected.id} />
                <Fact label="Submitted" value={selected.submitted} />
                <Fact label="Reviewer" value={selected.claimedBy ?? 'Unclaimed'} />
              </div>
            </section>
            <section className="content-section">
              <div className="section-heading">
                <div><span className="eyebrow">Submission</span><h2>{selected.title}</h2></div>
                <StatusPill status={selected.status} />
              </div>
              <p className="summary">{selected.summary}</p>
              <dl className="field-grid">
                {selected.fields.map((field) => (
                  <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                ))}
              </dl>
            </section>
            <section className="content-section staff-notes-section">
              <div className="section-heading">
                <div><span className="eyebrow">Internal</span><h2>Staff Notes</h2></div>
                <span className="count-label">{selected.notes.length}</span>
              </div>
              <div className="notes-list">
                {selected.notes.map((item, index) => (
                  <article className="staff-note" key={`${item.time}-${index}`}>
                    <strong>{item.author}</strong><span>{item.time}</span><p>{item.body}</p>
                  </article>
                ))}
                {selected.notes.length === 0 && <p className="muted">No internal notes yet.</p>}
              </div>
              <div className="note-composer">
                <textarea disabled={!canWriteSelected || actionState === 'note'} value={note} onChange={(event) => setNote(event.target.value)} placeholder={selected.type === 'Application' ? 'Application notes stay in the Discord approval workflow...' : 'Add a private staff note...'} />
                <button aria-label="Add staff note" disabled={!canWriteSelected || actionState === 'note' || !note.trim()} onClick={addNote} title="Add staff note" type="button"><Send size={17} /></button>
              </div>
            </section>
          </div>
        </section>
        {activityVisible && <button className="pane-resizer activity-resizer" aria-label="Resize ticket activity" onPointerDown={(event) => startResize('activity', event)} type="button"><span /></button>}
        {activityVisible && <aside className="activity-pane">
          <header>
            <div><span className="eyebrow">Discord Context</span><h2>Ticket Activity</h2></div>
            <button aria-label="Refresh ticket activity" disabled={!selected.ticketThreadId || ticketActivityState === 'loading'} onClick={() => loadTicketActivity()} title="Refresh ticket activity" type="button"><RefreshCw size={17} /></button>
          </header>
          <div className={`sync-state ${ticketActivityState === 'error' ? 'error' : ''}`}><Activity size={15} /><span>{ticketSyncLabel}</span></div>
          {ticketActivityError && <div className="ticket-error"><FileWarning size={15} /><span>{ticketActivityError}</span></div>}
          <div className="activity-list">
            {combinedActivity.map((item, index) => (
              <article className={`activity-item ${item.type}`} key={item.id ?? `${item.time}-${index}`}>
                <div className="activity-icon">
                  {item.avatarUrl ? <img alt="" src={item.avatarUrl} /> : item.type === 'system' ? <Activity size={15} /> : item.type === 'staff' ? <ShieldCheck size={15} /> : <CircleUserRound size={15} />}
                </div>
                <div><strong>{item.author}</strong><span>{item.time}</span><p>{item.body}</p></div>
              </article>
            ))}
            {combinedActivity.length === 0 && <div className="panel-empty"><MessageSquareText size={17} /><span>No ticket activity yet.</span></div>}
          </div>
          <div className="ticket-composer">
            <textarea disabled={!canMessageTicket || ticketSendState === 'sending'} value={ticketMessage} onChange={(event) => setTicketMessage(event.target.value)} placeholder={selected.ticketThreadId ? 'Message the linked Discord ticket...' : 'No linked Discord ticket for this submission.'} />
            <button disabled={!canMessageTicket || ticketSendState === 'sending' || !ticketMessage.trim()} onClick={sendTicketMessage} type="button"><Send size={16} />{ticketSendState === 'sending' ? 'Sending' : 'Send to Discord'}</button>
          </div>
        </aside>}</> : <section className="review-pane empty-review"><Inbox /><strong>Select a submission</strong><p>Review details will appear here.</p></section>}
      </main>}
    </div>
  )
}

function Sidebar({ active, collapsed, openSubmissionCount, workspace, user, mobileOpen, onClose, onNavigate, onSignOut, onToggleCollapse }: {
  active: AdminView
  collapsed: boolean
  openSubmissionCount: number
  workspace: WorkspaceId
  user: AdminUser
  mobileOpen: boolean
  onClose: () => void
  onNavigate: (view: AdminView) => void
  onSignOut: () => void
  onToggleCollapse: () => void
}) {
  const [workspaceMenu, setWorkspaceMenu] = useState(false)
  const workspaces: Array<{ id: WorkspaceId; label: string; detail: string; icon: ReactNode; target: AdminView }> = [
    { id: 'global', label: 'SHD Global', detail: 'All operations', icon: <Building2 size={17} />, target: 'global-overview' },
    { id: 'lifesteal', label: 'Lifesteal', detail: 'Minecraft network', icon: <Gamepad2 size={17} />, target: 'lifesteal-overview' },
    { id: 'general', label: 'General Support', detail: 'Community guild', icon: <Headphones size={17} />, target: 'general-overview' },
    { id: 'valorant', label: 'Valorant', detail: 'Competitive team', icon: <Crosshair size={17} />, target: 'valorant-overview' },
  ]
  const availableWorkspaces = workspaces.filter((item) => user.workspaces.includes(item.id))
  const currentWorkspace = availableWorkspaces.find((item) => item.id === workspace) ?? availableWorkspaces[0]

  const switchWorkspace = (target: AdminView) => {
    setWorkspaceMenu(false)
    onNavigate(target)
  }

  return (
    <>
      {mobileOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={onClose} type="button" />}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <header className="brand">
          <img src={logo} alt="SHD" />
          <div className="brand-copy"><strong>SHD Admin</strong><span>Internal tools</span></div>
          <button className="sidebar-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} type="button">
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button className="mobile-close" aria-label="Close navigation" onClick={onClose} type="button"><X /></button>
        </header>
        <div className="workspace-switcher">
          <span>Workspace</span>
          <button
            aria-expanded={workspaceMenu}
            aria-haspopup="menu"
            className="workspace-current"
            onClick={() => setWorkspaceMenu((open) => !open)}
            type="button"
          >
            <span className="workspace-icon">{currentWorkspace.icon}</span>
            <span><strong>{currentWorkspace.label}</strong><small>{currentWorkspace.detail}</small></span>
            <ChevronDown className={workspaceMenu ? 'rotated' : ''} size={16} />
          </button>
          {workspaceMenu && <div className="workspace-menu" role="menu">
            {availableWorkspaces.map((item) => (
              <button className={item.id === workspace ? 'selected' : ''} key={item.id} onClick={() => switchWorkspace(item.target)} role="menuitem" type="button">
                <span className="workspace-icon">{item.icon}</span>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                {item.id === workspace && <Check size={15} />}
              </button>
            ))}
          </div>}
        </div>
        {workspace === 'global' && <>
          <nav>
            <NavButton active={active === 'global-overview'} icon={<LayoutDashboard size={18} />} label="Overview" onClick={() => onNavigate('global-overview')} />
            <NavButton active={active === 'global-inbox'} icon={<Inbox size={18} />} label="Unified Inbox" badge={String(openSubmissionCount)} onClick={() => onNavigate('global-inbox')} />
            <NavButton active={active === 'global-staff'} icon={<KeyRound size={18} />} label="Staff & Access" onClick={() => onNavigate('global-staff')} />
            <NavButton active={active === 'global-integrations'} icon={<Network size={18} />} label="Integrations" onClick={() => onNavigate('global-integrations')} />
            <NavButton active={active === 'global-audit'} icon={<Activity size={18} />} label="Global Audit" onClick={() => onNavigate('global-audit')} />
          </nav>
        </>}
        {workspace === 'lifesteal' && <>
          <nav>
            <NavButton active={active === 'lifesteal-overview'} icon={<LayoutDashboard size={18} />} label="Overview" onClick={() => onNavigate('lifesteal-overview')} />
            <NavButton active={active === 'lifesteal-queue'} icon={<Inbox size={18} />} label="Review Queue" badge={String(openSubmissionCount)} onClick={() => onNavigate('lifesteal-queue')} />
            <NavButton active={active === 'lifesteal-players'} icon={<Users size={18} />} label="Players" onClick={() => onNavigate('lifesteal-players')} />
            <NavButton active={active === 'lifesteal-events'} icon={<CalendarDays size={18} />} label="Events" onClick={() => onNavigate('lifesteal-events')} />
            <NavButton active={active === 'lifesteal-staff-chat'} icon={<MessageSquareText size={18} />} label="Staff Chat" onClick={() => onNavigate('lifesteal-staff-chat')} />
          </nav>
          <div className="sidebar-section">
            <span>Queues</span>
            <NavButton active={active === 'lifesteal-applications'} icon={<UserCheck size={17} />} label="Applications" onClick={() => onNavigate('lifesteal-applications')} />
            <NavButton active={active === 'lifesteal-appeals'} icon={<Ban size={17} />} label="Appeals" onClick={() => onNavigate('lifesteal-appeals')} />
            <NavButton active={active === 'lifesteal-reports'} icon={<FileWarning size={17} />} label="Reports" onClick={() => onNavigate('lifesteal-reports')} />
            <NavButton active={active === 'lifesteal-support'} icon={<LifeBuoy size={17} />} label="Support" onClick={() => onNavigate('lifesteal-support')} />
          </div>
        </>}
        {workspace === 'general' && <nav>
          <NavButton active={active === 'general-overview'} icon={<LayoutDashboard size={18} />} label="Overview" onClick={() => onNavigate('general-overview')} />
          <NavButton active={active === 'general-inbox'} icon={<Inbox size={18} />} label="Support Inbox" onClick={() => onNavigate('general-inbox')} />
        </nav>}
        {workspace === 'valorant' && <nav>
          <NavButton active={active === 'valorant-overview'} icon={<LayoutDashboard size={18} />} label="Overview" onClick={() => onNavigate('valorant-overview')} />
          <NavButton active={active === 'valorant-inbox'} icon={<Inbox size={18} />} label="Support Inbox" onClick={() => onNavigate('valorant-inbox')} />
        </nav>}
        <footer>
          <div className="staff-profile">
            <div className="avatar">{user.displayName.slice(0, 2).toUpperCase()}</div>
            <div><strong>{user.displayName}</strong><span>{user.role}</span></div>
          </div>
          <button aria-label="Sign out" onClick={onSignOut} title="Sign out" type="button"><LogOut size={17} /></button>
        </footer>
      </aside>
    </>
  )
}

function NavButton({ active, badge, icon, label, onClick }: {
  active: boolean
  badge?: string
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return <button aria-label={label} className={active ? 'active' : ''} onClick={onClick} title={label} type="button">{icon}<span className="nav-label">{label}</span>{badge && <span className="nav-badge">{badge}</span>}</button>
}

function GlobalOverviewPage({ overview, state, submissions, onNavigate }: {
  overview: AdminOverview | null
  state: 'loading' | 'ready' | 'error'
  submissions: Submission[]
  onNavigate: (view: AdminView) => void
}) {
  const demoOpen = submissions.filter((item) => !['Approved', 'Denied'].includes(item.status)).length
  const metrics = overview?.metrics ?? {
    openWork: demoOpen,
    openApplications: submissions.filter((item) => item.type === 'Application' && !['Approved', 'Denied'].includes(item.status)).length,
    openSupport: submissions.filter((item) => item.type !== 'Application' && !['Approved', 'Denied'].includes(item.status)).length,
    unclaimed: submissions.filter((item) => !item.claimedBy && !['Approved', 'Denied'].includes(item.status)).length,
    highPriority: submissions.filter((item) => item.priority === 'High' && !['Approved', 'Denied'].includes(item.status)).length,
    linkedPlayers: 5,
    activeWorkspaces: 1,
    totalWorkspaces: 3,
    botConnections: 1,
    totalBotConnections: 2,
    authorizedStaff: 2,
  }
  const projectData = new Map(overview?.projects.map((project) => [project.id, project]))
  const projects = [
    {
      id: 'lifesteal' as const,
      name: 'Lifesteal',
      description: 'Applications, appeals, reports, linked players, and the Minecraft bridge.',
      status: !projectData.has('lifesteal') || projectData.get('lifesteal')?.status === 'operational' ? 'Operational' : 'Needs attention',
      work: `${projectData.get('lifesteal')?.openWork ?? metrics.openWork} open reviews`,
      icon: Gamepad2,
      target: 'lifesteal-overview' as AdminView,
      tone: 'green',
    },
    {
      id: 'general' as const,
      name: 'General Support',
      description: 'Community support for SHD accounts, services, and general questions.',
      status: 'Frontend ready',
      work: projectData.get('general')?.detail ?? 'Inbox awaiting backend',
      icon: Headphones,
      target: 'general-overview' as AdminView,
      tone: 'blue',
    },
    {
      id: 'valorant' as const,
      name: 'Valorant',
      description: 'Competitive operations, player reports, appeals, and team support.',
      status: 'Workspace staged',
      work: projectData.get('valorant')?.detail ?? 'Workflows not active',
      icon: Crosshair,
      target: 'valorant-overview' as AdminView,
      tone: 'red',
    },
  ]
  const services = overview?.services ?? {
    adminApi: { status: 'online' as const, detail: 'Protected routes responding' },
    lifestealBot: { status: 'online' as const, detail: 'Minecraft guild and API bridge' },
    supportPortal: { status: 'online' as const, detail: `${metrics.openWork} open intake records` },
    minecraftBridge: { status: 'waiting' as const, detail: 'Gameplay sync state unavailable in demo mode' },
    shdBot: { status: 'pending' as const, detail: 'General Support and Valorant bot not connected' },
  }

  return (
    <main className="page-workspace">
      <PageHeader
        eyebrow="SHD Operations"
        title="Global Overview"
        detail="One staff surface across every SHD project, with each Discord guild and workflow kept in its own workspace."
        action={<button className="page-action" onClick={() => onNavigate('global-inbox')} type="button"><Inbox size={16} />Open unified inbox</button>}
      />
      {state === 'loading' && <div className="operations-state"><Activity size={16} /><span>Loading live operations...</span></div>}
      {state === 'error' && <div className="operations-state error"><FileWarning size={16} /><span>Live global metrics could not be loaded. Review the admin API connection.</span></div>}
      <section className="metric-grid">
        <MetricCard label="Open work" value={String(metrics.openWork)} detail={`${metrics.unclaimed} currently unclaimed`} icon={<Inbox size={18} />} />
        <MetricCard label="Active workspaces" value={`${metrics.activeWorkspaces} / ${metrics.totalWorkspaces}`} detail="Lifesteal live; General and Valorant staged" icon={<Building2 size={18} />} />
        <MetricCard label="Bot connections" value={`${metrics.botConnections} / ${metrics.totalBotConnections}`} detail="Lifesteal online, SHD bot pending" icon={<Bot size={18} />} />
        <MetricCard label="Authorized staff" value={String(metrics.authorizedStaff)} detail="Current Discord role access" icon={<ShieldCheck size={18} />} />
      </section>
      <section className="project-grid">
        {projects.map(({ id, name, description, status, work, icon: Icon, target, tone }) => (
          <button className="project-card" key={name} onClick={() => onNavigate(target)} type="button">
            <span className={`project-icon ${tone}`}><Icon size={20} /></span>
            <span className="project-copy">
              <span className="eyebrow">{status}</span>
              <strong>{name}</strong>
              <p>{description}</p>
            </span>
            <span className="project-footer"><span>{id === 'lifesteal' ? `${work} / ${metrics.linkedPlayers} linked players` : work}</span><ArrowLeft className="project-arrow" size={17} /></span>
          </button>
        ))}
      </section>
      <section className="overview-grid">
        <article className="dashboard-panel">
          <header><div><span className="eyebrow">Service map</span><h2>Connected Systems</h2></div><button onClick={() => onNavigate('global-integrations')} type="button">Manage</button></header>
          <div className="health-list">
            <HealthRow label="Admin API" detail={services.adminApi.detail} status={serviceStatus(services.adminApi.status)} muted={services.adminApi.status !== 'online'} />
            <HealthRow label="Lifesteal bot" detail={services.lifestealBot.detail} status={serviceStatus(services.lifestealBot.status)} muted={services.lifestealBot.status !== 'online'} />
            <HealthRow label="Support portal" detail={services.supportPortal.detail} status={serviceStatus(services.supportPortal.status)} muted={services.supportPortal.status !== 'online'} />
            <HealthRow label="Minecraft bridge" detail={formatServiceDetail(services.minecraftBridge.detail)} status={serviceStatus(services.minecraftBridge.status)} muted={services.minecraftBridge.status !== 'online'} />
            <HealthRow label="SHD bot" detail={services.shdBot.detail} status={serviceStatus(services.shdBot.status)} muted />
          </div>
        </article>
        <article className="dashboard-panel">
          <header><div><span className="eyebrow">Recent</span><h2>Operations Activity</h2></div><button onClick={() => onNavigate('global-audit')} type="button">Full audit</button></header>
          <div className="compact-activity">
            {(overview?.recentActivity ?? []).map((item) => (
              <ActivityRow actor={item.actor} action={item.action} target={item.target} time={relativeTime(item.createdAt)} key={item.id} />
            ))}
            {overview?.recentActivity.length === 0 && <div className="panel-empty"><Activity size={17} /><span>No audit activity recorded yet.</span></div>}
            {!overview && adminDemoMode && <>
              <ActivityRow actor="PrimeLuigi" action="claimed a review" target="SHD-APP-K8F2QZ" time="Just now" />
              <ActivityRow actor="Support Portal" action="received a player report" target="SHD-RPT-M4Q7VN" time="41m ago" />
            </>}
          </div>
        </article>
      </section>
    </main>
  )
}

function serviceStatus(status: 'online' | 'waiting' | 'pending') {
  return status === 'online' ? 'Online' : status === 'waiting' ? 'Waiting' : 'Pending'
}

function formatServiceDetail(detail: string) {
  const match = detail.match(/^Last gameplay sync (\d+)$/)
  return match ? `Last gameplay sync ${relativeTime(Number(match[1]))}` : detail
}

function UnifiedInboxPage({ submissions, onNavigate }: { submissions: Submission[]; onNavigate: (view: AdminView) => void }) {
  const active = submissions.filter((item) => !['Approved', 'Denied'].includes(item.status))
  return (
    <main className="page-workspace">
      <PageHeader eyebrow="Cross-project Work" title="Unified Inbox" detail="A single triage view for new work. Opening an item moves staff into the owning project workspace." />
      <section className="inbox-sources">
        <button onClick={() => onNavigate('lifesteal-queue')} type="button"><span className="project-icon green"><Gamepad2 size={18} /></span><span><strong>Lifesteal</strong><small>{active.length} open</small></span></button>
        <button onClick={() => onNavigate('general-inbox')} type="button"><span className="project-icon blue"><Headphones size={18} /></span><span><strong>General Support</strong><small>Backend pending</small></span></button>
        <button onClick={() => onNavigate('valorant-inbox')} type="button"><span className="project-icon red"><Crosshair size={18} /></span><span><strong>Valorant</strong><small>Workflows staged</small></span></button>
      </section>
      <section className="unified-list">
        <header><span>Workspace</span><span>Submission</span><span>Owner</span><span>Status</span><span>Received</span></header>
        {active.map((item) => (
          <button key={item.id} onClick={() => onNavigate('lifesteal-queue')} type="button">
            <span className="workspace-tag"><Gamepad2 size={14} />Lifesteal</span>
            <span><strong>{item.title}</strong><small>{item.minecraft} · {item.id}</small></span>
            <span>{item.claimedBy ?? 'Unclaimed'}</span>
            <StatusPill status={item.status} />
            <time>{item.submitted}</time>
          </button>
        ))}
      </section>
    </main>
  )
}

function permissionLabel(permission: string) {
  const labels: Record<string, string> = {
    'global:audit': 'Global Audit',
    'integrations:read': 'Integrations',
    'staff:read': 'Staff Read',
    'staff:manage': 'Staff Manage',
    'lifesteal:read': 'Lifesteal Read',
    'lifesteal:review': 'Review Queue',
    'lifesteal:ticket': 'Ticket Messages',
    'lifesteal:players': 'Player Manager',
    'lifesteal:events': 'Event Manager',
    'lifesteal:staff-chat': 'Staff Chat',
  }
  return labels[permission] ?? permission
}

type StaffWorkspaceId = 'global' | 'lifesteal' | 'general' | 'valorant'
type StaffDirectoryMember = {
  id: string
  name: string
  discord: string
  discordId: string
  role: string
  workspaces: StaffWorkspaceId[]
  permissions: string[]
  status: 'Active' | 'Limited' | 'Invite pending' | 'Review'
  trust: 'Full' | 'Scoped' | 'Pending'
  source: string
  lastActive: number
  notes: string
}

const workspaceMeta: Record<StaffWorkspaceId, { label: string; detail: string; icon: ReactNode }> = {
  global: { label: 'Global', detail: 'Audit, staff access, integrations', icon: <Building2 size={16} /> },
  lifesteal: { label: 'Lifesteal', detail: 'Minecraft reviews, players, events', icon: <Gamepad2 size={16} /> },
  general: { label: 'General', detail: 'SHD-wide support workspace', icon: <Headphones size={16} /> },
  valorant: { label: 'Valorant', detail: 'Competitive support workspace', icon: <Crosshair size={16} /> },
}

const rolePolicies = [
  { role: 'Owner', detail: 'Full platform ownership across every workspace.', permissions: ['global:audit', 'staff:manage', 'lifesteal:review', 'lifesteal:players', 'lifesteal:events'] },
  { role: 'Admin', detail: 'Operational control without owner-only staff changes.', permissions: ['global:audit', 'lifesteal:review', 'lifesteal:players', 'lifesteal:events'] },
  { role: 'Mod', detail: 'Queue work, ticket responses, reports, and player support.', permissions: ['lifesteal:review', 'lifesteal:ticket', 'lifesteal:staff-chat'] },
  { role: 'SHD Team', detail: 'Scoped helper access for project-specific operations.', permissions: ['lifesteal:read', 'lifesteal:staff-chat'] },
]

function StaffAccessPage({ user }: { user: AdminUser }) {
  const staff = useMemo<StaffDirectoryMember[]>(() => {
    const currentWorkspaces = user.workspaces.filter((workspace): workspace is StaffWorkspaceId => workspace in workspaceMeta)
    return [
      {
        id: user.id,
        name: user.displayName,
        discord: `@${user.username}`,
        discordId: user.id,
        role: user.role,
        workspaces: currentWorkspaces.length ? currentWorkspaces : ['global', 'lifesteal'],
        permissions: user.permissions,
        status: 'Active',
        trust: 'Full',
        source: 'Discord OAuth session',
        lastActive: Date.now() - 2 * 60_000,
        notes: 'Current signed-in staff identity. Owner-level changes should remain audited.',
      },
      {
        id: '1224803434675572827',
        name: 'TlzMax5454',
        discord: '@tlzmax5454',
        discordId: '1224803434675572827',
        role: 'Owner',
        workspaces: ['global', 'lifesteal', 'general', 'valorant'],
        permissions: user.permissions,
        status: 'Active',
        trust: 'Full',
        source: 'Manual owner allowlist',
        lastActive: Date.now() - 24 * 60_000,
        notes: 'Full admin portal access approved for project ownership and live operations.',
      },
      {
        id: 'staff-xvoidism',
        name: 'xvoidism',
        discord: '@voidism',
        discordId: 'pending-discord-id',
        role: 'SHD Team',
        workspaces: ['lifesteal'],
        permissions: ['lifesteal:read', 'lifesteal:staff-chat'],
        status: 'Active',
        trust: 'Scoped',
        source: 'Lifesteal staff role',
        lastActive: Date.now() - 3 * 60 * 60_000,
        notes: 'Season staff access is scoped to Lifesteal visibility and staff communication.',
      },
      {
        id: 'staff-review-bot',
        name: 'Review Bot',
        discord: '@shd-lifesteal-bot',
        discordId: 'bot-service',
        role: 'Service',
        workspaces: ['lifesteal'],
        permissions: ['lifesteal:read', 'lifesteal:ticket', 'lifesteal:players', 'lifesteal:events'],
        status: 'Limited',
        trust: 'Scoped',
        source: 'Bot token service',
        lastActive: Date.now() - 9 * 60_000,
        notes: 'Service identity for ticket bridge, roster state, event publishing, and audit events.',
      },
      {
        id: 'staff-general-staged',
        name: 'General Support Lead',
        discord: '@pending',
        discordId: 'pending',
        role: 'Admin',
        workspaces: ['general', 'valorant'],
        permissions: ['integrations:read'],
        status: 'Invite pending',
        trust: 'Pending',
        source: 'Future guild bot',
        lastActive: Date.now() - 2 * 24 * 60 * 60_000,
        notes: 'Placeholder for the second Discord guild once General and Valorant workflows connect.',
      },
    ]
  }, [user])
  const [query, setQuery] = useState('')
  const [workspaceFilter, setWorkspaceFilter] = useState<'all' | StaffWorkspaceId>('all')
  const [selectedId, setSelectedId] = useState(user.id)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteDraft, setInviteDraft] = useState<{ discordId: string; displayName: string; role: string; workspaces: StaffWorkspaceId[] }>({ discordId: '', displayName: '', role: 'SHD Team', workspaces: ['lifesteal'] })
  const [inviteMessage, setInviteMessage] = useState('')

  const visibleStaff = staff.filter((member) => {
    const needle = query.trim().toLowerCase()
    const matchesQuery = !needle || [member.name, member.discord, member.role, member.discordId].some((value) => value.toLowerCase().includes(needle))
    const matchesWorkspace = workspaceFilter === 'all' || member.workspaces.includes(workspaceFilter)
    return matchesQuery && matchesWorkspace
  })
  const selected = staff.find((member) => member.id === selectedId) ?? visibleStaff[0] ?? staff[0]
  const ownerCount = staff.filter((member) => member.role === 'Owner').length
  const activeCount = staff.filter((member) => member.status === 'Active').length
  const pendingCount = staff.filter((member) => member.status !== 'Active').length
  const protectedActions = user.permissions.filter((permission) => permission.includes(':manage') || permission.includes(':players') || permission.includes(':events')).length
  const toggleInviteWorkspace = (workspace: StaffWorkspaceId) => {
    setInviteDraft((current) => ({
      ...current,
      workspaces: current.workspaces.includes(workspace)
        ? current.workspaces.filter((item) => item !== workspace)
        : [...current.workspaces, workspace],
    }))
  }
  const createInviteDraft = () => {
    const label = inviteDraft.displayName.trim() || inviteDraft.discordId.trim() || 'New staff member'
    setInviteMessage(`${label} invite draft staged for ${inviteDraft.workspaces.map((workspace) => workspaceMeta[workspace].label).join(', ')}.`)
    setInviteOpen(false)
  }

  return (
    <main className="page-workspace staff-access-page">
      <PageHeader eyebrow="Authorization" title="Staff & Access" detail="Discord remains the identity source; the admin portal translates guild roles into explicit workspace permissions." action={<div className="page-actions"><button className="page-action" onClick={() => setInviteOpen(true)} type="button"><UserCheck size={16} />Invite staff</button><button className="page-action secondary" type="button"><ShieldCheck size={16} />Review roles</button></div>} />
      <section className="access-command-grid">
        <article><Users size={18} /><span>Authorized staff</span><strong>{staff.length}</strong><p>{activeCount} active identities</p></article>
        <article><KeyRound size={18} /><span>Owners</span><strong>{ownerCount}</strong><p>Full platform access</p></article>
        <article><LockKeyhole size={18} /><span>Protected actions</span><strong>{protectedActions}</strong><p>High impact permissions on this session</p></article>
        <article><FileWarning size={18} /><span>Needs review</span><strong>{pendingCount}</strong><p>Pending or limited access states</p></article>
      </section>
      <section className="access-hero-grid">
        <article className="current-access-card">
          <div>
            <span className="eyebrow">Current Session</span>
            <h2>{user.displayName}</h2>
            <p>{user.role} access from Discord OAuth. Session refreshes through the admin API.</p>
          </div>
          <div className="scope-list">
            {user.permissions.map((permission) => <small key={permission}>{permissionLabel(permission)}</small>)}
          </div>
        </article>
        <article className="access-health-card">
          <header><div><span className="eyebrow">Access Model</span><h2>Role source of truth</h2></div><span className="service-state live"><span />Protected</span></header>
          <div className="access-health-list">
            <div><CheckCircle2 size={15} /><span><strong>Discord OAuth</strong><small>Login identity and avatar source</small></span></div>
            <div><CheckCircle2 size={15} /><span><strong>Workspace scopes</strong><small>Navigation and API routes stay isolated</small></span></div>
            <div><CheckCircle2 size={15} /><span><strong>Audit trail</strong><small>Claims, decisions, player edits, and event actions</small></span></div>
          </div>
        </article>
      </section>
      {inviteMessage && <div className="operations-state"><CheckCircle2 size={16} /><span>{inviteMessage}</span></div>}
      <section className="staff-access-layout">
        <article className="staff-directory-panel">
          <header>
            <div><span className="eyebrow">Directory</span><h2>Staff identities</h2></div>
            <span>{visibleStaff.length}</span>
          </header>
          <div className="staff-access-toolbar">
            <label className="event-search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff..." /></label>
            <div className="event-status-filters">
              {(['all', 'global', 'lifesteal', 'general', 'valorant'] as const).map((workspace) => (
                <button className={workspaceFilter === workspace ? 'active' : ''} key={workspace} onClick={() => setWorkspaceFilter(workspace)} type="button">{workspace === 'all' ? 'All' : workspaceMeta[workspace].label}</button>
              ))}
            </div>
          </div>
          <div className="staff-roster-list">
            {visibleStaff.map((member) => (
              <button className={selected.id === member.id ? 'active' : ''} key={member.id} onClick={() => setSelectedId(member.id)} type="button">
                <span className="avatar">{member.name.slice(0, 2).toUpperCase()}</span>
                <span><strong>{member.name}</strong><small>{member.discord} / {member.role}</small></span>
                <span className={`access-state ${member.status.toLowerCase().replaceAll(' ', '-')}`}>{member.status}</span>
              </button>
            ))}
            {visibleStaff.length === 0 && <div className="panel-empty"><UserRoundSearch size={17} /><span>No staff identities match the current filter.</span></div>}
          </div>
        </article>
        <aside className="staff-detail-card">
          <header>
            <span className="avatar large">{selected.name.slice(0, 2).toUpperCase()}</span>
            <div><span className="eyebrow">{selected.role}</span><h2>{selected.name}</h2><p>{selected.discord} / {selected.discordId}</p></div>
          </header>
          <div className="staff-detail-actions">
            <button type="button"><KeyRound size={15} />Copy ID</button>
            <button type="button"><Activity size={15} />Audit</button>
            <button type="button"><Settings2 size={15} />Edit</button>
          </div>
          <div className="staff-detail-facts">
            <div><span>Status</span><strong>{selected.status}</strong></div>
            <div><span>Trust</span><strong>{selected.trust}</strong></div>
            <div><span>Source</span><strong>{selected.source}</strong></div>
            <div><span>Last active</span><strong>{relativeTime(selected.lastActive)}</strong></div>
          </div>
          <section>
            <span className="eyebrow">Workspaces</span>
            <div className="workspace-chip-grid">
              {selected.workspaces.map((workspace) => <span key={workspace}>{workspaceMeta[workspace].icon}<strong>{workspaceMeta[workspace].label}</strong><small>{workspaceMeta[workspace].detail}</small></span>)}
            </div>
          </section>
          <section>
            <span className="eyebrow">Permissions</span>
            <div className="scope-list">{selected.permissions.map((permission) => <small key={permission}>{permissionLabel(permission)}</small>)}</div>
          </section>
          <section className="staff-note-card"><span className="eyebrow">Access note</span><p>{selected.notes}</p></section>
        </aside>
      </section>
      <section className="role-policy-grid">
        {rolePolicies.map((policy) => (
          <article key={policy.role}>
            <header><ShieldCheck size={18} /><strong>{policy.role}</strong></header>
            <p>{policy.detail}</p>
            <div className="scope-list">{policy.permissions.map((permission) => <small key={permission}>{permissionLabel(permission)}</small>)}</div>
          </article>
        ))}
      </section>
      <section className="workspace-access-matrix">
        <header><div><span className="eyebrow">Workspace Matrix</span><h2>Coverage by project</h2></div></header>
        {Object.entries(workspaceMeta).map(([id, meta]) => {
          const members = staff.filter((member) => member.workspaces.includes(id as StaffWorkspaceId))
          return <article key={id}>
            <span>{meta.icon}<strong>{meta.label}</strong><small>{meta.detail}</small></span>
            <div className="scope-list">{members.map((member) => <small key={member.id}>{member.name}</small>)}</div>
          </article>
        })}
      </section>
      {inviteOpen && <div className="modal-layer">
        <section className="admin-modal staff-invite-modal">
          <header><div><span className="eyebrow">Access Draft</span><h2>Invite staff</h2><p>Draft the intended role and workspace scope before the backend creates Discord-backed access.</p></div><button aria-label="Close invite modal" onClick={() => setInviteOpen(false)} type="button"><X size={17} /></button></header>
          <div className="manual-player-grid">
            <label><span>Discord ID</span><input value={inviteDraft.discordId} onChange={(event) => setInviteDraft((current) => ({ ...current, discordId: event.target.value }))} placeholder="1224..." /></label>
            <label><span>Display name</span><input value={inviteDraft.displayName} onChange={(event) => setInviteDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="Staff name" /></label>
            <label><span>Portal role</span><select value={inviteDraft.role} onChange={(event) => setInviteDraft((current) => ({ ...current, role: event.target.value }))}><option>Owner</option><option>Admin</option><option>Mod</option><option>SHD Team</option></select></label>
          </div>
          <div className="invite-workspace-list">
            {Object.entries(workspaceMeta).map(([id, meta]) => {
              const workspace = id as StaffWorkspaceId
              return <label key={workspace}><input checked={inviteDraft.workspaces.includes(workspace)} onChange={() => toggleInviteWorkspace(workspace)} type="checkbox" /><span>{meta.icon}<strong>{meta.label}</strong><small>{meta.detail}</small></span></label>
            })}
          </div>
          <footer><button className="page-action secondary" onClick={() => setInviteOpen(false)} type="button">Cancel</button><button className="page-action" disabled={!inviteDraft.discordId.trim() && !inviteDraft.displayName.trim()} onClick={createInviteDraft} type="button"><UserPlus size={16} />Create draft</button></footer>
        </section>
      </div>}
    </main>
  )
}

function IntegrationsPage() {
  const integrations = [
    { name: 'Lifesteal Bot', scope: 'Lifesteal Discord guild', detail: 'Tickets, role sync, approvals, roster state, and Minecraft actions.', state: 'Online', icon: Gamepad2, live: true },
    { name: 'SHD Bot', scope: 'General + Valorant Discord guild', detail: 'Future general support, Valorant reports, appeals, and staff notifications.', state: 'Backend pending', icon: Headphones, live: false },
    { name: 'Shared Admin API', scope: 'All workspaces', detail: 'Central authorization, review state, audit events, and action dispatch.', state: 'Planned', icon: Network, live: false },
    { name: 'Support Portal', scope: 'Public intake', detail: 'Minecraft forms are ready to feed the shared review platform.', state: 'Online', icon: LifeBuoy, live: true },
  ]
  return (
    <main className="page-workspace">
      <PageHeader eyebrow="Platform" title="Integrations" detail="Two guild bots can stay independent while one admin backend owns authorization, review state, and cross-project actions." action={<button className="page-action secondary" type="button"><Settings2 size={16} />Configuration</button>} />
      <section className="integration-grid">
        {integrations.map(({ name, scope, detail, state, icon: Icon, live }) => (
          <article key={name}>
            <header><span className="integration-icon"><Icon size={20} /></span><span className={`service-state ${live ? 'live' : ''}`}><span />{state}</span></header>
            <span className="eyebrow">{scope}</span>
            <h2>{name}</h2>
            <p>{detail}</p>
            <footer><span>Secrets isolated per service</span><button aria-label={`Configure ${name}`} title="Configure" type="button"><Settings2 size={16} /></button></footer>
          </article>
        ))}
      </section>
      <article className="architecture-strip">
        <span><CircleUserRound size={18} /><strong>Discord OAuth</strong></span>
        <i />
        <span><Building2 size={18} /><strong>Admin API</strong></span>
        <i />
        <span><Bot size={18} /><strong>Two guild bots</strong></span>
        <i />
        <span><Activity size={18} /><strong>Live ticket updates</strong></span>
      </article>
    </main>
  )
}

function ProjectOverviewPage({ project, onOpenInbox }: { project: 'General Support' | 'Valorant'; onOpenInbox: () => void }) {
  const general = project === 'General Support'
  const Icon = general ? Headphones : Crosshair
  return (
    <main className="page-workspace">
      <PageHeader
        eyebrow={`${project} Workspace`}
        title={project}
        detail={general
          ? 'The home for community questions and SHD-wide support that does not belong to a game-specific workflow.'
          : 'A dedicated operational surface for competitive team support, reports, appeals, and future event workflows.'}
        action={<button className="page-action" onClick={onOpenInbox} type="button"><Inbox size={16} />Open inbox</button>}
      />
      <section className="project-hero-panel">
        <span className={`project-icon ${general ? 'blue' : 'red'}`}><Icon size={24} /></span>
        <div><span className="eyebrow">Frontend workspace ready</span><h2>Clear boundary, shared platform.</h2><p>This workspace will use the same login, staff permissions, review state, and audit system without coupling its Discord bot to Lifesteal.</p></div>
      </section>
      <section className="permission-summary">
        <article><Inbox size={19} /><strong>Intake queue</strong><p>{general ? 'General support requests and account questions.' : 'Reports, appeals, and competitive support.'}</p></article>
        <article><Bot size={19} /><strong>Guild bot</strong><p>Discord ticket updates remain native to the owning community.</p></article>
        <article><Activity size={19} /><strong>Shared audit</strong><p>Every staff action still appears in the global accountability trail.</p></article>
      </section>
    </main>
  )
}

function WorkspaceInboxPage({ project }: { project: 'General Support' | 'Valorant' }) {
  const general = project === 'General Support'
  return (
    <main className="page-workspace">
      <PageHeader eyebrow={`${project} Workspace`} title="Support Inbox" detail={`The ${project} review queue is structurally ready for its backend intake and Discord ticket bridge.`} />
      <section className="empty-workspace">
        <span className={`project-icon ${general ? 'blue' : 'red'}`}>{general ? <Headphones size={22} /> : <Crosshair size={22} />}</span>
        <span className="eyebrow">No live source connected</span>
        <h2>Queue ready for real submissions.</h2>
        <p>The frontend intentionally stays empty until the shared admin API and the second guild bot are connected.</p>
      </section>
    </main>
  )
}

function LifestealStaffChatPage({ user }: { user: AdminUser }) {
  const demoMessages: StaffChatMessage[] = [
    { id: 'demo-chat-1', authorId: 'staff-1', authorName: 'PrimeLuigi', authorAvatarUrl: null, content: 'Event launch checklist is almost clean. Website and support flows are the current focus.', createdAt: Date.now() - 18 * 60_000 },
    { id: 'demo-chat-2', authorId: 'staff-2', authorName: 'TlzMax5454', authorAvatarUrl: null, content: 'Roster state looks good. Waiting on final ticket copy polish.', createdAt: Date.now() - 9 * 60_000 },
  ]
  const [messages, setMessages] = useState<StaffChatMessage[]>(adminDemoMode ? demoMessages : [])
  const [message, setMessage] = useState('')
  const [channelName, setChannelName] = useState(adminDemoMode ? 'lifesteal-staff' : '')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(adminDemoMode ? 'ready' : 'loading')
  const [sendState, setSendState] = useState<'idle' | 'sending'>('idle')
  const [error, setError] = useState('')
  const [timeNow, setTimeNow] = useState(Date.now())

  const loadChat = async (silent = false) => {
    if (adminDemoMode) return
    if (!silent) {
      setState('loading')
      setError('')
    }
    try {
      const payload = await getLifestealStaffChat()
      setMessages(payload.messages)
      setChannelName(payload.channelName)
      setState('ready')
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : 'Could not load staff chat.')
      setState('error')
    }
  }

  useEffect(() => {
    loadChat()
    if (adminDemoMode) return
    const timer = window.setInterval(() => loadChat(true), 8_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setTimeNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const sendMessage = async () => {
    const content = message.trim()
    if (!content || sendState === 'sending') return
    setError('')
    if (adminDemoMode) {
      setMessages((current) => [...current, {
        id: `demo-chat-${Date.now()}`,
        authorId: user.id,
        authorName: `${user.displayName} via Admin Portal`,
        authorAvatarUrl: user.avatarUrl,
        content,
        createdAt: Date.now(),
      }])
      setMessage('')
      return
    }
    setSendState('sending')
    try {
      const sent = await sendLifestealStaffChatMessage(content)
      setMessages((current) => [...current, sent])
      setMessage('')
    } catch (sendError) {
      setError(sendError instanceof AdminApiError ? sendError.message : 'Could not send staff message.')
    } finally {
      setSendState('idle')
    }
  }

  return (
    <main className="page-workspace staff-chat-page">
      <PageHeader
        eyebrow="Lifesteal Staff"
        title="Staff Chat"
        detail="A protected bridge into the configured Lifesteal Discord staff channel."
        action={<button className="page-action secondary" disabled={state === 'loading'} onClick={() => loadChat()} type="button"><RefreshCw size={16} />Refresh</button>}
      />
      <section className="staff-chat-shell">
        <header>
          <div><span className="eyebrow">Discord Bridge</span><h2>#{channelName || 'not configured'}</h2></div>
          <span className={`service-state ${state === 'ready' ? 'live' : ''}`}><span />{state === 'ready' ? 'Connected' : state === 'loading' ? 'Loading' : 'Needs attention'}</span>
        </header>
        {error && <div className="operations-state error"><FileWarning size={16} /><span>{error}</span></div>}
        <div className="staff-chat-list" aria-live="polite">
          {state === 'loading' && messages.length === 0 && <div className="panel-empty"><Activity size={17} /><span>Loading staff messages...</span></div>}
          {messages.map((item) => {
            const rendered = portalMessageParts(item.content)
            return <article className={item.authorId === user.id ? 'own' : ''} key={item.id}>
              <ChatAvatar name={item.authorName} src={item.authorAvatarUrl} />
              <div>
                <header><strong>{rendered.label || item.authorName}</strong><time>{relativeTime(item.createdAt, timeNow)}</time></header>
                <p>{rendered.body}</p>
              </div>
            </article>
          })}
          {state !== 'loading' && messages.length === 0 && <div className="panel-empty"><MessageSquareText size={17} /><span>No staff messages found.</span></div>}
        </div>
        <div className="staff-chat-composer">
          <textarea value={message} maxLength={1500} onChange={(event) => setMessage(event.target.value)} placeholder="Send a message to Lifesteal staff..." />
          <button disabled={!message.trim() || sendState === 'sending'} onClick={sendMessage} type="button"><Send size={16} />{sendState === 'sending' ? 'Sending' : 'Send'}</button>
        </div>
      </section>
    </main>
  )
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <article className="metric-card"><div><span>{label}</span>{icon}</div><strong>{value}</strong><p>{detail}</p></article>
}

function LifestealOverviewPage({ submissions, onNavigate }: { submissions: Submission[]; onNavigate: (view: AdminView) => void }) {
  const open = submissions.filter((item) => !['Approved', 'Denied'].includes(item.status)).length
  const unclaimed = submissions.filter((item) => !item.claimedBy && !['Approved', 'Denied'].includes(item.status)).length
  const highPriority = submissions.filter((item) => item.priority === 'High' && !['Approved', 'Denied'].includes(item.status)).length
  const metrics = [
    { label: 'Open reviews', value: String(open), detail: 'Across every Minecraft workflow', icon: Inbox },
    { label: 'Unclaimed', value: String(unclaimed), detail: 'Waiting for a staff owner', icon: UserRoundSearch },
    { label: 'High priority', value: String(highPriority), detail: 'Appeals or reports needing attention', icon: FileWarning },
    { label: 'Bot bridge', value: 'Online', detail: 'Last staff sync 18 seconds ago', icon: Activity },
  ]
  return (
    <main className="page-workspace">
      <PageHeader eyebrow="Lifesteal Operations" title="Overview" detail="Minecraft reviews, player access, service health, and staff activity." />
      <section className="metric-grid">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <article className="metric-card" key={label}>
            <div><span>{label}</span><Icon size={18} /></div>
            <strong>{value}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </section>
      <section className="overview-grid">
        <article className="dashboard-panel">
          <header><div><span className="eyebrow">Workload</span><h2>Queue Breakdown</h2></div><button onClick={() => onNavigate('lifesteal-queue')} type="button">Open queue</button></header>
          <div className="queue-breakdown">
            {(['Application', 'Appeal', 'Player Report', 'Support'] as SubmissionType[]).map((type) => {
              const count = submissions.filter((item) => item.type === type && !['Approved', 'Denied'].includes(item.status)).length
              const total = Math.max(1, submissions.filter((item) => item.type === type).length)
              return (
                <div key={type}>
                  <div><strong>{type}</strong><span>{count} open</span></div>
                  <div className="progress-track"><i style={{ width: `${Math.max(8, count / total * 100)}%` }} /></div>
                </div>
              )
            })}
          </div>
        </article>
        <article className="dashboard-panel">
          <header><div><span className="eyebrow">Integrations</span><h2>System Health</h2></div><span className="health-label"><CheckCircle2 size={14} />Healthy</span></header>
          <div className="health-list">
            <HealthRow label="Discord bot" detail="Connected to SHD guild" status="Online" />
            <HealthRow label="Support API" detail="Public intake responding" status="Online" />
            <HealthRow label="Minecraft bridge" detail="Last gameplay sync 32s ago" status="Online" />
            <HealthRow label="Admin storage" detail="Frontend prototype data" status="Mock" muted />
          </div>
        </article>
        <article className="dashboard-panel wide">
          <header><div><span className="eyebrow">Recent</span><h2>Review Activity</h2></div><button onClick={() => onNavigate('global-audit')} type="button">Full audit</button></header>
          <div className="compact-activity">
            <ActivityRow actor="PrimeLuigi" action="approved application" target="SHD-APP-7UZ5CY" time="Yesterday, 21:14" />
            <ActivityRow actor="TlzMax5454" action="claimed appeal" target="SHD-APL-3JD91P" time="15:03" />
            <ActivityRow actor="Discord Bot" action="retried whitelist sync" target="NovaForge" time="14:19" />
            <ActivityRow actor="Support Portal" action="received private report" target="SHD-RPT-M4Q7VN" time="14:35" />
          </div>
        </article>
      </section>
    </main>
  )
}

const defaultEventForm = {
  title: 'Event Start',
  startsAt: '2026-07-01T12:00',
  endsAt: '',
  type: 'Server Start',
  reward: 'Season 1 begins',
  objective: 'The server opens for the first public Season 1 session.',
  summary: 'The countdown to Season 1. We are looking forward to starting the server together at this time.',
  priority: '0',
  status: 'scheduled' as AdminLifestealEvent['status'],
  public: true,
  announce: false,
}

function inputDateTime(timestamp: number | null) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function dateTimeValue(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function adminEventDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp)
}

function adminEventTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(timestamp)
}

function adminEventDistance(timestamp: number, now = Date.now()) {
  const delta = timestamp - now
  const abs = Math.abs(delta)
  const minutes = Math.floor(abs / 60_000)
  const prefix = delta >= 0 ? 'In ' : ''
  const suffix = delta >= 0 ? '' : ' ago'
  if (minutes < 1) return delta >= 0 ? 'Starting now' : 'Just started'
  if (minutes < 60) return `${prefix}${minutes}m${suffix}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${prefix}${hours}h${suffix}`
  const days = Math.floor(hours / 24)
  return `${prefix}${days}d${suffix}`
}

function eventFormFromEvent(event: AdminLifestealEvent) {
  return {
    title: event.title,
    startsAt: inputDateTime(event.startsAt),
    endsAt: inputDateTime(event.endsAt),
    type: event.type,
    reward: event.reward,
    objective: event.objective,
    summary: event.summary,
    priority: String(event.priority),
    status: event.status,
    public: event.public,
    announce: event.announce,
  }
}

function eventPayloadFromForm(form: typeof defaultEventForm): UpsertAdminLifestealEventPayload {
  return {
    title: form.title.trim(),
    startsAt: dateTimeValue(form.startsAt),
    endsAt: form.endsAt ? dateTimeValue(form.endsAt) : null,
    type: form.type.trim(),
    reward: form.reward.trim(),
    objective: form.objective.trim(),
    summary: form.summary.trim(),
    priority: Number(form.priority) || 10,
    status: form.status,
    public: form.public,
    announce: form.announce,
  }
}

function LifestealEventsPage({ user }: { user: AdminUser }) {
  const demoEvents: AdminLifestealEvent[] = [
    { id: 1, title: 'Event Start', startsAt: Date.UTC(2026, 6, 1, 10, 0, 0), endsAt: null, type: 'Server Start', reward: 'Season 1 begins', objective: 'The server opens for the first public Season 1 session.', summary: 'The countdown to Season 1. We are looking forward to starting the server together at this time.', priority: 0, status: 'scheduled', public: true, announce: false, announcementMessageId: null, createdBy: 'demo', createdAt: Date.now(), updatedBy: 'demo', updatedAt: Date.now() },
    { id: 2, title: 'Grace Period', startsAt: Date.UTC(2026, 6, 1, 10, 0, 0), endsAt: Date.UTC(2026, 6, 1, 11, 0, 0), type: 'Protection Window', reward: 'Safe first hour', objective: 'PvP, combat tags, lifesteal, heart loss, eliminations, and revivals stay disabled for the first hour.', summary: 'The first hour gives players time to spread out, prepare, and settle into the season before combat turns on.', priority: 1, status: 'scheduled', public: true, announce: false, announcementMessageId: null, createdBy: 'demo', createdAt: Date.now(), updatedBy: 'demo', updatedAt: Date.now() },
    { id: 3, title: 'End Opening', startsAt: Date.UTC(2026, 6, 8, 10, 0, 0), endsAt: null, type: 'End Event', reward: 'Dragon Egg race begins', objective: 'The End opens exactly seven days after server start.', summary: 'The first major objective fight opens the End and begins the race for the Dragon Egg.', priority: 0, status: 'scheduled', public: true, announce: false, announcementMessageId: null, createdBy: 'demo', createdAt: Date.now(), updatedBy: 'demo', updatedAt: Date.now() },
    { id: 4, title: 'Dragon Egg = Mace', startsAt: Date.UTC(2026, 6, 8, 10, 0, 0), endsAt: Date.UTC(2026, 6, 10, 10, 0, 0), type: 'Objective Challenge', reward: 'Mace conversion', objective: 'Survive the End fight, carry the egg out of the End, and stay alive for 48 hours.', summary: 'Survive the End fight, carry the egg out of the End, and stay alive for 48 hours!', priority: 1, status: 'scheduled', public: true, announce: false, announcementMessageId: null, createdBy: 'demo', createdAt: Date.now(), updatedBy: 'demo', updatedAt: Date.now() },
  ]
  const canManage = adminDemoMode || user.permissions.includes('lifesteal:events')
  const [events, setEvents] = useState<AdminLifestealEvent[]>(adminDemoMode ? demoEvents : [])
  const [selectedId, setSelectedId] = useState<number | null>(adminDemoMode ? demoEvents[0].id : null)
  const selected = events.find((event) => event.id === selectedId) ?? null
  const [form, setForm] = useState(defaultEventForm)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(adminDemoMode ? 'ready' : 'loading')
  const [actionState, setActionState] = useState<'idle' | 'saving' | 'deleting' | 'announcing'>('idle')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | AdminLifestealEvent['status']>('All')
  const [timeNow, setTimeNow] = useState(Date.now())

  const loadEvents = async (silent = false) => {
    if (adminDemoMode) return
    if (!silent) setState('loading')
    try {
      const payload = await getAdminLifestealEvents()
      setEvents(payload.events)
      setSelectedId((current) => payload.events.some((event) => event.id === current) ? current : payload.events[0]?.id ?? null)
      setState('ready')
    } catch (error) {
      setMessage(error instanceof AdminApiError ? error.message : 'Could not load events.')
      setState('error')
    }
  }

  useEffect(() => {
    loadEvents()
    if (adminDemoMode) return
    const timer = window.setInterval(() => loadEvents(true), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setForm(selected ? eventFormFromEvent(selected) : defaultEventForm)
  }, [selectedId])

  useEffect(() => {
    const timer = window.setInterval(() => setTimeNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const sortedEvents = [...events].sort((left, right) => left.startsAt - right.startsAt || left.priority - right.priority)
  const visibleEvents = sortedEvents.filter((event) => {
    const matchesStatus = statusFilter === 'All' || event.status === statusFilter
    const needle = query.trim().toLowerCase()
    const matchesQuery = !needle || [event.title, event.type, event.reward, event.summary, event.objective]
      .some((value) => value.toLowerCase().includes(needle))
    return matchesStatus && matchesQuery
  })
  const nextEvent = sortedEvents.find((event) => event.public && !['cancelled', 'completed', 'draft'].includes(event.status) && event.startsAt >= timeNow) ?? sortedEvents[0] ?? null
  const publishedCount = events.filter((event) => event.public && !['draft', 'cancelled'].includes(event.status)).length
  const announcementCount = events.filter((event) => event.announce).length
  const formStart = dateTimeValue(form.startsAt)

  const update = <K extends keyof typeof defaultEventForm>(key: K, value: (typeof defaultEventForm)[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const save = async () => {
    if (!canManage || actionState !== 'idle') return
    setActionState('saving')
    setMessage('')
    const payload = eventPayloadFromForm(form)
    if (adminDemoMode) {
      const nextEvent: AdminLifestealEvent = { id: selected?.id ?? Date.now(), ...payload, endsAt: payload.endsAt ?? null, reward: payload.reward ?? '', announcementMessageId: null, createdBy: user.id, createdAt: selected?.createdAt ?? Date.now(), updatedBy: user.id, updatedAt: Date.now() }
      setEvents((current) => selected ? current.map((event) => event.id === selected.id ? nextEvent : event) : [...current, nextEvent].sort((left, right) => left.startsAt - right.startsAt || left.priority - right.priority))
      setSelectedId(nextEvent.id)
      setMessage('Event saved in demo mode.')
      setActionState('idle')
      return
    }
    try {
      const response = selected ? await updateAdminLifestealEvent(selected.id, payload) : await createAdminLifestealEvent(payload)
      setEvents(response.events)
      setSelectedId(response.event.id)
      setMessage(selected ? 'Event updated.' : 'Event created.')
    } catch (error) {
      setMessage(error instanceof AdminApiError ? error.message : 'Could not save event.')
    } finally {
      setActionState('idle')
    }
  }

  const remove = async () => {
    if (!selected || !canManage || actionState !== 'idle') return
    setActionState('deleting')
    setMessage('')
    if (adminDemoMode) {
      setEvents((current) => current.filter((event) => event.id !== selected.id))
      setSelectedId(null)
      setMessage('Event deleted in demo mode.')
      setActionState('idle')
      return
    }
    try {
      const response = await deleteAdminLifestealEvent(selected.id)
      setEvents(response.events)
      setSelectedId(response.events[0]?.id ?? null)
      setMessage('Event deleted.')
    } catch (error) {
      setMessage(error instanceof AdminApiError ? error.message : 'Could not delete event.')
    } finally {
      setActionState('idle')
    }
  }

  const resendAnnouncement = async () => {
    if (!selected || !canManage || actionState !== 'idle') return
    setActionState('announcing')
    setMessage('')
    if (adminDemoMode) {
      const messageId = `demo-${Date.now()}`
      setEvents((current) => current.map((event) => event.id === selected.id ? { ...event, announcementMessageId: messageId, updatedAt: Date.now(), updatedBy: user.id } : event))
      setMessage('Announcement sent in demo mode.')
      setActionState('idle')
      return
    }
    try {
      const response = await resendAdminLifestealEventAnnouncement(selected.id)
      setEvents(response.events)
      setSelectedId(response.event.id)
      setMessage('Discord announcement sent.')
    } catch (error) {
      setMessage(error instanceof AdminApiError ? error.message : 'Could not send announcement.')
    } finally {
      setActionState('idle')
    }
  }

  return (
    <main className="page-workspace">
      <PageHeader eyebrow="Season Operations" title="Events" detail="Create public Lifesteal schedule entries that publish to the website and can optionally announce in Discord." action={<div className="page-actions"><button className="page-action" disabled={!canManage} onClick={() => { setSelectedId(null); setForm(defaultEventForm); setMessage('') }} type="button"><CalendarDays size={16} />New event</button><button className="page-action secondary" disabled={state === 'loading'} onClick={() => loadEvents()} type="button"><RefreshCw size={16} />Refresh</button></div>} />
      <section className="event-admin-summary">
        <article><CalendarDays size={18} /><span>Total Events</span><strong>{events.length}</strong><p>{visibleEvents.length} visible in current filter</p></article>
        <article><CheckCircle2 size={18} /><span>Published</span><strong>{publishedCount}</strong><p>Visible on the Lifesteal website</p></article>
        <article><Megaphone size={18} /><span>Announcements</span><strong>{announcementCount}</strong><p>Queued to post in Discord on create</p></article>
        <article><Clock3 size={18} /><span>Next Event</span><strong>{nextEvent ? adminEventDistance(nextEvent.startsAt, timeNow) : '-'}</strong><p>{nextEvent?.title ?? 'No active schedule'}</p></article>
      </section>
      <section className="event-admin-layout">
        <aside className="event-admin-panel">
          <header><div><span className="eyebrow">Schedule</span><h2>Event Queue</h2></div><span>{visibleEvents.length}</span></header>
          <label className="event-search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events..." /></label>
          <div className="event-status-filters">
            {(['All', 'draft', 'scheduled', 'live', 'completed', 'cancelled'] as const).map((status) => (
              <button className={statusFilter === status ? 'active' : ''} key={status} onClick={() => setStatusFilter(status)} type="button">{status}</button>
            ))}
          </div>
          <div className="event-admin-list">
            {state === 'loading' && <div className="empty-state"><Activity /><strong>Loading events...</strong></div>}
            {state === 'error' && <div className="empty-state error"><FileWarning /><strong>Could not load events</strong></div>}
            {visibleEvents.map((event) => (
              <button className={selectedId === event.id ? 'active' : ''} key={event.id} onClick={() => setSelectedId(event.id)} type="button">
                <span className="event-date-block"><strong>{new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(event.startsAt)}</strong><small>{new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(event.startsAt)}</small></span>
                <span className="event-list-copy">
                  <span><i className={`event-admin-status ${event.status}`}>{event.status}</i>{event.public && <i className="event-admin-status public">public</i>}</span>
                  <strong>{event.title}</strong>
                  <small>{adminEventTime(event.startsAt)} / {event.type} / Priority {event.priority}</small>
                </span>
              </button>
            ))}
            {state !== 'loading' && visibleEvents.length === 0 && <div className="empty-state"><CalendarDays /><strong>No matching events</strong><span>Adjust filters or create a new event.</span></div>}
          </div>
        </aside>
        <section className="event-editor">
          <header><div><span className="eyebrow">{selected ? `Editing #${selected.id}` : 'New Event'}</span><h2>{selected ? selected.title : 'Create Event'}</h2></div><span className="health-label"><Megaphone size={14} />{form.announce ? 'Announce' : 'Website only'}</span></header>
          <section className="event-preview-card">
            <div><span className={`event-admin-status ${form.status}`}>{form.status}</span>{form.public && <span className="event-admin-status public">public</span>}</div>
            <h3>{form.title || 'Untitled event'}</h3>
            <p>{form.summary || 'Short summary will appear here.'}</p>
            <dl>
              <div><dt>Date</dt><dd>{adminEventDate(formStart)}</dd></div>
              <div><dt>Time</dt><dd>{adminEventTime(formStart)}</dd></div>
              <div><dt>Starts</dt><dd>{adminEventDistance(formStart, timeNow)}</dd></div>
              <div><dt>Reward</dt><dd>{form.reward || '-'}</dd></div>
            </dl>
          </section>
          <div className="event-editor-section">
            <div><span className="eyebrow">Basics</span><h3>Public Card</h3></div>
            <div className="event-editor-grid">
              <label><span>Title</span><input value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
              <label><span>Type</span><input value={form.type} onChange={(event) => update('type', event.target.value)} /></label>
              <label><span>Start</span><input type="datetime-local" value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></label>
              <label><span>End optional</span><input type="datetime-local" value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></label>
              <label><span>Reward</span><input value={form.reward} onChange={(event) => update('reward', event.target.value)} /></label>
              <label><span>Priority</span><input min="0" max="99" type="number" value={form.priority} onChange={(event) => update('priority', event.target.value)} /></label>
            </div>
          </div>
          <div className="event-editor-section compact">
            <div><span className="eyebrow">Publishing</span><h3>Visibility</h3></div>
            <div className="event-editor-grid">
              <label><span>Status</span><select value={form.status} onChange={(event) => update('status', event.target.value as AdminLifestealEvent['status'])}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
              <label className="event-toggle"><input checked={form.public} onChange={(event) => update('public', event.target.checked)} type="checkbox" /><span>Publish on website</span></label>
              <label className="event-toggle"><input checked={form.announce} onChange={(event) => update('announce', event.target.checked)} type="checkbox" /><span>Send Discord announcement on create</span></label>
            </div>
          </div>
          <div className="event-editor-section">
            <div><span className="eyebrow">Details</span><h3>Website Copy</h3></div>
            <label className="event-editor-wide"><span>Summary</span><textarea value={form.summary} onChange={(event) => update('summary', event.target.value)} /></label>
            <label className="event-editor-wide"><span>Objective</span><textarea value={form.objective} onChange={(event) => update('objective', event.target.value)} /></label>
          </div>
          {message && <p className={message.includes('Could not') || message.includes('permission') ? 'form-message error' : 'form-message'}>{message}</p>}
          <footer><button className="page-action" disabled={!canManage || actionState !== 'idle'} onClick={save} type="button"><Check size={16} />{actionState === 'saving' ? 'Saving...' : selected ? 'Update event' : 'Create event'}</button><button className="page-action secondary" disabled={!selected || !canManage || actionState !== 'idle'} onClick={resendAnnouncement} type="button"><Megaphone size={16} />{actionState === 'announcing' ? 'Sending...' : selected?.announcementMessageId ? 'Resend announcement' : 'Send announcement'}</button><button className="page-action secondary" disabled={!selected || !canManage || actionState !== 'idle'} onClick={remove} type="button"><Trash2 size={16} />{actionState === 'deleting' ? 'Deleting...' : 'Delete'}</button></footer>
        </section>
      </section>
    </main>
  )
}

const playerStatuses: AdminPlayerStatus[] = ['Whitelisted', 'Registered', 'Applied', 'Review', 'Banned', 'Denied']
const editablePlayerStatuses: AdminPlayerStatus[] = ['Whitelisted', 'Registered', 'Review', 'Banned', 'Denied']
const manualPlayerStatuses: Exclude<AdminPlayerStatus, 'Applied'>[] = ['Registered', 'Whitelisted', 'Review', 'Banned', 'Denied']
const playerBadges: AdminPlayerBadge[] = ['Owner', 'Admin', 'Mod', 'SHD Team', 'Player']

const players: AdminPlayer[] = [
  { id: 'linked:demo-1', source: 'linked', discordId: 'demo-1', discord: 'primeluigi', minecraftUuid: null, minecraft: 'PrimeLuigi', badge: 'Owner', badgeValue: 'owner', status: 'Whitelisted', sourceStatus: 'active', hearts: 10, risk: 'low', updatedAt: Date.now() - 2 * 60_000, applicationCode: null, application: null },
  { id: 'linked:demo-2', source: 'linked', discordId: 'demo-2', discord: 'tlzmax5454', minecraftUuid: null, minecraft: 'TlzMax5454', badge: 'SHD Team', badgeValue: 'shd-team', status: 'Whitelisted', sourceStatus: 'active', hearts: 10, risk: 'low', updatedAt: Date.now() - 8 * 60_000, applicationCode: null, application: null },
  { id: 'linked:demo-3', source: 'linked', discordId: 'demo-3', discord: 'voidism', minecraftUuid: null, minecraft: 'xvoidism', badge: 'SHD Team', badgeValue: 'shd-team', status: 'Whitelisted', sourceStatus: 'active', hearts: 10, risk: 'low', updatedAt: Date.now() - 12 * 60_000, applicationCode: 'SHD-APP-K8F2QZ', application: seedSubmissions[0] ? { code: seedSubmissions[0].id, status: 'ticket_verified', discord: seedSubmissions[0].discord, minecraft: seedSubmissions[0].minecraft, createdAt: Date.now() - 25 * 60_000, verifiedAt: Date.now() - 20 * 60_000, ticketThreadId: null, summary: seedSubmissions[0].summary, fields: seedSubmissions[0].fields } : null },
  { id: 'linked:demo-4', source: 'linked', discordId: 'demo-4', discord: 'riverbytes', minecraftUuid: null, minecraft: 'RiverBytes', badge: 'Player', badgeValue: 'player', status: 'Registered', sourceStatus: 'active', hearts: 10, risk: 'low', updatedAt: Date.now() - 24 * 60 * 60_000, applicationCode: 'SHD-APP-7UZ5CY', application: seedSubmissions[4] ? { code: seedSubmissions[4].id, status: 'approved', discord: seedSubmissions[4].discord, minecraft: seedSubmissions[4].minecraft, createdAt: Date.now() - 30 * 60 * 60_000, verifiedAt: Date.now() - 29 * 60 * 60_000, ticketThreadId: null, summary: seedSubmissions[4].summary, fields: seedSubmissions[4].fields } : null },
  { id: 'application:SHD-APP-DEMO', source: 'application', discordId: null, discord: 'newplayer', minecraftUuid: null, minecraft: 'NewPlayer', badge: 'Player', badgeValue: 'player', status: 'Applied', sourceStatus: 'ticket_verified', hearts: null, risk: 'low', updatedAt: Date.now() - 36 * 60_000, applicationCode: 'SHD-APP-DEMO', application: { code: 'SHD-APP-DEMO', status: 'ticket_verified', discord: 'newplayer', minecraft: 'NewPlayer', createdAt: Date.now() - 42 * 60_000, verifiedAt: Date.now() - 36 * 60_000, ticketThreadId: null, summary: 'Demo application waiting for review.', fields: [{ label: 'Experience', value: 'Vanilla SMP and PvP practice.' }, { label: 'Motivation', value: 'Wants to join Season 1 with a small group.' }] } },
]

function PlayersPage() {
  const [items, setItems] = useState<AdminPlayer[]>(adminDemoMode ? players : [])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(adminDemoMode ? 'ready' : 'loading')
  const [error, setError] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState<CreateAdminPlayerPayload>({
    discordId: '',
    discordUsername: '',
    minecraftName: '',
    minecraftUuid: '',
    badge: 'Player',
    status: 'Registered',
  })
  const [selectedId, setSelectedId] = useState<string | null>(adminDemoMode ? players[0]?.id ?? null : null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [manualState, setManualState] = useState<'idle' | 'saving'>('idle')
  const [timeNow, setTimeNow] = useState(Date.now())
  const selected = items.find((player) => player.id === selectedId) ?? null

  const loadPlayers = async (silent = false) => {
    if (adminDemoMode) return
    if (!silent) {
      setState('loading')
      setError('')
    }
    try {
      const payload = await getAdminPlayers()
      setItems(payload.players)
      setSelectedId((current) => payload.players.some((player) => player.id === current) ? current : payload.players[0]?.id ?? null)
      setState('ready')
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : 'Could not load players.')
      setState('error')
    }
  }

  useEffect(() => {
    loadPlayers()
    if (adminDemoMode) return
    const timer = window.setInterval(() => loadPlayers(true), 12_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setTimeNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const replacePlayers = (next: AdminPlayer[]) => {
    setItems(next)
    setSelectedId((current) => next.some((player) => player.id === current) ? current : next[0]?.id ?? null)
  }

  const updatePlayer = async (player: AdminPlayer, patch: { status?: AdminPlayerStatus; badge?: AdminPlayerBadge }) => {
    if (player.source === 'application' && patch.badge) return
    setActionId(player.id)
    setError('')
    if (adminDemoMode) {
      replacePlayers(items.map((item) => item.id === player.id ? { ...item, ...patch, updatedAt: Date.now() } : item))
      setActionId(null)
      return
    }
    try {
      const payload = await updateAdminPlayer(player.id, patch)
      replacePlayers(payload.players)
    } catch (actionError) {
      setError(actionError instanceof AdminApiError ? actionError.message : 'Could not update player.')
    } finally {
      setActionId(null)
    }
  }

  const removePlayer = async (player: AdminPlayer) => {
    const confirmed = window.confirm(`Remove ${player.minecraft} from the admin player list?`)
    if (!confirmed) return
    setActionId(player.id)
    setError('')
    if (adminDemoMode) {
      replacePlayers(items.filter((item) => item.id !== player.id))
      setActionId(null)
      return
    }
    try {
      const payload = await deleteAdminPlayer(player.id)
      replacePlayers(payload.players)
    } catch (actionError) {
      setError(actionError instanceof AdminApiError ? actionError.message : 'Could not delete player.')
    } finally {
      setActionId(null)
    }
  }

  const submitManualPlayer = async () => {
    const payload: CreateAdminPlayerPayload = {
      ...manualForm,
      discordId: manualForm.discordId.trim(),
      discordUsername: manualForm.discordUsername?.trim(),
      minecraftName: manualForm.minecraftName.trim(),
      minecraftUuid: manualForm.minecraftUuid?.trim(),
    }
    if (!payload.discordId || !payload.minecraftName || manualState === 'saving') return
    setManualState('saving')
    setError('')
    if (adminDemoMode) {
      const demoPlayer: AdminPlayer = {
        id: `linked:manual-${Date.now()}`,
        source: 'linked',
        discordId: payload.discordId,
        discord: payload.discordUsername || payload.discordId,
        minecraftUuid: payload.minecraftUuid || null,
        minecraft: payload.minecraftName,
        badge: payload.badge,
        badgeValue: payload.badge.toLowerCase().replaceAll(' ', '-'),
        status: payload.status,
        sourceStatus: payload.status === 'Banned' ? 'banned' : payload.status === 'Denied' ? 'denied' : payload.status === 'Review' ? 'review' : 'active',
        hearts: null,
        risk: payload.status === 'Review' || payload.status === 'Banned' ? 'high' : 'low',
        updatedAt: Date.now(),
        applicationCode: null,
        application: null,
      }
      replacePlayers([demoPlayer, ...items])
      setManualOpen(false)
      setManualForm({ discordId: '', discordUsername: '', minecraftName: '', minecraftUuid: '', badge: 'Player', status: 'Registered' })
      setManualState('idle')
      return
    }
    try {
      const response = await createAdminPlayer(payload)
      replacePlayers(response.players)
      setManualOpen(false)
      setManualForm({ discordId: '', discordUsername: '', minecraftName: '', minecraftUuid: '', badge: 'Player', status: 'Registered' })
    } catch (actionError) {
      setError(actionError instanceof AdminApiError ? actionError.message : 'Could not add player manually.')
    } finally {
      setManualState('idle')
    }
  }

  const visible = items.filter((player) => {
    const matchesQuery = !query.trim() || [player.minecraft, player.discord].some((value) => value.toLowerCase().includes(query.toLowerCase()))
    return matchesQuery && (status === 'All' || player.status === status)
  })
  return (
    <main className="page-workspace">
      <PageHeader eyebrow="Identity & Access" title="Players" detail="Inspect linked accounts, public state, access status, and saved application context." action={<div className="page-actions"><button className="page-action" onClick={() => setManualOpen(true)} type="button"><UserPlus size={16} />Add player</button><button className="page-action secondary" disabled={state === 'loading'} onClick={() => loadPlayers()} type="button"><RefreshCw size={16} />Refresh</button></div>} />
      {error && <div className="operations-state error"><FileWarning size={16} /><span>{error}</span></div>}
      <section className="table-toolbar">
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Minecraft or Discord" /></label>
        <div className="segmented-control">
          {['All', ...playerStatuses].map((item) => <button className={status === item ? 'active' : ''} onClick={() => setStatus(item)} type="button" key={item}>{item}</button>)}
        </div>
      </section>
      <section className="players-manager">
        <div className="data-table players-table">
          <div className="table-head"><span>Player</span><span>Badge</span><span>Status</span><span>Hearts</span><span>Risk</span><span>Updated</span><span /></div>
          {state === 'loading' && visible.length === 0 && <div className="empty-state"><Activity /><strong>Loading players</strong></div>}
          {visible.map((player) => (
            <article className={`table-row ${selectedId === player.id ? 'selected' : ''}`} key={player.id}>
              <button className="player-cell player-open" onClick={() => setSelectedId(player.id)} type="button"><img className="player-avatar small" alt="" src={minecraftHeadUrl(player.minecraft)} /><div><strong>{player.minecraft}</strong><span>@{player.discord}</span></div></button>
              <label className="table-select">
                <select disabled={player.source === 'application' || actionId === player.id} value={player.badge} onChange={(event) => updatePlayer(player, { badge: event.target.value as AdminPlayerBadge })}>
                  {playerBadges.map((badge) => <option key={badge} value={badge}>{badge}</option>)}
                </select>
              </label>
              <label className="table-select">
                <select disabled={actionId === player.id} value={player.status} onChange={(event) => updatePlayer(player, { status: event.target.value as AdminPlayerStatus })}>
                  {(player.source === 'application' ? ['Applied', 'Denied'] : editablePlayerStatuses).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <strong>{player.hearts ?? '-'}</strong>
              <span className={`risk-label ${player.risk.toLowerCase()}`}>{player.risk}</span>
              <span className="muted">{relativeTime(player.updatedAt, timeNow)}</span>
              <div className="row-actions">
                <button aria-label={`View ${player.minecraft} application`} disabled={!player.application} onClick={() => setSelectedId(player.id)} title={player.application ? 'View application' : 'No saved application'} type="button"><ExternalLink size={16} /></button>
                <button aria-label={`Delete ${player.minecraft}`} disabled={actionId === player.id} onClick={() => removePlayer(player)} title="Delete player listing" type="button"><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
          {state !== 'loading' && visible.length === 0 && <div className="empty-state"><Users /><strong>No matching players</strong></div>}
        </div>
        <aside className="player-detail-panel">
          {selected ? (
            <>
              <header>
                <img className="player-avatar" alt="" src={minecraftHeadUrl(selected.minecraft)} />
                <div><span className="eyebrow">{selected.source === 'linked' ? 'Linked Player' : 'Applied Player'}</span><h2>{selected.minecraft}</h2><p>@{selected.discord}</p></div>
              </header>
              <div className="player-detail-facts">
                <Fact label="Status" value={selected.status} />
                <Fact label="Badge" value={selected.badge} />
                <Fact label="Risk" value={selected.risk} />
                <Fact label="Updated" value={relativeTime(selected.updatedAt, timeNow)} />
              </div>
              {selected.application ? (
                <section className="player-application">
                  <div><span className="eyebrow">Saved Application</span><strong>{selected.application.code}</strong><p>{selected.application.summary}</p></div>
                  <div className="field-list compact">
                    {selected.application.fields.map((field) => <div key={field.label}><span>{field.label}</span><strong>{field.value}</strong></div>)}
                  </div>
                </section>
              ) : (
                <div className="panel-empty"><FileWarning size={17} /><span>No saved application was found for this player.</span></div>
              )}
            </>
          ) : (
            <div className="panel-empty"><Users size={17} /><span>Select a player to view saved context.</span></div>
          )}
        </aside>
      </section>
      {manualOpen && <div className="modal-layer" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setManualOpen(false)
      }}>
        <section className="admin-modal manual-player-modal" aria-label="Manual player add workflow" role="dialog" aria-modal="true">
          <header>
            <div><span className="eyebrow">Manual Roster Add</span><h2>Add Player</h2><p>Create a linked roster entry without an application key.</p></div>
            <button aria-label="Close manual add" onClick={() => setManualOpen(false)} type="button"><X size={18} /></button>
          </header>
          <div className="manual-player-grid">
            <label><span>Discord ID</span><input value={manualForm.discordId} onChange={(event) => setManualForm((form) => ({ ...form, discordId: event.target.value }))} placeholder="1224803434675572827" /></label>
            <label><span>Discord name</span><input value={manualForm.discordUsername} onChange={(event) => setManualForm((form) => ({ ...form, discordUsername: event.target.value }))} placeholder="Username or display name" /></label>
            <label><span>Minecraft name</span><input value={manualForm.minecraftName} onChange={(event) => setManualForm((form) => ({ ...form, minecraftName: event.target.value }))} placeholder="PrimeLuigi" /></label>
            <label><span>Minecraft UUID</span><input value={manualForm.minecraftUuid} onChange={(event) => setManualForm((form) => ({ ...form, minecraftUuid: event.target.value }))} placeholder="Optional, can be added later" /></label>
            <label><span>Badge</span><select value={manualForm.badge} onChange={(event) => setManualForm((form) => ({ ...form, badge: event.target.value as AdminPlayerBadge }))}>{playerBadges.map((badge) => <option key={badge} value={badge}>{badge}</option>)}</select></label>
            <label><span>Status</span><select value={manualForm.status} onChange={(event) => setManualForm((form) => ({ ...form, status: event.target.value as Exclude<AdminPlayerStatus, 'Applied'> }))}>{manualPlayerStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <footer>
            <button className="page-action secondary" onClick={() => setManualOpen(false)} type="button">Cancel</button>
            <button className="page-action" disabled={manualState === 'saving' || !manualForm.discordId.trim() || !manualForm.minecraftName.trim()} onClick={submitManualPlayer} type="button"><UserPlus size={16} />{manualState === 'saving' ? 'Adding...' : 'Add player'}</button>
          </footer>
        </section>
      </div>}
    </main>
  )
}

function AuditPage({ audit, state, submissions }: { audit: AdminAuditPayload | null; state: 'loading' | 'ready' | 'error'; submissions: Submission[] }) {
  const [scope, setScope] = useState('All')
  const demoEvents = [
    { actor: 'PrimeLuigi', type: 'Review', action: 'Approved application and enabled public status', target: 'SHD-APP-7UZ5CY', time: 'Yesterday, 21:14', result: 'Success' },
    { actor: 'TlzMax5454', type: 'Review', action: 'Claimed appeal review', target: 'SHD-APL-3JD91P', time: '15:03', result: 'Success' },
    { actor: 'Discord Bot', type: 'Integration', action: 'Posted staff request to linked ticket', target: 'SHD-SUP-T2PX6A', time: '14:19', result: 'Success' },
    { actor: 'Minecraft Bridge', type: 'Integration', action: 'Whitelist synchronization failed', target: 'NovaForge', time: '14:07', result: 'Warning' },
    { actor: 'Support Portal', type: 'Submission', action: 'Received private player report', target: 'SHD-RPT-M4Q7VN', time: '14:35', result: 'Success' },
    { actor: 'System', type: 'Security', action: 'Rejected expired rules acknowledgement key', target: 'Public API', time: '13:48', result: 'Blocked' },
  ]
  const events = audit?.events.map((event) => ({
    actor: event.actor,
    type: event.type,
    action: event.action,
    target: event.target,
    time: relativeTime(event.createdAt),
    result: event.result,
  })) ?? demoEvents
  const visible = events.filter((event) => scope === 'All' || event.type === scope)
  const summary = audit?.summary ?? {
    eventsToday: demoEvents.length,
    staffActions: demoEvents.filter((event) => event.actor !== 'System').length,
    integrationEvents: demoEvents.filter((event) => event.type === 'Integration').length,
    warnings: demoEvents.filter((event) => event.result !== 'Success').length,
  }
  return (
    <main className="page-workspace">
      <PageHeader eyebrow="Accountability" title="Audit Log" detail={`${submissions.length} submissions and the recent actions surrounding them.`} action={<button className="page-action secondary" type="button"><ExternalLink size={16} />Export</button>} />
      <section className="audit-summary">
        <Fact label="Events today" value={String(summary.eventsToday)} />
        <Fact label="Staff actions" value={String(summary.staffActions)} />
        <Fact label="Integration events" value={String(summary.integrationEvents)} />
        <Fact label="Warnings" value={String(summary.warnings)} />
      </section>
      <section className="table-toolbar">
        <div className="segmented-control">
          {['All', 'Review', 'Submission', 'Player', 'Integration', 'Security', 'System'].map((item) => <button className={scope === item ? 'active' : ''} onClick={() => setScope(item)} type="button" key={item}>{item}</button>)}
        </div>
      </section>
      <section className="audit-list">
        {state === 'loading' && <div className="panel-empty"><Activity size={17} /><span>Loading audit events...</span></div>}
        {state === 'error' && <div className="panel-empty"><FileWarning size={17} /><span>Could not load audit events.</span></div>}
        {visible.map((event, index) => (
          <article key={`${event.time}-${index}`}>
            <span className={`audit-result ${event.result.toLowerCase()}`}><Activity size={15} /></span>
            <div><strong>{event.action}</strong><p><b>{event.actor}</b> · {event.target}</p></div>
            <span className="audit-type">{event.type}</span>
            <time>{event.time}</time>
          </article>
        ))}
        {state === 'ready' && visible.length === 0 && <div className="panel-empty"><Activity size={17} /><span>No matching audit events.</span></div>}
      </section>
    </main>
  )
}

function PageHeader({ action, detail, eyebrow, title }: { action?: ReactNode; detail: string; eyebrow: string; title: string }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>{action}</header>
}

function HealthRow({ detail, label, muted = false, status }: { detail: string; label: string; muted?: boolean; status: string }) {
  return <div><span className={`health-dot ${muted ? 'muted' : ''}`} /><div><strong>{label}</strong><p>{detail}</p></div><b>{status}</b></div>
}

function ActivityRow({ actor, action, target, time }: { actor: string; action: string; target: string; time: string }) {
  return <div><div className="activity-icon"><Activity size={14} /></div><p><strong>{actor}</strong> {action} <b>{target}</b></p><time>{time}</time></div>
}

function QueueItem({ submission, active, onSelect }: { submission: Submission; active: boolean; onSelect: () => void }) {
  const Icon = typeIcons[submission.type]
  return (
    <button className={`queue-item ${active ? 'active' : ''}`} onClick={onSelect} type="button">
      <span className={`type-icon ${submission.type.toLowerCase().replace(' ', '-')}`}><Icon size={17} /></span>
      <span className="queue-copy">
        <span className="queue-topline"><strong>{submission.minecraft}</strong><time>{submission.submitted}</time></span>
        <span className="queue-title">{submission.title}</span>
        <span className="queue-meta">{submission.id} · {submission.type}</span>
      </span>
      {submission.priority === 'High' && <span className="priority-dot" title="High priority" />}
      <StatusPill status={submission.status} />
    </button>
  )
}

function ReviewHeader({ actionsLive, actionLoading, activityVisible, claimLoading, staffId, staffName, submission, onBack, onClaim, onDecide, onToggleActivity }: {
  actionsLive: boolean
  actionLoading: boolean
  activityVisible: boolean
  claimLoading: boolean
  staffId: string
  staffName: string
  submission: Submission
  onBack: () => void
  onClaim: () => void
  onDecide: (status: SubmissionStatus, body: string) => void
  onToggleActivity: () => void
}) {
  const owned = submission.claimedById ? submission.claimedById === staffId : submission.claimedBy === staffName
  const decided = ['Approved', 'Denied'].includes(submission.status)
  return (
    <header className="review-header">
      <div>
        <button className="back-button" aria-label="Back to queue" onClick={onBack} type="button"><ArrowLeft size={17} /></button>
        <div><span className="eyebrow">{submission.type}</span><strong>{submission.id}</strong></div>
      </div>
      <div className="review-actions">
        <button className="icon-action activity-toggle" aria-label={activityVisible ? 'Hide ticket activity' : 'Show ticket activity'} onClick={onToggleActivity} title={activityVisible ? 'Hide ticket activity' : 'Show ticket activity'} type="button">
          {activityVisible ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
        {!submission.claimedBy && <button className="claim-button" disabled={claimLoading} onClick={onClaim} type="button"><UserRoundSearch size={16} />{claimLoading ? 'Claiming...' : 'Claim'}</button>}
        {submission.claimedBy && !owned && <span className="claimed-label"><LockKeyhole size={14} />{submission.claimedBy}</span>}
        {owned && !decided && (
          <>
            {submission.type !== 'Application' && <button className="icon-action request" disabled={!actionsLive || actionLoading} onClick={() => onDecide('Waiting on player', 'Staff requested more information in Discord.')} title="Request information" type="button"><MessageSquareText size={17} /></button>}
            <button className="icon-action deny" disabled={!actionsLive || actionLoading} onClick={() => onDecide('Denied', `${submission.type} denied from the admin portal.`)} title="Deny" type="button"><XCircle size={18} /></button>
            <button className="approve-button" disabled={!actionsLive || actionLoading} onClick={() => onDecide('Approved', `${submission.type} approved from the admin portal.`)} title={submission.type === 'Application' ? 'Approve application' : 'Resolve'} type="button"><Check size={17} />{submission.type === 'Application' ? 'Approve' : 'Resolve'}</button>
          </>
        )}
      </div>
    </header>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  const Icon = status === 'Approved' ? CheckCircle2 : status === 'Denied' ? XCircle : status === 'Waiting on player' ? MessageSquareText : status === 'In review' ? UserRoundSearch : Clock3
  return <span className={`status-pill ${status.toLowerCase().replaceAll(' ', '-')}`}><Icon size={12} />{status}</span>
}

const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<App />)
