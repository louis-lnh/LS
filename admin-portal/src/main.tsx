import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  ArrowLeft,
  Ban,
  Bot,
  Building2,
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
  UserCheck,
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
  decideAdminSubmission,
  demoAdminUser,
  endAdminSession,
  getAdminSubmissions,
  getAdminOverview,
  getAdminSession,
  getLifestealStaffChat,
  getSubmissionTicketActivity,
  sendSubmissionTicketMessage,
  sendLifestealStaffChatMessage,
  type AdminApiSubmission,
  type AdminOverview,
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

  useEffect(() => {
    if (adminDemoMode || !user.workspaces.includes('lifesteal')) return
    getAdminSubmissions()
      .then((items) => {
        const normalized = items.map(submissionFromApi)
        setSubmissions(normalized)
        setSelectedId((current) => normalized.some((item) => item.id === current) ? current : normalized[0]?.id ?? '')
        setSubmissionState('ready')
      })
      .catch(() => setSubmissionState('error'))
  }, [user.workspaces])

  useEffect(() => {
    if (adminDemoMode || !user.workspaces.includes('global')) return
    getAdminOverview()
      .then((data) => {
        setOverview(data)
        setOverviewState('ready')
      })
      .catch(() => setOverviewState('error'))
  }, [user.workspaces])

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
  const selectedDecided = selected ? ['Approved', 'Denied'].includes(selected.status) : false
  const selectedOwned = selected ? (selected.claimedById ? selected.claimedById === user.id : selected.claimedBy === reviewerName) : false
  const selectedSupportsAdminActions = Boolean(selected && (adminDemoMode || selected.type !== 'Application'))
  const canWriteSelected = Boolean(selected && selectedSupportsAdminActions && (adminDemoMode || (selectedOwned && !selectedDecided)))
  const canMessageTicket = Boolean(selected?.ticketThreadId && (adminDemoMode || (selectedOwned && !selectedDecided)))
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
    if (selected.type === 'Application') {
      setClaimError('Applications still use the Discord approval command so whitelist automation stays intact.')
      return
    }
    const apiStatus = status === 'Waiting on player' ? 'waiting_on_player' : status === 'Denied' ? 'denied' : 'resolved'
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
      {view === 'global-staff' && <StaffAccessPage />}
      {view === 'global-integrations' && <IntegrationsPage />}
      {view === 'global-audit' && <AuditPage submissions={submissions} />}
      {view === 'lifesteal-overview' && <LifestealOverviewPage submissions={submissions} onNavigate={navigate} />}
      {view === 'lifesteal-players' && <PlayersPage />}
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
          <ReviewHeader actionsLive={selectedSupportsAdminActions} actionLoading={actionState === 'decision'} activityVisible={activityVisible} claimLoading={claimState === 'loading'} staffId={user.id} staffName={reviewerName} submission={selected} onBack={() => setMobileDetail(false)} onClaim={claim} onDecide={decide} onToggleActivity={toggleActivity} />
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

