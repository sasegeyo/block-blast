import { BlockColor, BoosterType, ThemeSkinId } from './rules';

export interface BlockColorPalette {
  fill: string;
  topHighlight: string;
  bottomShadow: string;
  glow: string;
}

export interface ThemeSkinConfig {
  id: ThemeSkinId;
  name: string;
  subtitle: string;
  costGems: number;
  costCoins?: number;
  unlockRequirement?: string;
  canvasBgStart: string;
  canvasBgEnd: string;
  boardFrameFill: string;
  boardFrameStroke: string;
  cellEmptyFill: string;
  cellEmptyStroke: string;
  cellVoidFill: string;
  accentHex: string;
  blocks: Record<BlockColor, BlockColorPalette>;
}

export const THEME_SKINS: Record<ThemeSkinId, ThemeSkinConfig> = {
  mystic_forest: {
    id: 'mystic_forest',
    name: 'Mystic Forest',
    subtitle: 'Ancient emerald sanctum & gilded runestones',
    costGems: 0,
    canvasBgStart: '#07130F',
    canvasBgEnd: '#0E241C',
    boardFrameFill: '#0B1C16',
    boardFrameStroke: '#D99B26',
    cellEmptyFill: '#122A21',
    cellEmptyStroke: '#1D4033',
    cellVoidFill: '#060F0C',
    accentHex: '#D99B26',
    blocks: {
      ruby: {
        fill: '#DC2626',
        topHighlight: '#F87171',
        bottomShadow: '#7F1D1D',
        glow: 'rgba(220, 38, 38, 0.45)',
      },
      amber: {
        fill: '#D97706',
        topHighlight: '#FBBF24',
        bottomShadow: '#78350F',
        glow: 'rgba(245, 158, 11, 0.45)',
      },
      emerald: {
        fill: '#059669',
        topHighlight: '#34D399',
        bottomShadow: '#064E3B',
        glow: 'rgba(16, 185, 129, 0.45)',
      },
      sapphire: {
        fill: '#2563EB',
        topHighlight: '#60A5FA',
        bottomShadow: '#1E3A8A',
        glow: 'rgba(59, 130, 246, 0.45)',
      },
      amethyst: {
        fill: '#7C3AED',
        topHighlight: '#C084FC',
        bottomShadow: '#4C1D95',
        glow: 'rgba(139, 92, 246, 0.45)',
      },
    },
  },
  artisan_wood: {
    id: 'artisan_wood',
    name: 'Artisan Timber',
    subtitle: 'Carved mahogany table & warm cedar blocks',
    costGems: 40,
    costCoins: 350,
    canvasBgStart: '#1A110B',
    canvasBgEnd: '#2B1B12',
    boardFrameFill: '#23150E',
    boardFrameStroke: '#C28448',
    cellEmptyFill: '#322015',
    cellEmptyStroke: '#4A3020',
    cellVoidFill: '#120B07',
    accentHex: '#E09F5A',
    blocks: {
      ruby: {
        fill: '#B93829',
        topHighlight: '#E3695B',
        bottomShadow: '#6E1E14',
        glow: 'rgba(185, 56, 41, 0.4)',
      },
      amber: {
        fill: '#C87D28',
        topHighlight: '#F0AE59',
        bottomShadow: '#7A4912',
        glow: 'rgba(200, 125, 40, 0.4)',
      },
      emerald: {
        fill: '#3B7A57',
        topHighlight: '#68B088',
        bottomShadow: '#1E442F',
        glow: 'rgba(59, 122, 87, 0.4)',
      },
      sapphire: {
        fill: '#2C5E8A',
        topHighlight: '#5B93C4',
        bottomShadow: '#173552',
        glow: 'rgba(44, 94, 138, 0.4)',
      },
      amethyst: {
        fill: '#7A497B',
        topHighlight: '#AD78AE',
        bottomShadow: '#462647',
        glow: 'rgba(122, 73, 123, 0.4)',
      },
    },
  },
  crystal_prism: {
    id: 'crystal_prism',
    name: 'Crystal Quartz',
    subtitle: 'Obsidian cavern & faceted astral prisms',
    costGems: 65,
    costCoins: 550,
    canvasBgStart: '#090D1A',
    canvasBgEnd: '#131B33',
    boardFrameFill: '#0D1326',
    boardFrameStroke: '#60A5FA',
    cellEmptyFill: '#16203D',
    cellEmptyStroke: '#243461',
    cellVoidFill: '#060913',
    accentHex: '#60A5FA',
    blocks: {
      ruby: {
        fill: '#E11D48',
        topHighlight: '#FB7185',
        bottomShadow: '#881337',
        glow: 'rgba(225, 29, 72, 0.5)',
      },
      amber: {
        fill: '#EA580C',
        topHighlight: '#FB923C',
        bottomShadow: '#7C2D12',
        glow: 'rgba(234, 88, 12, 0.5)',
      },
      emerald: {
        fill: '#0D9488',
        topHighlight: '#2DD4BF',
        bottomShadow: '#115E59',
        glow: 'rgba(13, 148, 136, 0.5)',
      },
      sapphire: {
        fill: '#0284C7',
        topHighlight: '#38BDF8',
        bottomShadow: '#075985',
        glow: 'rgba(2, 132, 199, 0.5)',
      },
      amethyst: {
        fill: '#9333EA',
        topHighlight: '#D8B4FE',
        bottomShadow: '#581C87',
        glow: 'rgba(147, 51, 234, 0.5)',
      },
    },
  },
  autumn_leaf: {
    id: 'autumn_leaf',
    name: 'Autumn Leaf Set',
    subtitle: '14-Day Streak Exclusive harvest foliage & gold',
    costGems: 85,
    unlockRequirement: '14-Day Streak Chest or 85 Gems',
    canvasBgStart: '#180E0B',
    canvasBgEnd: '#2B1711',
    boardFrameFill: '#21110C',
    boardFrameStroke: '#F59E0B',
    cellEmptyFill: '#331B14',
    cellEmptyStroke: '#4D291F',
    cellVoidFill: '#120906',
    accentHex: '#F59E0B',
    blocks: {
      ruby: {
        fill: '#C2272D',
        topHighlight: '#F26469',
        bottomShadow: '#6E1115',
        glow: 'rgba(194, 39, 45, 0.45)',
      },
      amber: {
        fill: '#D97706',
        topHighlight: '#FCD34D',
        bottomShadow: '#78350F',
        glow: 'rgba(217, 119, 6, 0.45)',
      },
      emerald: {
        fill: '#4D7C0F',
        topHighlight: '#A3E635',
        bottomShadow: '#365314',
        glow: 'rgba(77, 124, 15, 0.45)',
      },
      sapphire: {
        fill: '#0369A1',
        topHighlight: '#38BDF8',
        bottomShadow: '#0C4A6E',
        glow: 'rgba(3, 105, 161, 0.45)',
      },
      amethyst: {
        fill: '#A21CAF',
        topHighlight: '#E879F9',
        bottomShadow: '#701A75',
        glow: 'rgba(162, 28, 175, 0.45)',
      },
    },
  },
  retro_pixel: {
    id: 'retro_pixel',
    name: 'Arcade 16-Bit',
    subtitle: 'Tactile cartridge blocks & crisp chiptune contrast',
    costGems: 50,
    costCoins: 450,
    canvasBgStart: '#11111B',
    canvasBgEnd: '#1E1E2E',
    boardFrameFill: '#181825',
    boardFrameStroke: '#F9E2AF',
    cellEmptyFill: '#252538',
    cellEmptyStroke: '#383854',
    cellVoidFill: '#0B0B12',
    accentHex: '#F9E2AF',
    blocks: {
      ruby: {
        fill: '#F38BA8',
        topHighlight: '#F5C2E7',
        bottomShadow: '#A6425E',
        glow: 'rgba(243, 139, 168, 0.45)',
      },
      amber: {
        fill: '#FAB387',
        topHighlight: '#F9E2AF',
        bottomShadow: '#B36B3F',
        glow: 'rgba(250, 179, 135, 0.45)',
      },
      emerald: {
        fill: '#A6E3A1',
        topHighlight: '#D2F7CE',
        bottomShadow: '#589453',
        glow: 'rgba(166, 227, 161, 0.45)',
      },
      sapphire: {
        fill: '#89B4FA',
        topHighlight: '#B4BEFE',
        bottomShadow: '#426DB3',
        glow: 'rgba(137, 180, 250, 0.45)',
      },
      amethyst: {
        fill: '#CBA6F7',
        topHighlight: '#E6D2FC',
        bottomShadow: '#7952A8',
        glow: 'rgba(203, 166, 247, 0.45)',
      },
    },
  },
};

