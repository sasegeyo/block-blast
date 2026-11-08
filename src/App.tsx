import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BoosterType,
  GameMode,
  GridArchitecture,
  GridCell,
  MAX_BOOSTER_USES_PER_SESSION,
  StageObjective,
  ThemeSkinId,
  TrayPiece,
  applyBombBlastBooster,
  applyHammerBooster,
  createBoard,
  getBoosterCoinCost,
  getCampaignStageConfig,
  generateTrayPieces,
  hasAnyValidMove,
  placePieceOnBoard,
  rotateTrayPiece,
} from './game/rules';
import {
  CalendarDayEntry,
  INITIAL_STREAK_CHESTS,
  ShopBundle,
  StreakChestTier,
  THEME_SKINS,
  computeCalendarStreak,
  createInitialLeagueCohort,
  createInitialNovemberCalendar,
} from './game/metaState';
import { soundSynth } from './game/audioSynth';
import {
  BombIcon,
  CalendarIcon,
  CoinIcon,
  FlameStreakIcon,
  GemIcon,
  HammerIcon,
  MapIcon,
  MuteIcon,
  PauseIcon,
  RelicTitleEmblem,
  RerollIcon,
  RestartIcon,
  RotateIcon,
  ShopIcon,
  TrophyIcon,
} from './components/RelicIcons';
import { CanvasParticleBurst, RelicBoardCanvas, ShellState } from './components/RelicBoardCanvas';
import { ActiveMetaModal, MetaModals } from './components/MetaModals';

interface FrozenRunSummary {
  outcome: 'victory' | 'defeat';
  mode: GameMode;
  score: number;
  bestScore: number;
  linesClearedTotal: number;
  coinsEarnedRun: number;
  stageNumber: number;
  objectivesCompleted: number;
  objectivesTotal: number;
  doubledPayoutClaimed: boolean;
}