function StaffAccessPage() {
  const staff = [
    { name: 'PrimeLuigi', discord: '@primeluigi', role: 'Owner', scopes: ['Global', 'Lifesteal', 'General', 'Valorant'], state: 'Active' },
    { name: 'TlzMax5454', discord: '@tlzmax5454', role: 'SHD Team', scopes: ['Lifesteal'], state: 'Active' },
    { name: 'xvoidism', discord: '@voidism', role: 'SHD Team', scopes: ['Lifesteal'], state: 'Active' },
  ]
  return (
    <main className="page-workspace">
      <PageHeader eyebrow="Authorization" title="Staff & Access" detail="Discord remains the identity source; the admin portal translates guild roles into explicit workspace permissions." action={<button className="page-action" type="button"><UserCheck size={16} />Invite staff</button>} />
      <section className="permission-summary">
        <article><KeyRound size={19} /><strong>Discord OAuth</strong><p>One login for the complete SHD admin surface.</p></article>
        <article><ShieldCheck size={19} /><strong>Scoped permissions</strong><p>Staff only see workspaces granted by their roles.</p></article>
        <article><Activity size={19} /><strong>Audited actions</strong><p>Claims, decisions, messages, and access changes are recorded.</p></article>
      </section>
      <section className="staff-table">
        <header><span>Staff member</span><span>Portal role</span><span>Workspace access</span><span>Status</span></header>
        {staff.map((member) => (
          <article key={member.name}>
            <span className="staff-identity"><span className="avatar">{member.name.slice(0, 2).toUpperCase()}</span><span><strong>{member.name}</strong><small>{member.discord}</small></span></span>
            <strong>{member.role}</strong>
            <span className="scope-list">{member.scopes.map((scope) => <small key={scope}>{scope}</small>)}</span>
            <span className="health-label"><CheckCircle2 size={14} />{member.state}</span>
          </article>
        ))}
      </section>
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

const players = [
  { minecraft: 'PrimeLuigi', discord: 'primeluigi', badge: 'Owner', status: 'Whitelisted', hearts: '10', risk: 'Low', updated: '2 min ago' },
  { minecraft: 'TlzMax5454', discord: 'tlzmax5454', badge: 'SHD Team', status: 'Whitelisted', hearts: '10', risk: 'Low', updated: '8 min ago' },
  { minecraft: 'xvoidism', discord: 'voidism', badge: 'SHD Team', status: 'Whitelisted', hearts: '10', risk: 'Low', updated: '12 min ago' },
  { minecraft: 'RiverBytes', discord: 'riverbytes', badge: 'Player', status: 'Registered', hearts: '10', risk: 'Low', updated: 'Yesterday' },
  { minecraft: 'NorthStarMC', discord: 'northstar.', badge: 'Player', status: 'Banned', hearts: '-', risk: 'High', updated: '24 min ago' },
]

function PlayersPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const visible = players.filter((player) => {
    const matchesQuery = !query.trim() || [player.minecraft, player.discord].some((value) => value.toLowerCase().includes(query.toLowerCase()))
    return matchesQuery && (status === 'All' || player.status === status)
  })
  return (
    <main className="page-workspace">
      <PageHeader eyebrow="Identity & Access" title="Players" detail="Inspect linked accounts, public state, access status, and risk signals." action={<button className="page-action" type="button"><UserCheck size={16} />Link player</button>} />
      <section className="table-toolbar">
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Minecraft or Discord" /></label>
        <div className="segmented-control">
          {['All', 'Whitelisted', 'Registered', 'Banned'].map((item) => <button className={status === item ? 'active' : ''} onClick={() => setStatus(item)} type="button" key={item}>{item}</button>)}
        </div>
      </section>
      <section className="data-table players-table">
        <div className="table-head"><span>Player</span><span>Badge</span><span>Status</span><span>Hearts</span><span>Risk</span><span>Updated</span><span /></div>
        {visible.map((player) => (
          <article className="table-row" key={player.minecraft}>
            <div className="player-cell"><img className="player-avatar small" alt="" src={minecraftHeadUrl(player.minecraft)} /><div><strong>{player.minecraft}</strong><span>@{player.discord}</span></div></div>
            <span className="badge-label">{player.badge}</span>
            <span className={`access-status ${player.status.toLowerCase()}`}>{player.status}</span>
            <strong>{player.hearts}</strong>
            <span className={`risk-label ${player.risk.toLowerCase()}`}>{player.risk}</span>
            <span className="muted">{player.updated}</span>
            <button aria-label={`Open ${player.minecraft}`} title="Open player" type="button"><ExternalLink size={16} /></button>
          </article>
        ))}
        {visible.length === 0 && <div className="empty-state"><Users /><strong>No matching players</strong></div>}
      </section>
    </main>
  )
}

function AuditPage({ submissions }: { submissions: Submission[] }) {
  const [scope, setScope] = useState('All')
  const events = [
    { actor: 'PrimeLuigi', type: 'Review', action: 'Approved application and enabled public status', target: 'SHD-APP-7UZ5CY', time: 'Yesterday, 21:14', result: 'Success' },
    { actor: 'TlzMax5454', type: 'Review', action: 'Claimed appeal review', target: 'SHD-APL-3JD91P', time: '15:03', result: 'Success' },
    { actor: 'Discord Bot', type: 'Integration', action: 'Posted staff request to linked ticket', target: 'SHD-SUP-T2PX6A', time: '14:19', result: 'Success' },
    { actor: 'Minecraft Bridge', type: 'Integration', action: 'Whitelist synchronization failed', target: 'NovaForge', time: '14:07', result: 'Warning' },
    { actor: 'Support Portal', type: 'Submission', action: 'Received private player report', target: 'SHD-RPT-M4Q7VN', time: '14:35', result: 'Success' },
    { actor: 'System', type: 'Security', action: 'Rejected expired rules acknowledgement key', target: 'Public API', time: '13:48', result: 'Blocked' },
  ]
  const visible = events.filter((event) => scope === 'All' || event.type === scope)
  return (
    <main className="page-workspace">
      <PageHeader eyebrow="Accountability" title="Audit Log" detail={`${submissions.length} seeded submissions and the recent actions surrounding them.`} action={<button className="page-action secondary" type="button"><ExternalLink size={16} />Export</button>} />
      <section className="audit-summary">
        <Fact label="Events today" value="28" />
        <Fact label="Staff actions" value="11" />
        <Fact label="Integration events" value="14" />
        <Fact label="Warnings" value="3" />
      </section>
      <section className="table-toolbar">
        <div className="segmented-control">
          {['All', 'Review', 'Submission', 'Integration', 'Security'].map((item) => <button className={scope === item ? 'active' : ''} onClick={() => setScope(item)} type="button" key={item}>{item}</button>)}
        </div>
      </section>
      <section className="audit-list">
        {visible.map((event, index) => (
          <article key={`${event.time}-${index}`}>
            <span className={`audit-result ${event.result.toLowerCase()}`}><Activity size={15} /></span>
            <div><strong>{event.action}</strong><p><b>{event.actor}</b> · {event.target}</p></div>
            <span className="audit-type">{event.type}</span>
            <time>{event.time}</time>
          </article>
        ))}
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
            <button className="icon-action request" disabled={!actionsLive || actionLoading} onClick={() => onDecide('Waiting on player', 'Staff requested more information in Discord.')} title={actionsLive ? 'Request information' : 'Application approval still uses the Discord command'} type="button"><MessageSquareText size={17} /></button>
            <button className="icon-action deny" disabled={!actionsLive || actionLoading} onClick={() => onDecide('Denied', 'Submission denied from the admin portal.')} title={actionsLive ? 'Deny' : 'Application denial still uses the Discord command'} type="button"><XCircle size={18} /></button>
            <button className="approve-button" disabled={!actionsLive || actionLoading} onClick={() => onDecide('Approved', 'Submission resolved from the admin portal.')} title={actionsLive ? 'Resolve' : 'Application approval still uses the Discord command'} type="button"><Check size={17} />Resolve</button>
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