export interface CalendarDayEntry {
  day: number; // 1..30 (November 2026)
  status: 'completed' | 'missed' | 'today' | 'upcoming';
  mosaicPieceTitle: string;
}

export interface StreakChestTier {
  id: string;
  daysRequired: number;
  title: string;
  rewardSummary: string;
  coins: number;
  boosterType?: BoosterType;
  boosterCount?: number;
  unlockSkin?: ThemeSkinId;
  claimed: boolean;
}

export interface LeagueParticipant {
  id: string;
  name: string;
  badge: string;
  score: number;
  isPlayer?: boolean;
  trend: 'up' | 'down' | 'steady';
}

export interface ShopBundle {
  id: string;
  category: 'booster' | 'value' | 'daily_ad';
  title: string;
  subtitle: string;
  costCoins?: number;
  costGems?: number;
  isRewardedAd?: boolean;
  rewards: {
    coins?: number;
    gems?: number;
    boosters?: Partial<Record<BoosterType, number>>;
    adFreePassMinutes?: number;
  };
  claimedToday?: boolean;
}

export const NOVEMBER_MOSAIC_TITLES: string[] = [
  'Ancient Roots',
  'Moss Lantern',
  'Emerald Brook',
  'Stag Totem',
  'Gilded Fern',
  'Whispering Owl',
  'Runic Archway',
  'Moonlit Glade',
  'Amber Mushroom',
  'Crystal Spring',
  'Elder Willow',
  'Fox Spirit',
  'Starlight Altar',
  'Sunken Obelisk',
  'Golden Canopy',
  'Mist Waterfall',
  'Sapphire Lotus',
  'Carved Cairn',
  'Firefly Hollow',
  'Twilight Bridge',
  'Druid Sundial',
  'Silver Bramble',
  'Heartwood Spire',
  'Jade Dragonfly',
  'Sunbeam Clearing',
  'Quartz Monolith',
  'Wildflower Ring',
  'Guardian Statue',
  'Celestial Crown',
  'Heart of the Forest',
];

