import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Bell,
  BadgeCheck,
  Bug,
  Activity,
  CalendarDays,
  ChevronRight,
  CheckSquare,
  CircleUserRound,
  Crown,
  Database,
  FlaskConical,
  Gamepad2,
  Home,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Megaphone,
  MessageSquare,
  Menu,
  MonitorSmartphone,
  Palette,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import './styles.css'
import logo from './assets/shd-logo.png'
import lifestealRulesMarkdown from './content/lifesteal-rules.md?raw'
import {
  beginPortalLogin,
  endPortalSession,
  getPortalSession,
  hasPermission,
  type PortalUser,
} from './api'

type RouteId = 'home' | 'support' | 'events' | 'supportMinecraft' | 'supportMinecraftApply' | 'supportMinecraftAppeal' | 'supportMinecraftReport' | 'supportMinecraftGeneral' | 'settings' | 'account' | 'dashboard' | 'chat' | 'admin' | 'adminSupportReview' | 'adminUsers' | 'adminEvents' | 'adminChat'
type SessionState =
  | { status: 'loading'; user: null; error: null }
  | { status: 'anonymous'; user: null; error: string | null }
  | { status: 'authenticated'; user: PortalUser; error: null }
type PortalNotification = {
  id: string
  title: string
  message: string
  timestamp: string
}
type SettingSearchResult = {
  categoryId: string
  category: string
  label: string
  description: string
}
type CustomSelectOption = {
  value: string
  label: string
  disabled?: boolean
  markerClass?: string
}
type MinecraftEvent = {
  id: string
  title: string
  shortTitle: string
  status: 'active' | 'half' | 'inactive'
  statusLabel: string
  accessLabel: string
  supportLabel: string
  description: string
  applicationOpen: boolean
  applicationStatus?: 'submitted' | 'under_review' | 'accepted' | 'denied'
  rulesMarkdown: string
}
type MinecraftAppealRecord = {
  id: string
  evidenceId: string
  reason: string
  status: 'open' | 'under_review' | 'denied'
  issuedAt: string
  expiresAt?: string
}
type PortalEvent = {
  id: string
  title: string
  category: string
  status: 'open' | 'soon' | 'planning'
  date: string
  startsAt?: string
  description: string
  details: Array<[string, string]>
  href?: string
  linkLabel?: string
}

const routes: Record<RouteId, string> = {
  home: '/',
  support: '/support',
  events: '/events',
  supportMinecraft: '/support/minecraft',
  supportMinecraftApply: '/support/minecraft/apply',
  supportMinecraftAppeal: '/support/minecraft/appeal',
  supportMinecraftReport: '/support/minecraft/report',
  supportMinecraftGeneral: '/support/minecraft/general',
  settings: '/settings',
  account: '/account',
  dashboard: '/dashboard',
  chat: '/chat',
  admin: '/admin',
  adminSupportReview: '/admin/support',
  adminUsers: '/admin/users',
  adminEvents: '/admin/events',
  adminChat: '/admin/chat',
}

function MarkdownRulesContent({ markdown }: { markdown: string }) {
  return markdown.split(/\r?\n/).map((rawLine, index) => {
    const line = rawLine.trim()
    const key = `${index}-${line}`
    if (!line || line === '---') return null
    if (line.startsWith('# ')) return <h3 key={key}>{line.slice(2)}</h3>
    if (line.startsWith('## ')) return <h4 key={key}>{line.slice(3)}</h4>
    if (line.startsWith('* ')) return <p key={key} className="rules-bullet">{line.slice(2)}</p>
    return <p key={key}>{line}</p>
  })
}

const sharedLifestealRulesNotice = `# SHD Lifesteal Practice Rules

This event uses the same core Lifesteal rulebook unless staff announces a specific exception before the event starts.

## Event Notice

* Respect all players and staff.
* Do not cheat, exploit, xray, automate gameplay, or use unfair client modifications.
* Follow staff instructions during test rounds and practice sessions.
* Report bugs or abuse paths instead of using them.
* Published event-specific rules override this placeholder when the event goes live.

# Core Rulebook

${lifestealRulesMarkdown}`

const minecraftEvents: MinecraftEvent[] = [
  {
    id: 'lifesteal-beta',
    title: 'SHD Lifesteal Beta Season',
    shortTitle: 'Lifesteal Beta',
    status: 'active',
    statusLabel: 'Beta active',
    accessLabel: 'Application required',
    supportLabel: 'Portal workflow preview',
    description: 'The active SHD Lifesteal beta with applications, appeals, reports, anti-cheat review and player account linking.',
    applicationOpen: true,
    applicationStatus: 'submitted',
    rulesMarkdown: lifestealRulesMarkdown,
  },
  {
    id: 'lifesteal-practice',
    title: 'SHD Lifesteal Practice Event',
    shortTitle: 'Practice Event',
    status: 'half',
    statusLabel: 'Signup preview',
    accessLabel: 'Limited slots',
    supportLabel: 'Rules inherit Lifesteal',
    description: 'A smaller practice workflow placeholder for testing multiple Minecraft event signups in the portal.',
    applicationOpen: true,
    rulesMarkdown: sharedLifestealRulesNotice,
  },
]

const applicationStatusLabels: Record<NonNullable<MinecraftEvent['applicationStatus']>, string> = {
  submitted: 'Already signed up',
  under_review: 'Under review',
  accepted: 'Accepted',
  denied: 'Denied',
}
const demoAppealRecords: MinecraftAppealRecord[] = [
  {
    id: 'AP-1907',
    evidenceId: 'EV-1907',
    reason: 'Blocked client mod reported',
    status: 'open',
    issuedAt: 'July 15, 2026 19:07',
  },
  {
    id: 'AP-1842',
    evidenceId: 'EV-1842',
    reason: 'Temporary suspension for suspicious combat activity',
    status: 'under_review',
    issuedAt: 'July 14, 2026 22:41',
    expiresAt: 'July 17, 2026 22:41',
  },
]
const upcomingEvents: PortalEvent[] = [
  {
    id: 'lifesteal-beta',
    title: 'SHD Lifesteal Beta Season',
    category: 'Minecraft',
    status: 'open',
    date: 'July 23, 2026 18:00',
    startsAt: '2026-07-23T18:00:00+02:00',
    description: 'The active Lifesteal beta season with applications, anti-cheat review, custom rules, and account-linked support workflows.',
    details: [
      ['Access', 'Application required'],
      ['Format', 'Lifesteal SMP'],
      ['Support', 'Portal forms preview'],
      ['Start', '18:00 Berlin'],
      ['Identity', 'SHD account linked'],
    ],
    href: 'https://lifesteal.shd-esports.com',
    linkLabel: 'More infos',
  },
  {
    id: 'lifesteal-practice',
    title: 'Lifesteal Practice Event',
    category: 'Minecraft',
    status: 'soon',
    date: 'TBA',
    description: 'A smaller practice event used for testing registrations, rules, and support workflows before larger public events.',
    details: [
      ['Access', 'Limited slots'],
      ['Format', 'Practice round'],
      ['Rules', 'Core Lifesteal rules'],
    ],
  },
  {
    id: 'shd-community-night',
    title: 'SHD Community Night',
    category: 'Community',
    status: 'planning',
    date: 'TBA',
    description: 'A lightweight community event placeholder for announcements, signups, and future cross-game activities.',
    details: [
      ['Access', 'Members'],
      ['Format', 'Community'],
      ['Rewards', 'To be announced'],
    ],
  },
]
const initialMockNotifications: PortalNotification[] = [
  {
    id: 'mock-1',
    title: 'Portal preview',
    message: 'Notification center placeholder is now connected to the shell.',
    timestamp: 'Just now',
  },
]

function routeFromPath(pathname = window.location.pathname): RouteId {
  if (pathname.startsWith('/admin/support')) return 'adminSupportReview'
  if (pathname.startsWith('/admin/users')) return 'adminUsers'
  if (pathname.startsWith('/admin/events')) return 'adminEvents'
  if (pathname.startsWith('/admin/chat')) return 'adminChat'
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/chat')) return 'chat'
  if (pathname.startsWith('/events')) return 'events'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/account')) return 'account'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/support/minecraft/general')) return 'supportMinecraftGeneral'
  if (pathname.startsWith('/support/minecraft/report')) return 'supportMinecraftReport'
  if (pathname.startsWith('/support/minecraft/appeal')) return 'supportMinecraftAppeal'
  if (pathname.startsWith('/support/minecraft/apply')) return 'supportMinecraftApply'
  if (pathname.startsWith('/support/minecraft')) return 'supportMinecraft'
  if (pathname.startsWith('/support')) return 'support'
  return 'home'
}

function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || 'SH'
}

function canOpenAdmin(user: PortalUser | null) {
  return hasPermission(user, 'global:admin') || hasPermission(user, 'lifesteal:review')
}

function App() {
  const [route, setRoute] = useState<RouteId>(() => routeFromPath())
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<PortalNotification[]>(initialMockNotifications)
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>([])
  const [profileHoverLingering, setProfileHoverLingering] = useState(false)
  const [adminTransition, setAdminTransition] = useState<'enter' | 'exit' | null>(null)
  const [session, setSession] = useState<SessionState>({ status: 'loading', user: null, error: null })
  const profileHoverTimer = useRef<number | null>(null)
  const notificationMenuOpenRef = useRef(false)
  const latestNotificationsRef = useRef<PortalNotification[]>([])
  const previousAdminMode = useRef<boolean | null>(null)

  async function refreshSession() {
    setSession((current) => ({ status: 'loading', user: current.user, error: null }) as SessionState)
    try {
      const result = await getPortalSession()
      setSession(result.authenticated
        ? { status: 'authenticated', user: result.user, error: null }
        : { status: 'anonymous', user: null, error: null })
    } catch (error) {
      setSession({
        status: 'anonymous',
        user: null,
        error: error instanceof Error ? error.message : 'Could not reach the portal backend.',
      })
    }
  }

  useEffect(() => {
    refreshSession()
    const updateRoute = () => {
      setCurrentPath(window.location.pathname)
      setRoute(routeFromPath())
      setMenuOpen(false)
      setProfileMenuOpen(false)
      closeNotificationMenu()
    }
    const closeTopMenus = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('.profile-menu-wrap')) setProfileMenuOpen(false)
      if (!event.target.closest('.notification-menu-wrap')) closeNotificationMenu()
    }
    const demoLogin = () => refreshSession()
    window.addEventListener('popstate', updateRoute)
    window.addEventListener('pointerdown', closeTopMenus)
    window.addEventListener('portal-demo-login', demoLogin)
    return () => {
      if (profileHoverTimer.current !== null) window.clearTimeout(profileHoverTimer.current)
      window.removeEventListener('popstate', updateRoute)
      window.removeEventListener('pointerdown', closeTopMenus)
      window.removeEventListener('portal-demo-login', demoLogin)
    }
  }, [])

  const user = session.status === 'authenticated' ? session.user : null
  const latestNotifications = notifications.slice(0, 3)
  const notificationBadge = notifications.length > 9 ? '9+' : String(notifications.length)
  notificationMenuOpenRef.current = notificationMenuOpen
  latestNotificationsRef.current = latestNotifications
  const navItems = useMemo(() => [
    { id: 'home' as const, label: 'Home', icon: Home, visible: true },
    { id: 'support' as const, label: 'Support', icon: LifeBuoy, visible: true },
    { id: 'events' as const, label: 'Events', icon: CalendarDays, visible: true },
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, visible: true },
  ].filter((item) => item.visible), [user])
  const adminMode = route === 'admin' || route === 'adminSupportReview' || route === 'adminUsers' || route === 'adminEvents' || route === 'adminChat'
  const activeNavItems = adminMode
    ? [
        { id: 'admin' as const, label: 'Main Menu', icon: Home, visible: true },
        { id: 'adminSupportReview' as const, label: 'Support Review', icon: LifeBuoy, visible: true },
        { id: 'adminEvents' as const, label: 'Events', icon: CalendarDays, visible: true },
        { id: 'adminChat' as const, label: 'Chat', icon: MessageSquare, visible: true },
      ]
    : navItems
  const isNavItemActive = (item: { id: RouteId; label: string }) => (
    adminMode ? route === item.id && (item.id !== 'admin' || item.label === 'Main Menu') : route === item.id
  )

  useEffect(() => {
    if (previousAdminMode.current === null) {
      previousAdminMode.current = adminMode
      return undefined
    }
    if (previousAdminMode.current === adminMode) return undefined
    previousAdminMode.current = adminMode
    setAdminTransition(adminMode ? 'enter' : 'exit')
    const timer = window.setTimeout(() => setAdminTransition(null), 720)
    return () => window.clearTimeout(timer)
  }, [adminMode])

  async function logout() {
    setProfileMenuOpen(false)
    closeNotificationMenu()
    setProfileHoverLingering(false)
    await endPortalSession().catch(() => null)
    setSession({ status: 'anonymous', user: null, error: null })
    navigate('/')
  }

  function closeProfileMenu() {
    setProfileMenuOpen(false)
  }

  function closeNotificationMenu() {
    if (notificationMenuOpenRef.current && latestNotificationsRef.current.length > 0) {
      const displayedIds = new Set(latestNotificationsRef.current.map((notification) => notification.id))
      setSeenNotificationIds((current) => Array.from(new Set([...current, ...displayedIds])))
      setNotifications((current) => current.filter((notification) => !displayedIds.has(notification.id)))
    }
    notificationMenuOpenRef.current = false
    setNotificationMenuOpen(false)
  }

  function clearNotifications() {
    setSeenNotificationIds((current) => Array.from(new Set([...current, ...notifications.map((notification) => notification.id)])))
    setNotifications([])
  }

  function keepProfileExpanded() {
    if (profileHoverTimer.current !== null) window.clearTimeout(profileHoverTimer.current)
    setProfileHoverLingering(true)
  }

  function releaseProfileExpanded() {
    if (profileHoverTimer.current !== null) window.clearTimeout(profileHoverTimer.current)
    profileHoverTimer.current = window.setTimeout(() => {
      setProfileHoverLingering(false)
      profileHoverTimer.current = null
    }, 1000)
  }

  return (
    <div className={`portal ${adminMode ? 'admin-mode' : ''}`}>
      {adminTransition ? <AdminModeTransition direction={adminTransition} /> : null}
      <header className="topbar">
        <button className="mobile-menu" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <button className={`brand ${adminMode ? 'admin-brand' : ''}`} type="button" onClick={() => navigate(adminMode ? '/admin' : '/')}>
          <img src={logo} alt="" />
          <span>
            <strong>{adminMode ? 'SHD ADMIN' : 'SHD'}</strong>
            <small>{adminMode ? 'Control' : 'Esports'}</small>
          </span>
        </button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {activeNavItems.map((item) => <NavButton key={`${item.label}-${item.id}`} item={item} active={isNavItemActive(item)} />)}
        </nav>
        <div className="top-actions">
          {user ? (
            <>
              <div className="notification-menu-wrap">
                <button
                  className={`icon-button notification-button ${notificationMenuOpen ? 'open' : ''}`}
                  type="button"
                  aria-label={`Notifications${seenNotificationIds.length > 0 ? `, ${seenNotificationIds.length} seen` : ''}`}
                  aria-expanded={notificationMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    if (notificationMenuOpen) {
                      closeNotificationMenu()
                    } else {
                      setNotificationMenuOpen(true)
                    }
                    setProfileMenuOpen(false)
                  }}
                >
                  <Bell size={18} />
                  {notifications.length > 0 ? <span className="notification-badge">{notificationBadge}</span> : null}
                </button>
                {notificationMenuOpen ? (
                  <div className="notification-menu" role="menu">
                    {latestNotifications.length > 0 ? (
                      <div className="notification-menu-header">
                        <strong>Latest</strong>
                        <button type="button" onClick={clearNotifications}>Clear all</button>
                      </div>
                    ) : null}
                    {latestNotifications.map((notification) => (
                      <article className="notification-item" key={notification.id}>
                        <strong>{notification.title}</strong>
                        <p>{notification.message}</p>
                        <span>{notification.timestamp}</span>
                      </article>
                    ))}
                    {latestNotifications.length === 0 ? (
                      <div className="notification-empty">
                        <strong>No notifications</strong>
                        <p>You currently do not have any notifications.</p>
                      </div>
                    ) : null}
                    <span className="profile-menu-separator" role="separator" />
                    <button type="button" role="menuitem" onClick={() => {
                      closeNotificationMenu()
                      navigate('/chat')
                    }}>
                      Notification page
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="profile-menu-wrap">
                <button
                  className={`profile-chip ${profileMenuOpen ? 'open' : ''} ${profileHoverLingering ? 'hover-linger' : ''}`}
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen((value) => !value)
                    closeNotificationMenu()
                  }}
                  onPointerEnter={keepProfileExpanded}
                  onPointerLeave={releaseProfileExpanded}
                  onFocus={keepProfileExpanded}
                  onBlur={releaseProfileExpanded}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{initials(user.displayName)}</span>}
                  <strong>{user.displayName}</strong>
                </button>
                {profileMenuOpen ? (
                  <div className="profile-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => {
                      closeProfileMenu()
                      navigate('/account')
                    }}>My Account</button>
                    <button type="button" role="menuitem" onClick={() => {
                      closeProfileMenu()
                      navigate('/dashboard')
                    }}>Dashboard</button>
                    <button type="button" role="menuitem" onClick={() => {
                      closeProfileMenu()
                      navigate('/settings')
                    }}>Settings</button>
                    <span className="profile-menu-separator" role="separator" />
                    {adminMode ? (
                      <>
                        <button type="button" role="menuitem" onClick={() => {
                          closeProfileMenu()
                          navigate('/')
                        }}>Exit admin panel</button>
                        <span className="profile-menu-separator" role="separator" />
                      </>
                    ) : canOpenAdmin(user) ? (
                      <>
                        <button type="button" role="menuitem" onClick={() => {
                          closeProfileMenu()
                          navigate('/admin')
                        }}>Admin panel</button>
                        <span className="profile-menu-separator" role="separator" />
                      </>
                    ) : null}
                    <button type="button" role="menuitem" onClick={logout}>
                      <LogOut size={15} />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <button className="login-button" type="button" onClick={() => beginPortalLogin('/')}>
              <LockKeyhole size={17} />
              Login
            </button>
          )}
        </div>
      </header>

      <div className={`mobile-panel ${menuOpen ? 'open' : ''}`}>
        {activeNavItems.map((item) => <NavButton key={`${item.label}-${item.id}`} item={item} active={isNavItemActive(item)} />)}
      </div>

      <main>
        {session.error ? <BackendNotice message={session.error} /> : null}
        {route === 'admin' ? <AdminMainPage user={user} /> : null}
        {route === 'adminSupportReview' ? <AdminSupportReviewPage user={user} currentPath={currentPath} /> : null}
        {route === 'adminUsers' ? <AdminUsersPage user={user} /> : null}
        {route === 'adminEvents' ? <AdminEventsPage user={user} currentPath={currentPath} /> : null}
        {route === 'adminChat' ? <ChatPage user={user} notifications={notifications} mode="admin" /> : null}
        {route === 'home' ? <Landing /> : null}
        {route === 'events' ? <EventsPage /> : null}
        {route === 'support' ? <SupportEntry user={user} /> : null}
        {route === 'supportMinecraft' ? <MinecraftSupportPage user={user} /> : null}
        {route === 'supportMinecraftApply' ? <MinecraftApplyPage user={user} /> : null}
        {route === 'supportMinecraftAppeal' ? <MinecraftAppealPage user={user} /> : null}
        {route === 'supportMinecraftReport' ? <MinecraftReportPage user={user} /> : null}
        {route === 'supportMinecraftGeneral' ? <MinecraftGeneralSupportPage user={user} /> : null}
        {route === 'settings' ? <SettingsPage user={user} /> : null}
        {route === 'account' ? <MyAccountPage user={user} /> : null}
        {route === 'dashboard' ? <DashboardPage user={user} notifications={notifications} /> : null}
        {route === 'chat' ? <ChatPage user={user} notifications={notifications} /> : null}
      </main>

      <footer className="footer">
        <button type="button">Terms</button>
        <button type="button">Privacy</button>
        <button type="button">Contact</button>
        <button type="button">Discord</button>
      </footer>
    </div>
  )
}

