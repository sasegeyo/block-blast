import React, { useEffect, useRef } from 'react';
import {
  BOARD_SIZE,
  BlockColor,
  BoosterType,
  GridArchitecture,
  GridCell,
  ThemeSkinId,
  TrayPiece,
  canPlacePiece,
  findBestValidPlacement,
} from '../game/rules';
import { THEME_SKINS } from '../game/metaState';
import { soundSynth } from '../game/audioSynth';

export type ShellState = 'title' | 'playing' | 'paused' | 'gameover';

export interface CanvasParticleBurst {
  id: number;
  cells: Array<{ row: number; col: number; color: BlockColor }>;
  intensity: 'light' | 'heavy';
  calloutText?: string;
}

interface RelicBoardCanvasProps {
  shellState: ShellState;
  board: GridCell[][];
  architecture: GridArchitecture;
  tray: TrayPiece[];
  selectedPieceIndex: number;
  activeTargetingBooster: 'hammer' | 'bomb_blast' | null;
  themeId: ThemeSkinId;
  burstSignal: CanvasParticleBurst | null;
  onSelectPiece: (index: number) => void;
  onPlacePiece: (pieceIndex: number, row: number, col: number) => void;
  onUseTargetBooster: (row: number, col: number) => void;
  onRotatePiece: (pieceIndex: number) => void;
  onRerollTray: () => void;
  onActivateBoosterMode: (booster: BoosterType) => void;
  onStartGame: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
}

interface PooledFloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 180;
const MAX_FLOATING_TEXTS = 16;