export function createInitialNovemberCalendar(): CalendarDayEntry[] {
  // Current date in metadata is Nov 8, 2026.
  // Days 1, 2, 3, 5, 6, 7 are completed; Day 4 was missed (perfect for Streak Saver demo!);
  // Day 8 is Today!
  const entries: CalendarDayEntry[] = [];
  for (let d = 1; d <= 30; d++) {
    let status: CalendarDayEntry['status'] = 'upcoming';
    if ([1, 2, 3, 5, 6, 7].includes(d)) {
      status = 'completed';
    } else if (d === 4) {
      status = 'missed';
    } else if (d === 8) {
      status = 'today';
    }
    entries.push({
      day: d,
      status,
      mosaicPieceTitle: NOVEMBER_MOSAIC_TITLES[d - 1],
    });
  }
  return entries;
}

/**
 * Calculates current consecutive streak ending at the latest completed day (Day 7 or 8)
 * and total completed days in November.
 */
export function computeCalendarStreak(calendar: CalendarDayEntry[]): {
  currentStreak: number;
  completedDaysCount: number;
  missedDaysCount: number;
} {
  const completedDaysCount = calendar.filter((d) => d.status === 'completed').length;
  const missedDaysCount = calendar.filter((d) => d.status === 'missed').length;

  // Count consecutive completed days backwards from Day 8 (if completed) or Day 7
  const anchorDay = calendar[7]?.status === 'completed' ? 8 : 7;
  let streak = 0;
  for (let d = anchorDay; d >= 1; d--) {
    if (calendar[d - 1].status === 'completed') {
      streak++;
    } else {
      break;
    }
  }
  return { currentStreak: streak, completedDaysCount, missedDaysCount };
}