function NavButton({ item, active }: { item: { id: RouteId; label: string; icon: typeof Home }; active: boolean }) {
  const Icon = item.icon
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} type="button" onClick={() => navigate(routes[item.id])}>
      <Icon size={17} />
      {item.label}
    </button>
  )
}

function AdminModeTransition({ direction }: { direction: 'enter' | 'exit' }) {
  return (
    <div className="admin-mode-transition" aria-live="polite" aria-label={direction === 'enter' ? 'Admin mode loading' : 'Returning to portal'}>
      <div>
        <span>{direction === 'enter' ? 'Admin mode' : 'Portal mode'}</span>
        <strong>{direction === 'enter' ? 'Loading control panel' : 'Returning to portal'}</strong>
        <i />
      </div>
    </div>
  )
}

function BackendNotice({ message }: { message: string }) {
  return (
    <section className="notice warning">
      <strong>Backend unavailable</strong>
      <span>{message}</span>
    </section>
  )
}

function Landing() {
  return (
    <section className="landing">
      <div className="hero-mark">
        <img src={logo} alt="" />
      </div>
      <p className="eyebrow">SHD ESPORTS</p>
      <h1>SHD PORTAL</h1>
      <p className="hero-copy">
        One portal for everything SHD.
        <br />
        Support, applications, events and account management in one place.
      </p>
      <div className="hero-actions three-actions">
        <button className="primary-action" type="button" onClick={() => navigate('/support')}>
          Support
          <ChevronRight size={18} />
        </button>
        <button className="secondary-action" type="button" onClick={() => navigate('/dashboard')}>
          Dashboard
        </button>
        <button className="secondary-action" type="button" onClick={() => navigate('/settings')}>
          Settings
        </button>
      </div>
    </section>
  )
}

function formatCountdown(target: string) {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return { days: '00', hours: '00', minutes: '00', seconds: '00', label: 'Starting now' }
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return { days: pad(days), hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds), label: 'Starts in' }
}