export default function App() {
  const initialShellState = useMemo<ShellState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  }, []);

  const [shellState, setShellState] = useState<ShellState>(initialShellState);
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [architecture, setArchitecture] = useState<GridArchitecture>('standard');

  // Board & Tray state
  const [board, setBoard] = useState<GridCell[][]>(() =>
    createBoard('standard', { initialFrozenCount: 3, initialBombCount: 1, seed: 2026 })
  );
  const [turnIndex, setTurnIndex] = useState<number>(1);
  const [tray, setTray] = useState<TrayPiece[]>(() => generateTrayPieces(2026, 'classic', 1));
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number>(0);

  // Run Metrics
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(1480);
  const [comboStreak, setComboStreak] = useState<number>(0);
  const [linesClearedRun, setLinesClearedRun] = useState<number>(0);
  const [movesRemaining, setMovesRemaining] = useState<number>(15);
  const [blitzSecondsLeft, setBlitzSecondsLeft] = useState<number>(90);
  const [objectives, setObjectives] = useState<StageObjective[]>([]);
  const [lastChanceUsed, setLastChanceUsed] = useState<boolean>(false);
  const [statusBannerText, setStatusBannerText] = useState<string>(
    'Drag or tap a piece [1-3] onto the carved sockets to clear lines!'
  );
  const [burstSignal, setBurstSignal] = useState<CanvasParticleBurst | null>(null);

  // Boosters & Anti-Pay-to-Win Session Safeguards
  const [boosterStock, setBoosterStock] = useState<Record<BoosterType, number>>({
    rotate: 2,
    hammer: 2,
    reroll: 2,
    bomb_blast: 1,
  });
  const [boosterUsesSession, setBoosterUsesSession] = useState<Record<BoosterType, number>>({
    rotate: 0,
    hammer: 0,
    reroll: 0,
    bomb_blast: 0,
  });
  const [activeTargetingBooster, setActiveTargetingBooster] = useState<
    'hammer' | 'bomb_blast' | null
  >(null);

  // Economy & Meta Progression
  const [coins, setCoins] = useState<number>(420);
  const [gems, setGems] = useState<number>(65);
  const [calendar, setCalendar] = useState<CalendarDayEntry[]>(() =>
    createInitialNovemberCalendar()
  );
  const [streakChests, setStreakChests] = useState<StreakChestTier[]>(() => INITIAL_STREAK_CHESTS);
  const [highestCampaignStage, setHighestCampaignStage] = useState<number>(6);
  const [currentCampaignStage, setCurrentCampaignStage] = useState<number>(1);
  const [weeklyLeagueBaseScore, setWeeklyLeagueBaseScore] = useState<number>(3850);
  const [unlockedSkins, setUnlockedSkins] = useState<ThemeSkinId[]>([
    'mystic_forest',
    'artisan_wood',
  ]);
  const [equippedSkin, setEquippedSkin] = useState<ThemeSkinId>('mystic_forest');
  const [claimedShopBundles, setClaimedShopBundles] = useState<string[]>([]);
  const [activeModal, setActiveModal] = useState<ActiveMetaModal>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [frozenSummary, setFrozenSummary] = useState<FrozenRunSummary | null>(null);

  const burstIdCounterRef = useRef<number>(1);

  useEffect(() => {
    document.body.dataset.state = shellState;
  }, [shellState]);

  const leagueCohort = useMemo(
    () => createInitialLeagueCohort(weeklyLeagueBaseScore + score),
    [weeklyLeagueBaseScore, score]
  );
  const playerLeagueRank = useMemo(() => {
    const idx = leagueCohort.findIndex((p) => p.isPlayer);
    return idx >= 0 ? idx + 1 : 4;
  }, [leagueCohort]);

  const { currentStreak } = useMemo(() => computeCalendarStreak(calendar), [calendar]);

  const startNewRun = useCallback(
    (
      targetMode: GameMode = gameMode,
      targetArch: GridArchitecture = architecture,
      stageNum: number = currentCampaignStage
    ) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setActiveModal(null);
      setActiveTargetingBooster(null);
      setFrozenSummary(null);
      setLastChanceUsed(false);
      setScore(0);
      setComboStreak(0);
      setLinesClearedRun(0);
      setTurnIndex(1);
      setBoosterUsesSession({
        rotate: 0,
        hammer: 0,
        reroll: 0,
        bomb_blast: 0,
      });

      let chosenArch = targetArch;
      let frozenInit = 3;
      let bombInit = 1;
      let moveLim = 16;
      let nextObjectives: StageObjective[] = [];

      if (targetMode === 'daily') {
        chosenArch = 'holed';
        frozenInit = 3;
        bombInit = 1;
        moveLim = 14;
        nextObjectives = [
          { type: 'clear_ruby', label: 'Clear Ruby Blocks', target: 12, current: 0 },
          { type: 'shatter_ice', label: 'Shatter Ice Blocks', target: 2, current: 0 },
        ];
        setStatusBannerText('Daily Puzzle (Nov 8): Clear 12 Ruby & 2 Ice Blocks within 14 Moves!');
      } else if (targetMode === 'campaign') {
        const cfg = getCampaignStageConfig(stageNum);
        chosenArch = cfg.architecture;
        frozenInit = cfg.initialFrozenCount;
        bombInit = cfg.initialBombCount;
        moveLim = cfg.moveLimit;
        nextObjectives = cfg.objectives.map((o) => ({ ...o, current: 0 }));
        setStatusBannerText(`${cfg.title} · ${cfg.architecture.toUpperCase()} Grid · ${moveLim} Moves`);
      } else if (targetMode === 'blitz') {
        frozenInit = 2;
        bombInit = 2;
        setBlitzSecondsLeft(90);
        setStatusBannerText('Time Attack Blitz: Clear lines & combos for +4s/+8s bonus time!');
      } else {
        setStatusBannerText(
          `Classic Endless (${chosenArch.replace('_', ' ')}) · Drag or tap pieces to clear lines!`
        );
      }

      setGameMode(targetMode);
      setArchitecture(chosenArch);
      setMovesRemaining(moveLim);
      setObjectives(nextObjectives);

      const newBoard = createBoard(chosenArch, {
        initialFrozenCount: frozenInit,
        initialBombCount: bombInit,
        seed: 2026 + stageNum * 37,
      });
      const newTray = generateTrayPieces(2026 + stageNum * 91, targetMode, 1);
      setBoard(newBoard);
      setTray(newTray);
      setSelectedPieceIndex(0);
      setShellState('playing');
      soundSynth.playSelect();
    },
    [architecture, currentCampaignStage, gameMode]
  );

  // Blitz Mode 1Hz Timer
  useEffect(() => {
    if (shellState !== 'playing' || gameMode !== 'blitz' || activeModal !== null) return;
    const timer = window.setInterval(() => {
      setBlitzSecondsLeft((prev) => {
        if (prev <= 1) {
          soundSynth.playGameOver();
          setFrozenSummary({
            outcome: 'defeat',
            mode: 'blitz',
            score,
            bestScore: Math.max(bestScore, score),
            linesClearedTotal: linesClearedRun,
            coinsEarnedRun: Math.max(15, Math.floor(score / 40)),
            stageNumber: currentCampaignStage,
            objectivesCompleted: 0,
            objectivesTotal: 0,
            doubledPayoutClaimed: false,
          });
          setShellState('gameover');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [
    activeModal,
    bestScore,
    currentCampaignStage,
    gameMode,
    linesClearedRun,
    score,
    shellState,
  ]);

  // Handle placing a piece onto the board
  const handlePlacePiece = useCallback(
    (pieceIndex: number, row: number, col: number) => {
      if (shellState !== 'playing') return;
      const piece = tray[pieceIndex];
      if (!piece || piece.used) return;

      const nextTurnNum = turnIndex + 1;
      const result = placePieceOnBoard(board, piece, row, col, {
        architecture,
        moveCountAfterPlacement: nextTurnNum,
        currentComboStreak: comboStreak,
      });

      if (!result.valid) return;

      // Audio & Haptic Feedback
      if (result.bombsDetonated > 0) {
        soundSynth.playBombDetonate();
      } else if (result.bombsDefused > 0) {
        soundSynth.playBombDefuse();
      } else if (result.iceShattered > 0) {
        soundSynth.playHammerSmash();
      } else if (result.linesCleared > 0) {
        soundSynth.playLineClear(result.linesCleared, result.comboCount);
      } else if (result.events.some((e) => e.type === 'frost_crack')) {
        soundSynth.playFrostCrack();
      } else {
        soundSynth.playPlace();
      }

      const placedCellsList = piece.matrix.flatMap((rArr, dr) =>
        rArr
          .map((val, dc) =>
            val === 1 ? { row: row + dr, col: col + dc, color: piece.color } : null
          )
          .filter((x): x is { row: number; col: number; color: typeof piece.color } => x !== null)
      );

      const burstCells =
        result.clearedCells.length > 0 ? result.clearedCells : placedCellsList;

      // Energetic Floating Combo Banners
      let secondaryBanner: string | undefined;
      if (result.linesCleared >= 3) {
        secondaryBanner = 'RELIC CASCADE!';
      } else if (result.linesCleared === 2) {
        secondaryBanner = 'MAGNIFICENT!';
      } else if (result.comboCount >= 2) {
        secondaryBanner = `COMBO x${result.comboCount}!`;
      } else if (result.wildcardsTriggered > 0) {
        secondaryBanner = 'PRISM SURGE!';
      }

      burstIdCounterRef.current += 1;
      setBurstSignal({
        id: burstIdCounterRef.current,
        cells: burstCells,
        placedCells: placedCellsList.map((c) => ({ row: c.row, col: c.col })),
        fullRows: result.fullRows,
        fullCols: result.fullCols,
        ringCenter:
          result.bombsDefused > 0 || result.bombsDetonated > 0 || result.wildcardsTriggered > 0
            ? { row, col }
            : undefined,
        intensity:
          result.linesCleared >= 2 || result.bombsDetonated > 0
            ? 'heavy'
            : result.linesCleared === 1 || result.wildcardsTriggered > 0
              ? 'medium'
              : 'light',
        calloutText: result.events[0]?.message,
        secondaryBannerText: secondaryBanner,
      });

      if (result.events.length > 0) {
        setStatusBannerText(result.events.map((e) => e.message).join(' · '));
      } else {
        setStatusBannerText(`Placed ${piece.name} (+${result.scoreDelta} pts)`);
      }

      const nextScore = score + result.scoreDelta;
      const nextBest = Math.max(bestScore, nextScore);
      const nextLines = linesClearedRun + result.linesCleared;
      const nextCoins = coins + result.coinsEarned;

      setBoard(result.board);
      setScore(nextScore);
      setBestScore(nextBest);
      setComboStreak(result.comboCount);
      setLinesClearedRun(nextLines);
      setCoins(nextCoins);
      setTurnIndex(nextTurnNum);

      if (gameMode === 'blitz' && result.timeBonusSec > 0) {
        setBlitzSecondsLeft((prev) => prev + result.timeBonusSec);
      }

      let updatedTray = tray.map((p, idx) => (idx === pieceIndex ? { ...p, used: true } : p));
      if (updatedTray.every((p) => p.used)) {
        updatedTray = generateTrayPieces(2026 + nextTurnNum * 131, gameMode, nextTurnNum);
      }
      setTray(updatedTray);

      const nextAvailableIdx = updatedTray.findIndex((p) => !p.used);
      if (nextAvailableIdx >= 0) {
        setSelectedPieceIndex(nextAvailableIdx);
      }

      let updatedObjectives = objectives;
      if (gameMode === 'daily' || gameMode === 'campaign') {
        updatedObjectives = objectives.map((obj) => {
          if (obj.type === 'score') {
            return { ...obj, current: Math.min(obj.target, nextScore) };
          }
          if (obj.type === 'clear_ruby') {
            return { ...obj, current: Math.min(obj.target, obj.current + result.rubyCleared) };
          }
          if (obj.type === 'shatter_ice') {
            return { ...obj, current: Math.min(obj.target, obj.current + result.iceShattered) };
          }
          if (obj.type === 'defuse_bomb') {
            return { ...obj, current: Math.min(obj.target, obj.current + result.bombsDefused) };
          }
          if (obj.type === 'clear_lines') {
            return { ...obj, current: Math.min(obj.target, obj.current + result.linesCleared) };
          }
          return obj;
        });
        setObjectives(updatedObjectives);
      }

      const nextMovesLeft =
        gameMode === 'daily' || gameMode === 'campaign' ? movesRemaining - 1 : movesRemaining;
      if (gameMode === 'daily' || gameMode === 'campaign') {
        setMovesRemaining(nextMovesLeft);
      }

      const allObjectivesComplete =
        updatedObjectives.length > 0 &&
        updatedObjectives.every((o) => o.current >= o.target);

      if (allObjectivesComplete) {
        soundSynth.playVictory();
        const rewardBonus = gameMode === 'daily' ? 150 : 60 + currentCampaignStage * 5;
        setCoins((c) => c + rewardBonus);
        setWeeklyLeagueBaseScore((s) => s + nextScore);

        if (gameMode === 'daily') {
          setCalendar((prev) =>
            prev.map((d) => (d.day === 8 ? { ...d, status: 'completed' } : d))
          );
          setBoosterStock((prev) => ({ ...prev, hammer: prev.hammer + 1 }));
        } else if (gameMode === 'campaign') {
          setHighestCampaignStage((h) => Math.max(h, Math.min(500, currentCampaignStage + 1)));
        }

        setFrozenSummary({
          outcome: 'victory',
          mode: gameMode,
          score: nextScore,
          bestScore: nextBest,
          linesClearedTotal: nextLines,
          coinsEarnedRun: rewardBonus + result.coinsEarned,
          stageNumber: currentCampaignStage,
          objectivesCompleted: updatedObjectives.length,
          objectivesTotal: updatedObjectives.length,
          doubledPayoutClaimed: false,
        });
        setShellState('gameover');
        return;
      }

      const noMovesLeft =
        (gameMode === 'daily' || gameMode === 'campaign') && nextMovesLeft <= 0;
      const boardBlocked = !hasAnyValidMove(result.board, updatedTray);

      if (noMovesLeft || boardBlocked) {
        soundSynth.playGameOver();
        const completedCount = updatedObjectives.filter((o) => o.current >= o.target).length;
        setFrozenSummary({
          outcome: 'defeat',
          mode: gameMode,
          score: nextScore,
          bestScore: nextBest,
          linesClearedTotal: nextLines,
          coinsEarnedRun: Math.max(10, Math.floor(nextScore / 45)),
          stageNumber: currentCampaignStage,
          objectivesCompleted: completedCount,
          objectivesTotal: updatedObjectives.length,
          doubledPayoutClaimed: false,
        });
        setShellState('gameover');
      }
    },
    [
      architecture,
      bestScore,
      board,
      coins,
      comboStreak,
      currentCampaignStage,
      gameMode,
      linesClearedRun,
      movesRemaining,
      objectives,
      score,
      shellState,
      tray,
      turnIndex,
    ]
  );

  // Consume booster helper
  const tryConsumeBooster = useCallback(
    (type: BoosterType): boolean => {
      const usedThisSession = boosterUsesSession[type];
      if (usedThisSession >= MAX_BOOSTER_USES_PER_SESSION) {
        setStatusBannerText(
          `Anti-Pay-to-Win Cap: ${type.toUpperCase()} used ${MAX_BOOSTER_USES_PER_SESSION}/3 times this session!`
        );
        return false;
      }

      const currentStock = boosterStock[type];
      if (currentStock > 0) {
        setBoosterStock((prev) => ({ ...prev, [type]: prev[type] - 1 }));
        setBoosterUsesSession((prev) => ({ ...prev, [type]: prev[type] + 1 }));
        return true;
      }

      const coinCost = getBoosterCoinCost(type, usedThisSession);
      if (coinCost !== null && coins >= coinCost) {
        setCoins((c) => c - coinCost);
        setBoosterUsesSession((prev) => ({ ...prev, [type]: prev[type] + 1 }));
        return true;
      }

      setStatusBannerText(
        `Need ${coinCost ?? 999} Coins or stock to deploy ${type.toUpperCase()}!`
      );
      return false;
    },
    [boosterStock, boosterUsesSession, coins]
  );

  // Rotate Booster [R]
  const handleRotatePiece = useCallback(
    (pieceIdx: number = selectedPieceIndex) => {
      if (shellState !== 'playing') return;
      const target = tray[pieceIdx];
      if (!target || target.used) return;
      if (!tryConsumeBooster('rotate')) return;

      soundSynth.playBooster();
      setTray((prev) =>
        prev.map((p, idx) => (idx === pieceIdx ? rotateTrayPiece(p) : p))
      );
      setStatusBannerText(`Rotated ${target.name} 90° clockwise!`);
    },
    [selectedPieceIndex, shellState, tray, tryConsumeBooster]
  );

  // Reroll / Shape Refresh Booster [F]
  const handleRerollTray = useCallback(() => {
    if (shellState !== 'playing') return;
    if (!tryConsumeBooster('reroll')) return;

    soundSynth.playBooster();
    const nextTurn = turnIndex + 1;
    setTurnIndex(nextTurn);
    const fresh = generateTrayPieces(2026 + nextTurn * 313, gameMode, nextTurn);
    setTray(fresh);
    setSelectedPieceIndex(0);
    setStatusBannerText('Rerolled 3 fresh Relic Shapes!');
  }, [gameMode, shellState, tryConsumeBooster, turnIndex]);

  // Activate Targetable Booster Mode (Hammer [H] or Bomb Blast [B])
  const handleActivateBoosterMode = useCallback(
    (booster: BoosterType) => {
      if (shellState !== 'playing') return;
      if (booster === 'rotate') {
        handleRotatePiece(selectedPieceIndex);
        return;
      }
      if (booster === 'reroll') {
        handleRerollTray();
        return;
      }
      if (booster === 'hammer' || booster === 'bomb_blast') {
        if (boosterUsesSession[booster] >= MAX_BOOSTER_USES_PER_SESSION) {
          setStatusBannerText(
            `Anti-Pay-to-Win Cap: ${booster.toUpperCase()} maxed at ${MAX_BOOSTER_USES_PER_SESSION}/3 this session!`
          );
          return;
        }
        setActiveTargetingBooster((prev) => (prev === booster ? null : booster));
        setStatusBannerText(
          booster === 'hammer'
            ? 'Hammer Armed: Tap any occupied block on the grid to shatter it!'
            : '3x3 Bomb Armed: Tap the grid to detonate a 3x3 sector!'
        );
      }
    },
    [boosterUsesSession, handleRerollTray, handleRotatePiece, selectedPieceIndex, shellState]
  );

  // Execute Targetable Booster on board cell (row, col)
  const handleUseTargetBooster = useCallback(
    (row: number, col: number) => {
      if (!activeTargetingBooster) return;
      if (activeTargetingBooster === 'hammer') {
        const res = applyHammerBooster(board, row, col);
        if (!res.success || !res.shatteredCell) {
          setStatusBannerText('Hammer requires an occupied Relic cell!');
          return;
        }
        if (!tryConsumeBooster('hammer')) {
          setActiveTargetingBooster(null);
          return;
        }
        soundSynth.playHammerSmash();
        setBoard(res.board);
        setActiveTargetingBooster(null);
        burstIdCounterRef.current += 1;
        setBurstSignal({
          id: burstIdCounterRef.current,
          cells: [{ row, col, color: res.shatteredCell.color }],
          ringCenter: { row, col },
          intensity: 'heavy',
          calloutText: 'HAMMER SMASH!',
        });
        setStatusBannerText('Hammer shattered obstacle at (' + (row + 1) + ', ' + (col + 1) + ')!');
      } else if (activeTargetingBooster === 'bomb_blast') {
        const res = applyBombBlastBooster(board, row, col);
        if (!res.success) {
          setStatusBannerText('Select a 3x3 sector containing at least 1 block!');
          return;
        }
        if (!tryConsumeBooster('bomb_blast')) {
          setActiveTargetingBooster(null);
          return;
        }
        soundSynth.playBombDefuse();
        setBoard(res.board);
        setActiveTargetingBooster(null);
        burstIdCounterRef.current += 1;
        setBurstSignal({
          id: burstIdCounterRef.current,
          cells: res.clearedCells,
          ringCenter: { row, col },
          intensity: 'heavy',
          calloutText: `3x3 BLAST (-${res.clearedCount} BLOCKS)`,
        });
        setStatusBannerText(`3x3 Bomb Blast cleared ${res.clearedCount} blocks!`);
      }
    },
    [activeTargetingBooster, board, tryConsumeBooster]
  );

  // F2P One-Time "Last Chance Continue" on Defeat
  const handleLastChanceContinue = useCallback(() => {
    if (lastChanceUsed) return;
    setLastChanceUsed(true);
    const res = applyBombBlastBooster(board, 3, 3);
    const res2 = applyBombBlastBooster(res.board, 4, 4);
    const nextTurn = turnIndex + 1;
    setBoard(res2.board);
    setTray(generateTrayPieces(2026 + nextTurn * 509, gameMode, nextTurn));
    setMovesRemaining((m) => Math.max(5, m + 5));
    setBlitzSecondsLeft((s) => Math.max(30, s + 30));
    setFrozenSummary(null);
    setShellState('playing');
    soundSynth.playBooster();
    setStatusBannerText('Last Chance Activated! Center 3x3 cleared & +5 Moves granted!');
  }, [board, gameMode, lastChanceUsed, turnIndex]);

  // Meta Handlers
  const handleClaimStreakChest = (chestId: string) => {
    const chest = streakChests.find((c) => c.id === chestId);
    if (!chest || chest.claimed) return;
    soundSynth.playVictory();
    setCoins((c) => c + chest.coins);
    if (chest.boosterType && chest.boosterCount) {
      const bType = chest.boosterType;
      const bCount = chest.boosterCount;
      setBoosterStock((prev) => ({ ...prev, [bType]: prev[bType] + bCount }));
    }
    if (chest.unlockSkin && !unlockedSkins.includes(chest.unlockSkin)) {
      setUnlockedSkins((prev) => [...prev, chest.unlockSkin!]);
      setEquippedSkin(chest.unlockSkin);
    }
    setStreakChests((prev) =>
      prev.map((c) => (c.id === chestId ? { ...c, claimed: true } : c))
    );
  };

  const handleRecoverMissedDay = (day: number, method: 'gems' | 'ad') => {
    if (method === 'gems') {
      if (gems < 15) {
        setStatusBannerText('Not enough Gems (15 required) — use Watch Ad for free save!');
        return;
      }
      setGems((g) => g - 15);
    }
    soundSynth.playVictory();
    setCalendar((prev) =>
      prev.map((entry) => (entry.day === day ? { ...entry, status: 'completed' } : entry))
    );
  };

  const handleBuyOrEquipSkin = (skinId: ThemeSkinId) => {
    if (unlockedSkins.includes(skinId)) {
      soundSynth.playSelect();
      setEquippedSkin(skinId);
      return;
    }
    const skin = THEME_SKINS[skinId];
    if (gems >= skin.costGems) {
      soundSynth.playVictory();
      setGems((g) => g - skin.costGems);
      setUnlockedSkins((prev) => [...prev, skinId]);
      setEquippedSkin(skinId);
    }
  };

  const handlePurchaseBundle = (bundle: ShopBundle) => {
    if (bundle.isRewardedAd) {
      if (claimedShopBundles.includes(bundle.id)) return;
      setClaimedShopBundles((prev) => [...prev, bundle.id]);
    } else if (bundle.costCoins) {
      if (coins < bundle.costCoins) return;
      setCoins((c) => c - bundle.costCoins!);
    } else if (bundle.costGems) {
      if (gems < bundle.costGems) return;
      setGems((g) => g - bundle.costGems!);
    }

    soundSynth.playVictory();
    if (bundle.rewards.coins) {
      setCoins((c) => c + bundle.rewards.coins!);
    }
    if (bundle.rewards.boosters) {
      setBoosterStock((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(bundle.rewards.boosters!)) {
          const key = k as BoosterType;
          next[key] = (next[key] || 0) + (v || 0);
        }
        return next;
      });
    }
  };

  const handleTogglePause = useCallback(() => {
    setShellState((prev) => {
      if (prev === 'playing') return 'paused';
      if (prev === 'paused') return 'playing';
      return prev;
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    soundSynth.isMuted = !soundSynth.isMuted;
    setIsMuted(soundSynth.isMuted);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* 1. Isolated 60fps Canvas World & Board Viewport */}
      <RelicBoardCanvas
        shellState={shellState}
        board={board}
        architecture={architecture}
        tray={tray}
        selectedPieceIndex={selectedPieceIndex}
        activeTargetingBooster={activeTargetingBooster}
        themeId={equippedSkin}
        burstSignal={burstSignal}
        onSelectPiece={(idx) => setSelectedPieceIndex(idx)}
        onPlacePiece={handlePlacePiece}
        onUseTargetBooster={handleUseTargetBooster}
        onRotatePiece={handleRotatePiece}
        onRerollTray={handleRerollTray}
        onActivateBoosterMode={handleActivateBoosterMode}
        onStartGame={() => startNewRun(gameMode, architecture, currentCampaignStage)}
        onTogglePause={handleTogglePause}
        onToggleMute={handleToggleMute}
      />

      {/* 2. TITLE SCREEN STAGE */}
      {shellState === 'title' && (
        <section
          aria-label="Title Screen"
          className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-12"
        >
          <div className="max-w-xl w-full my-auto pointer-events-auto space-y-6 bg-[#07130F]/94 p-6 md:p-8 rounded-2xl border-2 border-[#D99B26]/75 shadow-2xl">
            <RelicTitleEmblem className="w-full max-w-md" />

            <p className="text-sm text-emerald-100/85 leading-relaxed">
              Master carved runic grids with multi-layer Frozen Relics, pulsating Bomb fuses, and
              prismatic Wildcard surges. Climb your 30-player Weekly League cohort and complete
              November&apos;s 30-piece Mystic Forest mosaic.
            </p>

            {/* Game Mode Selection Tabs */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                Select Game Mode
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'classic', label: 'Classic Endless' },
                    { id: 'daily', label: 'Daily Puzzle' },
                    { id: 'blitz', label: 'Time Blitz' },
                    { id: 'campaign', label: '500 Campaigns' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setGameMode(m.id)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                      gameMode === m.id
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                        : 'bg-[#0E241C] text-emerald-100 border-[#1D4033] hover:border-amber-400/50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Variable Grid Architecture Selector */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                Grid Architecture
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'standard', label: 'Standard 8x8' },
                    { id: 'holed', label: 'Holed 2x2' },
                    { id: 'shifting', label: 'Shifting Rows' },
                    { id: 'l_shaped', label: 'L-Shaped' },
                  ] as const
                ).map((arch) => (
                  <button
                    key={arch.id}
                    type="button"
                    onClick={() => setArchitecture(arch.id)}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                      architecture === arch.id
                        ? 'bg-emerald-700 text-white border-emerald-300 font-bold'
                        : 'bg-[#0B1C16] text-emerald-200/75 border-[#1D4033] hover:text-white'
                    }`}
                  >
                    {arch.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Start CTA + Meta Quick Links */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                data-start="true"
                onClick={() => startNewRun(gameMode, architecture, currentCampaignStage)}
                className="flex-1 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-base tracking-wider shadow-lg transition-transform active:scale-98 cursor-pointer whitespace-nowrap"
              >
                Start Odyssey
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('daily')}
                className="py-3.5 px-4 rounded-xl bg-[#122A21] hover:bg-[#193A2E] border border-amber-400/50 text-amber-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Daily Streak ({currentStreak}d)
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('league')}
                className="py-3.5 px-4 rounded-xl bg-[#122A21] hover:bg-[#193A2E] border border-emerald-400/40 text-emerald-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                League (#{playerLeagueRank})
              </button>
            </div>
          </div>

          <div className="text-xs text-emerald-200/80 font-mono-tabular tracking-wide">
            1-3 Select Piece · Drag or WASD/Arrows Place · Space Confirm · R Rotate · H Hammer · F Reroll · Esc Pause
          </div>
        </section>
      )}

      {/* 3. MOBILE-FIRST VERTICALLY STACKED GAMEPLAY SHELL (Top HUD -> Board/Tray -> Bottom Booster Bar) */}
      {shellState !== 'title' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between items-center px-2.5 py-2 sm:py-3">
          {/* STREAMLINED TOP HUD (Centered Mobile Container) */}
          <header className="w-full max-w-[460px] pointer-events-auto flex flex-col gap-1.5 bg-[#07140F]/95 px-2.5 sm:px-3.5 py-2 rounded-2xl border border-[#D99B26]/55 shadow-xl">
            {/* Top Sub-Row: Currencies, Sanctuary Hub Triggers & Settings/Pause Controls */}
            <div className="flex items-center justify-between gap-1 border-b border-[#18382C] pb-1.5">
              {/* Compact Currency & Streak Readout */}
              <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-mono-tabular shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveModal('shop')}
                  className="flex items-center gap-0.5 text-amber-300 font-bold hover:text-amber-200 cursor-pointer"
                  title="Soft Currency (Coins) · Open Relic Shop"
                >
                  <CoinIcon className="w-3.5 h-3.5 shrink-0" />
                  <span data-testid="hud-coins">{Math.round(coins)}</span>
                </button>
                <span className="text-emerald-700" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setActiveModal('shop')}
                  className="flex items-center gap-0.5 text-purple-300 font-bold hover:text-purple-200 cursor-pointer"
                  title="Hard Currency (Gems)"
                >
                  <GemIcon className="w-3.5 h-3.5 shrink-0" />
                  <span data-testid="hud-gems">{Math.round(gems)}</span>
                </button>
                <span className="text-emerald-700" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setActiveModal('daily')}
                  className="flex items-center gap-0.5 text-orange-300 font-bold hover:text-orange-200 cursor-pointer"
                  title="Daily Login Streak & Mosaic"
                >
                  <FlameStreakIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{currentStreak}d</span>
                </button>
              </div>

              {/* Compact Meta Hub Pills (Daily, Campaign, League, Shop) */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveModal('daily')}
                  aria-label={`Daily Mosaic ${currentStreak}d Streak`}
                  className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md bg-[#0D231B] hover:bg-[#153529] border border-[#1E4435] text-[10px] sm:text-[11px] font-semibold text-emerald-100 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <CalendarIcon className="hidden sm:block w-3 h-3 shrink-0" />
                  <span>Daily</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('campaign')}
                  aria-label={`500 Campaigns Stage ${currentCampaignStage}`}
                  className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md bg-[#0D231B] hover:bg-[#153529] border border-[#1E4435] text-[10px] sm:text-[11px] font-semibold text-emerald-100 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <MapIcon className="hidden sm:block w-3 h-3 shrink-0" />
                  <span>Stg {currentCampaignStage}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('league')}
                  aria-label={`Weekly League Rank #${playerLeagueRank}`}
                  className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md bg-[#0D231B] hover:bg-[#153529] border border-[#1E4435] text-[10px] sm:text-[11px] font-semibold text-amber-200 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <TrophyIcon className="hidden sm:block w-3 h-3 shrink-0" />
                  <span>#{playerLeagueRank}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('shop')}
                  aria-label={`Relic Shop ${THEME_SKINS[equippedSkin].name}`}
                  className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md bg-[#0D231B] hover:bg-[#153529] border border-[#1E4435] text-[10px] sm:text-[11px] font-semibold text-amber-300 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <ShopIcon className="hidden sm:block w-3 h-3 shrink-0" />
                  <span>Shop</span>
                </button>
              </div>

              {/* Compact Utility Controls: Mute [M], Pause [P], Restart */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleToggleMute();
                  }}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-md bg-[#0D231B] hover:bg-[#16382B] border border-[#1E4435] cursor-pointer transition-colors"
                >
                  <MuteIcon muted={isMuted} className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Pause Game"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleTogglePause();
                  }}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-md bg-[#0D231B] hover:bg-[#16382B] border border-[#1E4435] cursor-pointer transition-colors"
                >
                  <PauseIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Restart Run"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    startNewRun(gameMode, architecture, currentCampaignStage);
                  }}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-md bg-[#0D231B] hover:bg-[#16382B] border border-[#1E4435] cursor-pointer transition-colors"
                >
                  <RestartIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom Sub-Row: Glowing Hero Score, High Score / Best, Combo & Mode Objective Indicator */}
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-amber-300/80">
                    SCORE
                  </div>
                  <div
                    data-testid="hud-score"
                    className="text-2xl sm:text-3xl font-extrabold text-amber-300 hud-numeral leading-none"
                  >
                    {Math.round(score)}
                  </div>
                </div>

                <div className="h-7 w-px bg-[#18382C]" />

                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-300/75">
                    BEST
                  </div>
                  <div className="text-base font-bold text-emerald-100 hud-numeral leading-none mt-0.5">
                    {Math.round(bestScore)}
                  </div>
                </div>

                {comboStreak > 0 && (
                  <>
                    <div className="h-7 w-px bg-[#18382C]" />
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-amber-200">
                        COMBO
                      </div>
                      <div className="text-base font-extrabold text-amber-400 hud-numeral leading-none mt-0.5">
                        {comboStreak}x
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Mode / Stage Objective Indicator */}
              <div className="text-right text-xs">
                <div className="font-bold text-amber-200 uppercase tracking-wide text-[11px]">
                  {gameMode === 'classic' && `Classic · ${architecture.replace('_', ' ')}`}
                  {gameMode === 'daily' && `Daily · ${movesRemaining} Moves Left`}
                  {gameMode === 'blitz' && `Blitz · ${Math.round(blitzSecondsLeft)}s`}
                  {gameMode === 'campaign' && `Stage ${currentCampaignStage} · ${movesRemaining}m`}
                </div>
                <div className="text-[11px] text-emerald-200/80 font-mono-tabular truncate max-w-[190px]">
                  {(gameMode === 'daily' || gameMode === 'campaign') && objectives.length > 0
                    ? objectives.map((o) => `${o.label.split(' ')[1] || o.label}: ${o.current}/${o.target}`).join(' · ')
                    : `${THEME_SKINS[equippedSkin].name} · ${linesClearedRun} Lines`}
                </div>
              </div>
            </div>
          </header>

          {/* DEDICATED BOTTOM BOOSTER BAR (Docked Horizontal Circular Action Buttons) */}
          <footer
            aria-label="Strategic Boosters Dock"
            className="w-full max-w-[460px] pointer-events-auto flex flex-col items-center gap-1.5 bg-[#07140F]/95 px-4 py-2 rounded-2xl border border-[#D99B26]/55 shadow-xl"
          >
            <div className="w-full flex items-center justify-around gap-2">
              {(
                [
                  {
                    type: 'rotate' as const,
                    label: 'Rotate',
                    keyHint: '[R]',
                    icon: <RotateIcon className="w-5 h-5" />,
                  },
                  {
                    type: 'hammer' as const,
                    label: 'Hammer',
                    keyHint: '[H]',
                    icon: <HammerIcon className="w-5 h-5" />,
                  },
                  {
                    type: 'reroll' as const,
                    label: 'Refresh',
                    keyHint: '[F]',
                    icon: <RerollIcon className="w-5 h-5" />,
                  },
                  {
                    type: 'bomb_blast' as const,
                    label: 'Bomb 3x3',
                    keyHint: '[B]',
                    icon: <BombIcon className="w-5 h-5" />,
                  },
                ]
              ).map((b) => {
                const uses = boosterUsesSession[b.type];
                const stock = boosterStock[b.type];
                const cost = getBoosterCoinCost(b.type, uses);
                const isArmed = activeTargetingBooster === b.type;
                const isMaxed = uses >= MAX_BOOSTER_USES_PER_SESSION;

                return (
                  <button
                    key={b.type}
                    type="button"
                    disabled={isMaxed}
                    onClick={() => handleActivateBoosterMode(b.type)}
                    className="group flex flex-col items-center gap-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <div
                      className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-105 group-active:scale-95 shadow-md ${
                        isArmed
                          ? 'bg-amber-500/30 border-amber-300 ring-2 ring-amber-400/50'
                          : isMaxed
                            ? 'bg-[#06100C] border-[#152E24]'
                            : 'bg-gradient-to-b from-[#133227] to-[#0A1D16] border-[#D99B26]/70 group-hover:border-amber-300'
                      }`}
                    >
                      {b.icon}

                      {/* Floating Stock or Compounding Coin Cost Badge */}
                      <span
                        className={`absolute -top-1 -right-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono-tabular font-extrabold border shadow ${
                          isMaxed
                            ? 'bg-red-950 text-red-300 border-red-400/50'
                            : stock > 0
                              ? 'bg-emerald-600 text-white border-emerald-200'
                              : 'bg-amber-500 text-slate-950 border-amber-200'
                        }`}
                      >
                        {isMaxed ? 'CAP' : stock > 0 ? `x${stock}` : `${cost}c`}
                      </span>
                    </div>

                    {/* Label + 3-Use Session Cap Dots */}
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] font-bold text-emerald-100 whitespace-nowrap">
                        {b.label} <span className="text-amber-300 font-mono-tabular">{b.keyHint}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1" title={`${uses}/3 used this session`}>
                      {[0, 1, 2].map((dotIdx) => (
                        <span
                          key={dotIdx}
                          className={`w-1.5 h-1.5 rounded-full ${
                            dotIdx < uses ? 'bg-amber-400' : 'bg-emerald-900'
                          }`}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Subtle Contextual Status Strip */}
            <div className="w-full text-center text-[11px] text-emerald-200/85 truncate border-t border-[#163328] pt-1">
              {statusBannerText}
            </div>
          </footer>
        </div>
      )}

      {/* 4. PAUSE MODAL (body[data-state="paused"]) */}
      {shellState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Game Paused"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75 pointer-events-auto"
        >
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0B1C16] border-2 border-[#D99B26] shadow-2xl text-center space-y-5">
            <h2 className="font-display text-2xl font-bold text-amber-300">Sanctuary Paused</h2>
            <p className="text-xs text-emerald-200/80">
              Take a breath, Relic Seeker. Your board state and combo streak are preserved.
            </p>

            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#07130F] border border-[#1D4033] font-mono-tabular">
              <div>
                <div className="text-[10px] text-emerald-300/70 uppercase">SCORE</div>
                <div className="text-lg font-bold text-amber-300">{Math.round(score)}</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-300/70 uppercase">LINES</div>
                <div className="text-lg font-bold text-white">{linesClearedRun}</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-300/70 uppercase">LEAGUE</div>
                <div className="text-lg font-bold text-emerald-300">#{playerLeagueRank}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShellState('playing')}
                className="w-full py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer transition-colors"
              >
                Resume Odyssey
              </button>
              <button
                type="button"
                onClick={() => startNewRun(gameMode, architecture, currentCampaignStage)}
                className="w-full py-2.5 px-5 rounded-xl bg-[#122A21] hover:bg-[#193A2E] border border-[#1D4033] text-emerald-100 font-semibold text-xs cursor-pointer transition-colors"
              >
                Restart Stage
              </button>
              <button
                type="button"
                onClick={() => setShellState('title')}
                className="w-full py-2.5 px-5 rounded-xl bg-[#07130F] hover:bg-[#0E241C] border border-[#1D4033] text-emerald-300/80 font-semibold text-xs cursor-pointer transition-colors"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. VICTORY / GAME OVER MODAL (body[data-state="gameover"]) */}
      {shellState === 'gameover' && frozenSummary && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={frozenSummary.outcome === 'victory' ? 'Stage Clear Victory' : 'Game Over'}
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/80 pointer-events-auto"
        >
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0B1C16] border-2 border-[#D99B26] shadow-2xl text-center space-y-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                {frozenSummary.outcome === 'victory' ? 'Sanctuary Cleared' : 'Board Locked'}
              </div>
              <h2 className="font-display text-2xl font-extrabold text-white mt-1">
                {frozenSummary.outcome === 'victory'
                  ? 'Relic Mastery Achieved!'
                  : 'No Valid Placements Left'}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-[#07130F] border border-[#1D4033] font-mono-tabular">
              <div>
                <div className="text-[10px] text-emerald-300/70 uppercase">SCORE / BEST</div>
                <div className="text-sm font-bold text-amber-300 mt-0.5">
                  {Math.round(frozenSummary.score)} / {Math.round(frozenSummary.bestScore)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-300/70 uppercase">LINES CLEARED</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {frozenSummary.linesClearedTotal}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-300/70 uppercase">COINS EARNED</div>
                <div className="text-sm font-bold text-emerald-300 mt-0.5">
                  +{frozenSummary.coinsEarnedRun}
                </div>
              </div>
            </div>

            {frozenSummary.outcome === 'victory' && !frozenSummary.doubledPayoutClaimed && (
              <button
                type="button"
                onClick={() => {
                  soundSynth.playVictory();
                  setCoins((c) => c + frozenSummary.coinsEarnedRun);
                  setFrozenSummary((prev) =>
                    prev
                      ? {
                          ...prev,
                          coinsEarnedRun: prev.coinsEarnedRun * 2,
                          doubledPayoutClaimed: true,
                        }
                      : null
                  );
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-300 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Watch Rewarded Ad · Double Payout (+{frozenSummary.coinsEarnedRun} Bonus Coins)
              </button>
            )}

            {frozenSummary.outcome === 'defeat' && !lastChanceUsed && (
              <button
                type="button"
                onClick={handleLastChanceContinue}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-300 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Last Chance Continue (Watch Ad · Clear 3x3 Center & Keep Playing)
              </button>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  const nextStage =
                    frozenSummary.outcome === 'victory' && gameMode === 'campaign'
                      ? Math.min(500, currentCampaignStage + 1)
                      : currentCampaignStage;
                  setCurrentCampaignStage(nextStage);
                  startNewRun(gameMode, architecture, nextStage);
                }}
                className="w-full py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer transition-colors"
              >
                {frozenSummary.outcome === 'victory' && gameMode === 'campaign'
                  ? `Next Stage (Stage ${Math.min(500, currentCampaignStage + 1)})`
                  : 'Play Again'}
              </button>
              <button
                type="button"
                onClick={() => setShellState('title')}
                className="w-full py-2.5 px-5 rounded-xl bg-[#07130F] hover:bg-[#0E241C] border border-[#1D4033] text-emerald-200/80 font-semibold text-xs cursor-pointer transition-colors"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. META-PROGRESSION MODALS */}
      <MetaModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        coins={coins}
        gems={gems}
        calendar={calendar}
        streakChests={streakChests}
        onClaimStreakChest={handleClaimStreakChest}
        onRecoverMissedDay={handleRecoverMissedDay}
        onStartDailyPuzzle={() => startNewRun('daily', 'holed', currentCampaignStage)}
        highestCampaignStage={highestCampaignStage}
        currentCampaignStage={currentCampaignStage}
        onSelectCampaignStage={(stageNumber) => {
          setCurrentCampaignStage(stageNumber);
          startNewRun('campaign', getCampaignStageConfig(stageNumber).architecture, stageNumber);
        }}
        leagueCohort={leagueCohort}
        unlockedSkins={unlockedSkins}
        equippedSkin={equippedSkin}
        onBuyOrEquipSkin={handleBuyOrEquipSkin}
        claimedShopBundles={claimedShopBundles}
        onPurchaseBundle={handlePurchaseBundle}
        boosterStock={boosterStock}
      />
    </main>
  );
}