export const INITIAL_STREAK_CHESTS: StreakChestTier[] = [
  {
    id: 'chest-3d',
    daysRequired: 3,
    title: '3-Day Small Chest',
    rewardSummary: '50 Coins + 1x Hammer Booster',
    coins: 50,
    boosterType: 'hammer',
    boosterCount: 1,
    claimed: false,
  },
  {
    id: 'chest-7d',
    daysRequired: 7,
    title: '7-Day Medium Chest',
    rewardSummary: '150 Coins + 30-Min Ad-Free Unlimited Pass',
    coins: 150,
    boosterType: 'reroll',
    boosterCount: 2,
    claimed: false,
  },
  {
    id: 'chest-14d',
    daysRequired: 14,
    title: '14-Day Large Chest',
    rewardSummary: 'Exclusive Profile Frame + Autumn Leaf Block Skin',
    coins: 300,
    unlockSkin: 'autumn_leaf',
    claimed: false,
  },
  {
    id: 'chest-30d',
    daysRequired: 30,
    title: 'Monthly Grand Reliquary (100%)',
    rewardSummary: 'Legendary Mystic Forest Collector Badge + 1,000 Coins',
    coins: 1000,
    boosterType: 'bomb_blast',
    boosterCount: 3,
    claimed: false,
  },
];