export const RelicBoardCanvas: React.FC<RelicBoardCanvasProps> = (props) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef<RelicBoardCanvasProps>(props);
  propsRef.current = props;

  const lastBurstIdRef = useRef<number>(0);
  const requestRedrawRef = useRef<() => void>(() => {});

  // Trigger immediate canvas redraw whenever React props update
  useEffect(() => {
    requestRedrawRef.current();
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'block w-full h-full cursor-pointer touch-none';
    canvas.setAttribute('data-testid', 'relic-game-canvas');
    canvas.setAttribute('aria-label', 'RelicGrid Puzzle Board Canvas');
    canvas.tabIndex = 0;
    container.innerHTML = '';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Viewport & Layout Geometry Cache
    let width = container.clientWidth || window.innerWidth || 1440;
    let height = container.clientHeight || window.innerHeight || 900;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const updateCanvasSize = () => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      width = Math.max(320, rect.width || window.innerWidth);
      height = Math.max(480, rect.height || window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    updateCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
      requestRedrawRef.current();
    });
    resizeObserver.observe(container);

    // Zero-GC Pooled Particle Ring Buffer
    const particles: PooledParticle[] = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 4,
      alpha: 1,
      life: 0,
      maxLife: 1,
      color: '#FBBF24',
    }));
    let particleHead = 0;

    const spawnParticle = (
      x: number,
      y: number,
      vx: number,
      vy: number,
      size: number,
      maxLife: number,
      color: string
    ) => {
      const p = particles[particleHead];
      particleHead = (particleHead + 1) % MAX_PARTICLES;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.size = size;
      p.alpha = 1;
      p.life = 0;
      p.maxLife = maxLife;
      p.color = color;
    };

    // Zero-GC Pooled Floating Text Ring Buffer
    const floatingTexts: PooledFloatingText[] = Array.from({ length: MAX_FLOATING_TEXTS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -45,
      text: '',
      color: '#FDE68A',
      life: 0,
      maxLife: 1.1,
    }));
    let textHead = 0;

    const spawnFloatingText = (x: number, y: number, text: string, color: string) => {
      const ft = floatingTexts[textHead];
      textHead = (textHead + 1) % MAX_FLOATING_TEXTS;
      ft.active = true;
      ft.x = x;
      ft.y = y;
      ft.vy = -52;
      ft.text = text;
      ft.color = color;
      ft.life = 0;
      ft.maxLife = 1.15;
    };

    // Ambient Fireflies / Embers (Fixed array, zero GC)
    const embers = Array.from({ length: 36 }, (_, i) => ({
      x: ((i * 197) % 100) / 100,
      y: ((i * 313) % 100) / 100,
      speedY: 0.012 + (i % 5) * 0.004,
      driftX: 0.008 + (i % 3) * 0.004,
      phase: i * 0.7,
      radius: 1.5 + (i % 3) * 1.1,
    }));

    // Simulation state
    let simTime = 0;
    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let boardSquash = 0; // subtle spring impulse on placement
    let pointerX = width * 0.65;
    let pointerY = height * 0.5;
    let isDragging = false;
    let cursorRow = 3;
    let cursorCol = 3;
    let hoverRow = -1;
    let hoverCol = -1;

    // Unified Input Hub (held vs edge-triggered justPressed)
    const heldKeys = new Set<string>();
    const justPressedKeys = new Set<string>();

    const clearInputs = () => {
      heldKeys.clear();
      justPressedKeys.clear();
      isDragging = false;
    };

    // Layout computation helper
    const computeLayout = () => {
      const isTitle = propsRef.current.shellState === 'title';
      const minDim = Math.min(width, height);
      const cellSize = isTitle
        ? Math.max(28, Math.min(48, Math.floor(minDim * 0.052)))
        : Math.max(30, Math.min(50, Math.floor((height - 230) / (BOARD_SIZE + 2.6))));
      const boardPx = cellSize * BOARD_SIZE;

      // On Title Screen, stage the showcase board in the right 62% of viewport so left 38% is negative space
      const boardCenterX = isTitle
        ? width >= 900
          ? width * 0.68
          : width * 0.5
        : width * 0.5;
      const boardCenterY = isTitle
        ? width >= 900
          ? height * 0.5
          : height * 0.64
        : Math.max(84 + boardPx / 2, height * 0.41);

      const boardLeft = Math.round(boardCenterX - boardPx / 2);
      const boardTop = Math.round(boardCenterY - boardPx / 2);

      // Tray dock below the board
      const trayTop = boardTop + boardPx + Math.max(16, Math.floor(cellSize * 0.42));
      const traySlotWidth = Math.max(96, Math.floor(boardPx / 3));
      const trayHeight = Math.max(80, Math.floor(cellSize * 2.05));

      return {
        cellSize,
        boardPx,
        boardLeft,
        boardTop,
        boardCenterX,
        boardCenterY,
        trayTop,
        traySlotWidth,
        trayHeight,
      };
    };

    const screenToCanvas = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const updateHoverGridFromPointer = (cx: number, cy: number) => {
      const layout = computeLayout();
      const p = propsRef.current;
      const selectedPiece = p.tray[p.selectedPieceIndex];

      // Offset by piece center when dragging or hovering with a selected piece
      let offsetRows = 0;
      let offsetCols = 0;
      if (!p.activeTargetingBooster && selectedPiece && !selectedPiece.used) {
        offsetRows = Math.floor((selectedPiece.matrix.length - 1) / 2);
        offsetCols = Math.floor((selectedPiece.matrix[0].length - 1) / 2);
      }

      const rawCol = Math.floor((cx - layout.boardLeft) / layout.cellSize);
      const rawRow = Math.floor((cy - layout.boardTop) / layout.cellSize);

      if (rawRow >= 0 && rawRow < BOARD_SIZE && rawCol >= 0 && rawCol < BOARD_SIZE) {
        hoverRow = Math.max(0, Math.min(BOARD_SIZE - 1, rawRow - offsetRows));
        hoverCol = Math.max(0, Math.min(BOARD_SIZE - 1, rawCol - offsetCols));
        cursorRow = hoverRow;
        cursorCol = hoverCol;
      } else {
        hoverRow = -1;
        hoverCol = -1;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const p = propsRef.current;
      const pt = screenToCanvas(e.clientX, e.clientY);
      pointerX = pt.x;
      pointerY = pt.y;

      if (p.shellState !== 'playing') return;

      const layout = computeLayout();

      // Check if clicking one of the 3 Tray Pieces
      if (
        pt.y >= layout.trayTop - 8 &&
        pt.y <= layout.trayTop + layout.trayHeight + 12 &&
        pt.x >= layout.boardLeft - 16 &&
        pt.x <= layout.boardLeft + layout.boardPx + 16
      ) {
        const slotIdx = Math.min(
          2,
          Math.max(0, Math.floor((pt.x - layout.boardLeft) / layout.traySlotWidth))
        );
        if (p.tray[slotIdx] && !p.tray[slotIdx].used) {
          soundSynth.playSelect();
          p.onSelectPiece(slotIdx);
          isDragging = true;
          return;
        }
      }

      // Check if clicking inside the Board
      updateHoverGridFromPointer(pt.x, pt.y);
      if (hoverRow >= 0 && hoverCol >= 0) {
        if (p.activeTargetingBooster) {
          p.onUseTargetBooster(hoverRow, hoverCol);
          return;
        }
        const piece = p.tray[p.selectedPieceIndex];
        if (piece && !piece.used && canPlacePiece(p.board, piece, hoverRow, hoverCol)) {
          boardSquash = 1;
          p.onPlacePiece(p.selectedPieceIndex, hoverRow, hoverCol);
          isDragging = false;
          return;
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const pt = screenToCanvas(e.clientX, e.clientY);
      pointerX = pt.x;
      pointerY = pt.y;
      if (propsRef.current.shellState === 'playing') {
        updateHoverGridFromPointer(pt.x, pt.y);
        requestRedrawRef.current();
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      const p = propsRef.current;
      if (p.shellState !== 'playing') return;
      const pt = screenToCanvas(e.clientX, e.clientY);
      updateHoverGridFromPointer(pt.x, pt.y);
      if (hoverRow >= 0 && hoverCol >= 0) {
        const piece = p.tray[p.selectedPieceIndex];
        if (piece && !piece.used && canPlacePiece(p.board, piece, hoverRow, hoverCol)) {
          boardSquash = 1;
          p.onPlacePiece(p.selectedPieceIndex, hoverRow, hoverCol);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const code = e.code;
      if (!heldKeys.has(code)) {
        justPressedKeys.add(code);
      }
      heldKeys.add(code);

      const p = propsRef.current;

      // Title screen Start handshake on Enter or Space
      if (p.shellState === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          p.onStartGame();
        }
        return;
      }

      // Pause toggle on Escape or KeyP
      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        p.onTogglePause();
        return;
      }

      if (code === 'KeyM') {
        e.preventDefault();
        p.onToggleMute();
        return;
      }

      if (p.shellState !== 'playing') return;

      // Piece Selection 1, 2, 3
      if (code === 'Digit1' || code === 'Numpad1') {
        soundSynth.playSelect();
        p.onSelectPiece(0);
      } else if (code === 'Digit2' || code === 'Numpad2') {
        soundSynth.playSelect();
        p.onSelectPiece(1);
      } else if (code === 'Digit3' || code === 'Numpad3') {
        soundSynth.playSelect();
        p.onSelectPiece(2);
      } else if (code === 'KeyR') {
        e.preventDefault();
        p.onRotatePiece(p.selectedPieceIndex);
      } else if (code === 'KeyF') {
        e.preventDefault();
        p.onRerollTray();
      } else if (code === 'KeyH') {
        e.preventDefault();
        p.onActivateBoosterMode('hammer');
      } else if (code === 'KeyB') {
        e.preventDefault();
        p.onActivateBoosterMode('bomb_blast');
      } else if (code === 'ArrowUp' || code === 'KeyW') {
        e.preventDefault();
        cursorRow = Math.max(0, cursorRow - 1);
        hoverRow = cursorRow;
        if (hoverCol < 0) hoverCol = cursorCol;
        requestRedrawRef.current();
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        e.preventDefault();
        cursorRow = Math.min(BOARD_SIZE - 1, cursorRow + 1);
        hoverRow = cursorRow;
        if (hoverCol < 0) hoverCol = cursorCol;
        requestRedrawRef.current();
      } else if (code === 'ArrowLeft' || code === 'KeyA') {
        e.preventDefault();
        cursorCol = Math.max(0, cursorCol - 1);
        hoverCol = cursorCol;
        if (hoverRow < 0) hoverRow = cursorRow;
        requestRedrawRef.current();
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        e.preventDefault();
        cursorCol = Math.min(BOARD_SIZE - 1, cursorCol + 1);
        hoverCol = cursorCol;
        if (hoverRow < 0) hoverRow = cursorRow;
        requestRedrawRef.current();
      } else if (code === 'Space' || code === 'Enter') {
        e.preventDefault();
        const targetR = hoverRow >= 0 ? hoverRow : cursorRow;
        const targetC = hoverCol >= 0 ? hoverCol : cursorCol;

        if (p.activeTargetingBooster) {
          p.onUseTargetBooster(targetR, targetC);
          return;
        }

        const piece = p.tray[p.selectedPieceIndex];
        if (piece && !piece.used) {
          if (canPlacePiece(p.board, piece, targetR, targetC)) {
            boardSquash = 1;
            p.onPlacePiece(p.selectedPieceIndex, targetR, targetC);
          } else {
            // Assist keyboard player by snapping to best valid placement if current cursor cell is blocked
            const best = findBestValidPlacement(p.board, piece);
            if (best) {
              cursorRow = best.row;
              cursorCol = best.col;
              hoverRow = best.row;
              hoverCol = best.col;
              boardSquash = 1;
              p.onPlacePiece(p.selectedPieceIndex, best.row, best.col);
            }
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) clearInputs();
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Helper to draw a tactile 3D beveled Relic Block cell
    const drawRelicBlock = (
      x: number,
      y: number,
      size: number,
      colorKey: BlockColor,
      kind: GridCell['kind'],
      frozenLayers: number,
      bombTimer: number,
      themeId: ThemeSkinId,
      alpha: number = 1
    ) => {
      const theme = THEME_SKINS[themeId] || THEME_SKINS.mystic_forest;
      const palette = theme.blocks[colorKey] || theme.blocks.emerald;
      const pad = 2;
      const bx = x + pad;
      const by = y + pad;
      const bs = size - pad * 2;
      if (bs <= 4) return;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Outer dark silhouette
      ctx.fillStyle = '#040B08';
      ctx.beginPath();
      ctx.roundRect(bx - 1, by - 1, bs + 2, bs + 2, 6);
      ctx.fill();

      // Main block body
      ctx.fillStyle = palette.fill;
      ctx.beginPath();
      ctx.roundRect(bx, by, bs, bs, 5);
      ctx.fill();

      // Bottom bevel shadow
      ctx.fillStyle = palette.bottomShadow;
      ctx.beginPath();
      ctx.roundRect(bx, by + bs * 0.72, bs, bs * 0.28, [0, 0, 5, 5]);
      ctx.fill();

      // Top highlight bar
      ctx.fillStyle = palette.topHighlight;
      ctx.beginPath();
      ctx.roundRect(bx + 2, by + 2, bs - 4, Math.max(3, bs * 0.18), 3);
      ctx.fill();

      // Inner carved runic frame
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 4, by + 4, bs - 8, bs - 8);

      // Special Obstacle & Opportunity Overlays
      if (kind === 'frozen') {
        // Crystalline Frost Overlay + Layer Cracks (2 or 3 layers)
        ctx.fillStyle = frozenLayers >= 3 ? 'rgba(186, 230, 253, 0.62)' : 'rgba(125, 211, 252, 0.44)';
        ctx.beginPath();
        ctx.roundRect(bx + 1, by + 1, bs - 2, bs - 2, 4);
        ctx.fill();

        ctx.strokeStyle = '#E0F2FE';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx + 5, by + 5);
        ctx.lineTo(bx + bs * 0.52, by + bs * 0.48);
        ctx.lineTo(bx + bs - 5, by + 8);
        if (frozenLayers === 1) {
          // More fractured cracks when down to 1 layer
          ctx.moveTo(bx + 6, by + bs - 6);
          ctx.lineTo(bx + bs * 0.52, by + bs * 0.48);
          ctx.lineTo(bx + bs - 6, by + bs - 5);
        }
        ctx.stroke();

        // Layer badge in corner
        ctx.fillStyle = '#082F49';
        ctx.beginPath();
        ctx.arc(bx + bs - 9, by + bs - 9, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7DD3FC';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#F0F9FF';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${frozenLayers}`, bx + bs - 9, by + bs - 8.5);
      } else if (kind === 'bomb') {
        // Pulsing Crimson Bomb Telegraph when bombTimer <= 2
        const urgent = bombTimer <= 2;
        const pulse = urgent ? 0.5 + 0.5 * Math.sin(simTime * 12) : 0;
        if (urgent) {
          ctx.fillStyle = `rgba(254, 202, 202, ${0.25 + pulse * 0.35})`;
          ctx.beginPath();
          ctx.roundRect(bx, by, bs, bs, 5);
          ctx.fill();
        }

        // Bomb core sphere
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(bx + bs / 2, by + bs / 2 + 1, bs * 0.31, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = urgent ? '#FCA5A5' : '#FBBF24';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Countdown numeral
        ctx.fillStyle = urgent ? '#FEF08A' : '#FFFFFF';
        ctx.font = `700 ${Math.max(11, Math.floor(bs * 0.36))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${bombTimer}`, bx + bs / 2, by + bs / 2 + 1.5);
      } else if (kind === 'wildcard') {
        // Golden Prismatic Star Opportunity Emblem
        const cx = bx + bs / 2;
        const cy = by + bs / 2;
        const outerR = bs * 0.32;
        const innerR = bs * 0.15;
        ctx.fillStyle = '#FEF08A';
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2 + simTime * 1.2;
          const r = i % 2 === 0 ? outerR : innerR;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    };

    // Main 60Hz Simulation & Render Loop (afterDraw pattern for lossless compositor sync)
    let lastTime = performance.now();
    let rafId = 0;
    let frameTimerId = 0;
    let isDisposed = false;

    const tick = (now: number) => {
      if (isDisposed) return;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      // Clamp dt to <= 0.05s per game craft rules
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const p = propsRef.current;
      const theme = THEME_SKINS[p.themeId] || THEME_SKINS.mystic_forest;
      const layout = computeLayout();

      // Check if a new particle burst signal arrived from React
      if (p.burstSignal && p.burstSignal.id !== lastBurstIdRef.current) {
        lastBurstIdRef.current = p.burstSignal.id;
        const isHeavy = p.burstSignal.intensity === 'heavy';
        hitstopTimer = isHeavy ? 0.065 : 0.035;
        cameraTrauma = Math.min(1, cameraTrauma + (isHeavy ? 0.55 : 0.22));

        for (const cell of p.burstSignal.cells) {
          const cx = layout.boardLeft + (cell.col + 0.5) * layout.cellSize;
          const cy = layout.boardTop + (cell.row + 0.5) * layout.cellSize;
          const pal = theme.blocks[cell.color] || theme.blocks.amber;
          const count = isHeavy ? 6 : 3;
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (isHeavy ? 110 : 65) + Math.random() * 140;
            spawnParticle(
              cx,
              cy,
              Math.cos(angle) * speed,
              Math.sin(angle) * speed - 35,
              3 + Math.random() * 4,
              0.42 + Math.random() * 0.35,
              i % 2 === 0 ? pal.topHighlight : '#FEF08A'
            );
          }
        }

        if (p.burstSignal.calloutText) {
          spawnFloatingText(
            layout.boardCenterX,
            layout.boardTop + layout.boardPx * 0.35,
            p.burstSignal.calloutText,
            '#FDE68A'
          );
        }
      }

      // Sim-level hitstop vs render dt
      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
      }
      const simDt = hitstopTimer > 0 || p.shellState === 'paused' ? 0 : dt;
      simTime += simDt;

      // Decay camera trauma & board squash
      cameraTrauma = Math.max(0, cameraTrauma - dt * 2.4);
      boardSquash = Math.max(0, boardSquash - dt * 6.5);

      const shakeMag = cameraTrauma * cameraTrauma * 11;
      const shakeX = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;
      const shakeY = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Background Atmospheric Gradient
      const bgGrad = ctx.createRadialGradient(
        layout.boardCenterX,
        layout.boardCenterY,
        40,
        layout.boardCenterX,
        layout.boardCenterY,
        Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, theme.canvasBgEnd);
      bgGrad.addColorStop(1, theme.canvasBgStart);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle architectural runic rings in background
      ctx.save();
      ctx.strokeStyle = 'rgba(217, 155, 38, 0.06)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(layout.boardCenterX, layout.boardCenterY, layout.boardPx * 0.68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(layout.boardCenterX, layout.boardCenterY, layout.boardPx * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 2. Ambient Drifting Golden Embers
      for (const e of embers) {
        e.y -= e.speedY * (simDt || dt * 0.3);
        if (e.y < -0.05) e.y = 1.05;
        const ex = ((e.x + Math.sin(simTime * 0.8 + e.phase) * e.driftX + 1) % 1) * width;
        const ey = e.y * height;
        const alpha = 0.2 + 0.25 * Math.sin(simTime * 2.2 + e.phase);
        ctx.fillStyle = `rgba(251, 191, 36, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(ex, ey, e.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Apply camera shake + subtle parallax tilt on Title Screen
      ctx.save();
      const parallaxX =
        p.shellState === 'title' ? ((pointerX - width * 0.5) / width) * 14 : 0;
      const parallaxY =
        p.shellState === 'title' ? ((pointerY - height * 0.5) / height) * 10 : 0;

      const squashScaleX = 1 + boardSquash * 0.018;
      const squashScaleY = 1 - boardSquash * 0.018;

      ctx.translate(layout.boardCenterX + shakeX + parallaxX, layout.boardCenterY + shakeY + parallaxY);
      ctx.scale(squashScaleX, squashScaleY);
      ctx.translate(-layout.boardCenterX, -layout.boardCenterY);

      // 3. Board Sanctuary Frame
      const framePad = 12;
      ctx.fillStyle = '#040B08';
      ctx.beginPath();
      ctx.roundRect(
        layout.boardLeft - framePad - 3,
        layout.boardTop - framePad - 3,
        layout.boardPx + (framePad + 3) * 2,
        layout.boardPx + (framePad + 3) * 2,
        16
      );
      ctx.fill();

      ctx.fillStyle = theme.boardFrameFill;
      ctx.strokeStyle = theme.boardFrameStroke;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(
        layout.boardLeft - framePad,
        layout.boardTop - framePad,
        layout.boardPx + framePad * 2,
        layout.boardPx + framePad * 2,
        14
      );
      ctx.fill();
      ctx.stroke();

      // Shifting Architecture Row Telegraph Arrows
      if (p.architecture === 'shifting') {
        for (let r = 2; r <= 5; r++) {
          const ry = layout.boardTop + (r + 0.5) * layout.cellSize;
          ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
          ctx.beginPath();
          ctx.moveTo(layout.boardLeft - 8, ry - 4);
          ctx.lineTo(layout.boardLeft - 2, ry);
          ctx.lineTo(layout.boardLeft - 8, ry + 4);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 4. Render 8x8 Grid Cells
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const cell = p.board[r][c];
          const cx = layout.boardLeft + c * layout.cellSize;
          const cy = layout.boardTop + r * layout.cellSize;

          if (cell.kind === 'void') {
            // Carved Sanctuary Void Pit
            ctx.fillStyle = theme.cellVoidFill;
            ctx.beginPath();
            ctx.roundRect(cx + 2, cy + 2, layout.cellSize - 4, layout.cellSize - 4, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(217, 155, 38, 0.18)';
            ctx.lineWidth = 1;
            ctx.stroke();
            continue;
          }

          // Empty socket
          ctx.fillStyle = theme.cellEmptyFill;
          ctx.strokeStyle = theme.cellEmptyStroke;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(cx + 1.5, cy + 1.5, layout.cellSize - 3, layout.cellSize - 3, 5);
          ctx.fill();
          ctx.stroke();

          // On Title Screen, animate a self-playing showcase pattern on empty cells
          if (p.shellState === 'title' && cell.kind === 'empty') {
            const wave = Math.sin(simTime * 2.1 + r * 0.55 + c * 0.45);
            if (wave > 0.35) {
              const demoColors: BlockColor[] = ['emerald', 'amber', 'sapphire', 'ruby', 'amethyst'];
              const colKey = demoColors[(r * 3 + c) % demoColors.length];
              const demoKind =
                r === 2 && c === 5
                  ? 'frozen'
                  : r === 5 && c === 2
                    ? 'wildcard'
                    : r === 4 && c === 6
                      ? 'bomb'
                      : 'normal';
              drawRelicBlock(
                cx,
                cy,
                layout.cellSize,
                colKey,
                demoKind,
                2,
                4,
                p.themeId,
                Math.min(1, (wave - 0.35) * 2.2)
              );
            }
          } else if (cell.kind !== 'empty') {
            drawRelicBlock(
              cx,
              cy,
              layout.cellSize,
              cell.color,
              cell.kind,
              cell.frozenLayers,
              cell.bombTimer,
              p.themeId,
              1
            );
          }
        }
      }

      // 5. Render Ghost Placement Preview or Target Booster Reticle when Playing
      if (p.shellState === 'playing') {
        const previewR = hoverRow >= 0 ? hoverRow : cursorRow;
        const previewC = hoverCol >= 0 ? hoverCol : cursorCol;

        if (p.activeTargetingBooster && previewR >= 0 && previewC >= 0) {
          const isBomb = p.activeTargetingBooster === 'bomb_blast';
          const minR = isBomb ? Math.max(0, previewR - 1) : previewR;
          const maxR = isBomb ? Math.min(BOARD_SIZE - 1, previewR + 1) : previewR;
          const minC = isBomb ? Math.max(0, previewC - 1) : previewC;
          const maxC = isBomb ? Math.min(BOARD_SIZE - 1, previewC + 1) : previewC;

          for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
              const cx = layout.boardLeft + c * layout.cellSize;
              const cy = layout.boardTop + r * layout.cellSize;
              ctx.fillStyle = 'rgba(239, 68, 68, 0.32)';
              ctx.strokeStyle = '#FEF08A';
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.roundRect(cx + 2, cy + 2, layout.cellSize - 4, layout.cellSize - 4, 5);
              ctx.fill();
              ctx.stroke();
            }
          }
        } else {
          const piece = p.tray[p.selectedPieceIndex];
          if (piece && !piece.used && previewR >= 0 && previewC >= 0) {
            const valid = canPlacePiece(p.board, piece, previewR, previewC);
            for (let dr = 0; dr < piece.matrix.length; dr++) {
              for (let dc = 0; dc < piece.matrix[0].length; dc++) {
                if (piece.matrix[dr][dc] === 1) {
                  const r = previewR + dr;
                  const c = previewC + dc;
                  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                    const cx = layout.boardLeft + c * layout.cellSize;
                    const cy = layout.boardTop + r * layout.cellSize;
                    if (valid) {
                      const mod = piece.modifiers.find((m) => m.dr === dr && m.dc === dc);
                      drawRelicBlock(
                        cx,
                        cy,
                        layout.cellSize,
                        piece.color,
                        mod ? mod.kind : 'normal',
                        mod?.frozenLayers ?? 2,
                        mod?.bombTimer ?? 5,
                        p.themeId,
                        0.58
                      );
                      ctx.strokeStyle = '#FEF08A';
                      ctx.lineWidth = 2;
                      ctx.strokeRect(cx + 2, cy + 2, layout.cellSize - 4, layout.cellSize - 4);
                    } else {
                      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
                      ctx.strokeStyle = 'rgba(248, 113, 113, 0.75)';
                      ctx.lineWidth = 1.5;
                      ctx.strokeRect(cx + 3, cy + 3, layout.cellSize - 6, layout.cellSize - 6);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 6. Render Bottom 3-Piece Tactician Tray Dock (when not on Title Screen)
      if (p.shellState !== 'title') {
        const trayLeft = layout.boardLeft;
        const trayWidth = layout.boardPx;

        // Tray Dock Backing
        ctx.fillStyle = 'rgba(7, 19, 15, 0.92)';
        ctx.strokeStyle = 'rgba(217, 155, 38, 0.42)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(trayLeft - 8, layout.trayTop, trayWidth + 16, layout.trayHeight, 12);
        ctx.fill();
        ctx.stroke();

        const miniCell = Math.max(16, Math.min(24, Math.floor(layout.cellSize * 0.48)));

        for (let i = 0; i < 3; i++) {
          const piece = p.tray[i];
          const slotX = trayLeft + i * layout.traySlotWidth;
          const slotCenterX = slotX + layout.traySlotWidth / 2;
          const slotCenterY = layout.trayTop + layout.trayHeight / 2;
          const isSelected = i === p.selectedPieceIndex && piece && !piece.used;

          // Selection slot highlight
          if (isSelected) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
            ctx.strokeStyle = '#FBBF24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(slotX + 4, layout.trayTop + 6, layout.traySlotWidth - 8, layout.trayHeight - 12, 9);
            ctx.fill();
            ctx.stroke();
          }

          // Key binding badge [1], [2], [3]
          ctx.fillStyle = isSelected ? '#FBBF24' : 'rgba(167, 243, 208, 0.55)';
          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`[${i + 1}]`, slotX + 12, layout.trayTop + 10);

          if (!piece || piece.used) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
            ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PLACED', slotCenterX, slotCenterY);
            continue;
          }

          const rows = piece.matrix.length;
          const cols = piece.matrix[0].length;
          const pWidth = cols * miniCell;
          const pHeight = rows * miniCell;
          const startX = Math.round(slotCenterX - pWidth / 2);
          const startY = Math.round(slotCenterY - pHeight / 2 + 4);

          const fitsAnywhere = findBestValidPlacement(p.board, piece) !== null;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (piece.matrix[r][c] === 1) {
                const mod = piece.modifiers.find((m) => m.dr === r && m.dc === c);
                drawRelicBlock(
                  startX + c * miniCell,
                  startY + r * miniCell,
                  miniCell,
                  piece.color,
                  mod ? mod.kind : 'normal',
                  mod?.frozenLayers ?? 2,
                  mod?.bombTimer ?? 5,
                  p.themeId,
                  fitsAnywhere ? 1 : 0.38
                );
              }
            }
          }
        }
      }

      ctx.restore(); // Restore from shake/parallax transform

      // 7. Update & Render Zero-GC Particle Pool
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const pt = particles[i];
        if (!pt.active) continue;
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          pt.active = false;
          continue;
        }
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 260 * dt; // gravity
        const progress = pt.life / pt.maxLife;
        pt.alpha = 1 - progress;

        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.roundRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size, 2);
        ctx.fill();
        ctx.restore();
      }

      // 8. Update & Render Pooled Floating Score/Event Callouts
      for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
        const ft = floatingTexts[i];
        if (!ft.active) continue;
        ft.life += dt;
        if (ft.life >= ft.maxLife) {
          ft.active = false;
          continue;
        }
        ft.y += ft.vy * dt;
        const alpha = 1 - ft.life / ft.maxLife;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.font = '800 20px "Cinzel", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#030A07';
        ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      justPressedKeys.clear();
      ctx.restore();

      const isHeadless = typeof navigator !== 'undefined' && navigator.webdriver === true;
      if (!isDisposed && !isHeadless) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const scheduleSingleFrame = () => {
      if (isDisposed) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };

    requestRedrawRef.current = scheduleSingleFrame;
    scheduleSingleFrame();

    return () => {
      isDisposed = true;
      window.clearTimeout(frameTimerId);
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden z-0"
      aria-label="Game Viewport Container"
    />
  );
};
