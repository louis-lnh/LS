import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import heroImage from './assets/lifesteal-hero.png'
import dragonEggBadge from './assets/prestige/dragon-egg.png'
import adminBadge from './assets/prestige/admin.png'
import ownerBadge from './assets/prestige/owner.png'
import maceBadge from './assets/prestige/mace.png'
import shdTextLogo from './assets/prestige/shd-logo.png'
import shdteamBadge from './assets/prestige/shd-logo-no-text.png'
import moderatorBadge from './assets/prestige/moderator.png'
import rulesMarkdown from './content/rules.md?raw'

type PageId = 'landing' | 'rules' | 'players' | 'events' | 'world' | 'signup' | 'punishments' | 'legal' | 'privacy' | 'terms' | 'imprint'
type Move = 'up' | 'down' | 'same'
type PrestigeBadgeId = 'owner' | 'admin' | 'mod' | 'shd-team' | 'dragon-egg' | 'mace-1' | 'mace-2'
type StatusKind = 'achievement' | 'critical' | 'objective'

type NavItem = {
  id: PageId
  label: string
}

type LegalPageContent = {
  id: PageId
  label: string
  title: string
  intro: string
  sections: Array<{ title: string; body: string }>
}

type Player = {
  rank: number
  name: string
  prestige: PrestigeBadgeId[]
  hearts: number
  heartsGained: number | null
  heartsLost: number | null
  kills: number
  deaths: number
  revivals?: number
  maceKills: number | null
  playtime: string
  status?: string
  move: Move
  previousRank: number
  lastUpdated: string
}

type LiveStatus = {
  online_players: number | null
  max_players: number | null
  grace_active: boolean
  grace_paused: boolean
  grace_remaining_seconds: number | null
  source_updated_at?: number | null
  snapshot_age_seconds?: number | null
  updated_at: number | null
}

type PublicPlayer = {
  rank?: number
  minecraft_uuid?: string
  name: string
  prestige?: string[]
  hearts_current?: number | null
  hearts?: number | null
  heart_gains?: number | null
  hearts_gained?: number | null
  heart_losses?: number | null
  hearts_lost?: number | null
  kills_total?: number
  kills?: number
  deaths_total?: number
  deaths?: number
  revivals_total?: number
  revivals?: number
  mace_kills?: number | null
  playtime?: string
  status?: string | null
  eliminated?: boolean
  source_updated_at?: number
  updated_at?: number
}

type PublicObjectiveHolder = {
  owner: string | null
  owner_minecraft_uuid?: string | null
  state: 'held' | 'unclaimed'
  data_status?: string | Record<string, string>
  mace_kills?: number | null
  source_updated_at?: number | null
  updated_at?: number | null
}

type PublicObjectives = {
  dragon_egg?: PublicObjectiveHolder | null
  maces?: PublicObjectiveHolder[]
  twenty_hearts?: {
    count: number
    player_names: string[]
    data_status?: string
    source_updated_at?: number | null
    updated_at?: number | null
  } | null
}

type SyncHealth = {
  state: 'live' | 'stale' | 'offline' | 'waiting'
  fresh: boolean
  stale: boolean
  waiting: boolean
  last_sync_at: number | null
  snapshot_age_seconds: number | null
  players_received: number | null
  public_players_published: number
  source: string
  schema_version: number
}

type LiveData = {
  status: LiveStatus | null
  players: Player[]
  objectives: PublicObjectives | null
  health: SyncHealth | null
  playersUpdatedAt: number | null
  loaded: boolean
}

type RankHistory = {
  currentUpdatedAt: number | null
  currentRanks: Record<string, number>
  moves: Record<string, { previousRank: number; changedAt: number }>
}

type EventItem = {
  title: string
  startsAt: number
  priority: number
  type: string
  reward: string
  objective: string
  summary: string
}

type RuleIndexItem = {
  id: string
  number: string
  title: string
}

type RuleBlock =
  | { type: 'h2' | 'h3'; text: string; id?: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'hr' }

type ProfileStatGroup = {
  title: string
  stats: Array<{ label: string; value: string }>
}

const navItems: NavItem[] = [
  { id: 'landing', label: 'Home' },
  { id: 'rules', label: 'Rules' },
  { id: 'players', label: 'Players' },
  { id: 'events', label: 'Events' },
  { id: 'world', label: 'World' },
  { id: 'signup', label: 'Apply' },
  { id: 'punishments', label: 'Bans' },
]

const footerLegalItems: NavItem[] = [
  { id: 'legal', label: 'Legal' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'terms', label: 'Terms of Service' },
  { id: 'imprint', label: 'Imprint' },
]

const routeItems: NavItem[] = [...navItems, ...footerLegalItems]

const priorityLinks: NavItem[] = [
  { id: 'signup', label: 'Application / Signup' },
  { id: 'rules', label: 'Rules' },
  { id: 'players', label: 'Player List' },
]

const publicApiBase = (import.meta.env.VITE_LIFESTEAL_API_BASE_URL ?? 'http://localhost:3000/api/v1/public').replace(/\/$/, '')
const rankHistoryKey = 'shd-lifesteal-rank-history-v1'
const rankMoveLifetimeMs = 24 * 60 * 60 * 1000
const seasonStarted = false
const seasonStartTimestamp = Date.UTC(2026, 6, 1, 10, 0, 0)

const prestigeBadges: Record<PrestigeBadgeId, { label: string; shortLabel: string; image?: string }> = {
  owner: { label: 'Owner', shortLabel: 'OWN', image: ownerBadge },
  admin: { label: 'Admin', shortLabel: 'ADM', image: adminBadge },
  mod: { label: 'Mod', shortLabel: 'MOD', image: moderatorBadge },
  'shd-team': { label: 'SHD Team', shortLabel: 'SHD', image: shdteamBadge },
  'dragon-egg': { label: 'Dragon Egg Holder', shortLabel: 'EGG', image: dragonEggBadge },
  'mace-1': { label: 'Mace Wielder #1', shortLabel: 'M1', image: maceBadge },
  'mace-2': { label: 'Mace Wielder #2', shortLabel: 'M2', image: maceBadge },
}

const statusInfo: Record<string, { label: string; kind: StatusKind }> = {
  'Most Feared': { label: 'Most Feared', kind: 'achievement' },
  'Most Wanted': { label: 'Most Wanted', kind: 'achievement' },
  'Kill Streak x5+': { label: 'Kill Streak x5+', kind: 'achievement' },
  'Event Winner': { label: 'Event Winner', kind: 'achievement' },
  'Bounty Target': { label: 'Bounty Target', kind: 'objective' },
  Eliminated: { label: 'Eliminated', kind: 'critical' },
  'On Last Heart': { label: 'On Last Heart', kind: 'critical' },
}

const prestigePriority: PrestigeBadgeId[] = ['owner', 'admin', 'mod', 'shd-team', 'dragon-egg', 'mace-1', 'mace-2']
const builtInPrestigeBadgesByUuid: Record<string, PrestigeBadgeId[]> = {
  'f4ae7f4f-cb60-45ff-bb15-576c89330e78': ['shd-team'],
  f4ae7f4fcb6045ffbb15576c89330e78: ['shd-team'],
  'a5f7ba0b-cee1-4137-9b9b-835285ed606c': ['shd-team'],
  a5f7ba0bcee141379b9b835285ed606c: ['shd-team'],
}
const builtInPrestigeBadgesByName: Record<string, PrestigeBadgeId[]> = {
  tlzmax5454: ['shd-team'],
  xvoidism: ['shd-team'],
}

function isPrestigeBadgeId(value: string): value is PrestigeBadgeId {
  return Object.prototype.hasOwnProperty.call(prestigeBadges, value)
}

function builtInPrestigeBadges(player: PublicPlayer) {
  const uuid = player.minecraft_uuid?.toLowerCase()
  const name = player.name.toLowerCase()
  return uuid ? builtInPrestigeBadgesByUuid[uuid] ?? builtInPrestigeBadgesByName[name] ?? [] : builtInPrestigeBadgesByName[name] ?? []
}