export function createInitialLeagueCohort(playerScore: number): LeagueParticipant[] {
  const rivals: Array<{ name: string; badge: string; baseScore: number; trend: 'up' | 'down' | 'steady' }> = [
    { name: 'Lyra Vance', badge: 'Grand Runesmith', baseScore: 4820, trend: 'up' },
    { name: 'Kaelen Thorne', badge: 'Frostbreaker', baseScore: 4390, trend: 'up' },
    { name: 'Sora Takahashi', badge: 'Mosaic Keeper', baseScore: 3960, trend: 'steady' },
    { name: 'Orin Ironwood', badge: 'Relic Warden', baseScore: 3420, trend: 'down' },
    { name: 'Mira Solis', badge: 'Combo Tactician', baseScore: 3290, trend: 'up' },
    { name: 'Vespera Noctis', badge: 'Quartz Sage', baseScore: 3150, trend: 'steady' },
    { name: 'Darian Crest', badge: 'Sunstone Seeker', baseScore: 2980, trend: 'down' },
    { name: 'Elena Rostova', badge: 'Canopy Ranger', baseScore: 2840, trend: 'up' },
    { name: 'Tarek Al-Mansoor', badge: 'Obelisk Architect', baseScore: 2710, trend: 'steady' },
    { name: 'Freya Lindqvist', badge: 'Glacier Sentinel', baseScore: 2590, trend: 'up' },
    { name: 'Mateo Silva', badge: 'Amber Alchemist', baseScore: 2460, trend: 'down' },
    { name: 'Nadia Chen', badge: 'Starlight Weaver', baseScore: 2350, trend: 'steady' },
    { name: 'Gideon Mercer', badge: 'Stonecarver', baseScore: 2240, trend: 'steady' },
    { name: 'Zara Okafor', badge: 'Wildcard Prodigy', baseScore: 2110, trend: 'up' },
    { name: 'Lukas Weber', badge: 'Timber Artisan', baseScore: 1990, trend: 'down' },
    { name: 'Chloe Dubois', badge: 'Emerald Druid', baseScore: 1875, trend: 'steady' },
    { name: 'Ronan Kelly', badge: 'Sanctum Guard', baseScore: 1760, trend: 'down' },
    { name: 'Hana Kim', badge: 'Prism Striker', baseScore: 1640, trend: 'up' },
    { name: 'Victor Vance', badge: 'Rune Apprentice', baseScore: 1530, trend: 'steady' },
    { name: 'Amara Patel', badge: 'Rootway Scout', baseScore: 1420, trend: 'down' },
    { name: 'Julian Sterling', badge: 'Moss Gatherer', baseScore: 1310, trend: 'steady' },
    { name: 'Astrid Holm', badge: 'Frost Initiate', baseScore: 1190, trend: 'down' },
    { name: 'Marcus Vance', badge: 'Pebble Shaper', baseScore: 1080, trend: 'down' },
    { name: 'Sienna Brooks', badge: 'Danger Zone', baseScore: 960, trend: 'down' },
    { name: 'Devon Price', badge: 'Danger Zone', baseScore: 870, trend: 'down' },
    { name: 'Kira Volkov', badge: 'Danger Zone', baseScore: 760, trend: 'down' },
    { name: 'Liam O-Connor', badge: 'Danger Zone', baseScore: 640, trend: 'down' },
    { name: 'Tessa Gray', badge: 'Danger Zone', baseScore: 510, trend: 'down' },
    { name: 'Bram Novak', badge: 'Danger Zone', baseScore: 390, trend: 'down' },
  ];

  const list: LeagueParticipant[] = rivals.map((r, idx) => ({
    id: `rival-${idx + 1}`,
    name: r.name,
    badge: r.badge,
    score: r.baseScore,
    trend: r.trend,
  }));

  list.push({
    id: 'player-you',
    name: 'You (Relic Seeker)',
    badge: '14-Day Streak Aspirant',
    score: playerScore,
    isPlayer: true,
    trend: 'up',
  });

  return list.sort((a, b) => b.score - a.score);
}

export const SHOP_BUNDLES: ShopBundle[] = [
  {
    id: 'daily-free-chest',
    category: 'daily_ad',
    title: 'Daily Sanctuary Chest',
    subtitle: 'Free F2P Daily Reward (Simulated 2s Rewarded Ad)',
    isRewardedAd: true,
    rewards: {
      coins: 120,
      boosters: { hammer: 1, rotate: 1 },
    },
    claimedToday: false,
  },
  {
    id: 'bundle-tactician',
    category: 'booster',
    title: 'Tactician 10-Booster Pack',
    subtitle: '5x Hammer + 5x Shape Refresh (20% Off)',
    costCoins: 240,
    rewards: {
      boosters: { hammer: 5, reroll: 5 },
    },
  },
  {
    id: 'bundle-demolition',
    category: 'booster',
    title: 'Demolition Relic Kit',
    subtitle: '3x 3x3 Bomb Blast + 4x Rotate',
    costCoins: 210,
    rewards: {
      boosters: { bomb_blast: 3, rotate: 4 },
    },
  },
  {
    id: 'bundle-starter-value',
    category: 'value',
    title: 'Relic Seeker Starter Pack',
    subtitle: '500 Coins + 3x Every Booster + Ad-Free Pass',
    costGems: 45,
    rewards: {
      coins: 500,
      boosters: { rotate: 3, hammer: 3, reroll: 3, bomb_blast: 3 },
      adFreePassMinutes: 60,
    },
  },
];
