import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import heroImage from './assets/lifesteal-hero.png'
import dragonEggBadge from './assets/prestige/dragon-egg.png'
import adminBadge from './assets/prestige/admin.png'
import ownerBadge from './assets/prestige/owner.png'
import maceBadge from './assets/prestige/mace.png'
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
  heartsGained: number
  heartsLost: number
  kills: number
  deaths: number
  playtime: string
  status?: string
  move: Move
  previousRank: number
  lastUpdated: string
}

type EventItem = {
  title: string
  date: string
  time: string
  status: 'Upcoming' | 'Complete'
  type: string
  reward: string
  objective: string
  summary: string
  result?: string
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

const players: Player[] = [
  { rank: 1, name: 'Wemmbu', prestige: ['mace-1'], hearts: 20, heartsGained: 14, heartsLost: 4, kills: 37, deaths: 4, playtime: '18h 42m', status: 'Most Feared', move: 'same', previousRank: 1, lastUpdated: '12 min ago' },
  { rank: 2, name: 'FlameFrags', prestige: ['dragon-egg'], hearts: 20, heartsGained: 13, heartsLost: 3, kills: 31, deaths: 7, playtime: '17h 06m', status: 'Most Wanted', move: 'up', previousRank: 4, lastUpdated: '12 min ago' },
  { rank: 3, name: 'Ashswag', prestige: ['admin'], hearts: 19, heartsGained: 12, heartsLost: 3, kills: 26, deaths: 6, playtime: '16h 58m', status: 'Kill Streak x5+', move: 'down', previousRank: 2, lastUpdated: '12 min ago' },
  { rank: 4, name: 'Parrot', prestige: ['shd-team'], hearts: 18, heartsGained: 11, heartsLost: 3, kills: 22, deaths: 8, playtime: '15h 33m', status: 'Event Winner', move: 'same', previousRank: 4, lastUpdated: '12 min ago' },
  { rank: 5, name: 'Mapicc', prestige: [], hearts: 17, heartsGained: 10, heartsLost: 3, kills: 19, deaths: 9, playtime: '14h 51m', status: 'Bounty Target', move: 'up', previousRank: 7, lastUpdated: '12 min ago' },
  { rank: 6, name: 'MinuteTech', prestige: ['mod'], hearts: 16, heartsGained: 9, heartsLost: 3, kills: 18, deaths: 10, playtime: '13h 24m', status: 'Kill Streak x5+', move: 'up', previousRank: 8, lastUpdated: '12 min ago' },
  { rank: 7, name: 'Spoke', prestige: ['mace-2'], hearts: 15, heartsGained: 8, heartsLost: 3, kills: 16, deaths: 8, playtime: '12h 49m', move: 'same', previousRank: 7, lastUpdated: '12 min ago' },
  { rank: 8, name: 'Zam', prestige: [], hearts: 14, heartsGained: 7, heartsLost: 3, kills: 14, deaths: 9, playtime: '12h 11m', status: 'Bounty Target', move: 'down', previousRank: 6, lastUpdated: '12 min ago' },
  { rank: 9, name: 'ClownPierce', prestige: [], hearts: 13, heartsGained: 6, heartsLost: 3, kills: 13, deaths: 11, playtime: '11h 38m', status: 'Most Wanted', move: 'same', previousRank: 9, lastUpdated: '12 min ago' },
  { rank: 10, name: 'Branzy', prestige: [], hearts: 12, heartsGained: 5, heartsLost: 3, kills: 11, deaths: 10, playtime: '10h 52m', move: 'up', previousRank: 12, lastUpdated: '12 min ago' },
  { rank: 11, name: 'ChiefXD', prestige: [], hearts: 11, heartsGained: 4, heartsLost: 3, kills: 9, deaths: 12, playtime: '9h 47m', move: 'down', previousRank: 10, lastUpdated: '12 min ago' },
  { rank: 12, name: 'Jaron', prestige: ['owner', 'shd-team'], hearts: 10, heartsGained: 4, heartsLost: 4, kills: 8, deaths: 13, playtime: '9h 02m', move: 'same', previousRank: 12, lastUpdated: '12 min ago' },
  { rank: 13, name: 'PlanetLord', prestige: [], hearts: 9, heartsGained: 3, heartsLost: 4, kills: 7, deaths: 13, playtime: '8h 44m', move: 'up', previousRank: 15, lastUpdated: '12 min ago' },
  { rank: 14, name: 'Redoons', prestige: [], hearts: 8, heartsGained: 3, heartsLost: 5, kills: 6, deaths: 14, playtime: '7h 55m', move: 'down', previousRank: 13, lastUpdated: '12 min ago' },
  { rank: 15, name: 'Vort3x', prestige: [], hearts: 7, heartsGained: 2, heartsLost: 5, kills: 5, deaths: 15, playtime: '7h 21m', move: 'same', previousRank: 15, lastUpdated: '12 min ago' },
  { rank: 16, name: 'Mysticat', prestige: [], hearts: 6, heartsGained: 2, heartsLost: 6, kills: 4, deaths: 15, playtime: '6h 40m', status: 'Eliminated', move: 'down', previousRank: 14, lastUpdated: '12 min ago' },
  { rank: 17, name: 'Tango', prestige: [], hearts: 1, heartsGained: 1, heartsLost: 10, kills: 3, deaths: 16, playtime: '5h 12m', status: 'On Last Heart', move: 'same', previousRank: 17, lastUpdated: '12 min ago' },
  { rank: 18, name: 'Ivory', prestige: [], hearts: 0, heartsGained: 1, heartsLost: 11, kills: 2, deaths: 17, playtime: '4h 38m', status: 'Eliminated', move: 'down', previousRank: 18, lastUpdated: '12 min ago' },
]

const prestigeBadges: Record<PrestigeBadgeId, { label: string; shortLabel: string; image?: string }> = {
  owner: { label: 'Owner', shortLabel: 'OWN', image: ownerBadge },
  admin: { label: 'Admin', shortLabel: 'ADM', image: adminBadge },
  mod: { label: 'Mod', shortLabel: 'MOD', image: moderatorBadge },
  'shd-team': { label: 'SHD Team', shortLabel: 'SHD' },
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

function isEliminated(player: Player) {
  return player.status === 'Eliminated' || player.hearts <= 0
}

function prestigeDetail(player: Player, badge: PrestigeBadgeId) {
  if (badge === 'dragon-egg') {
    return 'Last pickup at 21:48'
  }

  if (badge === 'mace-1') {
    return 'Kills with Mace: 12'
  }

  if (badge === 'mace-2') {
    return 'Kills with Mace: 7'
  }

  if (badge === 'owner') {
    return 'Server owner'
  }

  if (badge === 'admin') {
    return 'Staff prefix: Admin'
  }

  if (badge === 'mod') {
    return 'Staff prefix: Mod'
  }

  return player.name === 'Jaron' ? 'SHD Team member' : 'Event staff team'
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
    return 'Current bounty reward: 3 Hearts'
  }

  if (status === 'Kill Streak x5+') {
    return player.name === 'Ashswag' ? 'Current kill streak: 8' : 'Current kill streak: 5'
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

function playerHeadUrl(player: Player) {
  return `https://minotar.net/avatar/${encodeURIComponent(player.name)}/128.png`
}

function profileStatsFor(player: Player): ProfileStatGroup[] {
  if (player.name !== 'Wemmbu') {
    return [
      {
        title: 'General',
        stats: [
          { label: 'Current Hearts', value: String(player.hearts) },
          { label: 'Maximum Hearts Reached', value: String(Math.max(player.hearts, 10)) },
          { label: 'Total Hearts Gained', value: String(player.heartsGained) },
          { label: 'Total Hearts Lost', value: String(player.heartsLost) },
          { label: 'Kill Count', value: String(player.kills) },
          { label: 'Death Count', value: String(player.deaths) },
          { label: 'KDR', value: playerKdr(player) },
          { label: 'Playtime', value: player.playtime },
        ],
      },
      {
        title: 'Profile Mock',
        stats: [
          { label: 'Detailed Card', value: 'Coming Later' },
          { label: 'Current Test Player', value: 'Wemmbu' },
        ],
      },
    ]
  }

  return [
    {
      title: 'General',
      stats: [
        { label: 'Current Hearts', value: '20' },
        { label: 'Maximum Hearts Reached', value: '20' },
        { label: 'Total Hearts Gained', value: '14' },
        { label: 'Total Hearts Lost', value: '4' },
        { label: 'Kill Count', value: '37' },
        { label: 'Death Count', value: '4' },
        { label: 'KDR', value: '9.25' },
        { label: 'Playtime', value: '18h 42m' },
      ],
    },
    {
      title: 'Lifesteal',
      stats: [
        { label: 'Hearts Withdrawn', value: '5' },
        { label: 'Hearts Consumed', value: '9' },
        { label: 'Hearts Crafted', value: '3' },
        { label: 'Revivals Received', value: '1' },
        { label: 'Revivals Performed', value: '2' },
        { label: 'Times Eliminated', value: '0' },
      ],
    },
    {
      title: 'Combat',
      stats: [
        { label: 'Longest Kill Streak', value: '11' },
        { label: 'Current Kill Streak', value: '6' },
        { label: 'Most Valuable Kill', value: 'FlameFrags' },
        { label: 'Deaths While On Last Heart', value: '0' },
      ],
    },
    {
      title: 'Objectives',
      stats: [
        { label: 'Dragon Egg Hold Time', value: '0h 00m' },
        { label: 'Dragon Egg Pickups', value: '0' },
        { label: 'Mace One Kills', value: '12' },
        { label: 'Mace Two Kills', value: '0' },
        { label: 'Objective Captures', value: '3' },
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
    title: 'Opening War Night',
    date: 'June 14, 2026',
    time: '20:00 CEST',
    status: 'Upcoming',
    type: 'PvP Window',
    reward: 'Mace unlock pressure',
    objective: 'First coordinated combat window after grace.',
    summary: 'First coordinated PvP window after grace with objective pressure enabled.',
  },
  {
    title: 'Egg Hunt Sprint',
    date: 'June 21, 2026',
    time: '19:30 CEST',
    status: 'Upcoming',
    type: 'Objective Sprint',
    reward: 'Dragon Egg Champion badge',
    objective: 'Move, defend, or steal the Dragon Egg during a short public window.',
    summary: 'Short event around dragon egg movement, recovery, and public tracking.',
  },
  {
    title: 'Bounty Board',
    date: 'June 28, 2026',
    time: '20:00 CEST',
    status: 'Upcoming',
    type: 'Bounty Event',
    reward: '3 Heart bounty pool',
    objective: 'Highest-value target becomes public for one timed hunt.',
    summary: 'A staff-selected bounty target creates a short, focused hunt across the world.',
  },
  {
    title: 'Nether Supply Run',
    date: 'July 5, 2026',
    time: '19:00 CEST',
    status: 'Upcoming',
    type: 'Resource Race',
    reward: 'Supply drop priority',
    objective: 'Timed Nether route with public checkpoints and limited PvP pressure.',
    summary: 'A resource-focused event built around controlled Nether movement and checkpoint pressure.',
  },
  {
    title: 'Final Stand Trial',
    date: 'July 12, 2026',
    time: '20:30 CEST',
    status: 'Upcoming',
    type: 'Arena Trial',
    reward: 'Event Winner status',
    objective: 'Small bracket combat night for players willing to risk hearts.',
    summary: 'A compact arena-style trial with heart pressure and a visible winner badge.',
  },
  {
    title: 'Preseason Stress Test',
    date: 'June 2, 2026',
    time: '18:00 CEST',
    status: 'Complete',
    type: 'Test Session',
    reward: 'Systems validated',
    objective: 'Validate combat tags, restrictions, Discord sync, and death flow.',
    summary: 'Validated grace, combat tags, death flow, item restrictions, and Discord sync.',
    result: 'Passed with minor tuning notes.',
  },
  {
    title: 'Whitelist Scrim',
    date: 'May 30, 2026',
    time: '19:00 CEST',
    status: 'Complete',
    type: 'Scrim',
    reward: 'No season rewards',
    objective: 'Check early-game pacing and rule clarity.',
    summary: 'Closed test for first-hour pacing, player onboarding, and basic server stability.',
    result: 'Grace pacing felt strong.',
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
      { title: 'External Services', body: 'The website and season flow may use Discord for community communication, Minecraft/Microsoft account information for player identity, and the Lifesteal Support Portal at lifesteal-support.shd-esports.com for applications, appeals, and staff review.' },
      { title: 'Contact', body: 'Preferred contact path: Lifesteal Support Portal at lifesteal-support.shd-esports.com. Before public launch, activate support@shd-esports.com for direct email contact.' },
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
      { title: 'Requests and Rights', body: 'Players may request access, correction, or deletion through the Lifesteal Support Portal at lifesteal-support.shd-esports.com. Before public launch, activate privacy@shd-esports.com for privacy requests and support@shd-esports.com for general support.' },
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
      { title: 'Applications and Appeals', body: 'Applications and punishment appeals may be handled through lifesteal-support.shd-esports.com. Submitting false, abusive, duplicated, or spam content may result in denied requests or further restrictions.' },
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
      { title: 'Contact', body: 'Preferred contact path: Lifesteal Support Portal at lifesteal-support.shd-esports.com. Before public launch, activate support@shd-esports.com for email contact.' },
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
        {page === 'landing' && <Landing onNavigate={navigate} />}
        {page === 'rules' && <RulesPage />}
        {page === 'players' && <PlayersPage />}
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

function Landing({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return (
    <section className="landing-page page-frame">
      <div className="landing-copy">
        <span className="chip">SHD LIFESTEAL</span>
        <h1>SHD LIFESTEAL</h1>
        <p className="season-line">Season 1</p>
        <div className="landing-live-card" aria-label="Current server population">
          <span>Online Now</span>
          <strong>18 / 50 Players</strong>
          <p>Mock live count for the future server widget.</p>
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
        </article>
      </div>
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

function PlayersPage() {
  const [query, setQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const eliminatedPlayers = players.filter(isEliminated).length
  const activePlayers = players.length - eliminatedPlayers
  const filteredPlayers = useMemo(() => {
    if (!normalizedQuery) {
      return players
    }

    return players.filter((player) => playerSearchText(player).includes(normalizedQuery))
  }, [normalizedQuery])

  useEffect(() => {
    if (!selectedPlayer) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPlayer(null)
      }
    }

    document.body.classList.add('modal-open')
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedPlayer])

  return (
    <section className="content-page page-frame">
      <div className={selectedPlayer ? 'players-content is-muted' : 'players-content'}>
        <PageIntro label="Players" title="Player List">
          Leaderboard-style roster view for every season player, objective holders, combat stats, and player profiles later.
        </PageIntro>
        <div className="objective-row player-objectives">
          <Objective title="Dragon Egg" owner="FlameFrags" detail="Last pickup at 21:48" />
          <Objective title="Mace One" owner="Wemmbu" detail="Kills with Mace: 12" />
          <Objective title="Mace Two" owner="Spoke" detail="Kills with Mace: 7" />
          <Objective title="20 Hearts" owner="2 Players" detail="Number of players who reached 20 hearts" />
        </div>
        <div className="objective-row player-highlights">
          <Objective title="Most Kills" owner="Wemmbu" detail="37 confirmed kills" />
          <Objective title="Highest Streak" owner="Ashswag" detail="Current kill streak: 8" />
          <Objective title="Most Playtime" owner="Wemmbu" detail="18h 42m active this season" />
          <Objective title="Bounty Target" owner="Mapicc" detail="Reward pool: 3 Hearts" />
        </div>
        <div className="leaderboard-tools">
          <div>
            <span>Leaderboard</span>
            <strong>{normalizedQuery ? `${filteredPlayers.length} Matching Players` : `${players.length} Total Players`}</strong>
            <div className="leaderboard-counts" aria-label="Season player counts">
              <span>{activePlayers} Active</span>
              <span>{eliminatedPlayers} Eliminated</span>
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
                  onClick={() => setSelectedPlayer(player)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedPlayer(player)
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
                  <td className="empty-row" colSpan={9}>No players found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedPlayer && <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </section>
  )
}

function HeartValue({ player }: { player: Player }) {
  return (
    <span className="hover-wrap heart-value" tabIndex={0}>
      <span>{player.hearts}</span>
      <span className="hover-card heart-card" role="tooltip">
        <strong>Heart Breakdown</strong>
        <span>Current Hearts: {player.hearts}</span>
        <span>Hearts Gained: {player.heartsGained}</span>
        <span>Hearts Lost: {player.heartsLost}</span>
      </span>
    </span>
  )
}

function MoveIndicator({ player }: { player: Player }) {
  const amount = Math.abs(player.previousRank - player.rank)
  const symbol = player.move === 'up' ? '▲' : player.move === 'down' ? '▼' : '-'
  const label = player.move === 'same' ? '-' : `${symbol} ${amount}`
  const title = player.move === 'same' ? 'No rank change in the last 24 hours' : `Moved ${player.move} ${amount} ${amount === 1 ? 'position' : 'positions'} in the last 24 hours`

  return (
    <span className="hover-wrap" tabIndex={0}>
      <span className={`move ${player.move}`}>{label}</span>
      <span className="hover-card move-card" role="tooltip">
        <strong>Position Change (24h)</strong>
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
    return <span className="muted-value">-</span>
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
  const featuredEvent = events.find((event) => event.status === 'Upcoming') ?? events[0]
  const upcomingEvents = events.filter((event) => event.status === 'Upcoming')
  const completedEvents = events.filter((event) => event.status === 'Complete')
  const eventVisibleItems = Math.max(1, Math.min(3, upcomingEvents.length, Math.max(1, completedEvents.length)))
  const eventPanelHeight = `${7.2 + eventVisibleItems * 8.35 + Math.max(0, eventVisibleItems - 1) * 0.8}rem`

  return (
    <section className="content-page page-frame">
      <PageIntro label="Events" title="Season Events">
        Event windows, objective races, bounty nights, and archived results for the current season.
      </PageIntro>
      <div className="events-dashboard">
        <article className="featured-event">
          <div>
            <span className="event-status upcoming">{featuredEvent.status}</span>
            <h2>{featuredEvent.title}</h2>
            <p>{featuredEvent.summary}</p>
          </div>
          <div className="featured-event-meta">
            <EventMeta label="Date" value={featuredEvent.date} />
            <EventMeta label="Time" value={featuredEvent.time} />
            <EventMeta label="Type" value={featuredEvent.type} />
            <EventMeta label="Reward" value={featuredEvent.reward} />
          </div>
        </article>
        <div className="event-stat-row">
          <EventMeta label="Next Event In" value="4d 08h" />
          <EventMeta label="Upcoming" value={String(upcomingEvents.length)} />
          <EventMeta label="Completed" value={String(completedEvents.length)} />
          <EventMeta label="Season Phase" value="Pre-End" />
        </div>
        <div className="event-board" style={{ '--event-panel-height': eventPanelHeight } as React.CSSProperties}>
          <section className="event-timeline">
            <span className="event-section-label">Upcoming Schedule</span>
            <div className="event-scroll-list">
              {upcomingEvents.map((event) => (
                <article className="timeline-event" key={event.title}>
                  <div className="timeline-marker" />
                  <div className="timeline-date">
                    <strong>{event.date}</strong>
                    <span>{event.time}</span>
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
          <section className="event-archive">
            <span className="event-section-label">Archive</span>
            <div className="event-scroll-list">
              {completedEvents.length > 0 ? (
                completedEvents.map((event) => (
                  <article className="archive-event" key={event.title}>
                    <div>
                      <span className="event-status">{event.status}</span>
                      <h3>{event.title}</h3>
                      <p>{event.summary}</p>
                    </div>
                    <strong>{event.result}</strong>
                  </article>
                ))
              ) : (
                <article className="archive-event empty-event">
                  <div>
                    <span className="event-status">Archive</span>
                    <h3>No Results Yet</h3>
                    <p>Completed events will appear here once Season 1 starts moving.</p>
                  </div>
                  <strong>Waiting for first event.</strong>
                </article>
              )}
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
          <p>Same border size as the Overworld for Season 1.</p>
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
            <li>Difficulty: Hard</li>
            <li>Version: 1.21.4</li>
            <li>View Distance: 10 chunks</li>
            <li>Simulation Distance: 8 chunks</li>
          </ul>
        </article>
        <article className="info-card">
          <span>Objectives</span>
          <h2>Egg + Maces</h2>
          <p>Public tracking shows holders and status. Coordinates stay hidden for competitive integrity.</p>
        </article>
        <article className="info-card">
          <span>Grace Period</span>
          <h2>60 Minutes</h2>
          <p>PvP, combat tags, lifesteal, heart loss, eliminations, and revivals stay disabled during grace.</p>
        </article>
      </div>
      <div className="world-event-strip">
        <span>End Opens / Event In</span>
        <strong>6d 14h 22m</strong>
        <p>Mock timer for the first End objective window.</p>
      </div>
    </section>
  )
}

function SignupPage() {
  return (
    <section className="content-page page-frame">
      <PageIntro label="Apply" title="Season 1 Applications">
        Public application hub for joining the Lifesteal season, receiving an Application ID, and opening a clean Discord review ticket.
      </PageIntro>
      <div className="apply-page">
        <article className="apply-hero">
          <div>
            <span className="apply-status">Applications Open</span>
            <h2>Apply for the whitelist</h2>
            <p>
              Applications will be handled through the SHD application portal. After submitting, you receive an Application ID
              that staff can use inside your Discord ticket.
            </p>
          </div>
          <div className="apply-portal-card">
            <span>Portal</span>
            <strong>lifesteal-support.shd-esports.com</strong>
            <p>Temporary Season 1 support portal for applications, appeals, and staff review.</p>
            <a className="primary-action" href="https://lifesteal-support.shd-esports.com">Open Support Portal</a>
          </div>
        </article>

        <div className="apply-flow" aria-label="Application review flow">
          <ApplyStep number="01" title="Read Rules" detail="Know the Lifesteal rules before applying." />
          <ApplyStep number="02" title="Submit Form" detail="Fill out the Season 1 application portal." />
          <ApplyStep number="03" title="Get ID" detail="Save your generated Application ID." />
          <ApplyStep number="04" title="Open Ticket" detail="Send the ID through the Discord ticket form." />
          <ApplyStep number="05" title="Staff Review" detail="Staff marks the application accepted, pending, waitlisted, or denied." />
        </div>

        <div className="apply-grid">
          <article className="apply-card">
            <span>Requirements</span>
            <h2>Before You Apply</h2>
            <ul>
              <li>Minecraft Java account ready</li>
              <li>Discord account available for tickets</li>
              <li>Rules read and accepted</li>
              <li>No alt account abuse</li>
              <li>Understand heart loss and elimination</li>
            </ul>
          </article>
          <article className="apply-card">
            <span>Review Outcomes</span>
            <h2>Application Status</h2>
            <div className="apply-outcomes">
              <strong>Accepted</strong>
              <strong>Pending Review</strong>
              <strong>Waitlisted</strong>
              <strong>Denied</strong>
            </div>
            <p>Use your Application ID when asking for updates. Do not DM staff about applications.</p>
          </article>
        </div>

        <aside className="application-id-preview">
          <div>
            <span>Example Application ID</span>
            <strong>LS-S1-A7K2</strong>
          </div>
          <p>After submitting the portal form, include this ID in your Discord ticket so staff can find your application fast.</p>
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
              Appeals are handled through the Lifesteal Support Portal. Submit your appeal, keep the generated Appeal ID,
              and use that ID if staff asks for extra context in Discord.
            </p>
          </div>
          <div className="apply-portal-card">
            <span>Support Portal</span>
            <strong>lifesteal-support.shd-esports.com</strong>
            <p>One portal for applications, ban appeals, and future Lifesteal support requests.</p>
            <a className="primary-action" href="https://lifesteal-support.shd-esports.com">Open Support Portal</a>
          </div>
        </article>

        <div className="apply-flow" aria-label="Appeal review flow">
          <ApplyStep number="01" title="Check Reason" detail="Read the punishment reason and any staff note first." />
          <ApplyStep number="02" title="Submit Appeal" detail="Explain what happened through the support portal." />
          <ApplyStep number="03" title="Add Evidence" detail="Attach clips, screenshots, or logs if they help the review." />
          <ApplyStep number="04" title="Keep ID" detail="Save the generated Appeal ID for staff follow-up." />
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
            <span>Example Appeal ID</span>
            <strong>LS-APPEAL-4M9Q</strong>
          </div>
          <p>Use this ID in Discord if staff requests follow-up. It lets moderators find the exact appeal without digging.</p>
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
      <p>© 2026 SHD Esports. Public Lifesteal season website. Current mock page: {current}.</p>
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