function relativeTime(timestamp: number | null | undefined) {
  if (!timestamp) return 'never'
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function countdownTo(timestamp: number) {
  const totalSeconds = Math.max(0, Math.floor((timestamp - Date.now()) / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

function eventDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(timestamp)
}

function eventTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(timestamp)
}

function playerRankKey(player: PublicPlayer) {
  return (player.minecraft_uuid ?? player.name).toLowerCase()
}

function emptyRankHistory(): RankHistory {
  return { currentUpdatedAt: null, currentRanks: {}, moves: {} }
}

function readRankHistory(): RankHistory {
  try {
    const raw = window.localStorage.getItem(rankHistoryKey)
    if (!raw) return emptyRankHistory()
    const parsed = JSON.parse(raw) as Partial<RankHistory>
    return {
      currentUpdatedAt: parsed.currentUpdatedAt ?? null,
      currentRanks: parsed.currentRanks ?? {},
      moves: parsed.moves ?? {},
    }
  } catch (_error) {
    return emptyRankHistory()
  }
}

function writeRankHistory(history: RankHistory) {
  try {
    window.localStorage.setItem(rankHistoryKey, JSON.stringify(history))
  } catch (_error) {
    // Rank movement is a progressive enhancement; private browsing can block storage.
  }
}

function currentRanksFor(players: PublicPlayer[]) {
  return Object.fromEntries(players.map((player, index) => [playerRankKey(player), player.rank ?? index + 1]))
}

function recentRankMoves(moves: RankHistory['moves']) {
  const now = Date.now()
  return Object.fromEntries(Object.entries(moves).filter(([, move]) => now - move.changedAt <= rankMoveLifetimeMs))
}

function rankHistoryFor(players: PublicPlayer[], updatedAt: number | null | undefined) {
  const history = readRankHistory()
  const currentRanks = currentRanksFor(players)
  const moves = recentRankMoves(history.moves)
  if (updatedAt && updatedAt !== history.currentUpdatedAt) {
    for (const [key, rank] of Object.entries(currentRanks)) {
      const previousRank = history.currentRanks[key]
      if (previousRank != null && previousRank !== rank) {
        moves[key] = { previousRank, changedAt: Date.now() }
      }
    }

    const nextHistory = {
      currentUpdatedAt: updatedAt,
      currentRanks,
      moves,
    }
    writeRankHistory(nextHistory)
    return nextHistory
  }

  if (!history.currentUpdatedAt && players.length > 0) {
    const nextHistory = { currentUpdatedAt: updatedAt ?? null, currentRanks, moves: {} }
    writeRankHistory(nextHistory)
    return nextHistory
  }

  return { ...history, moves }
}

function publicPlayerToPlayer(player: PublicPlayer, index: number, rankMoves: RankHistory['moves'] = {}): Player {
  const rank = player.rank ?? index + 1
  const previousRank = rankMoves[playerRankKey(player)]?.previousRank ?? rank
  const move: Move = previousRank > rank ? 'up' : previousRank < rank ? 'down' : 'same'
  const rawHearts = player.hearts_current ?? player.hearts ?? null
  const hearts = player.eliminated ? Math.max(0, rawHearts ?? 0) : rawHearts ?? 10
  const prestige = [...new Set([...(player.prestige ?? []).filter(isPrestigeBadgeId), ...builtInPrestigeBadges(player)])]
  const status = player.status ?? (player.eliminated ? 'Eliminated' : hearts === 1 ? 'On Last Heart' : undefined)
  const updatedAt = player.source_updated_at ?? player.updated_at

  return {
    rank,
    name: player.name,
    prestige,
    hearts,
    heartsGained: player.heart_gains ?? player.hearts_gained ?? null,
    heartsLost: player.heart_losses ?? player.hearts_lost ?? null,
    kills: player.kills_total ?? player.kills ?? 0,
    deaths: player.deaths_total ?? player.deaths ?? 0,
    revivals: player.revivals_total ?? player.revivals ?? 0,
    maceKills: player.mace_kills ?? null,
    playtime: player.playtime ?? 'Hidden',
    status,
    move,
    previousRank,
    lastUpdated: relativeTime(updatedAt),
  }
}

function useLiveData(): LiveData {
  const [liveData, setLiveData] = useState<LiveData>({ status: null, players: [], objectives: null, health: null, playersUpdatedAt: null, loaded: false })

  useEffect(() => {
    let cancelled = false

    async function loadLiveData() {
      try {
        const [statusResponse, playersResponse, objectivesResponse, healthResponse] = await Promise.all([
          fetch(`${publicApiBase}/status`),
          fetch(`${publicApiBase}/players`),
          fetch(`${publicApiBase}/objectives`).catch(() => null),
          fetch(`${publicApiBase}/sync-health`).catch(() => null),
        ])
        if (!statusResponse.ok || !playersResponse.ok) {
          if (!cancelled) setLiveData((current) => ({ ...current, loaded: true }))
          return
        }

        const statusBody = await statusResponse.json() as { status?: LiveStatus; updatedAt?: number | null }
        const playersBody = await playersResponse.json() as { players?: PublicPlayer[]; updatedAt?: number | null }
        const objectivesBody = objectivesResponse?.ok
          ? await objectivesResponse.json() as { objectives?: PublicObjectives; updatedAt?: number | null }
          : { objectives: null }
        const healthBody = healthResponse?.ok
          ? await healthResponse.json() as { health?: SyncHealth; updatedAt?: number | null }
          : { health: null }
        if (cancelled) return

        const publicPlayers = playersBody.players ?? []
        const rankHistory = rankHistoryFor(publicPlayers, playersBody.updatedAt)

        setLiveData({
          status: statusBody.status ?? null,
          players: publicPlayers.map((player, index) => publicPlayerToPlayer(player, index, rankHistory.moves)),
          objectives: objectivesBody.objectives ?? null,
          health: healthBody.health ?? null,
          playersUpdatedAt: playersBody.updatedAt ?? null,
          loaded: true,
        })
      } catch (_error) {
        if (!cancelled) {
          setLiveData((current) => ({ ...current, loaded: true }))
        }
      }
    }

    loadLiveData()
    const interval = window.setInterval(loadLiveData, 30000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  return liveData
}

function isEliminated(player: Player) {
  return player.status === 'Eliminated' || player.hearts <= 0
}

function prestigeDetail(player: Player, badge: PrestigeBadgeId) {
  if (badge === 'dragon-egg') {
    return 'Current public Dragon Egg holder'
  }

  if (badge === 'mace-1') {
    return player.maceKills == null ? 'Mace kills not synced yet' : `Kills with Mace: ${player.maceKills}`
  }

  if (badge === 'mace-2') {
    return player.maceKills == null ? 'Mace kills not synced yet' : `Kills with Mace: ${player.maceKills}`
  }

  if (badge === 'owner') {
    return 'Server owner'
  }

  if (badge === 'admin') {
    return 'Staff badge: Admin'
  }

  if (badge === 'mod') {
    return 'Staff badge: Mod'
  }

  return 'SHD Team member'
}

function statusDetail(player: Player, status: string) {
  if (status === 'Event Winner') {
    return 'Winner of Opening War Night'
  }

  if (status === 'Most Wanted') {
    return `${player.kills} kills this season`
  }

  if (status === 'Most Feared') {
    return `${player.hearts} current hearts`
  }

  if (status === 'Bounty Target') {
    return 'Current bounty target'
  }

  if (status === 'Kill Streak x5+') {
    return `${player.kills} kills this season`
  }

  if (status === 'On Last Heart') {
    return 'Critical state: one death from elimination'
  }

  if (status === 'Eliminated') {
    return 'Out of the season until revived'
  }

  return 'Season status'
}

function playerSearchText(player: Player) {
  const prestige = player.prestige
    .flatMap((badge) => {
      const badgeInfo = prestigeBadges[badge]
      return [badgeInfo.label, badgeInfo.shortLabel]
    })
    .join(' ')
  const status = player.status ?? ''
  const state = isEliminated(player) ? 'eliminated' : 'active'
  const heartMilestones = [
    `${player.hearts} hearts`,
    player.hearts === 20 ? '20 hearts max hearts heart cap most feared' : '',
    player.hearts === 1 ? 'last heart on last heart' : '',
  ].join(' ')

  return `${player.name} ${prestige} ${status} ${state} ${heartMilestones} ${player.kills} kills ${player.deaths} deaths ${player.playtime}`.toLowerCase()
}

function playerKdr(player: Player) {
  return player.deaths === 0 ? player.kills.toFixed(2) : (player.kills / player.deaths).toFixed(2)
}

function statValue(value: number | string | null | undefined) {
  return value == null ? 'Not synced' : String(value)
}

function listValue(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None'
}

function syncHealthLabel(health: SyncHealth | null) {
  if (!health) return 'Waiting'
  if (health.state === 'live') return 'Live'
  if (health.state === 'stale') return 'Stale'
  if (health.state === 'offline') return 'Offline'
  return 'Waiting'
}

function syncHealthDetail(health: SyncHealth | null) {
  if (!health?.last_sync_at) return 'No server sync yet'
  return `Last sync ${relativeTime(health.last_sync_at)}`
}

function playerHeadUrl(player: Player) {
  return `https://minotar.net/avatar/${encodeURIComponent(player.name)}/128.png`
}

function profileStatsFor(player: Player): ProfileStatGroup[] {
  const moveAmount = Math.abs(player.previousRank - player.rank)
  const movement = player.move === 'same'
    ? 'No change'
    : `${player.move === 'up' ? '+' : '-'}${moveAmount} ${moveAmount === 1 ? 'rank' : 'ranks'}`
  const objectiveBadges = [
    player.prestige.includes('dragon-egg') ? 'Dragon Egg' : null,
    player.prestige.includes('mace-1') ? 'Mace One' : null,
    player.prestige.includes('mace-2') ? 'Mace Two' : null,
  ].filter((value): value is string => Boolean(value))
  const staffBadges = player.prestige
    .filter((badge) => ['owner', 'admin', 'mod', 'shd-team'].includes(badge))
    .map((badge) => prestigeBadges[badge].label)

  return [
    {
      title: 'General',
      stats: [
        { label: 'Current Hearts', value: String(player.hearts) },
        { label: 'Highest Known Hearts', value: String(Math.max(player.hearts, 10)) },
        { label: 'Season Rank', value: `#${player.rank}` },
        { label: 'Previous Rank', value: `#${player.previousRank}` },
        { label: 'Rank Movement', value: movement },
        { label: 'Last Updated', value: player.lastUpdated },
        { label: 'Playtime', value: player.playtime },
      ],
    },
    {
      title: 'Lifesteal',
      stats: [
        { label: 'Total Hearts Gained', value: statValue(player.heartsGained) },
        { label: 'Total Hearts Lost', value: statValue(player.heartsLost) },
        { label: 'Net Heart Change', value: player.heartsGained == null || player.heartsLost == null ? 'Not synced' : String(player.heartsGained - player.heartsLost) },
        { label: 'Revivals', value: String(player.revivals ?? 0) },
        { label: 'Current State', value: isEliminated(player) ? 'Eliminated' : 'Active' },
        { label: 'Status Label', value: player.status ?? 'None' },
      ],
    },
    {
      title: 'Combat',
      stats: [
        { label: 'Kill Count', value: String(player.kills) },
        { label: 'Death Count', value: String(player.deaths) },
        { label: 'KDR', value: playerKdr(player) },
        { label: 'Mace Kills', value: statValue(player.maceKills) },
      ],
    },
    {
      title: 'Objectives',
      stats: [
        { label: 'Objective Badges', value: listValue(objectiveBadges) },
        { label: 'Staff Badges', value: listValue(staffBadges) },
        { label: 'Dragon Egg Holder', value: player.prestige.includes('dragon-egg') ? 'Yes' : 'No' },
        { label: 'Mace Wielder', value: player.prestige.includes('mace-1') || player.prestige.includes('mace-2') ? 'Yes' : 'No' },
        { label: 'Mace One Kills', value: player.prestige.includes('mace-1') ? statValue(player.maceKills) : 'Not holder' },
        { label: 'Mace Two Kills', value: player.prestige.includes('mace-2') ? statValue(player.maceKills) : 'Not holder' },
      ],
    },
  ]
}

const rules = [
  {
    number: 1,
    title: 'General Rules',
    subsections: [
      {
        title: 'Respect Other Players',
        body: ['Treat all players with respect.', 'Competitive trash talk is expected. Use common sense.'],
        bullets: ['Harassment', 'Hate speech', 'Discrimination', 'Real-life threats', 'Doxxing', 'Excessive personal attacks'],
      },
      {
        title: 'Cheating & Unfair Advantages',
        body: [
          'Any modification, software, exploit, or method that provides an unfair advantage is prohibited.',
          'If you are unsure whether something is allowed, ask staff first.',
        ],
        bullets: [
          'X-Ray',
          'Kill Aura',
          'Reach',
          'Trigger Bot',
          'Auto Clicker',
          'Fly Hacks',
          'ESP',
          'Freecam',
          'Inventory Tweaks providing combat advantages',
          'Duplication exploits',
          'Packet manipulation',
          'Macros that automate gameplay',
        ],
      },
      {
        title: 'Exploit Abuse',
        body: [
          'Abusing bugs or unintended mechanics for an unfair advantage is prohibited.',
          'Known exploits must be reported.',
          'Staff may remove items, reverse actions, or issue punishments if exploits are abused.',
        ],
      },
      {
        title: 'Alternate Accounts',
        body: ['Using alternate accounts is not allowed.'],
        bullets: ['Heart farming', 'Scouting', 'Extra storage', 'Ban evasion', 'Any competitive advantage'],
      },
    ],
  },
  {
    number: 2,
    title: 'Lifesteal System',
    subsections: [
      {
        title: 'Hearts',
        bullets: ['Every player starts with 10 hearts.', 'Maximum hearts: 20.', 'Dying removes 1 heart.', 'Killing another player grants 1 heart.'],
      },
      {
        title: 'Heart Items',
        body: ['If the killer already has 20 hearts, a Heart Item drops instead.', 'Heart Items may be consumed to gain hearts.'],
      },
      {
        title: 'Elimination',
        body: ['Players who die while on 1 heart are eliminated.', 'Eliminated players may not participate again unless officially revived.'],
      },
    ],
  },
  {
    number: 3,
    title: 'Grace Period',
    subsections: [
      { title: 'Duration', body: ['The event begins with a 60-minute Grace Period.'] },
      {
        title: 'During Grace Period',
        body: ['The following are disabled during Grace Period.', 'Deaths during Grace Period do not remove hearts.'],
        bullets: ['PvP', 'Combat Tagging', 'Lifesteal', 'Eliminations', 'Revival Crafting', 'Revival Usage'],
      },
    ],
  },
  {
    number: 4,
    title: 'Combat Rules',
    subsections: [
      { title: 'Combat Tag', body: ['Entering combat applies a 30-second combat tag.', 'Taking or dealing damage refreshes the timer.'] },
      { title: 'Combat Logging', body: ['Logging out during combat is prohibited.', 'Combat loggers will be treated as dead.', 'Staff may restore lost hearts to victims if necessary.'] },
      {
        title: 'Pearl Stasis Chambers',
        body: ['Pearl Stasis Chambers are allowed.', 'If you are in combat, you must fight or escape using normal gameplay mechanics.'],
        bullets: ['Activating a stasis chamber while combat tagged is prohibited.', 'Using external players to pull someone out of active combat is prohibited.'],
      },
      {
        title: 'Combat Mobility Restrictions',
        body: [
          'Ender pearls, Elytras, and Riptide Tridents may not be used to create combat kills while restricted by the combat system.',
          'Using mobility items to bypass cooldowns, swap gear mid-air, or set up a kill from flight is punishable even if the mod does not catch every setup automatically.',
        ],
        bullets: [
          'Flying above a player, swapping from Elytra to chestplate, and dropping into a Mace kill is prohibited.',
          'Using Riptide, ender pearls, Elytra flight, or spear-style airborne attacks to bypass combat restrictions is prohibited.',
          'Staff may treat suspicious mobility-assisted kills as anti-cheat or rules cases.'
        ],
      },
    ],
  },
  {
    number: 5,
    title: 'Revival System',
    subsections: [
      { title: 'Crafting', body: ['Revival Items can only be crafted by players below 10 hearts.'] },
      { title: 'Cooldowns', body: ['Revival crafting is subject to server cooldowns.'] },
      { title: 'Revival Result', body: ['Revived players return with 3 hearts.'] },
      { title: 'Abuse', body: ['Any attempt to bypass revival restrictions is prohibited.'] },
    ],
  },
  {
    number: 6,
    title: 'Raiding & Bases',
    subsections: [
      { title: 'Raiding', body: ['Raiding is fully allowed.'] },
      { title: 'Base Defense', bullets: ['Walls', 'Traps', 'Hidden Bases', 'Secret Entrances', 'Defensive Redstone'] },
      {
        title: 'Griefing',
        body: ['The purpose of raiding is to gain resources and eliminate enemies. The following are not allowed.'],
        bullets: ['Destroying builds solely to ruin them', 'Excessive griefing with no competitive purpose', 'Lag-inducing destruction'],
      },
    ],
  },
  {
    number: 7,
    title: 'Allowed Mechanics',
    subsections: [
      {
        title: 'Allowed by Default',
        body: ['Unless stated otherwise, vanilla mechanics are generally allowed.'],
        bullets: [
          'Nether Roof Travel',
          'AFK Farms',
          'Automatic Farms',
          'Villager Trading',
          'Iron Farms',
          'Gold Farms',
          'Mob Farms',
          'Pearl Stasis Chambers',
          'Chunk Loaders',
          'Bed Mining',
          'Bed Explosions',
          'TNT Duping for farming purposes',
        ],
      },
    ],
  },
  {
    number: 8,
    title: 'Restricted Mechanics',
    subsections: [
      {
        title: 'TNT Duping',
        body: [
          'TNT Duping is allowed for farming, including world eaters, quarry systems, and resource farms.',
          'TNT Duping may not be used for PvP traps, base traps, automatic kill systems, or combat applications.',
        ],
      },
      { title: 'Crystal PvP', body: ['End Crystals are disabled.', 'Any method attempting to recreate crystal combat mechanics is prohibited.'] },
      { title: 'Respawn Anchors', body: ['Respawn Anchors are disabled.', 'Anchor PvP is not possible.'] },
      { title: 'Totems', body: ['Totems of Undying are disabled.'] },
      {
        title: 'Lag Machines',
        body: ['Any machine intentionally designed to create server lag is prohibited.'],
        bullets: ['Excessive Redstone Clocks', 'Entity Spam', 'Item Spam', 'Chunk Crash Attempts'],
      },
    ],
  },
  {
    number: 9,
    title: 'Teams & Alliances',
    subsections: [
      { title: 'Team Size', body: ['There is no team size limit.'], bullets: ['Play Solo', 'Form Small Groups', 'Create Large Alliances'] },
      { title: 'Betrayal', body: ['Betrayal is allowed.', 'Scamming, lying, and backstabbing are part of the event.', 'Use caution when trusting other players.'] },
    ],
  },
  {
    number: 10,
    title: 'Staff Decisions',
    subsections: [
      { title: 'Common Sense Rule', body: ['Not every situation can be covered by written rules.', 'Attempting to exploit loopholes may still result in punishment.'] },
      { title: 'Staff Authority', body: ['Staff decisions are final.'] },
      { title: 'Balance Changes', body: ['The server team reserves the right to adjust recipes, cooldowns, mechanics, disabled features, and event systems if required for balance or server stability.'] },
    ],
  },
  {
    number: 11,
    title: 'Final Rule',
    subsections: [
      {
        title: 'Play to Win',
        body: [
          'Play to win.',
          'Do not cheat.',
          'Do not abuse exploits.',
          'Do not intentionally lag or crash the server.',
          'If you have to ask yourself whether something is probably against the rules, it probably is.',
        ],
      },
    ],
  },
]

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseRules(markdown: string): { title: string; blocks: RuleBlock[]; index: RuleIndexItem[] } {
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

const events: EventItem[] = [
  {
    title: 'Event Start',
    startsAt: seasonStartTimestamp,
    priority: 0,
    type: 'Server Start',
    reward: 'Season 1 begins',
    objective: 'The server opens for the first public Season 1 session.',
    summary: 'The countdown to Season 1. We are looking forward to starting the server together at this time.',
  },
  {
    title: 'Grace Period',
    startsAt: seasonStartTimestamp,
    priority: 1,
    type: 'Protection Window',
    reward: 'Safe first hour',
    objective: 'PvP, combat tags, lifesteal, heart loss, eliminations, and revivals stay disabled for the first hour.',
    summary: 'The first hour gives players time to spread out, prepare, and settle into the season before combat turns on.',
  },
  {
    title: 'End Opening',
    startsAt: seasonStartTimestamp + 7 * 24 * 60 * 60 * 1000,
    priority: 0,
    type: 'End Event',
    reward: 'Dragon Egg race begins',
    objective: 'The End opens exactly seven days after server start.',
    summary: 'The first major objective fight opens the End and begins the race for the Dragon Egg.',
  },
  {
    title: 'Dragon Egg = Mace',
    startsAt: seasonStartTimestamp + 7 * 24 * 60 * 60 * 1000,
    priority: 1,
    type: 'Objective Challenge',
    reward: 'Mace conversion',
    objective: 'Survive the End fight, carry the egg out of the End, and stay alive for 48 hours.',
    summary: 'Survive the End fight, carry the egg out of the End, and stay alive for 48 hours!',
  },
]

const legalPages: Record<string, LegalPageContent> = {
  legal: {
    id: 'legal',
    label: 'Legal',
    title: 'Legal Notice',
    intro: 'Legal information for the SHD Lifesteal website and related Season 1 support flows.',
    sections: [
      { title: 'Project Owner', body: 'SHD Esports, represented by Louis Lenhartz.' },
      { title: 'Business Address', body: 'Louis Lenhartz, An der Burg Suelz 27a, 53797 Lohmar, Nordrhein-Westfalen, Germany.' },
      { title: 'Website Purpose', body: 'This website provides public information about the Lifesteal season, including rules, players, events, support flows, and server information.' },
      { title: 'External Services', body: 'The website and season flow may use Discord for community communication, Minecraft/Microsoft account information for player identity, and the SHD Support Portal at support.shd-esports.com for applications, appeals, and staff review.' },
      { title: 'Contact', body: 'Preferred contact path: SHD Support Portal at support.shd-esports.com. Before public launch, activate support@shd-esports.com for direct email contact.' },
    ],
  },
  privacy: {
    id: 'privacy',
    label: 'Privacy Policy',
    title: 'Privacy Policy',
    intro: 'Privacy information for the SHD Lifesteal website, server systems, applications, appeals, and public season statistics.',
    sections: [
      { title: 'Controller', body: 'SHD Esports, represented by Louis Lenhartz, An der Burg Suelz 27a, 53797 Lohmar, Nordrhein-Westfalen, Germany.' },
      { title: 'Data We May Process', body: 'We may process Minecraft usernames, Minecraft UUIDs, Discord usernames or IDs, application IDs, appeal IDs, application answers, appeal text, submitted evidence, player statistics, objective holder data, punishment records, server logs, and website or support portal technical logs.' },
      { title: 'Purpose of Processing', body: 'Data is used for server operation, whitelist and application review, ban appeals and support, moderation, anti-cheat review, leaderboard and season statistics, event organization, security, and abuse prevention.' },
      { title: 'External Services', body: 'The project may use Discord, Minecraft/Microsoft account identifiers, SHD-owned support systems, server hosting, website hosting, and future database or form systems required for applications and appeals.' },
      { title: 'Public Data', body: 'Public pages may show player names, hearts, kills, deaths, playtime, status labels, objective holders, event results, and online player counts. Internal OBS widgets are not intended as public data sources.' },
      { title: 'Retention', body: 'Applications are generally kept for the relevant season, roughly 3 to 4 months. Server logs are generally kept for the season. Appeals and punishment records may be kept long-term so staff can review repeat cases and historical decisions.' },
      { title: 'Requests and Rights', body: 'Players may request access, correction, or deletion through the SHD Support Portal at support.shd-esports.com. Before public launch, activate privacy@shd-esports.com for privacy requests and support@shd-esports.com for general support.' },
    ],
  },
  terms: {
    id: 'terms',
    label: 'Terms of Service',
    title: 'Terms of Service',
    intro: 'Terms for using the SHD Lifesteal website, support portal references, and public season information.',
    sections: [
      { title: 'Use of the Website', body: 'This website is intended for players and viewers of the SHD Lifesteal season. Abuse, scraping, impersonation, or attempts to disrupt services may be restricted.' },
      { title: 'Server Participation', body: 'Joining the server may require application approval, rules acceptance, Discord verification, Minecraft account verification, and compliance with moderation decisions.' },
      { title: 'Content Accuracy', body: 'Stats, holders, schedules, and support states may be delayed or corrected if backend data changes or staff review requires adjustments.' },
      { title: 'Applications and Appeals', body: 'Applications and punishment appeals may be handled through support.shd-esports.com. Submitting false, abusive, duplicated, or spam content may result in denied requests or further restrictions.' },
      { title: 'Moderation', body: 'Staff may warn, mute, kick, ban, remove items, reverse actions, or issue other moderation actions when rules, event integrity, or server security require it.' },
      { title: 'Third-Party Services', body: 'Discord, Minecraft, Microsoft, hosting providers, and other external services are operated by their respective providers and are not controlled by SHD Esports.' },
      { title: 'Changes', body: 'Rules, features, website pages, support processes, event details, and public data displays may change during the season as the project evolves.' },
    ],
  },
  imprint: {
    id: 'imprint',
    label: 'Imprint',
    title: 'Imprint',
    intro: 'Imprint information for the SHD Lifesteal website.',
    sections: [
      { title: 'Responsible Entity', body: 'SHD Esports, represented by Louis Lenhartz.' },
      { title: 'Address', body: 'Louis Lenhartz, An der Burg Suelz 27a, 53797 Lohmar, Nordrhein-Westfalen, Germany.' },
      { title: 'Contact', body: 'Preferred contact path: SHD Support Portal at support.shd-esports.com. Before public launch, activate support@shd-esports.com for email contact.' },
      { title: 'Editorial Responsibility', body: 'Louis Lenhartz is responsible for the website content unless a different responsible editor is named later.' },
    ],
  },
}

function pageFromPath(): PageId {
  const value = window.location.pathname.replace(/^\/+/, '') as PageId
  return routeItems.some((item) => item.id === value) ? value : 'landing'
}

function pathForPage(page: PageId) {
  return page === 'landing' ? '/' : `/${page}`
}

function App() {
  const [page, setPage] = useState<PageId>(() => pageFromPath())
  const liveData = useLiveData()
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
        {page === 'landing' && <Landing liveHealth={liveData.health} liveLoaded={liveData.loaded} liveStatus={liveData.status} onNavigate={navigate} />}
        {page === 'rules' && <RulesPage />}
        {page === 'players' && <PlayersPage liveHealth={liveData.health} liveLoaded={liveData.loaded} liveObjectives={liveData.objectives} livePlayers={liveData.players} liveUpdatedAt={liveData.playersUpdatedAt} />}
        {page === 'events' && <EventsPage />}
        {page === 'world' && <WorldPage />}
        {page === 'signup' && <SignupPage />}
        {page === 'punishments' && <PunishmentsPage />}
        {footerLegalItems.some((item) => item.id === page) && <LegalInfoPage page={page} />}
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
  return (
    <header className="topbar">
      <button className="brand-button" onClick={() => onNavigate('landing')} type="button">
        SHD LIFESTEAL
      </button>
      <nav aria-label="Main navigation">
        {navItems.slice(1).map((item) => (
          <button key={item.id} className={current === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)} type="button">
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

function Landing({ liveHealth, liveLoaded, liveStatus, onNavigate }: { liveHealth: SyncHealth | null; liveLoaded: boolean; liveStatus: LiveStatus | null; onNavigate: (page: PageId) => void }) {
  const [eventCountdown, setEventCountdown] = useState(() => countdownTo(seasonStartTimestamp))
  const hasLivePopulation = liveStatus?.online_players != null && liveStatus?.max_players != null
  const population = !seasonStarted
    ? eventCountdown
    : hasLivePopulation
    ? `${liveStatus.online_players} / ${liveStatus.max_players} Players`
    : liveLoaded
      ? 'Live status unavailable'
      : 'Loading live data'
  const populationNote = !seasonStarted
    ? 'July 1, 2026 - 12:00 CEST. Registered players are listed on the Players page until Season 1 begins.'
    : hasLivePopulation
    ? `Updated ${relativeTime(liveStatus.updated_at)}`
    : liveLoaded
      ? 'Waiting for the next public server sync.'
      : 'Connecting to the public live API.'

  useEffect(() => {
    if (seasonStarted) return
    const interval = window.setInterval(() => setEventCountdown(countdownTo(seasonStartTimestamp)), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="landing-page page-frame">
      <div className="landing-copy">
        <img className="landing-logo" src={shdTextLogo} alt="SHD" />
        <span className="chip">SHD LIFESTEAL</span>
        <h1>SHD LIFESTEAL</h1>
        <p className="season-line">Season 1</p>
        <div className="landing-live-card" aria-label="Current server population">
          <span>{seasonStarted ? 'Online Now' : 'Event Starts In'}</span>
          <strong>{population}</strong>
          {seasonStarted && liveHealth && <em className={`sync-pill ${liveHealth.state}`}>{syncHealthLabel(liveHealth)}</em>}
          <p>{populationNote}</p>
        </div>
        <div className="landing-actions">
          {priorityLinks.map((link, index) => (
            <button className={index === 0 ? 'primary-action' : 'secondary-action'} key={link.id} onClick={() => onNavigate(link.id)} type="button">
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </section>
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

function RulesPage() {
  return (
    <section className="content-page rules-page page-frame">
      <PageIntro label="Rules" title={parsedRules.title}>
        Official rules for the SHD Lifesteal event. This version is text-first and mirrors the final public rule document.
      </PageIntro>
      <aside className="rules-key-info">
        <strong>Need the rules key?</strong>
        <span>Read through the rules, then scroll to the bottom to generate the SHD-RULES key for your application.</span>
      </aside>
      <div className="rules-layout">
        <aside className="rules-index" aria-label="Rules index">
          {parsedRules.index.map((section) => (
            <a href={`#${section.id}`} key={section.id}>
              <span>{section.number || '--'}</span>
              {section.title}
            </a>
          ))}
        </aside>
        <article className="rules-document">
          {parsedRules.blocks.map((block, index) => (
            <RuleBlockView block={block} key={`${block.type}-${index}`} />
          ))}
          <RulesAcknowledgement />
        </article>
      </div>
    </section>
  )
}

function RulesAcknowledgement() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const acknowledge = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${publicApiBase}/rules/acknowledge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: 'lifesteal' }),
      })
      const body = await response.json() as { ok?: boolean; code?: string; error?: string }
      if (!response.ok || !body.ok || !body.code) {
        throw new Error(body.error ?? 'Could not create rules key.')
      }
      setCode(body.code)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create rules key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rules-acknowledgement">
      <span>Application Step</span>
      <h2>Rules Acknowledgement</h2>
      <p>Generate a rules key after reading the rules. You will need this key for the SHD Support signup form.</p>
      {code && (
        <p className="rules-key-result">
          Your rules key is: <strong>{code}</strong>
        </p>
      )}
      {error && <p className="rules-acknowledgement-error">{error}</p>}
      {!code && <button className="primary-action" onClick={acknowledge} type="button">{loading ? 'Creating Key...' : 'I Read And Understand The Rules'}</button>}
    </section>
  )
}

function RuleBlockView({ block }: { block: RuleBlock }) {
  if (block.type === 'h2') {
    return <h2 id={block.id}>{block.text}</h2>
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

function PlayersPage({ liveHealth, liveLoaded, liveObjectives, livePlayers, liveUpdatedAt }: { liveHealth: SyncHealth | null; liveLoaded: boolean; liveObjectives: PublicObjectives | null; livePlayers: Player[]; liveUpdatedAt: number | null }) {
  const [query, setQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const players = livePlayers
  const usingLiveObjectives = livePlayers.length > 0 && liveObjectives != null
  const topPlayer = players[0]
  const dragonEggHolder = players.find((player) => player.prestige.includes('dragon-egg'))
  const maceWielders = players.filter((player) => player.prestige.includes('mace-1') || player.prestige.includes('mace-2'))
  const mostKills = [...players].sort((first, second) => second.kills - first.kills)[0]
  const mostPlaytime = [...players].sort((first, second) => second.playtime.localeCompare(first.playtime))[0]
  const twentyHeartPlayers = usingLiveObjectives
    ? liveObjectives?.twenty_hearts?.count ?? 0
    : players.filter((player) => player.hearts >= 20).length
  const eliminatedPlayers = players.filter(isEliminated).length
  const activePlayers = players.length - eliminatedPlayers
  const dragonEggOwner = usingLiveObjectives ? liveObjectives?.dragon_egg?.owner ?? null : dragonEggHolder?.name ?? null
  const dragonEggDetail = usingLiveObjectives
    ? (liveObjectives?.dragon_egg?.owner ? `Updated ${relativeTime(liveObjectives.dragon_egg.source_updated_at ?? liveObjectives.dragon_egg.updated_at)}` : 'No public holder synced')
    : (dragonEggHolder ? `Updated ${dragonEggHolder.lastUpdated}` : 'No public holder synced')
  const liveMaces = liveObjectives?.maces ?? []
  const maceOneOwner = usingLiveObjectives ? liveMaces[0]?.owner ?? null : maceWielders[0]?.name ?? null
  const maceTwoOwner = usingLiveObjectives ? liveMaces[1]?.owner ?? null : maceWielders[1]?.name ?? null
  const maceOneKills = usingLiveObjectives ? liveMaces[0]?.mace_kills ?? null : maceWielders[0]?.maceKills ?? null
  const maceTwoKills = usingLiveObjectives ? liveMaces[1]?.mace_kills ?? null : maceWielders[1]?.maceKills ?? null
  const maceDetail = (owner: string | null, kills: number | null) => {
    if (!owner) return 'No public wielder synced'
    return kills == null ? 'Mace kills not synced yet' : `${kills} mace kills`
  }
  const filteredPlayers = useMemo(() => {
    if (!normalizedQuery) {
      return players
    }

    return players.filter((player) => playerSearchText(player).includes(normalizedQuery))
  }, [normalizedQuery, players])
  const preSeasonPlayers = useMemo(() => {
    const roster = normalizedQuery ? filteredPlayers : players
    return [...roster].sort((first, second) =>
      preSeasonStatusRank(first) - preSeasonStatusRank(second) ||
      preSeasonBadgeRank(first) - preSeasonBadgeRank(second) ||
      first.name.localeCompare(second.name)
    )
  }, [filteredPlayers, normalizedQuery, players])
  const openProfile = (player: Player) => {
    const params = new URLSearchParams(window.location.search)
    params.set('profile', player.name)
    window.history.replaceState(null, '', `${pathForPage('players')}?${params.toString()}`)
    setSelectedPlayer(player)
  }
  const closeProfile = () => {
    window.history.replaceState(null, '', pathForPage('players'))
    setSelectedPlayer(null)
  }

  useEffect(() => {
    const profileName = new URLSearchParams(window.location.search).get('profile')
    if (!profileName || selectedPlayer) return
    const profile = players.find((player) => player.name.toLowerCase() === profileName.toLowerCase())
    if (profile) setSelectedPlayer(profile)
  }, [players, selectedPlayer])

  useEffect(() => {
    if (!selectedPlayer) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeProfile()
      }
    }

    document.body.classList.add('modal-open')
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedPlayer])

  if (!seasonStarted) {
    return (
      <section className="content-page page-frame">
        <PageIntro label="Players" title="Registered Players">
          Season 1 has not started yet. Until live gameplay begins, this page only shows registered public players and the SHD team.
        </PageIntro>
        <div className="leaderboard-tools pre-season-tools">
          <div>
            <span>Pre-Season Roster</span>
            <strong>{liveLoaded ? `${players.length} Public Roster Entries` : 'Loading Public Roster'}</strong>
            <div className="leaderboard-counts" aria-label="Pre-season player counts">
              <span>{players.filter((player) => preSeasonStatus(player) === 'Whitelisted').length} Whitelisted</span>
              <span>{players.filter((player) => preSeasonStatus(player) === 'Registered').length} Registered</span>
              <span>{players.filter((player) => preSeasonStatus(player) === 'Applied').length} Applied</span>
              {!liveLoaded && <span>Connecting to public API</span>}
              {liveLoaded && players.length === 0 && <span>No public players registered yet</span>}
              {players.length > 0 && <span>Updated {relativeTime(liveUpdatedAt)}</span>}
            </div>
          </div>
          <label className="player-search">
            <span>Search Players</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players..." type="search" />
          </label>
        </div>
        <div className="pre-season-roster">
          <PreSeasonRosterTable players={preSeasonPlayers} emptyText={liveLoaded ? 'No registered public players found.' : 'Loading registered players...'} />
        </div>
      </section>
    )
  }

  return (
    <section className="content-page page-frame">
      <div className={selectedPlayer ? 'players-content is-muted' : 'players-content'}>
        <PageIntro label="Players" title="Player List">
          Leaderboard-style roster view for every season player, objective holders, combat stats, and live player profiles.
        </PageIntro>
        <div className="objective-row player-objectives">
          <Objective title="Dragon Egg" owner={dragonEggOwner ?? 'Unclaimed'} detail={dragonEggDetail} />
          <Objective title="Mace One" owner={maceOneOwner ?? 'Unclaimed'} detail={maceDetail(maceOneOwner, maceOneKills)} />
          <Objective title="Mace Two" owner={maceTwoOwner ?? 'Unclaimed'} detail={maceDetail(maceTwoOwner, maceTwoKills)} />
          <Objective title="20 Hearts" owner={`${twentyHeartPlayers} Players`} detail="Number of players who reached 20 hearts" />
        </div>
        <div className="objective-row player-highlights">
          <Objective title="Most Kills" owner={mostKills?.name ?? 'Pending'} detail={`${mostKills?.kills ?? 0} confirmed kills`} />
          <Objective title="Top Hearts" owner={topPlayer?.name ?? 'Pending'} detail={`${topPlayer?.hearts ?? 0} current hearts`} />
          <Objective title="Most Playtime" owner={mostPlaytime?.name ?? 'Pending'} detail={`${mostPlaytime?.playtime ?? 'Hidden'} active this season`} />
          <Objective title="Bounty Target" owner="Pending" detail="Reward pool opens during public bounty windows" />
        </div>
        <div className="leaderboard-tools">
          <div>
            <span>{livePlayers.length > 0 ? 'Live Leaderboard' : 'Loading Leaderboard'}</span>
            <strong>{normalizedQuery ? `${filteredPlayers.length} Matching Players` : liveLoaded ? `${players.length} Total Players` : 'Loading Players'}</strong>
            <div className="leaderboard-counts" aria-label="Season player counts">
              <span>{activePlayers} Active</span>
              <span>{eliminatedPlayers} Eliminated</span>
              {!liveLoaded && <span>Connecting to live API</span>}
              {liveLoaded && livePlayers.length === 0 && <span>No public players synced yet</span>}
              {livePlayers.length > 0 && <span>Updated {relativeTime(liveUpdatedAt)}</span>}
              {livePlayers.length > 0 && liveHealth && <span className={`sync-pill ${liveHealth.state}`}>{syncHealthLabel(liveHealth)} · {syncHealthDetail(liveHealth)}</span>}
            </div>
          </div>
          <label className="player-search">
            <span>Search Players</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players..." type="search" />
          </label>
        </div>
        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Prestige</th>
                <th>Hearts</th>
                <th>Kills</th>
                <th>Deaths</th>
                <th>Playtime</th>
                <th>Status</th>
                <th>Move</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr
                  className="player-row"
                  key={player.name}
                  onClick={() => openProfile(player)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openProfile(player)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className="rank">#{player.rank}</td>
                  <td className="player-name">{player.name}</td>
                  <td>
                    <PrestigeList player={player} />
                  </td>
                  <td>
                    <HeartValue player={player} />
                  </td>
                  <td>{player.kills}</td>
                  <td>{player.deaths}</td>
                  <td>{player.playtime}</td>
                  <td>
                    <StatusBadge player={player} />
                  </td>
                  <td>
                    <MoveIndicator player={player} />
                  </td>
                </tr>
              ))}
              {filteredPlayers.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan={9}>{liveLoaded ? 'No players found.' : 'Loading live players...'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedPlayer && <PlayerProfileModal player={selectedPlayer} onClose={closeProfile} />}
    </section>
  )
}

function PreSeasonRosterTable({ players, emptyText }: { players: Player[]; emptyText: string }) {
  return (
    <section className="table-panel pre-season-table">
      <header>
        <span>Registered Roster</span>
        <strong>{players.length}</strong>
      </header>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Badges</th>
            <th>Status</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.name}>
              <td className="player-name">{player.name}</td>
              <td>
                <span className={`pre-season-badge ${preSeasonBadgeClass(player)}`}>{preSeasonBadge(player)}</span>
              </td>
              <td>{preSeasonStatus(player)}</td>
              <td>{player.lastUpdated}</td>
            </tr>
          ))}
          {players.length === 0 && (
            <tr>
              <td className="empty-row" colSpan={4}>{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function preSeasonBadge(player: Player) {
  if (player.prestige.includes('owner')) return 'Owner'
  if (player.prestige.includes('admin')) return 'Admin'
  if (player.prestige.includes('mod')) return 'Mod'
  if (player.prestige.includes('shd-team')) return 'SHD Team'
  return 'Player'
}

function preSeasonBadgeRank(player: Player) {
  return ['Owner', 'Admin', 'Mod', 'SHD Team', 'Player'].indexOf(preSeasonBadge(player))
}

function preSeasonBadgeClass(player: Player) {
  return preSeasonBadge(player).toLowerCase().replace(/\s+/g, '-')
}

function preSeasonStatus(player: Player) {
  if (preSeasonBadge(player) !== 'Player') return 'Whitelisted'
  return player.status === 'Applied' ? 'Applied' : 'Registered'
}

function preSeasonStatusRank(player: Player) {
  const status = preSeasonStatus(player)
  if (status === 'Whitelisted') return 0
  if (status === 'Registered') return 1
  return 2
}

function HeartValue({ player }: { player: Player }) {
  return (
    <span className="hover-wrap heart-value" tabIndex={0}>
      <span>{player.hearts}</span>
      <span className="hover-card heart-card" role="tooltip">
        <strong>Heart Breakdown</strong>
        <span>Current Hearts: {player.hearts}</span>
        <span>Hearts Gained: {statValue(player.heartsGained)}</span>
        <span>Hearts Lost: {statValue(player.heartsLost)}</span>
      </span>
    </span>
  )
}

function MoveIndicator({ player }: { player: Player }) {
  const amount = Math.abs(player.previousRank - player.rank)
  const symbol = player.move === 'up' ? '+' : player.move === 'down' ? '-' : '-'
  const label = player.move === 'same' ? '-' : `${symbol} ${amount}`
  const title = player.move === 'same' ? 'No rank change since the previous live snapshot' : `Moved ${player.move} ${amount} ${amount === 1 ? 'position' : 'positions'} since the previous live snapshot`

  return (
    <span className="hover-wrap" tabIndex={0}>
      <span className={`move ${player.move}`}>{label}</span>
      <span className="hover-card move-card" role="tooltip">
        <strong>Position Change</strong>
        <span>{title}</span>
        <span>Rank #{player.previousRank} {'->'} #{player.rank}</span>
        <span>Updated {player.lastUpdated}</span>
      </span>
    </span>
  )
}

function PlayerProfileModal({ player, onClose }: { player: Player; onClose: () => void }) {
  const statGroups = profileStatsFor(player)

  return (
    <div className="profile-overlay" onClick={onClose} role="presentation">
      <article className="profile-modal" aria-label={`${player.name} player profile`} onClick={(event) => event.stopPropagation()}>
        <button className="profile-close" onClick={onClose} type="button" aria-label="Close player profile">
          X
        </button>
        <header className="profile-header">
          <div className="profile-head-wrap">
            <img className="profile-head" src={playerHeadUrl(player)} alt={`${player.name} Minecraft skin head`} />
          </div>
          <div>
            <span className="profile-eyebrow">Season 1 Profile</span>
            <h2>{player.name}</h2>
            <div className="profile-badges">
              <PrestigeList player={player} expanded />
              <StatusBadge player={player} />
            </div>
          </div>
        </header>
        <div className="profile-summary">
          <ProfileSummaryStat label="Rank" value={`#${player.rank}`} />
          <ProfileSummaryStat label="Hearts" value={String(player.hearts)} />
          <ProfileSummaryStat label="Kills" value={String(player.kills)} />
          <ProfileSummaryStat label="KDR" value={playerKdr(player)} />
        </div>
        <div className="profile-stat-grid">
          {statGroups.map((group) => (
            <section className="profile-stat-card" key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </article>
    </div>
  )
}

function ProfileSummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatusBadge({ player }: { player: Player }) {
  if (!player.status) {
    return null
  }

  const meta = statusInfo[player.status] ?? { label: player.status, kind: 'achievement' as StatusKind }
  return (
    <span className="hover-wrap" tabIndex={0}>
      <span className={`status-badge ${meta.kind}`}>{meta.label}</span>
      <span className="hover-card status-card" role="tooltip">
        <strong>{meta.label}</strong>
        <span>{statusDetail(player, player.status)}</span>
      </span>
    </span>
  )
}

function PrestigeList({ player, expanded = false }: { player: Player; expanded?: boolean }) {
  const badges = [...player.prestige].sort((first, second) => prestigePriority.indexOf(first) - prestigePriority.indexOf(second))

  if (badges.length === 0) {
    return <span className="muted-value">-</span>
  }

  const primaryBadge = badges[0]
  const primaryInfo = prestigeBadges[primaryBadge]
  const extraBadges = badges.slice(1)

  return (
    <div className="prestige-list" aria-label={badges.map((badge) => prestigeBadges[badge].label).join(', ')}>
      <span className="hover-wrap" tabIndex={0}>
        <span className={expanded ? `prestige-badge ${primaryBadge} is-expanded` : `prestige-badge ${primaryBadge}`}>
          {primaryInfo.image && <img src={primaryInfo.image} alt="" />}
          <span className="badge-short">{primaryInfo.shortLabel}</span>
          <span className="badge-full">{primaryInfo.label}</span>
        </span>
        <span className="hover-card prestige-card" role="tooltip">
          <strong>{primaryInfo.label}</strong>
          <span>{prestigeDetail(player, primaryBadge)}</span>
          {extraBadges.length > 0 && (
            <>
              <em>All Prestiges</em>
              {badges.map((badge) => (
                <span key={badge}>{prestigeBadges[badge].label}: {prestigeDetail(player, badge)}</span>
              ))}
            </>
          )}
        </span>
      </span>
      {extraBadges.length > 0 && (
        <span className="hover-wrap" tabIndex={0}>
          <span className="prestige-more">+{extraBadges.length}</span>
          <span className="hover-card prestige-card" role="tooltip">
            <strong>Additional Prestiges</strong>
            {extraBadges.map((badge) => (
              <span key={badge}>{prestigeBadges[badge].label}: {prestigeDetail(player, badge)}</span>
            ))}
          </span>
        </span>
      )}
    </div>
  )
}

function Objective({ title, owner, detail }: { title: string; owner: string; detail: string }) {
  return (
    <article className="objective-card">
      <span>{title}</span>
      <h2>{owner}</h2>
      <p>{detail}</p>
    </article>
  )
}

function EventsPage() {
  const [now, setNow] = useState(() => Date.now())
  const upcomingEvents = [...events]
    .filter((event) => event.startsAt >= now)
    .sort((first, second) => first.startsAt - second.startsAt || first.priority - second.priority)
  const featuredEvent = upcomingEvents[0] ?? [...events].sort((first, second) => second.startsAt - first.startsAt || first.priority - second.priority)[0]
  const eventVisibleItems = Math.max(1, Math.min(4, upcomingEvents.length))
  const eventPanelHeight = `${7.2 + eventVisibleItems * 8.35 + Math.max(0, eventVisibleItems - 1) * 0.8}rem`
  const nextEventCountdown = featuredEvent ? countdownTo(featuredEvent.startsAt) : 'Season live'

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="content-page page-frame">
      <PageIntro label="Events" title="Season Events">
        Season start, grace period, objective windows, and planned public event timings.
      </PageIntro>
      <div className="events-dashboard">
        <article className="featured-event">
          <div>
            <span className="event-status upcoming">Upcoming</span>
            <h2>{featuredEvent.title}</h2>
            <p>{featuredEvent.summary}</p>
          </div>
          <div className="featured-event-meta">
            <EventMeta label="Date" value={eventDate(featuredEvent.startsAt)} />
            <EventMeta label="Time" value={eventTime(featuredEvent.startsAt)} />
            <EventMeta label="Type" value={featuredEvent.type} />
            <EventMeta label="Reward" value={featuredEvent.reward} />
          </div>
        </article>
        <div className="event-stat-row">
          <EventMeta label="Next Event In" value={nextEventCountdown} />
          <EventMeta label="Upcoming" value={String(upcomingEvents.length)} />
          <EventMeta label="Completed" value="-" />
          <EventMeta label="Season Phase" value="Pre-End" />
        </div>
        <div className="event-board event-board-single" style={{ '--event-panel-height': eventPanelHeight } as React.CSSProperties}>
          <section className="event-timeline">
            <span className="event-section-label">Upcoming Schedule</span>
            <div className="event-scroll-list">
              {upcomingEvents.map((event) => (
                <article className="timeline-event" key={event.title}>
                  <div className="timeline-marker" />
                  <div className="timeline-date">
                    <strong>{eventDate(event.startsAt)}</strong>
                    <span>{eventTime(event.startsAt)}</span>
                  </div>
                  <div>
                    <span className="event-status upcoming">{event.type}</span>
                    <h3>{event.title}</h3>
                    <p>{event.objective}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}

function EventMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="event-meta">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function WorldPage() {
  const [eventCountdown, setEventCountdown] = useState(() => countdownTo(seasonStartTimestamp))

  useEffect(() => {
    const interval = window.setInterval(() => setEventCountdown(countdownTo(seasonStartTimestamp)), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="content-page page-frame">
      <PageIntro label="World" title="Map / World Info">
        Public season world information, dimension limits, objective policy, and core server settings.
      </PageIntro>
      <div className="info-grid world-grid">
        <article className="info-card">
          <span>Overworld</span>
          <h2>50,000 x 50,000</h2>
          <p>25k blocks each direction from world center.</p>
        </article>
        <article className="info-card">
          <span>Nether</span>
          <h2>50,000 x 50,000</h2>
          <p>25k blocks each direction from world center.</p>
        </article>
        <article className="info-card">
          <span>End</span>
          <h2>Infinite</h2>
          <p>Disabled until the End event begins.</p>
        </article>
        <article className="info-card">
          <span>Server Settings</span>
          <h2>Season Config</h2>
          <ul>
            <li>Difficulty: Normal</li>
            <li>Version: 1.21.11</li>
            <li>View Distance: 32 chunks test-wise</li>
            <li>Simulation Distance: 12 chunks test-wise</li>
          </ul>
        </article>
        <article className="info-card">
          <span>Objectives</span>
          <h2>Egg + Maces</h2>
          <p>Objective holders are exposed publicly with live holder state, approximate coordinate context, and the in-game glowing effect while tracking is active.</p>
        </article>
        <article className="info-card">
          <span>Grace Period</span>
          <h2>60 Minutes</h2>
          <p>PvP, combat tags, lifesteal, heart loss, eliminations, and revivals stay disabled during grace.</p>
        </article>
      </div>
      <div className="world-event-strip">
        <span>Event Starts In</span>
        <strong>{eventCountdown}</strong>
        <p>July 1, 2026 - 12:00 CEST. Looking forward to starting the server at this date.</p>
      </div>
    </section>
  )
}

function SignupPage() {
  return (
    <section className="content-page page-frame">
      <PageIntro label="Apply" title="Season 1 Applications">
        Public application hub for joining the Lifesteal season with a rules key, support form, and Discord ticket verification.
      </PageIntro>
      <div className="apply-page">
        <article className="apply-hero">
          <div>
            <span className="apply-status">Applications Open</span>
            <h2>Apply for the whitelist</h2>
            <p>
              Read the Lifesteal rules first and generate your rules key at the bottom of the rules page. The SHD Support
              portal uses that key before creating your application key for Discord ticket verification.
            </p>
          </div>
          <div className="apply-portal-card">
            <span>Portal</span>
            <strong>support.shd-esports.com</strong>
            <p>SHD support portal for applications, appeals, reports, and staff review.</p>
            <a className="primary-action" href="https://support.shd-esports.com/applications">Open Support Portal</a>
          </div>
        </article>

        <div className="apply-flow" aria-label="Application review flow">
          <ApplyStep number="01" title="Read Rules" detail="Read the Lifesteal rules and generate your SHD-RULES key." />
          <ApplyStep number="02" title="Submit Form" detail="Open SHD Support, select Minecraft, and complete MC - Signup." />
          <ApplyStep number="03" title="Get App Key" detail="Save your generated SHD-APP key after submission." />
          <ApplyStep number="04" title="Open Ticket" detail="Send the SHD-APP key inside your Discord ticket." />
          <ApplyStep number="05" title="Staff Review" detail="The bot verifies your ticket and staff reviews the application." />
        </div>

        <div className="apply-grid">
          <article className="apply-card">
            <span>Requirements</span>
            <h2>Before You Apply</h2>
            <ul>
              <li>Minecraft Java account ready</li>
              <li>Discord account available for tickets</li>
              <li>Rules key generated from this website</li>
              <li>No alt account abuse</li>
              <li>Understand heart loss and elimination</li>
            </ul>
          </article>
          <article className="apply-card">
            <span>Review Outcomes</span>
            <h2>Application Status</h2>
            <div className="apply-outcomes">
              <strong>Ticket Verified</strong>
              <strong>Accepted</strong>
              <strong>Pending Review</strong>
              <strong>Waitlisted</strong>
              <strong>Denied</strong>
            </div>
            <p>Use your SHD-APP key in your ticket. Do not DM staff about applications.</p>
          </article>
        </div>

        <aside className="application-id-preview">
          <div>
            <span>Example Application Key</span>
            <strong>SHD-APP-A7K2Q9</strong>
          </div>
          <p>After submitting the portal form, send this key in your Discord ticket so the bot can verify your application.</p>
        </aside>
      </div>
    </section>
  )
}

function ApplyStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <article className="apply-step">
      <span>{number}</span>
      <h2>{title}</h2>
      <p>{detail}</p>
    </article>
  )
}

function PunishmentsPage() {
  return (
    <section className="content-page page-frame">
      <PageIntro label="Moderation" title="Punishments & Appeals">
        Public moderation hub for ban appeals, evidence review, support IDs, and staff decisions.
      </PageIntro>
      <div className="apply-page">
        <article className="apply-hero punishment-hero">
          <div>
            <span className="apply-status punishment-status">Appeals Reviewed</span>
            <h2>Appeal a punishment</h2>
            <p>
              Appeals will be handled through the SHD Support Portal. Submit your appeal there once the Minecraft appeal
              flow opens and keep the generated key for Discord follow-up.
            </p>
          </div>
          <div className="apply-portal-card">
            <span>Support Portal</span>
            <strong>support.shd-esports.com</strong>
            <p>One SHD portal for applications, ban appeals, reports, and support requests.</p>
            <a className="primary-action" href="https://support.shd-esports.com/reports-appeals">Open Support Portal</a>
          </div>
        </article>

        <div className="apply-flow" aria-label="Appeal review flow">
          <ApplyStep number="01" title="Check Reason" detail="Read the punishment reason and any staff note first." />
          <ApplyStep number="02" title="Submit Appeal" detail="Explain what happened through the support portal." />
          <ApplyStep number="03" title="Add Evidence" detail="Attach clips, screenshots, or logs if they help the review." />
          <ApplyStep number="04" title="Keep Key" detail="Save the generated appeal key for staff follow-up." />
          <ApplyStep number="05" title="Wait Review" detail="Staff reviews evidence and updates the appeal status." />
        </div>

        <div className="apply-grid">
          <article className="apply-card">
            <span>Appeal Checklist</span>
            <h2>What Staff Needs</h2>
            <ul>
              <li>Minecraft username and Discord tag</li>
              <li>Punishment reason and approximate time</li>
              <li>Short explanation without spam</li>
              <li>Clips, screenshots, or logs if available</li>
              <li>One appeal per punishment</li>
            </ul>
          </article>
          <article className="apply-card">
            <span>Review Outcomes</span>
            <h2>Appeal Status</h2>
            <div className="apply-outcomes punishment-outcomes">
              <strong>Accepted</strong>
              <strong>Denied</strong>
              <strong>Reduced</strong>
              <strong>Needs Info</strong>
            </div>
            <p>Appeals are evidence-first. Staff may uphold, reduce, or fully remove a punishment after review.</p>
          </article>
        </div>

        <div className="apply-grid">
          <article className="apply-card">
            <span>Anti-Cheat</span>
            <h2>Evidence First</h2>
            <p>
              Season 1 anti-cheat should collect useful evidence, alert staff, and avoid rushed automatic bans wherever possible.
            </p>
          </article>
          <article className="apply-card">
            <span>Staff Boundary</span>
            <h2>No DM Appeals</h2>
            <p>
              Do not DM individual staff members about punishments. Use the support portal so the whole review history stays visible.
            </p>
          </article>
        </div>

        <aside className="application-id-preview">
          <div>
            <span>Example Appeal Key</span>
            <strong>SHD-APPEAL-4M9Q</strong>
          </div>
          <p>Use this key in Discord if staff requests follow-up. It lets moderators find the exact appeal without digging.</p>
        </aside>
      </div>
    </section>
  )
}

function LegalInfoPage({ page }: { page: PageId }) {
  const content = legalPages[page] ?? legalPages.legal

  return (
    <section className="content-page legal-page page-frame">
      <PageIntro label={content.label} title={content.title}>
        {content.intro}
      </PageIntro>
      <article className="legal-document">
        <div className="legal-note">
          <span>Draft Legal Copy</span>
          <p>This page uses provided project data. Review it before public release and activate the listed contact emails first.</p>
        </div>
        {content.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </article>
    </section>
  )
}

function Footer({ current, onNavigate }: { current: string; onNavigate: (page: PageId) => void }) {
  return (
    <footer className="footer">
      <strong>SHD LIFESTEAL</strong>
      <p>© 2026 SHD Esports. Public Lifesteal season website. Current page: {current}.</p>
      <nav aria-label="Legal navigation">
        {footerLegalItems.map((item) => (
          <button key={item.id} onClick={() => onNavigate(item.id)} type="button">
            {item.label}
          </button>
        ))}
      </nav>
    </footer>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