function EventsPage() {
  const featuredEvent = upcomingEvents[0]
  const otherEvents = upcomingEvents.slice(1)
  const [countdown, setCountdown] = useState(() => featuredEvent.startsAt ? formatCountdown(featuredEvent.startsAt) : null)

  useEffect(() => {
    if (!featuredEvent.startsAt) return undefined
    const updateCountdown = () => setCountdown(formatCountdown(featuredEvent.startsAt || ''))
    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(timer)
  }, [featuredEvent.startsAt])

  return (
    <section className="page events-page">
      <PageHeader eyebrow="Events" title="SHD EVENTS" copy="Upcoming SHD events, registration windows, and event links in one place." />

      <section className="event-feature">
        <div>
          <span className="event-main-label">Main Event</span>
          <span className={`event-status ${featuredEvent.status}`}>{featuredEvent.status}</span>
          <p className="eyebrow">{featuredEvent.category}</p>
          <h2>{featuredEvent.title}</h2>
          <p>{featuredEvent.description}</p>
        </div>
        {countdown ? (
          <div className="event-countdown" aria-label={`${countdown.label} ${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, ${countdown.seconds} seconds`}>
            <span>{countdown.label}</span>
            <strong>{countdown.days}<small>d</small></strong>
            <strong>{countdown.hours}<small>h</small></strong>
            <strong>{countdown.minutes}<small>m</small></strong>
            <strong>{countdown.seconds}<small>s</small></strong>
          </div>
        ) : null}
        <dl>
          <div><dt>Date</dt><dd>{featuredEvent.date}</dd></div>
          {featuredEvent.details.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        {featuredEvent.href ? (
          <a className="primary-action event-link" href={featuredEvent.href} target="_blank" rel="noreferrer">
            {featuredEvent.linkLabel || 'Open Event'}
            <ChevronRight size={18} />
          </a>
        ) : null}
      </section>

      <div className="event-grid">
        {otherEvents.map((event) => (
          <article className="event-card" key={event.id}>
            <header>
              <div>
                <span className={`event-status ${event.status}`}>{event.status}</span>
                <h2>{event.title}</h2>
              </div>
              <small>{event.category}</small>
            </header>
            <p>{event.description}</p>
            <dl>
              <div><dt>Date</dt><dd>{event.date}</dd></div>
              {event.details.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
            {event.href ? (
              <a className="secondary-action event-link" href={event.href} target="_blank" rel="noreferrer">
                {event.linkLabel || 'Open Event'}
              </a>
            ) : (
              <button className="secondary-action event-link" type="button" disabled>Coming soon</button>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function AdminMainPage({ user }: { user: PortalUser | null }) {
  if (!user) {
    return (
      <section className="page admin-page">
        <PageHeader eyebrow="Admin Panel" title="LOGIN REQUIRED" copy="Sign in with a staff account to access the admin panel." />
        <div className="support-login-card">
          <LockKeyhole size={24} />
          <button className="primary-action" type="button" onClick={() => beginPortalLogin('/admin')}>Login</button>
        </div>
      </section>
    )
  }

  if (!canOpenAdmin(user)) {
    return (
      <section className="page admin-page">
        <PageHeader eyebrow="Admin Panel" title="ACCESS DENIED" copy="This area is only available for staff with admin panel access." />
      </section>
    )
  }

  return (
    <section className="page admin-page">
      <PageHeader eyebrow="SHD ADMIN" title="MAIN MENU" copy="Placeholder control center for support, users, events and system tools." />
      <div className="admin-main-grid">
        <button className="admin-main-card" type="button" onClick={() => navigate('/admin/support')}>
          <LifeBuoy size={22} />
          <h2>Support Review</h2>
          <p>Applications, appeals, reports and general support will be reviewed from here.</p>
        </button>
        <button className="admin-main-card" type="button" onClick={() => navigate('/admin/users')}>
          <Users size={22} />
          <h2>Users</h2>
          <p>User lookup, SHD IDs, linked accounts, roles and permissions.</p>
        </button>
        <button className="admin-main-card" type="button" onClick={() => navigate('/admin/events')}>
          <CalendarDays size={22} />
          <h2>Events</h2>
          <p>Event registrations, event status, rules and public event visibility.</p>
        </button>
        <section className="admin-main-card">
          <ServerCog size={22} />
          <h2>Systems</h2>
          <p>Server agent, health checks, logs, deployments and infrastructure actions.</p>
        </section>
      </div>
      <section className="admin-overview">
        <header>
          <Activity size={18} />
          <h2>Live Overview</h2>
          <span>Preview data</span>
        </header>
        <div className="admin-overview-grid">
          <AdminOverviewMetric label="Open Queues" value="7" />
          <AdminOverviewMetric label="Users" value="128" />
          <AdminOverviewMetric label="Running Systems" value="9" />
          <AdminOverviewMetric label="Paused Systems" value="2" tone="warn" />
          <AdminOverviewMetric label="Active Websites" value="4" />
          <AdminOverviewMetric label="G17 Laptop Server" value="Operational" tone="good" />
        </div>
        <section className="admin-health-panel" aria-label="G17 laptop server quick health">
          <AdminHealthSegment label="CPU" value={28} unit="%" />
          <AdminHealthSegment label="TMP" value={61} unit="C" />
          <AdminHealthSegment label="RAM" value={54} unit="%" />
          <AdminHealthSegment label="SSD" value={72} unit="%" />
        </section>
      </section>
    </section>
  )
}

function AdminSupportReviewPage({ user, currentPath }: { user: PortalUser | null; currentPath: string }) {
  const activeReviewId = currentPath.match(/\/admin\/support\/review-([^/]+)/)?.[1] || null
  const reviewMetrics = [
    ['Total', '18'],
    ['Minecraft', '9'],
    ['Events', '3'],
    ['Valorant', '0'],
  ]
  const openQueues = [
    { id: 'AP-1024', type: 'Application', category: 'Minecraft', requester: 'PrimeLuigi', status: 'Under review', updated: '2 min ago', href: '/admin/support/review-AP-1024' },
    { id: 'REPORT-1019', type: 'Player Report', category: 'Minecraft', requester: 'qopzex', status: 'Waiting staff', updated: '11 min ago' },
    { id: 'APPEAL-1014', type: 'Ban Appeal', category: 'Minecraft', requester: 'TlzMax5454', status: 'Needs evidence', updated: '24 min ago' },
    { id: 'EVENT-1008', type: 'Event Support', category: 'Events', requester: 'vlt_luigi', status: 'Waiting user', updated: '38 min ago' },
  ]
  const archivedQueues = [
    { id: 'SUPPORT-0998', type: 'General Support', category: 'Minecraft', requester: 'zex', status: 'Resolved', updated: 'Yesterday' },
    { id: 'APPLY-0984', type: 'Application', category: 'Minecraft', requester: 'Nora', status: 'Accepted', updated: 'Jul 16' },
    { id: 'REPORT-0971', type: 'Player Report', category: 'Minecraft', requester: 'Mika', status: 'Closed', updated: 'Jul 15' },
  ]

  if (!user) {
    return (
      <section className="page admin-page">
        <PageHeader eyebrow="Support Review" title="LOGIN REQUIRED" copy="Sign in with a staff account to access support review." />
        <div className="support-login-card">
          <LockKeyhole size={24} />
          <button className="primary-action" type="button" onClick={() => beginPortalLogin('/admin/support')}>Login</button>
        </div>
      </section>
    )
  }

  if (!canOpenAdmin(user)) {
    return (
      <section className="page admin-page">
        <PageHeader eyebrow="Support Review" title="ACCESS DENIED" copy="This area is only available for staff with support review access." />
      </section>
    )
  }

  if (activeReviewId === 'AP-1024') {
    return <AdminSupportSubmissionView user={user} />
  }

  return (
    <section className="page admin-page admin-review-page">
      <PageHeader eyebrow="Admin / Support" title="SUPPORT REVIEW" copy="Live support overview for open queues across Minecraft, events, applications, appeals, reports and general requests." />
      <section className="admin-review-overview">
        <header>
          <LifeBuoy size={18} />
          <h2>Live Queue Overview</h2>
          <span>Preview data</span>
        </header>
        <div className="admin-review-grid">
          {reviewMetrics.map(([label, value]) => (
            <div className={label === 'Total' ? 'primary' : ''} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="admin-queue-board">
        <header>
          <div>
            <p className="eyebrow">Review Queue</p>
            <h2>Open Queues</h2>
          </div>
          <span>{openQueues.length} active</span>
        </header>
        <div className="admin-queue-list">
          {openQueues.map((item) => <AdminQueueRow key={item.id} item={item} />)}
        </div>
        <div className="admin-archive-head">
          <h3>Archived Forms</h3>
          <span>{archivedQueues.length} finished</span>
        </div>
        <div className="admin-queue-list archived">
          {archivedQueues.map((item) => <AdminQueueRow key={item.id} item={item} archived />)}
        </div>
      </section>
    </section>
  )
}

function AdminUsersPage({ user }: { user: PortalUser | null }) {
  const [query, setQuery] = useState('')
  const [selectedUserShdId, setSelectedUserShdId] = useState<string | null>(null)
  const adminUsers = [
    { section: 'Owners', name: 'PrimeLuigi', username: 'vlt_luigi', shdId: 'SHD0001', joined: 'July 2026', discordId: '1248919319967039498', minecraft: 'PrimeLuigi', minecraftUuid: '6ad0d6d1-90ca-49aa-b5aa-d4c7e197b60e', status: 'Online', event: 'Lifesteal Practice', open: '1', archived: '2', riskAlerts: '0' },
    { section: 'Owners', name: 'TlzMax5454', username: 'tlzmax', shdId: 'SHD0003', joined: 'July 2026', discordId: '1182045023315118130', minecraft: 'TlzMax5454', minecraftUuid: 'f4ae7f4f-cb60-45ff-bb15-576c89330e78', status: 'Idle', event: 'Lifesteal Beta', open: '0', archived: '1', riskAlerts: '1' },
    { section: 'Staff', name: 'qopzex', username: 'qopzex', shdId: 'SHD0002', joined: 'July 2026', discordId: '1109506589263659009', minecraft: 'qopzex', minecraftUuid: '843c54a3-0568-4033-8561-ab68bfeed99f', status: 'Online', event: 'None', open: '0', archived: '0', riskAlerts: '0' },
    { section: 'Members', name: 'Nora', username: 'nora', shdId: 'SHD0042', joined: 'July 2026', discordId: '1092000000000000042', minecraft: 'Nora', minecraftUuid: 'pending', status: 'Offline', event: 'None', open: '0', archived: '1', riskAlerts: '0' },
    { section: 'Members', name: 'Mika', username: 'mika', shdId: 'SHD0043', joined: 'July 2026', discordId: '1092000000000000043', minecraft: 'Mika', minecraftUuid: 'pending', status: 'Do not disturb', event: 'Lifesteal Practice', open: '2', archived: '0', riskAlerts: '2' },
    { section: 'Members', name: 'zex', username: 'zex', shdId: 'SHD0044', joined: 'July 2026', discordId: '1092000000000000044', minecraft: 'zex', minecraftUuid: 'pending', status: 'Online', event: 'None', open: '0', archived: '3', riskAlerts: '0' },
    { section: 'Members', name: 'Rin', username: 'rin', shdId: 'SHD0045', joined: 'July 2026', discordId: '1092000000000000045', minecraft: 'Rin', minecraftUuid: 'pending', status: 'Idle', event: 'Event waitlist', open: '1', archived: '0', riskAlerts: '1' },
  ]
  const normalizedQuery = query.trim().toLowerCase()
  const visibleUsers = normalizedQuery
    ? adminUsers.filter((entry) => [entry.name, entry.shdId, entry.discordId, entry.section].some((value) => value.toLowerCase().includes(normalizedQuery)))
    : adminUsers
  const sections = ['Owners', 'Staff', 'Members']
  const selectedUser = adminUsers.find((entry) => entry.shdId === selectedUserShdId)

  if (!user) {
    return (
      <section className="page admin-page">
        <PageHeader eyebrow="Admin / Users" title="LOGIN REQUIRED" copy="Sign in with a staff account to access user review." />
        <div className="support-login-card">
          <LockKeyhole size={24} />
          <button className="primary-action" type="button" onClick={() => beginPortalLogin('/admin/users')}>Login</button>
        </div>
      </section>
    )
  }

  if (!canOpenAdmin(user)) {
    return (
      <section className="page admin-page">
        <PageHeader eyebrow="Admin / Users" title="ACCESS DENIED" copy="This area is only available for staff with user review access." />
      </section>
    )
  }

  return (
    <section className="page admin-page admin-users-page">
      <PageHeader eyebrow="Admin / Users" title="USERS" copy="Search and review SHD users, staff roles, Discord identities and risk alerts." />
      <section className="admin-user-search">
        <Search size={18} />
        <input value={query} placeholder="Search users, SHD IDs, Discord IDs, or roles" onChange={(event) => setQuery(event.currentTarget.value)} />
        <span>{visibleUsers.length} shown</span>
      </section>
      <section className="admin-users-table">
        <div className="admin-users-head">
          <span>Name</span>
          <span>SHD ID</span>
          <span>Joined</span>
          <span>Discord ID</span>
          <span>Risk Alerts</span>
        </div>
        {sections.map((section) => {
          const entries = visibleUsers.filter((entry) => entry.section === section)
          if (entries.length === 0) return null
          return (
            <div className="admin-users-section" key={section}>
              <div className="admin-users-section-label">{section}</div>
              {entries.map((entry) => (
                <button className="admin-user-row" type="button" key={entry.shdId} onClick={() => setSelectedUserShdId(entry.shdId)}>
                  <strong>{entry.name}</strong>
                  <span>{entry.shdId}</span>
                  <span>{entry.joined}</span>
                  <span>{entry.discordId}</span>
                  <span className={Number(entry.riskAlerts) > 0 ? 'risk' : ''}>{entry.riskAlerts}</span>
                </button>
              ))}
            </div>
          )
        })}
      </section>
      {selectedUser ? <AdminUserProfileCard user={selectedUser} onClose={() => setSelectedUserShdId(null)} /> : null}
    </section>
  )
}

function AdminEventsPage({ user, currentPath }: { user: PortalUser | null; currentPath: string }) {
  const eventMetrics = [
    ['Published', '2'],
    ['Drafts', '2'],
    ['Archived', '1'],
    ['Feeds', '4'],
  ]
  const lifestealSchedule = [
    { date: '20 July 2026', time: '18:00 CEST', type: 'Server Start', title: 'Event Start', description: 'The server opens for the first public Season 1 session.' },
    { date: '20 July 2026', time: '18:00 CEST', type: 'Protection Window', title: 'Grace Period', description: 'PvP, combat tags, lifesteal, heart loss, eliminations, and revivals stay disabled for the first hour.' },
    { date: '20 July 2026', time: '19:00 CEST', type: 'Milestone', title: 'Bloodright Ascension', description: 'Be the first player to reach the announced kill requirement after grace ends.' },
  ]
  const adminEvents = [
    {
      id: 'EVT-2001',
      title: 'SHD Lifesteal Beta Season',
      group: 'Published',
      category: 'Minecraft',
      parent: 'SHD Global',
      status: 'Published',
      date: 'July 23, 2026 18:00',
      owner: 'PrimeLuigi',
      consumers: ['Portal', 'Lifesteal site', 'Discord bot', 'Minecraft server'],
      description: 'The active Lifesteal beta season with applications, anti-cheat review, custom rules, and account-linked support workflows.',
      childEvents: lifestealSchedule,
    },
    {
      id: 'EVT-2002',
      title: 'Lifesteal Practice Event',
      group: 'Published',
      category: 'Minecraft',
      parent: 'SHD Lifesteal Beta Season',
      status: 'Published',
      date: 'TBA',
      owner: 'qopzex',
      consumers: ['Portal', 'Lifesteal site'],
      description: 'A smaller practice event used for testing registrations, rules, and support workflows before larger public events.',
      childEvents: [],
    },
    {
      id: 'EVT-2003',
      title: 'Community Night',
      group: 'Drafts',
      category: 'Community',
      parent: 'SHD Global',
      status: 'Draft',
      date: 'TBA',
      owner: 'TlzMax5454',
      consumers: ['Staff preview'],
      description: 'Community event placeholder for announcements, signups, and future cross-game activities.',
      childEvents: [],
    },
    {
      id: 'EVT-2004',
      title: 'Valorant Scrim Block',
      group: 'Drafts',
      category: 'Valorant',
      parent: 'SHD Global',
      status: 'Draft',
      date: 'TBA',
      owner: 'PrimeLuigi',
      consumers: ['Staff preview'],
      description: 'Internal planning record for a future Valorant event workflow.',
      childEvents: [],
    },
    {
      id: 'EVT-1997',
      title: 'Closed Beta Warmup',
      group: 'Archived',
      category: 'Minecraft',
      parent: 'SHD Lifesteal Beta Season',
      status: 'Archived',
      date: 'July 16, 2026',
      owner: 'PrimeLuigi',
      consumers: ['Discord history'],
      description: 'Archived warmup event. Public website feeds are disabled, but Discord message history remains.',
      childEvents: [],
    },
  ]
  const eventGroups = ['Published', 'Drafts', 'Archived']
  const activeEventId = currentPath.match(/\/admin\/events\/([^/]+)/)?.[1] || null
  const eventFormMode = activeEventId === 'new' ? 'create' : currentPath.endsWith('/edit') ? 'edit' : null
  const editEventId = currentPath.match(/\/admin\/events\/([^/]+)\/edit$/)?.[1] || null
  const selectedEvent = adminEvents.find((event) => event.id.toLowerCase() === activeEventId?.toLowerCase())
  const eventToEdit = adminEvents.find((event) => event.id.toLowerCase() === editEventId?.toLowerCase())

  if (!user) {
    return (
      <section className="page admin-page">
        <PageHeader eyebrow="Admin / Events" title="LOGIN REQUIRED" copy="Sign in with a staff account to access event management." />
        <div className="support-login-card">
          <LockKeyhole size={24} />
          <button className="primary-action" type="button" onClick={() => beginPortalLogin('/admin/events')}>Login</button>
        </div>
      </section>
    )
  }

  if (!canOpenAdmin(user)) {
    return (
      <section className="page admin-page">
        <PageHeader eyebrow="Admin / Events" title="ACCESS DENIED" copy="This area is only available for staff with event management access." />
      </section>
    )
  }

  if (eventFormMode === 'create') {
    return <AdminEventFormPage mode="create" />
  }

  if (eventFormMode === 'edit' && eventToEdit) {
    return <AdminEventFormPage mode="edit" event={eventToEdit} />
  }

  if (selectedEvent) {
    return <AdminEventDetailPage event={selectedEvent} />
  }

  return (
    <section className="page admin-page admin-events-page">
      <div className="admin-events-topline">
        <PageHeader eyebrow="Admin / Events" title="EVENTS" copy="Structured event control for portal pages, event websites, Discord announcements and server-specific event data." />
        <button className="primary-action" type="button" onClick={() => navigate('/admin/events/new')}>Create Event</button>
      </div>
      <section className="admin-review-overview">
        <header>
          <CalendarDays size={18} />
          <h2>Event Pipeline</h2>
          <span>Preview data</span>
        </header>
        <div className="admin-review-grid">
          {eventMetrics.map(([label, value]) => (
            <div className={label === 'Upcoming' ? 'primary' : ''} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-events-table-card">
        <header>
          <div>
            <p className="eyebrow">Event Records</p>
            <h2>Published, Draft and Archived Events</h2>
          </div>
          <span>{adminEvents.length} total</span>
        </header>
        <div className="admin-events-table-head">
          <span>Event</span>
          <span>Category</span>
          <span>Date</span>
          <span>Feeds</span>
          <span>Status</span>
        </div>
        {eventGroups.map((group) => {
          const entries = adminEvents.filter((event) => event.group === group)
          if (entries.length === 0) return null
          return (
            <div className="admin-events-table-section" key={group}>
              <div className="admin-events-section-label">{group}</div>
              {entries.map((event) => (
                <button className="admin-events-table-row" type="button" key={event.id} onClick={() => navigate(`/admin/events/${event.id}`)}>
                  <strong>{event.title}<small>{event.id} / {event.parent}</small></strong>
                  <span>{event.category}</span>
                  <span>{event.date}</span>
                  <span>{event.consumers.length} active</span>
                  <span className={`admin-event-status ${event.status.toLowerCase()}`}>{event.status}</span>
                </button>
              ))}
            </div>
          )
        })}
      </section>

      <section className="admin-event-feeds">
        <header>
          <Database size={18} />
          <div>
            <p className="eyebrow">Distribution</p>
            <h2>Feed Preview</h2>
          </div>
        </header>
        <div className="admin-event-feed-grid">
          <article>
            <strong>Website feeds</strong>
            <p>Main portal, Lifesteal website, and future event pages can read the same structured event record.</p>
            <code>/api/events/lifesteal-beta</code>
          </article>
          <article>
            <strong>Discord bot payload</strong>
            <p>Publishing can trigger bot announcements with title, date, status, signup link and target guild.</p>
            <code>event.published - discord.notify</code>
          </article>
          <article>
            <strong>Event servers</strong>
            <p>Game servers can receive event visibility, rules version, signup state and countdown metadata.</p>
            <code>lifesteal.event.sync</code>
          </article>
        </div>
      </section>
    </section>
  )
}

function AdminEventDetailPage({ event }: {
  event: {
    id: string
    title: string
    category: string
    parent: string
    status: string
    date: string
    owner: string
    consumers: string[]
    description: string
    childEvents: Array<{ date: string; time: string; type: string; title: string; description: string }>
  }
}) {
  return (
    <section className="page admin-page admin-events-page">
      <section className="admin-event-detail">
        <header>
          <div>
            <p className="eyebrow">{event.id} / {event.status}</p>
            <h2 id="admin-event-detail-title">{event.title}</h2>
            <span>{event.parent}</span>
          </div>
          <button type="button" onClick={() => navigate('/admin/events')}>Back to Events</button>
        </header>
        <div className="admin-event-detail-grid">
          <dl>
            <div><dt>Category</dt><dd>{event.category}</dd></div>
            <div><dt>Date</dt><dd>{event.date}</dd></div>
            <div><dt>Owner</dt><dd>{event.owner}</dd></div>
            <div><dt>Consumers</dt><dd>{event.consumers.join(', ')}</dd></div>
          </dl>
          <article>
            <strong>Public description</strong>
            <p>{event.description}</p>
          </article>
        </div>
        <section className="admin-event-detail-schedule">
          <div>
            <p className="eyebrow">Nested Events</p>
            <h3>Lifesteal beta schedule</h3>
          </div>
          {event.childEvents.length > 0 ? (
            <div className="admin-event-schedule-list">
              {event.childEvents.map((child) => (
                <article key={`${child.date}-${child.time}-${child.title}`}>
                  <time>{child.date}<span>{child.time}</span></time>
                  <div>
                    <small>{child.type}</small>
                    <strong>{child.title}</strong>
                    <p>{child.description}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="admin-event-empty">No nested event schedule is attached to this record yet.</p>
          )}
        </section>
        <div className="admin-event-detail-actions">
          <button className="secondary-action" type="button" onClick={() => navigate(`/admin/events/${event.id}/edit`)}>Edit</button>
          <button className="secondary-action" type="button">Save as draft</button>
          <button className="secondary-action" type="button">Revoke publish</button>
          <button className="secondary-action danger" type="button">Archive</button>
          <button className="primary-action" type="button">Publish</button>
        </div>
      </section>
    </section>
  )
}

function AdminEventFormPage({ mode, event }: {
  mode: 'create' | 'edit'
  event?: {
    id: string
    title: string
    category: string
    parent: string
    status: string
    date: string
    owner: string
    consumers: string[]
    description: string
    childEvents: Array<{ date: string; time: string; type: string; title: string; description: string }>
  }
}) {
  const isEdit = mode === 'edit'
  const title = isEdit ? `EDIT ${event?.id || 'EVENT'}` : 'CREATE EVENT'
  const childEvents = event?.childEvents.length ? event.childEvents : [
    { date: '20 July 2026', time: '18:00 CEST', type: 'Server Start', title: 'Event Start', description: 'The server opens for the first public Season 1 session.' },
  ]

  return (
    <section className="page admin-page admin-events-page">
      <section className="admin-event-form-page">
        <header>
          <div>
            <p className="eyebrow">Admin / Events</p>
            <h1>{title}</h1>
            <span>{isEdit ? 'Update the event record and decide what gets synced again.' : 'Create a structured event record for websites, Discord bots and event servers.'}</span>
          </div>
          <button type="button" onClick={() => navigate(isEdit && event ? `/admin/events/${event.id}` : '/admin/events')}>{isEdit ? 'Back to Event' : 'Back to Events'}</button>
        </header>

        <div className="admin-event-form-shell">
          <section className="admin-event-form-panel">
            <div>
              <p className="eyebrow">Core Record</p>
              <h2>Main Event Details</h2>
            </div>
            <div className="admin-event-form-grid">
              <label>
                Event name
                <input defaultValue={event?.title || 'New SHD Event'} />
              </label>
              <label>
                Event ID
                <input defaultValue={event?.id || 'Auto-generated after save'} disabled={!isEdit} />
              </label>
              <label>
                Parent event / workspace
                <CustomSelect
                  ariaLabel="Parent event or workspace"
                  value={event?.parent === 'SHD Lifesteal Beta Season' ? 'lifesteal-beta' : 'shd-global'}
                  options={[
                    { value: 'shd-global', label: 'SHD Global' },
                    { value: 'lifesteal-beta', label: 'SHD Lifesteal Beta Season' },
                    { value: 'valorant', label: 'Valorant Workspace' },
                  ]}
                  onChange={() => null}
                />
              </label>
              <label>
                Category
                <CustomSelect
                  ariaLabel="Event category"
                  value={(event?.category || 'Minecraft').toLowerCase()}
                  options={[
                    { value: 'minecraft', label: 'Minecraft' },
                    { value: 'community', label: 'Community' },
                    { value: 'valorant', label: 'Valorant' },
                    { value: 'esports', label: 'Esports' },
                  ]}
                  onChange={() => null}
                />
              </label>
              <label>
                Status
                <CustomSelect
                  ariaLabel="Event status"
                  value={(event?.status || 'Draft').toLowerCase()}
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'published', label: 'Published' },
                    { value: 'archived', label: 'Archived' },
                  ]}
                  onChange={() => null}
                />
              </label>
              <label>
                Date / time
                <input defaultValue={event?.date || 'TBA'} />
              </label>
              <label>
                Owner
                <input defaultValue={event?.owner || 'PrimeLuigi'} />
              </label>
              <label>
                Public link
                <input defaultValue="https://lifesteal.shd-esports.com" />
              </label>
            </div>
            <label className="admin-event-description">
              Public description
              <textarea defaultValue={event?.description || 'Describe what users and downstream websites should display for this event.'} />
            </label>
          </section>

          <aside className="admin-event-form-panel">
            <div>
              <p className="eyebrow">Publishing</p>
              <h2>Distribution Targets</h2>
            </div>
            <div className="admin-event-toggles">
              <span>Portal event page</span>
              <span>Lifesteal website</span>
              <span>Discord bot notification</span>
              <span>Event API feed</span>
              <span>Minecraft server sync</span>
              <span>Staff preview only</span>
            </div>
            <div className="admin-event-feed-note">
              <strong>Archive behavior</strong>
              <p>Archived events stop publishing to websites and API feeds. Discord messages can be marked outdated, but not truly revoked from user history.</p>
            </div>
          </aside>
        </div>

        <section className="admin-event-form-panel">
          <div className="admin-event-form-section-head">
            <div>
              <p className="eyebrow">Nested Events</p>
              <h2>Schedule Entries</h2>
            </div>
            <button className="secondary-action" type="button">Add Schedule Entry</button>
          </div>
          <div className="admin-event-edit-schedule">
            {childEvents.map((child, index) => (
              <article key={`${child.date}-${child.time}-${child.title}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div className="admin-event-form-grid">
                  <label>
                    Date
                    <input defaultValue={child.date} />
                  </label>
                  <label>
                    Time
                    <input defaultValue={child.time} />
                  </label>
                  <label>
                    Type
                    <input defaultValue={child.type} />
                  </label>
                  <label>
                    Title
                    <input defaultValue={child.title} />
                  </label>
                </div>
                <label className="admin-event-description compact">
                  Description
                  <textarea defaultValue={child.description} />
                </label>
              </article>
            ))}
          </div>
        </section>

        <div className="admin-event-form-actions">
          <button className="secondary-action danger" type="button">Archive</button>
          <button className="secondary-action" type="button">Save draft</button>
          <button className="secondary-action" type="button">Preview feed</button>
          <button className="primary-action" type="button" onClick={() => navigate(isEdit && event ? `/admin/events/${event.id}` : '/admin/events/EVT-2005')}>Publish Event</button>
        </div>
      </section>
    </section>
  )
}

function AdminUserProfileCard({ user, onClose }: { user: { section: string; name: string; username: string; shdId: string; joined: string; discordId: string; minecraft: string; minecraftUuid: string; status: string; event: string; open: string; archived: string; riskAlerts: string }; onClose: () => void }) {
  return (
    <div className="admin-user-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-user-profile-title">
      <section className="admin-user-profile-card">
        <header>
          <div className="admin-user-profile-title">
            <div className="admin-user-profile-avatar">{initials(user.name)}</div>
            <div>
              <p className="eyebrow">{user.section}</p>
              <h2 id="admin-user-profile-title">{user.name}</h2>
              <span>@{user.username}</span>
            </div>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>
        <div className="admin-user-profile-status">
          <span>Status</span>
          <strong>{user.status}</strong>
        </div>
        <dl>
          <div><dt>SHD ID</dt><dd>{user.shdId}</dd></div>
          <div><dt>Discord ID</dt><dd>{user.discordId}</dd></div>
          <div><dt>Minecraft Username</dt><dd>{user.minecraft}</dd></div>
          <div><dt>Minecraft UUID</dt><dd>{user.minecraftUuid}</dd></div>
          <div><dt>Joined</dt><dd>{user.joined}</dd></div>
          <div><dt>Signed Up For</dt><dd>{user.event}</dd></div>
          <div><dt>Open Submissions</dt><dd>{user.open}</dd></div>
          <div><dt>Archived Submissions</dt><dd>{user.archived}</dd></div>
          <div><dt>Risk Alerts</dt><dd>{user.riskAlerts} ToS / event rule alert{user.riskAlerts === '1' ? '' : 's'}</dd></div>
        </dl>
        <button className="primary-action" type="button" onClick={() => navigate('/admin/chat')}>Contact User</button>
      </section>
    </div>
  )
}

function AdminSupportSubmissionView({ user }: { user: PortalUser }) {
  const [reviewStatus, setReviewStatus] = useState('Under review')
  const [claimedBy, setClaimedBy] = useState<string | null>(null)
  const [denyOverlayOpen, setDenyOverlayOpen] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  const submitter = {
    discordId: '1248919319967039498',
    discordUsername: 'vlt_luigi',
    minecraftUuid: '6ad0d6d1-90ca-49aa-b5aa-d4c7e197b60e',
    minecraftUsername: 'PrimeLuigi',
    joined: 'July 2026',
    shdId: 'SHD0001',
    formId: 'AP-1024',
  }
  const [chatMessages, setChatMessages] = useState([
    ['System', 'Application AP-1024 was submitted and linked to this review chat.'],
    ['System', 'AP-1024 is now under review.'],
    ['PrimeLuigi', 'I submitted everything and accepted the Lifesteal rules.'],
  ])
  const canActOnSubmission = claimedBy === user.displayName || user.role.toLowerCase() === 'owner'

  function claimSubmission() {
    setClaimedBy(user.displayName)
    setChatMessages((current) => [
      ...current,
      ['System', `${user.displayName} claimed AP-1024 and is now reviewing it.`],
    ])
  }

  function acceptSubmission() {
    if (!canActOnSubmission) return
    setReviewStatus('Accepted')
    setChatMessages((current) => [
      ...current,
      ['System', `${user.displayName} accepted AP-1024. The applicant was notified in this linked chat.`],
    ])
  }

  function denySubmission() {
    if (!canActOnSubmission) return
    const reason = denyReason.trim()
    if (!reason) return
    setReviewStatus('Denied')
    setChatMessages((current) => [
      ...current,
      ['System', `${user.displayName} denied AP-1024. Reason: ${reason}`],
    ])
    setDenyReason('')
    setDenyOverlayOpen(false)
  }

  return (
    <section className="page admin-page admin-submission-page">
      <PageHeader eyebrow="APPLY - 1024" title="PrimeLuigi" copy="Applied for SHD Lifesteal Practice Event." />
      <div className="admin-submission-shell">
        <aside className="admin-submission-profile">
          <div className="admin-submission-profile-head">
            <div className="admin-submission-avatar">{initials(submitter.minecraftUsername)}</div>
            <div>
              <h2>{submitter.minecraftUsername}</h2>
              <p>@{submitter.discordUsername}</p>
            </div>
          </div>
          <dl>
            <div><dt>Discord ID <button type="button" onClick={() => navigator.clipboard?.writeText(submitter.discordId)}>Copy</button></dt><dd>{submitter.discordId}</dd></div>
            <div><dt>Discord Username</dt><dd>{submitter.discordUsername}</dd></div>
            <div><dt>Minecraft UUID <button type="button" onClick={() => navigator.clipboard?.writeText(submitter.minecraftUuid)}>Copy</button></dt><dd>{submitter.minecraftUuid}</dd></div>
            <div><dt>Minecraft Username</dt><dd>{submitter.minecraftUsername}</dd></div>
            <div><dt>Joined</dt><dd>{submitter.joined}</dd></div>
            <div><dt>SHD ID</dt><dd>{submitter.shdId}</dd></div>
            <div><dt>Submission ID</dt><dd>{submitter.formId}</dd></div>
          </dl>
          <span className="admin-submission-profile-separator" role="separator" />
          {claimedBy ? <p className="admin-claim-note">Claimed by <strong>{claimedBy}</strong></p> : null}
          {!claimedBy ? (
            <button className="primary-action" type="button" onClick={claimSubmission}>Claim</button>
          ) : canActOnSubmission ? (
            <div className="admin-submission-actions">
              <button className="primary-action" type="button" onClick={acceptSubmission}>Accept</button>
              <button className="secondary-action danger" type="button" onClick={() => setDenyOverlayOpen(true)}>Deny</button>
            </div>
          ) : (
            <p className="admin-claim-note locked">Only the claimer or owners can take action.</p>
          )}
          <button className="secondary-action admin-submission-back" type="button" onClick={() => navigate('/admin/support')}>Back to Support</button>
        </aside>

        <main className="admin-submission-content">
          <header>
            <span>Application</span>
            <strong>{reviewStatus}</strong>
          </header>
          <section>
            <h2>Apply / Join Lifesteal</h2>
            <p>This mock submission represents the form content that staff will review before accepting or denying the request.</p>
          </section>
          <dl>
            <div><dt>Selected Event</dt><dd>SHD Lifesteal Practice Event</dd></div>
            <div><dt>Discord Username</dt><dd>vlt_luigi</dd></div>
            <div><dt>Minecraft Username</dt><dd>PrimeLuigi</dd></div>
            <div><dt>Why do you want to join?</dt><dd>I want to participate in the Lifesteal beta and help test the new support and anti-cheat workflows.</dd></div>
            <div><dt>Staff Notes</dt><dd>Already linked Discord and Minecraft account. Rules accepted before submitting.</dd></div>
            <div><dt>Terms</dt><dd>SHD ToS accepted. Event rules acknowledged.</dd></div>
          </dl>
        </main>

        <aside className="admin-submission-chat">
          <header>
            <h2>Linked Chat</h2>
            <span>AP-1024</span>
          </header>
          <div className="admin-submission-messages">
            {chatMessages.map(([author, message]) => (
              <article key={`${author}-${message}`}>
                <strong>{author}</strong>
                <p>{message}</p>
              </article>
            ))}
          </div>
          <label>
            Staff reply
            <textarea rows={3} placeholder="Ask a follow-up question or update the applicant." />
          </label>
          <button className="primary-action" type="button">Send Preview</button>
        </aside>
      </div>
      {denyOverlayOpen ? (
        <div className="admin-deny-overlay" role="dialog" aria-modal="true" aria-labelledby="deny-review-title">
          <section className="admin-deny-modal">
            <header>
              <p className="eyebrow">Deny Submission</p>
              <h2 id="deny-review-title">AP-1024</h2>
            </header>
            <label>
              Reason
              <textarea value={denyReason} rows={5} placeholder="Tell the user why this submission was denied." onChange={(event) => setDenyReason(event.currentTarget.value)} />
            </label>
            <footer>
              <button className="secondary-action" type="button" onClick={() => setDenyOverlayOpen(false)}>Cancel</button>
              <button className="primary-action" type="button" disabled={!denyReason.trim()} onClick={denySubmission}>Send Denial</button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function AdminQueueRow({ item, archived = false }: { item: { id: string; type: string; category: string; requester: string; status: string; updated: string; href?: string }; archived?: boolean }) {
  const content = (
    <>
      <div>
        <strong>{item.id}</strong>
        <span>{item.type}</span>
      </div>
      <div>
        <span>Category</span>
        <strong>{item.category}</strong>
      </div>
      <div>
        <span>Requester</span>
        <strong>{item.requester}</strong>
      </div>
      <div>
        <span>Status</span>
        <strong>{item.status}</strong>
      </div>
      <small>{item.updated}</small>
    </>
  )

  if (item.href) {
    return (
      <button className={`admin-queue-row clickable ${archived ? 'archived' : ''}`} type="button" onClick={() => navigate(item.href || '/admin/support')}>
        {content}
      </button>
    )
  }

  return (
    <article className={`admin-queue-row ${archived ? 'archived' : ''}`}>
      {content}
    </article>
  )
}

function AdminOverviewMetric({ label, value, tone = 'default', wide = false }: { label: string; value: string; tone?: 'default' | 'good' | 'warn'; wide?: boolean }) {
  return (
    <div className={`admin-overview-metric ${tone} ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function AdminHealthSegment({ label, value, unit }: { label: string; value: number; unit: string }) {
  const tone = value < 30 ? 'good' : value < 70 ? 'warn' : 'danger'
  return (
    <div className={`admin-health-segment ${tone}`} style={{ '--value': value } as React.CSSProperties}>
      <span>{label}</span>
      <strong>{value}<small>{unit}</small></strong>
      <i aria-hidden="true"><b /></i>
    </div>
  )
}

function DashboardPage({ user, notifications }: { user: PortalUser | null; notifications: PortalNotification[] }) {
  const displayName = user?.displayName || 'SHD User'
  return (
    <section className="page dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Welcome back, {displayName}</h2>
        </div>
        <DashboardList items={[
          notifications.length > 0 ? `${notifications.length} new notification waiting` : 'No new notifications',
          'No open support tickets right now',
          'Lifesteal application status is synced through Discord',
        ]} />
      </section>

      <div className="dashboard-stat-grid">
        <DashboardStat icon={LifeBuoy} label="Ticket Activity" value="0" note="Open tickets" />
        <DashboardStat icon={BadgeCheck} label="Application" value="Ready" note="No action needed" />
        <DashboardStat icon={Bell} label="Notifications" value={String(notifications.length)} note={notifications.length > 0 ? 'Needs review' : 'All clear'} />
        <DashboardStat icon={CalendarDays} label="Upcoming" value="1" note="Event placeholder" />
      </div>

      <DashboardPanel icon={CheckSquare} title="Quick Actions" className="dashboard-actions-card">
        <div className="dashboard-quick-actions">
          <button type="button" onClick={() => navigate('/support')}>Open Support</button>
          <button type="button">View my Submissions</button>
          <button type="button" onClick={() => navigate('/chat')}>Direct Messages</button>
          <button type="button">Upcoming Events</button>
        </div>
      </DashboardPanel>

      <div className="dashboard-main-grid">
        <DashboardPanel icon={Activity} title="Recent Activity" className="wide">
          <DashboardTimeline items={[
            ['Today', 'Profile preview updated'],
            ['Yesterday', 'Lifesteal signup confirmed'],
            ['Jul 2026', 'SHD portal preview session created'],
          ]} />
        </DashboardPanel>

        <DashboardPanel icon={MessageSquare} title="Messages & Chats">
          <DashboardList items={['No unread messages', 'Chats will appear here later', 'Discord sync placeholder']} />
        </DashboardPanel>

        <DashboardPanel icon={LifeBuoy} title="Support">
          <DashboardList items={['Applications: none open', 'Appeals: none open', 'Reports: none open']} />
        </DashboardPanel>

        <DashboardPanel icon={CalendarDays} title="Upcoming Events">
          <DashboardList items={['Lifesteal Beta Season', 'Event schedule placeholder', 'No personal RSVP yet']} />
        </DashboardPanel>

        <DashboardPanel icon={Megaphone} title="Announcements">
          <DashboardList items={['Support portal redesign in progress', 'Applications moved to Discord tickets']} />
        </DashboardPanel>

      </div>
    </section>
  )
}

function DashboardStat({ icon: Icon, label, value, note }: { icon: typeof Bell; label: string; value: string; note: string }) {
  return (
    <section className="dashboard-stat">
      <Icon size={19} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  )
}

function DashboardPanel({ icon: Icon, title, className = '', children }: { icon: typeof Bell; title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`dashboard-panel ${className}`}>
      <header>
        <Icon size={18} />
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  )
}

function DashboardList({ items }: { items: string[] }) {
  return (
    <ul className="dashboard-list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function DashboardTimeline({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="dashboard-timeline">
      {items.map(([time, text]) => (
        <div key={`${time}-${text}`}>
          <span>{time}</span>
          <p>{text}</p>
        </div>
      ))}
    </div>
  )
}

type ChatView = 'notifications' | 'friends' | 'requests' | 'announcements' | 'events' | 'esports' | 'dm-luigi' | 'dm-max' | 'dm-zex'

function ChatPage({ user, notifications, mode = 'member' }: { user: PortalUser | null; notifications: PortalNotification[]; mode?: 'member' | 'admin' }) {
  const [activeView, setActiveView] = useState<ChatView>('notifications')
  const [friendFilter, setFriendFilter] = useState<'all' | 'online' | 'requests'>('all')
  const [messageDraft, setMessageDraft] = useState('')
  const [messages, setMessages] = useState<Record<string, string[]>>({
    'dm-luigi': ['Welcome to the SHD chat preview.'],
    'dm-max': ['Ticket sync test message.'],
    'dm-zex': ['Profile cards are looking cleaner.'],
  })
  const friends = [
    { name: 'PrimeLuigi', status: 'online' },
    { name: 'TlzMax5454', status: 'idle' },
    { name: 'qopzex', status: 'offline' },
  ]
  const unreadCount = notifications.length
  const activeLabel = {
    notifications: 'Notifications',
    friends: 'Friends',
    requests: 'Requests',
    announcements: 'SHD Announcements',
    events: 'SHD Events',
    esports: 'SHD Esports',
    'dm-luigi': 'PrimeLuigi',
    'dm-max': 'TlzMax5454',
    'dm-zex': 'qopzex',
  }[activeView]
  const canSend = activeView.startsWith('dm-')

  function sendMessage() {
    const text = messageDraft.trim()
    if (!text || !canSend) return
    setMessages((current) => ({
      ...current,
      [activeView]: [...(current[activeView] || []), text],
    }))
    setMessageDraft('')
  }

  return (
    <section className={`chat-page ${mode === 'admin' ? 'admin-chat-page' : ''}`}>
      {mode === 'admin' ? (
        <div className="admin-chat-bar">
          <span>Admin chat mode</span>
          <button type="button">New notification</button>
          <button type="button">Official message</button>
        </div>
      ) : null}
      <div className="chat-shell">
        <aside className="chat-left">
          <ChatNavButton active={activeView === 'notifications'} label="Notifications" count={unreadCount} onClick={() => setActiveView('notifications')} />
          <ChatNavButton active={activeView === 'friends'} label="Friends" count={friends.length} onClick={() => setActiveView('friends')} />
          <ChatNavButton active={activeView === 'requests'} label="Requests" count={2} onClick={() => setActiveView('requests')} />
          <span className="chat-separator" />
          <ChatNavButton active={activeView === 'announcements'} label="SHD Announcements" onClick={() => setActiveView('announcements')} />
          <ChatNavButton active={activeView === 'events'} label="SHD Events" onClick={() => setActiveView('events')} />
          <ChatNavButton active={activeView === 'esports'} label="SHD Esports" onClick={() => setActiveView('esports')} />
          <span className="chat-separator" />
          <ChatNavButton active={activeView === 'dm-luigi'} label="PrimeLuigi" onClick={() => setActiveView('dm-luigi')} />
          <ChatNavButton active={activeView === 'dm-max'} label="TlzMax5454" onClick={() => setActiveView('dm-max')} />
          <ChatNavButton active={activeView === 'dm-zex'} label="qopzex" onClick={() => setActiveView('dm-zex')} />
        </aside>

        <section className="chat-middle">
          <header className="chat-channel-header">
            <h1>{activeLabel}</h1>
            <span>{canSend ? 'Direct message' : 'View only'}</span>
          </header>
          <div className="chat-content">
            {activeView === 'notifications' ? <ChatNotifications notifications={notifications} /> : null}
            {activeView === 'friends' ? <ChatFriends friends={friends} filter={friendFilter} setFilter={setFriendFilter} /> : null}
            {activeView === 'requests' ? <ChatRequests /> : null}
            {['announcements', 'events', 'esports'].includes(activeView) ? <ChatAnnouncements view={activeView} /> : null}
            {canSend ? <ChatMessages messages={messages[activeView] || []} user={user} /> : null}
          </div>
          {canSend ? (
            <div className="chat-input-row">
              <input
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendMessage()
                }}
                placeholder={`Message ${activeLabel}`}
              />
              <button type="button" onClick={sendMessage} aria-label="Send message"><Send size={16} /></button>
            </div>
          ) : null}
        </section>

        <aside className="chat-right">
          {activeView === 'notifications' ? <ChatNotificationAside count={unreadCount} /> : null}
          {activeView === 'friends' ? <ChatProfileAside user={user} /> : null}
          {activeView === 'requests' ? <ChatRequestsAside /> : null}
          {['announcements', 'events', 'esports'].includes(activeView) ? <ChatChannelAside view={activeView} /> : null}
          {canSend ? <ChatDmAside name={activeLabel} /> : null}
        </aside>
      </div>
    </section>
  )
}

function ChatNavButton({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button className={`chat-nav-button ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <span>{label}</span>
      {count !== undefined ? <strong>{count}</strong> : null}
    </button>
  )
}

function ChatNotifications({ notifications }: { notifications: PortalNotification[] }) {
  return (
    <div className="chat-list-page">
      {(notifications.length ? notifications : [{ id: 'empty', title: 'All clear', message: 'You do not have new notifications right now.', timestamp: 'Now' }]).map((notification) => (
        <article key={notification.id}>
          <strong>{notification.title}</strong>
          <p>{notification.message}</p>
          <span>{notification.timestamp}</span>
        </article>
      ))}
    </div>
  )
}

function ChatFriends({ friends, filter, setFilter }: { friends: Array<{ name: string; status: string }>; filter: 'all' | 'online' | 'requests'; setFilter: (filter: 'all' | 'online' | 'requests') => void }) {
  const visibleFriends = filter === 'online' ? friends.filter((friend) => friend.status === 'online') : friends
  return (
    <div className="chat-friends-page">
      <nav>
        {(['all', 'online', 'requests'] as const).map((item) => <button className={filter === item ? 'active' : ''} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}
      </nav>
      {(filter === 'requests' ? ['vlt_luigi wants to connect', 'Member request placeholder'] : visibleFriends.map((friend) => `${friend.name} - ${friend.status}`)).map((item) => <p key={item}>{item}</p>)}
    </div>
  )
}

function ChatRequests() {
  return (
    <div className="chat-list-page">
      <article><strong>Direct Message Requests</strong><p>Two placeholder requests are waiting for review.</p><span>Preview</span></article>
      <span className="chat-separator" />
      {['PrimeLuigi', 'TlzMax5454', 'qopzex', 'SHD Member'].map((member) => <article key={member}><strong>{member}</strong><p>Select this member to request a direct message.</p><span>Member</span></article>)}
    </div>
  )
}

function ChatAnnouncements({ view }: { view: ChatView }) {
  const title = view === 'events' ? 'Event update' : view === 'esports' ? 'Esports update' : 'Portal update'
  return (
    <div className="chat-message-stack">
      <article><strong>{title}</strong><p>This read-only channel is a placeholder for official SHD posts.</p></article>
      <article><strong>System</strong><p>Members can read this channel, but posting is staff-only.</p></article>
    </div>
  )
}

function ChatMessages({ messages, user }: { messages: string[]; user: PortalUser | null }) {
  return (
    <div className="chat-message-stack">
      {messages.map((message, index) => <article className={index === messages.length - 1 ? 'own' : ''} key={`${message}-${index}`}><strong>{index === messages.length - 1 ? user?.displayName || 'You' : 'SHD Member'}</strong><p>{message}</p></article>)}
    </div>
  )
}

function ChatNotificationAside({ count }: { count: number }) {
  return <ChatAsideBlock title="Important" lines={[`${count} unread notifications`, 'Ticket activity appears here', 'Event reminders appear here']} action="Mark all as read" />
}

function ChatProfileAside({ user }: { user: PortalUser | null }) {
  return <ChatAsideBlock title={user?.displayName || 'Your profile'} lines={['Status: Online', 'Friends preview', 'Profile settings later']} action="Change status" />
}

function ChatRequestsAside() {
  return <ChatAsideBlock title="Requests" lines={['2 pending requests', 'DM requests listed in the middle', 'Member discovery placeholder']} />
}

function ChatChannelAside({ view }: { view: ChatView }) {
  return <ChatAsideBlock title="Channel Info" lines={[String(view).replace('-', ' '), 'Official SHD channel', 'Posting restricted']} />
}

function ChatDmAside({ name }: { name: string }) {
  return <ChatAsideBlock title={name} lines={['Direct message preview', 'Shared profile data later', 'Connected services later']} />
}

function ChatAsideBlock({ title, lines, action }: { title: string; lines: string[]; action?: string }) {
  return (
    <section className="chat-aside-block">
      <h2>{title}</h2>
      {lines.map((line) => <p key={line}>{line}</p>)}
      {action ? <button type="button">{action}</button> : null}
    </section>
  )
}

function SupportEntry({ user }: { user: PortalUser | null }) {
  return (
    <section className="page">
      <PageHeader eyebrow="Support" title="SHD SUPPORT" copy="Find support, submit applications and stay connected with SHD." />
      <div className="card-row">
        <FlowCard icon={LifeBuoy} title="Minecraft" copy="Applications, appeals, reports and everything related to our Minecraft projects." onClick={() => navigate('/support/minecraft')} />
        <FlowCard icon={LifeBuoy} title="SHD Event" copy="Join upcoming events, view information and submit event applications." />
        <FlowCard icon={CircleUserRound} title="Valorant" copy="Team applications, reports and competitive information." />
      </div>
      {!user ? <p className="muted-line">Logging in later will let users see their own ticket and application history.</p> : null}
    </section>
  )
}

function MinecraftSupportPage({ user }: { user: PortalUser | null }) {
  const requireLogin = (path: string) => {
    if (!user) {
      beginPortalLogin(path)
      return
    }
    navigate(path)
  }
  const availableEvents = minecraftEvents.filter((event) => event.applicationOpen)

  return (
    <section className="page">
      <PageHeader eyebrow="Minecraft Support" title="MINECRAFT FORMS" copy="Lifesteal and Minecraft support workflows will open from here." />
      <section className="minecraft-info-card">
        <div className="minecraft-info-card-heading">
          <p className="eyebrow">Available Minecraft Events</p>
          <h2>{availableEvents.length === 1 ? availableEvents[0].title : `${availableEvents.length} events open`}</h2>
          <p>Select the event you want to join or need help with. Applications will use the rulebook attached to that event.</p>
        </div>
        <div className="minecraft-event-list">
          {availableEvents.map((event) => (
            <article className="minecraft-event-summary" key={event.id}>
              <h3>{event.title}</h3>
              <p>{event.description}</p>
              <dl>
                <div><dt>Status</dt><dd>{event.statusLabel}</dd></div>
                <div><dt>Access</dt><dd>{event.accessLabel}</dd></div>
                <div><dt>Support</dt><dd>{event.supportLabel}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
      <div className="card-row support-form-row">
        <FlowCard icon={LifeBuoy} title="Apply / Join" copy="Start a Minecraft application and connect your Discord/Minecraft identity." status="half" onClick={() => requireLogin('/support/minecraft/apply')} />
        <FlowCard icon={ShieldCheck} title="Ban Appeals" copy="Appeal a Minecraft punishment." status="half" onClick={() => requireLogin('/support/minecraft/appeal')} />
        <FlowCard icon={CircleUserRound} title="Report a Player" copy="Report Minecraft player behavior for staff review." status="half" onClick={() => requireLogin('/support/minecraft/report')} />
        <FlowCard icon={LifeBuoy} title="General Support" copy="Get help with joining, setting up mods, account linking, or other Minecraft support questions." status="half" onClick={() => requireLogin('/support/minecraft/general')} />
      </div>
      <div className="support-back-row">
        <button className="support-back-button" type="button" onClick={() => navigate('/support')}>Back to Support</button>
      </div>
    </section>
  )
}

function MinecraftApplyPage({ user }: { user: PortalUser | null }) {
  const applicationEvents = minecraftEvents.filter((event) => event.applicationOpen)
  const selectableApplicationEvents = applicationEvents.filter((event) => !event.applicationStatus)
  const [selectedEventId, setSelectedEventId] = useState(selectableApplicationEvents[0]?.id || applicationEvents[0]?.id || '')
  const [rulesOverlayOpen, setRulesOverlayOpen] = useState(false)
  const [rulesScrolled, setRulesScrolled] = useState(false)
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const selectedEvent = applicationEvents.find((event) => event.id === selectedEventId) || applicationEvents[0]
  const selectedEventApplicationStatus = selectedEvent.applicationStatus

  function changeSelectedEvent(value: string) {
    setSelectedEventId(value)
    setRulesAccepted(false)
    setRulesScrolled(false)
  }

  if (!user) {
    return (
      <section className="page">
        <PageHeader eyebrow="Minecraft Application" title="LOGIN REQUIRED" copy="Sign in before starting a Minecraft application so we can connect the request to your SHD account." />
        <div className="support-login-card">
          <LockKeyhole size={24} />
          <p>After login, you will return to the Apply / Join form.</p>
          <button className="primary-action" type="button" onClick={() => beginPortalLogin('/support/minecraft/apply')}>Login to Apply</button>
        </div>
      </section>
    )
  }

  return (
    <section className="page minecraft-apply-page">
      <PageHeader eyebrow="Minecraft Application" title="APPLY / JOIN" copy="Start your Minecraft application. Linked SHD account identities are filled automatically when available." />
      <form className="support-form-card">
        {applicationEvents.length > 1 ? (
          <section className="form-section">
            <h2>Event</h2>
            <CustomSelect
              ariaLabel="Select Minecraft event"
              className="event-select"
              value={selectedEventId}
              onChange={changeSelectedEvent}
              options={applicationEvents.map((event) => ({
                value: event.id,
                label: event.applicationStatus ? `${event.title} - ${applicationStatusLabels[event.applicationStatus]}` : event.title,
                disabled: Boolean(event.applicationStatus),
              }))}
            />
            <p className="form-helper">{selectedEvent.description}</p>
            {selectedEventApplicationStatus ? (
              <p className="form-status-note">{applicationStatusLabels[selectedEventApplicationStatus]} for this event.</p>
            ) : null}
          </section>
        ) : null}
        <section className="form-section">
          <h2>Account</h2>
          <div className="form-account-summary">
            <span>SHD ID: <strong>{user.shdId || 'Assigned after account setup'}</strong></span>
            <span>Discord: <strong>{user.linkedDiscord ? 'Linked' : 'Not linked yet'}</strong></span>
            <span>Minecraft: <strong>{user.linkedMinecraft ? 'Linked' : 'Not linked yet'}</strong></span>
          </div>
          <div className="form-grid two">
            <label>
              Discord Username
              <input value={user.linkedDiscord?.username || user.username} readOnly />
            </label>
            <label>
              Minecraft Username
              <input defaultValue={user.linkedMinecraft?.username || ''} placeholder="Your current Minecraft name" />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>Application</h2>
          <label>
            Why do you want to join?
            <textarea rows={4} placeholder="Tell staff why you want to join SHD Lifesteal." />
          </label>
          <label>
            Anything staff should know?
            <textarea rows={3} placeholder="Previous names, friends on the server, availability, or other notes." />
          </label>
        </section>

        <section className="form-section compact">
          <label className="form-check">
            <input type="checkbox" />
            I agree to the ToS of SHD Esport.
          </label>
          <label className="form-check rules-check">
            <input type="checkbox" checked={rulesAccepted} readOnly onClick={(event) => {
              event.preventDefault()
              setRulesScrolled(false)
              setRulesOverlayOpen(true)
            }} />
            I agree and understand the rules of {selectedEvent.shortTitle}.
          </label>
        </section>

        <div className="form-actions">
          <button className="secondary-action" type="button" onClick={() => navigate('/support/minecraft')}>Back</button>
          <button className="primary-action" type="button" disabled={Boolean(selectedEventApplicationStatus)}>Submit Application Preview</button>
        </div>
      </form>
      {rulesOverlayOpen ? (
        <div className="rules-overlay" role="dialog" aria-modal="true" aria-labelledby="lifesteal-rules-title">
          <section className="rules-modal">
            <header>
              <div>
                <p className="eyebrow">{selectedEvent.title}</p>
                <h2 id="lifesteal-rules-title">Read before applying</h2>
              </div>
            </header>
            <p className="rules-note">Scroll all the way to the bottom to unlock the acknowledgement button.</p>
            <div className="rules-scroll" onScroll={(event) => {
              const target = event.currentTarget
              if (target.scrollTop + target.clientHeight >= target.scrollHeight - 8) setRulesScrolled(true)
            }}>
              <MarkdownRulesContent markdown={selectedEvent.rulesMarkdown} />
            </div>
            <footer>
              <button type="button" className="secondary-action" onClick={() => setRulesOverlayOpen(false)}>Cancel</button>
              <button type="button" className="primary-action" disabled={!rulesScrolled} onClick={() => {
                setRulesAccepted(true)
                setRulesOverlayOpen(false)
              }}>I have read and understand the rules</button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function MinecraftReportPage({ user }: { user: PortalUser | null }) {
  if (!user) {
    return (
      <section className="page">
        <PageHeader eyebrow="Player Report" title="LOGIN REQUIRED" copy="Sign in before reporting a player so staff can connect the report to your SHD account." />
        <div className="support-login-card">
          <LockKeyhole size={24} />
          <p>After login, you will return to the player report form.</p>
          <button className="primary-action" type="button" onClick={() => beginPortalLogin('/support/minecraft/report')}>Login to Report</button>
        </div>
      </section>
    )
  }

  return (
    <section className="page minecraft-report-page">
      <PageHeader eyebrow="Minecraft Report" title="REPORT A PLAYER" copy="Submit a Minecraft player report across SHD Minecraft events. Your linked SHD account identity is attached automatically for staff review." />
      <form className="support-form-card">
        <section className="form-section">
          <h2>Your Account</h2>
          <div className="form-account-summary">
            <span>SHD ID: <strong>{user.shdId || 'Assigned after account setup'}</strong></span>
            <span>Discord: <strong>{user.linkedDiscord ? 'Linked' : 'Not linked yet'}</strong></span>
            <span>Minecraft: <strong>{user.linkedMinecraft ? 'Linked' : 'Not linked yet'}</strong></span>
          </div>
          <div className="form-grid two">
            <label>
              Discord Username
              <input value={user.linkedDiscord?.username || user.username} readOnly />
            </label>
            <label>
              Your Minecraft Username
              <input value={user.linkedMinecraft?.username || 'No linked Minecraft account'} readOnly />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>Reported Player</h2>
          <div className="form-grid two">
            <label>
              Player Name
              <input placeholder="Minecraft username of the player" />
            </label>
            <label>
              Report Type
              <CustomSelect ariaLabel="Report type" defaultValue="cheating" options={[
                { value: 'cheating', label: 'Cheating / Unfair Advantage' },
                { value: 'toxicity', label: 'Harassment / Toxicity' },
                { value: 'exploit', label: 'Exploit Abuse' },
                { value: 'griefing', label: 'Rule-Breaking Griefing' },
                { value: 'other', label: 'Other' },
              ]} />
            </label>
          </div>
          <p className="form-helper">Later, the portal will resolve the reported player name into UUID, SHD ID, linked Discord account and recent server activity for staff.</p>
        </section>

        <section className="form-section">
          <h2>Report Details</h2>
          <label>
            What happened?
            <textarea rows={5} placeholder="Describe what happened, where it happened, and why staff should review it." />
          </label>
          <label>
            Evidence
            <textarea rows={3} placeholder="Paste screenshots, video links, timestamps, coordinates, chat logs, or anything else staff can use." />
          </label>
        </section>

        <div className="form-actions">
          <button className="secondary-action" type="button" onClick={() => navigate('/support/minecraft')}>Back</button>
          <button className="primary-action" type="button">Submit Report Preview</button>
        </div>
      </form>
    </section>
  )
}

function MinecraftAppealPage({ user }: { user: PortalUser | null }) {
  const [selectedAppealId, setSelectedAppealId] = useState(demoAppealRecords[0]?.id || 'manual')
  const selectedAppeal = demoAppealRecords.find((appeal) => appeal.id === selectedAppealId)

  if (!user) {
    return (
      <section className="page">
        <PageHeader eyebrow="Ban Appeal" title="LOGIN REQUIRED" copy="Sign in before starting an appeal so staff can connect it to your SHD account." />
        <div className="support-login-card">
          <LockKeyhole size={24} />
          <p>After login, you will return to the ban appeal form.</p>
          <button className="primary-action" type="button" onClick={() => beginPortalLogin('/support/minecraft/appeal')}>Login to Appeal</button>
        </div>
      </section>
    )
  }

  return (
    <section className="page minecraft-appeal-page">
      <PageHeader eyebrow="Minecraft Appeal" title="BAN APPEAL" copy="Appeal a ban, temporary suspension, or anti-cheat action. Known appeal records are pulled from your linked SHD account when available." />
      <form className="support-form-card">
        <section className="form-section">
          <h2>Your Account</h2>
          <div className="form-account-summary">
            <span>SHD ID: <strong>{user.shdId || 'Assigned after account setup'}</strong></span>
            <span>Discord: <strong>{user.linkedDiscord ? 'Linked' : 'Not linked yet'}</strong></span>
            <span>Minecraft: <strong>{user.linkedMinecraft ? 'Linked' : 'Not linked yet'}</strong></span>
          </div>
          <div className="form-grid two">
            <label>
              Discord Username
              <input value={user.linkedDiscord?.username || user.username} readOnly />
            </label>
            <label>
              Minecraft Username
              <input value={user.linkedMinecraft?.username || 'No linked Minecraft account'} readOnly />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>Appeal Reference</h2>
          <div className="form-grid two">
            <label>
              Appeal ID
              <CustomSelect
                ariaLabel="Appeal ID"
                value={selectedAppealId}
                onChange={setSelectedAppealId}
                options={[
                  ...demoAppealRecords.map((appeal) => ({
                    value: appeal.id,
                    label: `${appeal.id} - ${appeal.reason}`,
                  })),
                  { value: 'manual', label: 'Enter manually / not listed' },
                ]}
              />
            </label>
            <label>
              Manual Appeal ID
              <input disabled={selectedAppealId !== 'manual'} placeholder="AP-1234" />
            </label>
          </div>
          {selectedAppeal ? (
            <div className="appeal-summary-card">
              <span><strong>Appeal ID</strong>{selectedAppeal.id}</span>
              <span><strong>Evidence ID</strong>{selectedAppeal.evidenceId}</span>
              <span><strong>Status</strong>{selectedAppeal.status.replace('_', ' ')}</span>
              <span><strong>Issued</strong>{selectedAppeal.issuedAt}</span>
              {selectedAppeal.expiresAt ? <span><strong>Temporary Until</strong>{selectedAppeal.expiresAt}</span> : null}
            </div>
          ) : (
            <p className="form-helper">Use the short appeal ID shown on your Minecraft disconnect screen, for example AP-1234.</p>
          )}
        </section>

        <section className="form-section">
          <h2>Appeal Details</h2>
          <label>
            What happened?
            <textarea rows={5} placeholder="Explain what happened from your perspective and why staff should review the action." />
          </label>
          <label>
            Evidence
            <textarea rows={3} placeholder="Paste screenshots, video links, logs, timestamps, or anything else relevant." />
          </label>
        </section>

        <section className="form-section compact">
          <label className="form-check">
            <input type="checkbox" />
            I understand false information can lead to the appeal being denied.
          </label>
        </section>

        <div className="form-actions">
          <button className="secondary-action" type="button" onClick={() => navigate('/support/minecraft')}>Back</button>
          <button className="primary-action" type="button">Submit Appeal Preview</button>
        </div>
      </form>
    </section>
  )
}

function MinecraftGeneralSupportPage({ user }: { user: PortalUser | null }) {
  if (!user) {
    return (
      <section className="page">
        <PageHeader eyebrow="Minecraft Support" title="LOGIN REQUIRED" copy="Sign in before opening a general support request so staff can connect it to your SHD account." />
        <div className="support-login-card">
          <LockKeyhole size={24} />
          <p>After login, you will return to the general Minecraft support form.</p>
          <button className="primary-action" type="button" onClick={() => beginPortalLogin('/support/minecraft/general')}>Login for Support</button>
        </div>
      </section>
    )
  }

  return (
    <section className="page minecraft-general-page">
      <PageHeader eyebrow="Minecraft Support" title="GENERAL SUPPORT" copy="Get help with joining, mod setup, account linking, connection issues, or other Minecraft questions." />
      <form className="support-form-card">
        <section className="form-section">
          <h2>Your Account</h2>
          <div className="form-account-summary">
            <span>SHD ID: <strong>{user.shdId || 'Assigned after account setup'}</strong></span>
            <span>Discord: <strong>{user.linkedDiscord ? 'Linked' : 'Not linked yet'}</strong></span>
            <span>Minecraft: <strong>{user.linkedMinecraft ? 'Linked' : 'Not linked yet'}</strong></span>
          </div>
          <div className="form-grid two">
            <label>
              Discord Username
              <input value={user.linkedDiscord?.username || user.username} readOnly />
            </label>
            <label>
              Minecraft Username
              <input defaultValue={user.linkedMinecraft?.username || ''} placeholder="Optional if not linked yet" />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>Support Request</h2>
          <div className="form-grid two">
            <label>
              Topic
              <CustomSelect ariaLabel="Support topic" defaultValue="mod-setup" options={[
                { value: 'mod-setup', label: 'Mod Setup' },
                { value: 'joining', label: 'Joining the Server' },
                { value: 'account-linking', label: 'Account Linking' },
                { value: 'connection', label: 'Connection Issue' },
                { value: 'client-error', label: 'Client Error / Crash' },
                { value: 'other', label: 'Other Question' },
              ]} />
            </label>
            <label>
              Urgency
              <CustomSelect ariaLabel="Support urgency" defaultValue="normal" options={[
                { value: 'normal', label: 'Normal' },
                { value: 'blocked', label: 'Blocked from Playing' },
                { value: 'time-sensitive', label: 'Time Sensitive' },
              ]} />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>Details</h2>
          <label>
            What do you need help with?
            <textarea rows={5} placeholder="Describe what you are trying to do and where you are stuck." />
          </label>
          <label>
            What have you tried already?
            <textarea rows={3} placeholder="Mention guides followed, errors seen, restart attempts, reinstall attempts, or anything else relevant." />
          </label>
          <label>
            Screenshots, logs, or links
            <textarea rows={3} placeholder="Paste screenshots, crash logs, launcher errors, mod list details, or links." />
          </label>
        </section>

        <div className="form-actions">
          <button className="secondary-action" type="button" onClick={() => navigate('/support/minecraft')}>Back</button>
          <button className="primary-action" type="button">Submit Support Preview</button>
        </div>
      </form>
    </section>
  )
}

function MyAccountPage({ user }: { user: PortalUser | null }) {
  const [profileStatus, setProfileStatus] = useState<'online' | 'idle' | 'offline' | 'dnd'>('online')
  const statusOptions: Array<{ id: typeof profileStatus; label: string }> = [
    { id: 'online', label: 'Online' },
    { id: 'idle', label: 'Idle' },
    { id: 'dnd', label: 'Do not disturb' },
    { id: 'offline', label: 'Offline' },
  ]

  if (!user) {
    return (
      <section className="page account-page">
        <PageHeader eyebrow="My Account" title="SIGN IN REQUIRED" copy="Log in to view your SHD account identity, roles, connected accounts and security overview." />
        <div className="account-empty">
          <LockKeyhole size={24} />
          <button className="primary-action" type="button" onClick={() => beginPortalLogin('/account')}>Login</button>
        </div>
      </section>
    )
  }

  return (
    <section className="page account-page">
      <PageHeader eyebrow="My Account" title="MY ACCOUNT" copy="Your current SHD identity, access, connected services and account status." />

      <div className="account-flow">
        <section className="account-preview-card">
          <div className="account-profile-side">
            <div className="account-avatar">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{initials(user.displayName)}</span>}
              <i className={`status-${profileStatus}`} aria-label={`Status: ${profileStatus}`} />
            </div>
          </div>
          <div className="account-preview-main">
            <p className="eyebrow">Profile Preview</p>
            <div className="account-name-line">
              <h2>{user.displayName}</h2>
            </div>
            <div className="account-username-line">
              <p>@{user.username}</p>
              <span>{user.role}</span>
            </div>
            <small>Member since July 2026</small>
            <div className="profile-tags" aria-label="Profile tags">
              <span>Owner</span>
              <span>Dev</span>
            </div>
            <div className="profile-badges" aria-label="Profile badges">
              <span aria-label="Founder" data-description="Original SHD portal founder badge."><Sparkles size={15} /></span>
              <span aria-label="Verified" data-description="Verified SHD identity and linked Discord account."><BadgeCheck size={15} /></span>
              <span aria-label="Beta Member" data-description="Helped test SHD features before public release."><FlaskConical size={15} /></span>
              <span aria-label="Bug Hunter" data-description="Reported issues that helped improve SHD systems."><Bug size={15} /></span>
            </div>
            <div className="profile-actions-row">
              <button className="settings-action" type="button">Edit Profile</button>
              <CustomSelect
                ariaLabel="Profile status"
                className="profile-status-select"
                value={profileStatus}
                onChange={(value) => setProfileStatus(value as typeof profileStatus)}
                options={statusOptions.map((option) => ({ value: option.id, label: option.label, markerClass: `status-${option.id}` }))}
              />
            </div>
          </div>
        </section>

        <div className="account-metrics">
          <span><strong>Discord</strong>Connected</span>
          <span><strong>{user.workspaces.length}</strong>Workspaces</span>
          <span><strong>{user.permissions.length}</strong>Permissions</span>
        </div>

        <div className="account-row account-row-three">
          <AccountPanel icon={ShieldCheck} title="Identity">
            <DetailList items={[
              ['Discord User ID', user.id],
              ['Username', user.username],
              ['Session Expires', formatDateTime(user.expiresAt)],
            ]} />
          </AccountPanel>

          <AccountPanel icon={Gamepad2} title="Connected Accounts">
            <ConnectionSummary items={[
              ['Discord', 'Connected'],
              ['Minecraft', 'Linked later'],
              ['Steam / Riot', 'Future'],
            ]} />
          </AccountPanel>

          <AccountPanel icon={Crown} title="Roles">
            <TagList items={[user.role, ...user.workspaces.slice(0, 3)]} />
          </AccountPanel>
        </div>

        <div className="account-row account-row-two">
          <AccountPanel icon={ShieldCheck} title="Security">
            <DetailList items={[
              ['Login Method', 'Discord'],
              ['Two-Factor', 'Handled by Discord'],
              ['Recent Logins', 'Future'],
            ]} />
          </AccountPanel>

          <AccountPanel icon={MonitorSmartphone} title="Devices">
            <DetailList items={[
              ['Current Device', 'This browser'],
              ['Active Sessions', 'Current session only'],
              ['Trusted Devices', 'Future'],
            ]} />
          </AccountPanel>
        </div>

        <div className="account-row account-row-bottom">
          <AccountPanel icon={ServerCog} title="Developer">
            <DetailList items={[
              ['API Access', 'Not enabled'],
              ['Developer Access', canOpenAdmin(user) ? 'Staff preview available' : 'Not available'],
            ]} />
          </AccountPanel>

          <AccountPanel icon={CircleUserRound} title="Account Status">
            <DetailList items={[
              ['Status', 'Active'],
              ['Public Profile', 'Configured in Settings'],
              ['Timeline', 'Future'],
            ]} />
          </AccountPanel>
        </div>
      </div>
    </section>
  )
}

function AccountPanel({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return (
    <section className="account-panel">
      <header>
        <Icon size={19} />
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  )
}

function DetailList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="account-details">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function TagList({ items }: { items: string[] }) {
  return <div className="account-tags">{items.map((item) => <span key={item}>{item}</span>)}</div>
}

function ConnectionSummary({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="connection-summary">
      {items.map(([service, status]) => (
        <div key={service}>
          <strong>{service}</strong>
          <span>{status}</span>
        </div>
      ))}
    </div>
  )
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

function makeSettingSearchItems(categoryId: string, category: string, labels: string[]): SettingSearchResult[] {
  return labels.map((label) => ({
    categoryId,
    category,
    label,
    description: `Open ${category} settings`,
  }))
}

function SettingsPage({ user }: { user: PortalUser | null }) {
  const staffAccess = canOpenAdmin(user)
  const ownerAccess = user?.role.toLowerCase() === 'owner' || hasPermission(user, 'global:admin')
  const [activeCategory, setActiveCategory] = useState('account')
  const [developerMode, setDeveloperMode] = useState(false)
  const [settingsSearch, setSettingsSearch] = useState('')
  const [settingsSearchOpen, setSettingsSearchOpen] = useState(false)
  const settingsSearchRef = useRef<HTMLDivElement | null>(null)
  const categories = [
    { id: 'account', label: 'Account', icon: UserRound, visible: true },
    { id: 'security', label: 'Security', icon: ShieldCheck, visible: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, visible: true },
    { id: 'appearance', label: 'Appearance', icon: Palette, visible: true },
    { id: 'connected', label: 'Connected Services', icon: Gamepad2, visible: true },
    { id: 'devices', label: 'Devices', icon: MonitorSmartphone, visible: true },
    { id: 'privacy', label: 'Privacy', icon: CircleUserRound, visible: true },
    { id: 'staff', label: 'Staff', icon: ServerCog, visible: staffAccess, separatorBefore: true },
    { id: 'organization', label: 'Organization', icon: Crown, visible: ownerAccess, separatorBefore: true },
    { id: 'data', label: 'Data', icon: Database, visible: true, separatorBefore: true },
  ].filter((category) => category.visible)
  const searchResults = useMemo(() => {
    const query = settingsSearch.trim().toLowerCase()
    if (!query) return []
    const searchable: SettingSearchResult[] = [
      ...makeSettingSearchItems('account', 'Account', ['Profile Picture', 'Username', 'Display Name', 'Bio', 'Language', 'Timezone', 'Date Format']),
      ...makeSettingSearchItems('security', 'Security', ['Discord Account', 'Linked Minecraft Accounts', 'Two-Factor Authentication', 'Active Sessions', 'Logout all Devices']),
      ...makeSettingSearchItems('notifications', 'Notifications', ['Desktop Notifications', 'Email Notifications', 'Discord Notifications', 'Push Notifications', 'Sound', 'Applications', 'Support', 'Events', 'Minecraft', 'System', 'Announcements', 'Security', 'Staff Activity']),
      ...makeSettingSearchItems('appearance', 'Appearance', ['Theme', 'Dark', 'Light', 'Accent Color', 'Animations', 'Compact Mode', 'Reduce Motion']),
      ...makeSettingSearchItems('connected', 'Connected Services', ['Discord', 'Minecraft', 'Steam', 'GitHub', 'Riot', 'Future Services']),
      ...makeSettingSearchItems('devices', 'Devices', ['Current Device', 'Linked Devices', 'Mobile App', 'Web Sessions']),
      ...makeSettingSearchItems('privacy', 'Privacy', ['Show Discord', 'Show Minecraft Username', 'Show Activity', 'Show Online Status', 'Public Profile', 'Friend Requests']),
      ...(staffAccess ? makeSettingSearchItems('staff', 'Staff', ['Staff Dashboard', 'Default Landing Page', 'Auto Refresh', 'Refresh Interval', 'Quick Actions', 'Show Staff Feed', 'Compact Tables', 'Moderation', 'Warn Confirmation', 'Ban Confirmation', 'Delete Confirmation', 'Danger Zone Confirmation', 'Moderator Notes', 'Ticket Preference', 'Default Ticket Filter', 'Assigned to Me', 'Open Tickets', 'Closed Tickets', 'Auto Open New Tickets', 'Sound Alerts', 'Admin Notifications', 'New Applications', 'Appeals', 'Reports', 'Server Alerts', 'Health Checks', 'Deployments', 'Discord Alerts', 'Infrastructure', 'Live Console', 'Log Streaming', 'Developer Mode', 'Debug Information']) : []),
      ...(ownerAccess ? makeSettingSearchItems('organization', 'Organization', ['Maintenance Mode', 'Emergency Banner', 'Global Announcement', 'Portal Status', 'Version', 'Developer Options', 'Experimental Features']) : []),
      ...makeSettingSearchItems('data', 'Data', ['Download my Data', 'Delete Account', 'Export Settings']),
    ]
    return searchable
      .filter((item) => `${item.category} ${item.label} ${item.description}`.toLowerCase().includes(query))
      .slice(0, 8)
  }, [ownerAccess, settingsSearch, staffAccess])

  useEffect(() => {
    const closeSearchResults = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (!settingsSearchRef.current?.contains(event.target)) setSettingsSearchOpen(false)
    }
    window.addEventListener('pointerdown', closeSearchResults)
    return () => window.removeEventListener('pointerdown', closeSearchResults)
  }, [])

  return (
    <section className="page settings-page">
      <PageHeader eyebrow="Settings" title="SHD SETTINGS" copy="Manage your portal profile, linked accounts, notifications, appearance, privacy and account data." />

      <div className="settings-search" ref={settingsSearchRef}>
        <Search size={18} />
        <input
          type="search"
          value={settingsSearch}
          onChange={(event) => {
            setSettingsSearch(event.currentTarget.value)
            setSettingsSearchOpen(true)
          }}
          onFocus={() => {
            if (settingsSearch.trim()) setSettingsSearchOpen(true)
          }}
          placeholder="Search settings, categories, staff tools..."
          aria-label="Search settings"
        />
        {settingsSearch.trim() && settingsSearchOpen ? (
          <div className="settings-search-results">
            {searchResults.length > 0 ? searchResults.map((result) => (
              <button
                type="button"
                key={`${result.categoryId}-${result.label}`}
                onClick={() => {
                  setActiveCategory(result.categoryId)
                  setSettingsSearch('')
                  setSettingsSearchOpen(false)
                }}
              >
                <span>{result.category}</span>
                <strong>{result.label}</strong>
                <small>{result.description}</small>
              </button>
            )) : <p>No matching settings found.</p>}
          </div>
        ) : null}
      </div>

      <div className="settings-shell">
        <aside className="settings-sidebar" aria-label="Settings categories">
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <button
                className={`settings-tab ${activeCategory === category.id ? 'active' : ''} ${category.separatorBefore ? 'with-separator' : ''}`}
                type="button"
                key={category.id}
                title={category.label}
                onClick={(event) => {
                  setActiveCategory(category.id)
                  event.currentTarget.blur()
                }}
              >
                <Icon size={17} />
                <span>
                  <strong>{category.label}</strong>
                </span>
              </button>
            )
          })}
        </aside>

        <div className="settings-layout">
          {activeCategory === 'account' ? <SettingsSection icon={UserRound} title="Account" copy="Public identity and localization.">
          <SettingRow label="Profile Picture" description="Uses your Discord avatar until SHD accounts support uploads.">
            <AvatarPreview user={user} />
          </SettingRow>
          <SettingRow label="Username" description="Primary account username." value={user?.username || 'Not signed in'} />
          <SettingRow label="Display Name" description="Shown across the portal and support tickets.">
            <input type="text" value={user?.displayName || ''} placeholder="Display name" readOnly />
          </SettingRow>
          <SettingRow label="Bio" description="Optional short text for your future public profile.">
            <textarea placeholder="No bio yet." rows={3} />
          </SettingRow>
          <SettingRow label="Language" description="Portal display language.">
            <CustomSelect ariaLabel="Language" defaultValue="en" options={[
              { value: 'en', label: 'English' },
              { value: 'de', label: 'Deutsch' },
            ]} />
          </SettingRow>
          <SettingRow label="Timezone" description="Used for ticket, event and appeal timestamps.">
            <CustomSelect ariaLabel="Timezone" defaultValue="Europe/Berlin" options={[
              { value: 'Europe/Berlin', label: 'Europe/Berlin' },
              { value: 'UTC', label: 'UTC' },
              { value: 'America/New_York', label: 'America/New_York' },
            ]} />
          </SettingRow>
          <SettingRow label="Date Format" description="How dates are displayed in the portal.">
            <CustomSelect ariaLabel="Date format" defaultValue="dd.mm.yyyy" options={[
              { value: 'dd.mm.yyyy', label: 'DD.MM.YYYY' },
              { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD' },
              { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY' },
            ]} />
          </SettingRow>
        </SettingsSection> : null}

        {activeCategory === 'security' ? <SettingsSection icon={ShieldCheck} title="Security" copy="Login and linked identity controls.">
          <SettingRow label="Discord Account" description="Discord is the current login identity." value={user?.id ? `Linked: ${user.id}` : 'Not linked'} />
          <SettingRow label="Linked Minecraft Accounts" description="Minecraft identity is synced through Discord tickets." value="Managed through Lifesteal verification" />
          <SettingRow label="Two-Factor Authentication" description="Available after SHD-native login exists." disabled>
            <Toggle disabled />
          </SettingRow>
          <SettingRow label="Active Sessions" description="Session management will move here later." disabled value="Coming later" />
          <SettingRow label="Logout all Devices" description="Requires native session tracking." disabled>
            <button className="settings-action danger" type="button" disabled>Logout all</button>
          </SettingRow>
        </SettingsSection> : null}

        {activeCategory === 'notifications' ? <SettingsSection icon={Bell} title="Notifications" copy="Choose where SHD should send updates.">
          <SettingRow label="Desktop Notifications" description="Browser notification prompts will be added later."><Toggle /></SettingRow>
          <SettingRow label="Email Notifications" description="Requires SHD account email support." disabled><Toggle disabled /></SettingRow>
          <SettingRow label="Discord Notifications" description="Ticket and account updates through Discord."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Push Notifications" description="Mobile app placeholder." disabled><Toggle disabled /></SettingRow>
          <SettingRow label="Sound" description="Play a subtle sound for important portal alerts."><Toggle /></SettingRow>
          <SettingGroup title="Notification Categories" items={['Applications', 'Support', 'Events', 'Minecraft', 'System', 'Announcements', 'Security', 'Staff Activity']} />
        </SettingsSection> : null}

        {activeCategory === 'appearance' ? <SettingsSection icon={Palette} title="Appearance" copy="Visual preferences for the portal shell.">
          <SettingRow label="Theme" description="Light mode is planned, dark is active now.">
            <CustomSelect ariaLabel="Theme" defaultValue="dark" options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light later', disabled: true },
            ]} />
          </SettingRow>
          <SettingRow label="Accent Color" description="Current SHD gold accent.">
            <input type="color" value="#f6d58e" readOnly />
          </SettingRow>
          <SettingRow label="Animations" description="Keep interface animations enabled."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Compact Mode" description="Tighter spacing for dense admin-style views."><Toggle /></SettingRow>
          <SettingRow label="Reduce Motion" description="Prefer fewer transitions and less movement."><Toggle /></SettingRow>
        </SettingsSection> : null}

        {activeCategory === 'connected' ? <SettingsSection icon={Gamepad2} title="Connected Services" copy="External accounts that may be used across SHD.">
          <ConnectionGrid services={['Discord', 'Minecraft', 'Steam', 'GitHub', 'Riot', 'Future Services']} />
        </SettingsSection> : null}

        {activeCategory === 'devices' ? <SettingsSection icon={MonitorSmartphone} title="Devices" copy="Device and session overview placeholders.">
          <SettingRow label="Current Device" description="This browser session." value="Current web session" />
          <SettingRow label="Linked Devices" description="Saved trusted devices will appear here later." disabled value="Coming later" />
          <SettingRow label="Mobile App" description="Reserved for a future SHD app." disabled value="Not available" />
          <SettingRow label="Web Sessions" description="Detailed session list requires backend session storage." disabled value="Coming later" />
        </SettingsSection> : null}

        {activeCategory === 'privacy' ? <SettingsSection icon={CircleUserRound} title="Privacy" copy="Control what other users can see later.">
          <SettingRow label="Show Discord" description="Allow staff-facing profile views to show Discord identity."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Show Minecraft Username" description="Show verified Minecraft username on public profile."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Show Activity" description="Display recent SHD activity."><Toggle /></SettingRow>
          <SettingRow label="Show Online Status" description="Show when you are online."><Toggle /></SettingRow>
          <SettingRow label="Public Profile" description="Allow others to open your profile page."><Toggle /></SettingRow>
          <SettingRow label="Friend Requests" description="Future social feature." disabled><Toggle disabled /></SettingRow>
        </SettingsSection> : null}

        {activeCategory === 'staff' && staffAccess ? <SettingsSection icon={ServerCog} title="Staff" copy="Staff-only defaults for admin workflows, moderation, tickets and infrastructure views.">
          <SettingSubsection title="Staff Dashboard" />
          <SettingRow label="Default Landing Page" description="Choose which staff view opens first.">
            <CustomSelect ariaLabel="Default landing page" defaultValue="dashboard" options={[
              { value: 'dashboard', label: 'Staff Dashboard' },
              { value: 'tickets', label: 'Ticket Queue' },
              { value: 'servers', label: 'Server Health' },
            ]} />
          </SettingRow>
          <SettingRow label="Auto Refresh" description="Refresh staff data automatically."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Refresh Interval" description="How often staff panels should update.">
            <CustomSelect ariaLabel="Refresh interval" defaultValue="30" options={[
              { value: '15', label: '15 seconds' },
              { value: '30', label: '30 seconds' },
              { value: '60', label: '60 seconds' },
            ]} />
          </SettingRow>
          <SettingRow label="Quick Actions" description="Show common staff actions near the top."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Show Staff Feed" description="Display recent moderation and support activity."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Compact Tables" description="Use denser rows in staff tables."><Toggle /></SettingRow>

          <SettingSubsection title="Moderation" />
          <SettingRow label="Warn Confirmation" description="Ask before sending a warning."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Ban Confirmation" description="Ask before banning a player."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Delete Confirmation" description="Ask before deleting moderation records."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Danger Zone Confirmation" description="Require extra confirmation for high-risk actions."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Moderator Notes" description="Show private staff notes on player records."><Toggle defaultChecked /></SettingRow>

          <SettingSubsection title="Ticket Preference" />
          <SettingRow label="Default Ticket Filter" description="Initial filter for support and appeal queues.">
            <CustomSelect ariaLabel="Default ticket filter" defaultValue="assigned" options={[
              { value: 'assigned', label: 'Assigned to Me' },
              { value: 'open', label: 'Open Tickets' },
              { value: 'closed', label: 'Closed Tickets' },
            ]} />
          </SettingRow>
          <SettingRow label="Auto Open New Tickets" description="Open newly assigned tickets automatically."><Toggle /></SettingRow>
          <SettingRow label="Sound Alerts" description="Play a sound for new staff tickets."><Toggle /></SettingRow>

          <SettingSubsection title="Admin Notifications" />
          <SettingGroup title="Admin Notification Categories" items={['New Applications', 'Appeals', 'Reports', 'Server Alerts', 'Health Checks', 'Deployments', 'Discord Alerts']} />

          <SettingSubsection title="Infrastructure" />
          <SettingRow label="Live Console" description="Show live server console controls where available."><Toggle /></SettingRow>
          <SettingRow label="Auto Refresh" description="Refresh infrastructure panels automatically."><Toggle defaultChecked /></SettingRow>
          <SettingRow label="Log Streaming" description="Stream logs instead of polling snapshots."><Toggle /></SettingRow>
          <SettingRow label="Developer Mode" description="Show IDs, endpoints and raw technical metadata.">
            <Toggle checked={developerMode} onChange={setDeveloperMode} />
          </SettingRow>
          <SettingRow label="Debug Information" description="Display request timing and backend debug fields."><Toggle /></SettingRow>
          {developerMode ? <DeveloperModePreview /> : null}
        </SettingsSection> : null}

        {activeCategory === 'organization' && ownerAccess ? <SettingsSection icon={Crown} title="Organization" copy="Owner-only controls for global announcements, portal status and experimental behavior.">
          <SettingRow label="Maintenance Mode" description="Temporarily disable public portal access."><Toggle /></SettingRow>
          <SettingRow label="Emergency Banner" description="Show a critical banner across portal pages."><Toggle /></SettingRow>
          <SettingRow label="Global Announcement" description="Short placeholder announcement shown across SHD.">
            <input type="text" placeholder="No announcement active" />
          </SettingRow>
          <SettingRow label="Portal Status" description="Public status shown to users.">
            <CustomSelect ariaLabel="Portal status" defaultValue="online" options={[
              { value: 'online', label: 'Online' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'degraded', label: 'Degraded' },
            ]} />
          </SettingRow>
          <SettingRow label="Version" description="Current portal build label." value="Preview build" />
          <SettingRow label="Developer Options" description="Show owner-only developer controls."><Toggle /></SettingRow>
          <SettingRow label="Experimental Features" description="Enable unfinished owner preview features."><Toggle /></SettingRow>
        </SettingsSection> : null}

        {activeCategory === 'data' ? <SettingsSection icon={Database} title="Data" copy="Exports and account lifecycle actions.">
          <SettingRow label="Download my Data" description="Generate an account data export when backend support is ready." disabled>
            <button className="settings-action" type="button" disabled>Download</button>
          </SettingRow>
          <SettingRow label="Export Settings" description="Local preference export placeholder.">
            <button className="settings-action" type="button">Export</button>
          </SettingRow>
          <SettingRow label="Delete Account" description="Reserved for native SHD accounts." disabled>
            <button className="settings-action danger" type="button" disabled>Delete</button>
          </SettingRow>
        </SettingsSection> : null}
        </div>
      </div>
    </section>
  )
}

function SettingsSection({ icon: Icon, title, copy, children }: { icon: typeof UserRound; title: string; copy: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <header>
        <Icon size={20} />
        <span>
          <h2>{title}</h2>
          <p>{copy}</p>
        </span>
      </header>
      <div className="settings-list">{children}</div>
    </section>
  )
}

function SettingRow({ label, description, value, disabled = false, children }: { label: string; description: string; value?: string; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`setting-row ${disabled ? 'disabled' : ''}`}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <div className="setting-control">
        {children || <em>{value}</em>}
      </div>
    </div>
  )
}

function Toggle({ defaultChecked = false, checked, disabled = false, onChange }: { defaultChecked?: boolean; checked?: boolean; disabled?: boolean; onChange?: (checked: boolean) => void }) {
  return (
    <label className={`toggle ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
      />
      <span />
    </label>
  )
}

function CustomSelect({ ariaLabel, className = '', defaultValue, value, onChange, options }: { ariaLabel: string; className?: string; defaultValue?: string; value?: string; onChange?: (value: string) => void; options: CustomSelectOption[] }) {
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue || options[0]?.value || '')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selectedValue = value ?? internalValue
  const selectedOption = options.find((option) => option.value === selectedValue) || options[0]

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    window.addEventListener('pointerdown', closeMenu)
    return () => window.removeEventListener('pointerdown', closeMenu)
  }, [])

  function selectOption(option: CustomSelectOption) {
    if (option.disabled) return
    if (value === undefined) setInternalValue(option.value)
    onChange?.(option.value)
    setOpen(false)
  }

  return (
    <div className={`custom-select ${className}`} ref={rootRef}>
      <button
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        {selectedOption?.markerClass ? <i className={selectedOption.markerClass} /> : null}
        <span>{selectedOption?.label}</span>
      </button>
      {open ? (
        <div className="custom-select-options" role="menu">
          {options.map((option) => (
            <button
              type="button"
              role="menuitem"
              key={option.value}
              className={selectedValue === option.value ? 'active' : ''}
              disabled={option.disabled}
              onClick={() => selectOption(option)}
            >
              {option.markerClass ? <i className={option.markerClass} /> : null}
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SettingSubsection({ title }: { title: string }) {
  return (
    <div className="setting-subsection">
      <strong>{title}</strong>
    </div>
  )
}

function DeveloperModePreview() {
  return (
    <div className="developer-preview">
      <strong>Developer metadata examples</strong>
      <div>
        {[
          'Copy ID',
          'Database ID',
          'API Endpoint',
          'Created At',
          'Updated At',
          'Permissions',
          'Role IDs',
          'Ticket #4812',
          'Database UUID',
          'Discord Message ID',
          'Webhook ID',
          'Request Duration',
        ].map((item) => <span key={item}>{item}</span>)}
      </div>
    </div>
  )
}

function AvatarPreview({ user }: { user: PortalUser | null }) {
  return (
    <div className="avatar-preview">
      {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{initials(user?.displayName || 'SH')}</span>}
      <button className="settings-action" type="button" disabled>Change later</button>
    </div>
  )
}

function SettingGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="setting-group">
      <strong>{title}</strong>
      <div>
        {items.map((item) => (
          <label key={item}>
            <input type="checkbox" defaultChecked />
            {item}
          </label>
        ))}
      </div>
    </div>
  )
}

function ConnectionGrid({ services }: { services: string[] }) {
  return (
    <div className="connection-grid">
      {services.map((service, index) => (
        <button className="connection-pill" type="button" key={service} disabled={index > 1}>
          <span>{service.slice(0, 2).toUpperCase()}</span>
          {service}
        </button>
      ))}
    </div>
  )
}

function PageHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
    </header>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function FlowCard({ icon: Icon, title, copy, onClick, status }: { icon: typeof LifeBuoy; title: string; copy: string; onClick?: () => void; status?: 'active' | 'half' | 'inactive' }) {
  return (
    <button className="flow-card" type="button" onClick={onClick} disabled={!onClick}>
      <Icon size={21} />
      <h2>{title}</h2>
      <p>{copy}</p>
      {status ? <span className={`support-status-dot ${status}`} aria-label={`${status} support status`} /> : null}
    </button>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
