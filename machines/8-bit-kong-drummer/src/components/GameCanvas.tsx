
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrumType, Platform, DrumTrigger, Barrel, Player, Ladder } from '../types';
import { audioManager } from '../services/AudioManager';

interface GameCanvasProps {
  bpm: number;
  barrelInterval: number;
  selectedDrum: DrumType;
  onTriggersChange: (count: number) => void;
  resetRequested: boolean;
  onResetComplete: () => void;
  godMode: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number; // Used as scale factor
  type: DrumType;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 570; // Reduced from 600 to remove empty space
const PLAYER_SIZE = 30;
const SPRITE_SCALE = 3;
const BARREL_RADIUS = 12;
const GRAVITY = 0.2;
const BARREL_GRAVITY = 0.15;
const JUMP_FORCE = -4.5;
const PLAYER_SPEED = 2;
const CLIMB_SPEED = 1;

const NEON_COLORS: Record<DrumType, string> = {
  [DrumType.KICK]: '#39FF14',
  [DrumType.SNARE]: '#FF00FF',
  [DrumType.HIHAT]: '#00FFFF',
  [DrumType.CLAP]: '#FEFE33',
  [DrumType.CRASH]: '#FF5F1F',
};

const PIXELS_PER_BEAT = 30; 
const PIXELS_PER_8TH = 15;

const INITIAL_PLATFORMS: Platform[] = [
  { x: 0, y: 550, width: 800, height: 10, slope: 0 },
  { x: 50, y: 460, width: 600, height: 10, slope: 25 },
  { x: 150, y: 370, width: 600, height: 10, slope: -25 },
  { x: 50, y: 280, width: 600, height: 10, slope: 25 },
  { x: 150, y: 190, width: 600, height: 10, slope: -25 },
  { x: 50, y: 100, width: 250, height: 10, slope: 0 },
];

const INITIAL_LADDERS: Ladder[] = [
  { x: 600, yTop: 475, yBottom: 550 },
  { x: 150, yTop: 365, yBottom: 465 },
  { x: 600, yTop: 295, yBottom: 385 },
  { x: 150, yTop: 185, yBottom: 285 },
  { x: 150, yTop: 100, yBottom: 185 },
];

const INITIAL_PLAYER_STATE: Player = {
  x: 400,
  y: 500,
  vx: 0,
  vy: 0,
  width: PLAYER_SIZE,
  height: PLAYER_SIZE,
  isGrounded: false,
  isClimbing: false,
  platformIndex: -1,
  facing: 'RIGHT',
  isPlacing: false,
  placeTimer: 0
};

const getYOnPlatform = (x: number, p: Platform) => {
  const relX = (x - p.x) / p.width;
  return p.y + relX * p.slope;
};

// Helper to draw drum shapes
const drawDrumShape = (ctx: CanvasRenderingContext2D, type: DrumType, scale: number) => {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.beginPath();
    switch (type) {
      case DrumType.KICK: 
        ctx.fillRect(-8, -24, 16, 24); 
        break;
      case DrumType.SNARE:
        ctx.moveTo(0, -24); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.fill(); 
        break;
      case DrumType.HIHAT:
        ctx.arc(0, -12, 10, 0, Math.PI * 2); ctx.fill(); 
        break;
      case DrumType.CLAP:
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          ctx.lineTo(Math.cos(angle) * 12, -12 + Math.sin(angle) * 12);
          const angle2 = (Math.PI * 2 * (i + 0.5)) / 5 - Math.PI / 2;
          ctx.lineTo(Math.cos(angle2) * 5, -12 + Math.sin(angle2) * 5);
        }
        ctx.fill(); 
        break;
      case DrumType.CRASH:
        ctx.moveTo(0, -24); ctx.lineTo(10, -12); ctx.lineTo(0, 0); ctx.lineTo(-10, -12); ctx.fill(); 
        break;
    }
    ctx.restore();
};

// Animation states for Kong
type KongState = 'IDLE' | 'GRAB_LEFT' | 'HOLD' | 'THROW_RIGHT';

const GameCanvas: React.FC<GameCanvasProps> = ({ bpm, barrelInterval, selectedDrum, onTriggersChange, resetRequested, onResetComplete, godMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Mutable Game State (Refs) ---
  const playerRef = useRef<Player>({ ...INITIAL_PLAYER_STATE });
  const barrelsRef = useRef<Barrel[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const monkeyStateRef = useRef<KongState>('IDLE');
  const mouthStateRef = useRef<DrumType | null>(null);
  
  const [triggers, setTriggers] = useState<DrumTrigger[]>([]);
  const triggersRef = useRef<DrumTrigger[]>([]);

  const keys = useRef<{ [key: string]: boolean }>({});
  const jumpLock = useRef<boolean>(false);
  const lastSpawnTime = useRef<number>(Date.now());
  const mouthTimeoutRef = useRef<number | null>(null);
  const frameIdRef = useRef<number>(0);

  // Sync state to ref
  useEffect(() => {
    triggersRef.current = triggers;
    onTriggersChange(triggers.length);
  }, [triggers, onTriggersChange]);

  // Handle Reset
  useEffect(() => {
    if (resetRequested) {
      setTriggers([]);
      barrelsRef.current = [];
      particlesRef.current = [];
      playerRef.current = { ...INITIAL_PLAYER_STATE };
      jumpLock.current = false;
      onResetComplete();
    }
  }, [resetRequested, onResetComplete]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      if (e.code === 'ArrowUp') jumpLock.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Trigger Mouth Animation
  const triggerMouth = useCallback((type: DrumType) => {
    mouthStateRef.current = type;
    if (mouthTimeoutRef.current) window.clearTimeout(mouthTimeoutRef.current);
    mouthTimeoutRef.current = window.setTimeout(() => {
      mouthStateRef.current = null;
    }, 150);
  }, []);

  // --- Game Loop ---
  useEffect(() => {
    const update = () => {
      const player = playerRef.current;
      
      // 1. Player Logic (Movement & Physics)
      if (player.placeTimer > 0) {
        player.placeTimer--;
        if (player.placeTimer <= 0) player.isPlacing = false;
      }

      const playerCenterX = player.x + player.width / 2;
      const playerBottomY = player.y + player.height;
      
      let contactLadder: Ladder | null = null;
      INITIAL_LADDERS.forEach(l => {
        if (Math.abs(playerCenterX - l.x) < 20 && playerBottomY >= l.yTop - 10 && player.y <= l.yBottom + 10) {
          contactLadder = l;
        }
      });

      if (contactLadder) {
        if (keys.current['ArrowUp'] || keys.current['ArrowDown']) {
          player.isClimbing = true;
          player.isGrounded = false;
          player.vx = 0;
          player.x = contactLadder.x - player.width / 2;
        }
      } else {
        player.isClimbing = false;
      }

      if (player.isClimbing) {
        player.vy = 0;
        if (keys.current['ArrowUp']) player.vy = -CLIMB_SPEED;
        if (keys.current['ArrowDown']) player.vy = CLIMB_SPEED;
        
        if (contactLadder) {
           if (playerBottomY < contactLadder.yTop && keys.current['ArrowUp']) player.isClimbing = false;
           if (playerBottomY > contactLadder.yBottom + 5 && keys.current['ArrowDown']) player.isClimbing = false;
        }
      } else {
        if (keys.current['ArrowLeft']) {
          player.vx = -PLAYER_SPEED;
          player.facing = 'LEFT';
        } else if (keys.current['ArrowRight']) {
          player.vx = PLAYER_SPEED;
          player.facing = 'RIGHT';
        } else {
          player.vx = 0;
        }

        if (keys.current['ArrowUp'] && player.isGrounded && !jumpLock.current) {
          player.vy = JUMP_FORCE;
          player.isGrounded = false;
          jumpLock.current = true;
        }
        player.vy += GRAVITY;
      }

      player.x += player.vx;
      player.y += player.vy;

      if (!player.isClimbing || (player.isClimbing && keys.current['ArrowDown'])) {
        player.isGrounded = false;
        player.platformIndex = -1;
        
        INITIAL_PLATFORMS.forEach((p, idx) => {
          if (player.x + player.width > p.x && player.x < p.x + p.width) {
            const platY = getYOnPlatform(player.x + player.width / 2, p);
            if (player.y + player.height >= platY && player.y + player.height <= platY + 25 && player.vy >= 0) {
              player.y = platY - player.height;
              player.vy = 0;
              player.isGrounded = true;
              player.isClimbing = false;
              player.platformIndex = idx;
            }
          }
        });
      }

      if (player.x < 0) player.x = 0;
      if (player.x + player.width > CANVAS_WIDTH) player.x = CANVAS_WIDTH - player.width;
      if (player.y > CANVAS_HEIGHT) {
        player.y = 500;
        player.x = 400;
        player.vy = 0;
        player.isClimbing = false;
      }

      // Space Interaction
      if (keys.current['Space'] && player.isGrounded && player.platformIndex !== -1) {
          const rawCenterX = player.x + player.width / 2;
          const currentPlatform = INITIAL_PLATFORMS[player.platformIndex];
          const snappedX = Math.round(rawCenterX / PIXELS_PER_8TH) * PIXELS_PER_8TH;

          if (snappedX >= currentPlatform.x && snappedX <= currentPlatform.x + currentPlatform.width) {
              const snappedY = getYOnPlatform(snappedX, currentPlatform);
              const existingTriggerIndex = triggersRef.current.findIndex(t => 
                Math.abs(t.x - snappedX) < 1 && t.platformIndex === player.platformIndex
              );

              if (existingTriggerIndex !== -1) {
                const triggerIdToRemove = triggersRef.current[existingTriggerIndex].id;
                setTriggers(prev => prev.filter(t => t.id !== triggerIdToRemove));
                triggersRef.current = triggersRef.current.filter(t => t.id !== triggerIdToRemove);
                
                player.isPlacing = true;
                player.placeTimer = 15;
              } else {
                const newTrigger = {
                  id: Math.random().toString(36).substr(2, 9),
                  x: snappedX,
                  y: snappedY,
                  type: selectedDrum,
                  platformIndex: player.platformIndex
                };
                setTriggers(prev => [...prev, newTrigger]);
                triggersRef.current = [...triggersRef.current, newTrigger];
                
                player.isPlacing = true;
                player.placeTimer = 15;
              }
          }
          keys.current['Space'] = false;
      }

      // 2. Barrels & Monkey Logic
      const barrelSpeedBase = bpm / 120;
      const spawnInterval = (60000 / bpm) * barrelInterval;
      const now = Date.now();
      const timeInCycle = now - lastSpawnTime.current;

      // Determine Monkey State based on time since last spawn
      // Cycle: [IDLE] -> [GRAB] (800ms before) -> [HOLD] (400ms before) -> [THROW] (at 0)
      
      if (timeInCycle < 250) {
         monkeyStateRef.current = 'THROW_RIGHT';
      } else if (timeInCycle > spawnInterval - 400) {
         monkeyStateRef.current = 'HOLD';
      } else if (timeInCycle > spawnInterval - 800) {
         monkeyStateRef.current = 'GRAB_LEFT';
      } else {
         monkeyStateRef.current = 'IDLE';
      }

      if (timeInCycle >= spawnInterval) {
        // SPAWN BARREL
        const newBarrel: Barrel = {
          id: Math.random().toString(36).substr(2, 9),
          x: 190, // Adjusted spawn X for moved monkey
          y: 70, 
          vx: barrelSpeedBase,
          vy: 0,
          radius: BARREL_RADIUS,
          platformIndex: 5,
          hasTriggered: new Set()
        };
        barrelsRef.current.push(newBarrel);
        lastSpawnTime.current = now;
      }

      barrelsRef.current = barrelsRef.current.map(b => {
        b.vy += BARREL_GRAVITY;
        b.x += b.vx;
        b.y += b.vy;

        let groundedOnLevel = -1;
        INITIAL_PLATFORMS.forEach((p, idx) => {
          if (b.x + b.radius > p.x && b.x - b.radius < p.x + p.width) {
            const platY = getYOnPlatform(b.x, p);
            if (b.y + b.radius >= platY && b.y + b.radius <= platY + 20 && b.vy >= 0) {
              b.y = platY - b.radius;
              b.vy = 0;
              groundedOnLevel = idx;
              if (p.slope > 0) b.vx = barrelSpeedBase;
              else if (p.slope < 0) b.vx = -barrelSpeedBase;
              else if (idx === 5) b.vx = barrelSpeedBase; 
            }
          }
        });

        if (groundedOnLevel !== -1 && groundedOnLevel !== b.platformIndex) {
          b.hasTriggered = new Set();
          b.platformIndex = groundedOnLevel;
        }

        triggersRef.current.forEach(t => {
          if (t.platformIndex === b.platformIndex && !b.hasTriggered.has(t.id)) {
            const dist = Math.abs(b.x - t.x);
            const hitWindow = Math.max(barrelSpeedBase * 2.5, 4);
            if (dist < hitWindow) { 
              audioManager.playSound(t.type);
              triggerMouth(t.type);
              b.hasTriggered.add(t.id);
              
              // Spawn Particles with Shape and Type
              const particleCount = Math.floor(Math.random() * 4) + 1; // 1-4
              for(let i=0; i<particleCount; i++) {
                  particlesRef.current.push({
                      x: t.x,
                      y: t.y,
                      vx: (Math.random() - 0.5) * 4,
                      vy: -(Math.random() * 3 + 2), // Upward
                      color: NEON_COLORS[t.type],
                      size: Math.random() * 0.4 + 0.4, // Initial scale factor
                      type: t.type
                  });
              }
            }
          }
        });

        // Collision Check (God Mode Off)
        if (!godMode) {
          const closestX = Math.max(player.x, Math.min(b.x, player.x + player.width));
          const closestY = Math.max(player.y, Math.min(b.y, player.y + player.height));
          const distanceX = b.x - closestX;
          const distanceY = b.y - closestY;
          const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

          if (distanceSquared < (b.radius * b.radius)) {
             // Collision detected - Kill Player
             player.x = 400;
             player.y = 500;
             player.vx = 0;
             player.vy = 0;
             player.isClimbing = false;
             player.isGrounded = true;
          }
        }

        return b;
      }).filter(b => b.y < CANVAS_HEIGHT - 10 && b.x > -50 && b.x < CANVAS_WIDTH + 50);

      // Update Particles
      particlesRef.current = particlesRef.current.map(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95; // Slower ease out
        p.vy *= 0.95;
        p.size -= 0.015; // Slower decay for longer life
        return p;
      }).filter(p => p.size > 0);
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const player = playerRef.current;
      const barrels = barrelsRef.current;
      const particles = particlesRef.current;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Monkey at x=140
      drawMonkey(ctx, 140, 100);

      // Draw Ladders
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      INITIAL_LADDERS.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(l.x - 10, l.yTop);
        ctx.lineTo(l.x - 10, l.yBottom);
        ctx.moveTo(l.x + 10, l.yTop);
        ctx.lineTo(l.x + 10, l.yBottom);
        ctx.stroke();
        for (let ry = l.yTop; ry <= l.yBottom; ry += 8) {
          ctx.beginPath();
          ctx.moveTo(l.x - 10, ry);
          ctx.lineTo(l.x + 10, ry);
          ctx.stroke();
        }
      });

      // Platforms
      INITIAL_PLATFORMS.forEach((p, idx) => {
        // Grid
        for (let startX = 0; startX < CANVAS_WIDTH; startX += PIXELS_PER_BEAT) {
          const beatNum = Math.floor(startX / PIXELS_PER_BEAT);
          if (startX + PIXELS_PER_BEAT > p.x && startX < p.x + p.width) {
            const drawX = Math.max(p.x, startX);
            const endX = Math.min(p.x + p.width, startX + PIXELS_PER_BEAT);
            const width = endX - drawX;
            if (width > 0) {
              ctx.fillStyle = beatNum % 2 === 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)';
              const y1 = getYOnPlatform(drawX, p);
              const y2 = getYOnPlatform(endX, p);
              ctx.beginPath();
              ctx.moveTo(drawX, y1);
              ctx.lineTo(endX, y2);
              ctx.lineTo(endX, y2 + 10);
              ctx.lineTo(drawX, y1 + 10);
              ctx.fill();
            }
          }
        }
        // Line
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.width, p.y + p.slope);
        ctx.stroke();
        
        // Ticks (Skipping top and bottom platforms)
        if (idx !== 0 && idx !== INITIAL_PLATFORMS.length - 1) {
            for (let xPos = 0; xPos < CANVAS_WIDTH; xPos += PIXELS_PER_8TH) {
              if (xPos >= p.x && xPos <= p.x + p.width) {
                const isBeat = xPos % PIXELS_PER_BEAT === 0;
                const isMeasure = xPos % (PIXELS_PER_BEAT * 4) === 0;
                const yPos = getYOnPlatform(xPos, p);
                if (isMeasure) {
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(xPos, yPos - 6);
                  ctx.lineTo(xPos, yPos + 6);
                  ctx.stroke();
                } else if (isBeat) {
                  ctx.strokeStyle = '#aaa';
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(xPos, yPos - 4);
                  ctx.lineTo(xPos, yPos + 4);
                  ctx.stroke();
                } else {
                  ctx.strokeStyle = '#555';
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(xPos, yPos - 2);
                  ctx.lineTo(xPos, yPos + 2);
                  ctx.stroke();
                }
              }
            }
        }
      });

      // Triggers
      triggersRef.current.forEach(t => {
        ctx.fillStyle = NEON_COLORS[t.type];
        
        // Draw Trigger Shape Scaled down to 0.8
        ctx.save();
        ctx.translate(t.x, t.y);
        drawDrumShape(ctx, t.type, 0.8);
        ctx.restore();
      });

      // Particles
      particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        drawDrumShape(ctx, p.type, p.size);
        ctx.restore();
      });

      // Barrels
      ctx.fillStyle = '#fff';
      barrels.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const rotation = (b.x / 10);
        ctx.moveTo(b.x + Math.cos(rotation)*b.radius, b.y + Math.sin(rotation)*b.radius);
        ctx.lineTo(b.x - Math.cos(rotation)*b.radius, b.y - Math.sin(rotation)*b.radius);
        ctx.stroke();
      });

      // Player
      drawPlayerSprite(ctx, player);
    };

    const loop = () => {
      update();
      draw();
      frameIdRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => cancelAnimationFrame(frameIdRef.current);
  }, [bpm, barrelInterval, selectedDrum, triggerMouth, godMode]);

  // --- Sprites & Monkey Helpers ---
  const drawPlayerSprite = (ctx: CanvasRenderingContext2D, p: Player) => {
    const scale = SPRITE_SCALE;
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    const R = '#FFFFFF'; const B = '#AAAAAA'; const S = '#FFFFFF'; const H = '#555555'; const _ = null;

    const dp = (dx: number, dy: number, color: string | null) => {
      if (!color) return;
      ctx.fillStyle = color;
      if (p.facing === 'LEFT') {
         ctx.fillRect(x + (10 * scale) - (dx * scale) - scale, y + dy * scale, scale, scale);
      } else {
         ctx.fillRect(x + dx * scale, y + dy * scale, scale, scale);
      }
    };

    const time = Date.now();
    if (p.isPlacing) {
       [_,_,R,R,R,R,R,_,_,_].forEach((c, i) => dp(i, 0, c));
       [_,_,R,R,R,R,R,R,_,_].forEach((c, i) => dp(i, 1, c));
       [_,_,H,H,S,S,S,_,_,_].forEach((c, i) => dp(i, 2, c));
       [_,_,H,S,S,H,H,H,S,_].forEach((c, i) => dp(i, 3, c));
       [_,_,_,S,S,S,S,S,S,_].forEach((c, i) => dp(i, 4, c));
       [_,_,_,R,B,R,R,S,S,S].forEach((c, i) => dp(i, 5, c));
       [_,_,R,R,B,R,R,R,_,_].forEach((c, i) => dp(i, 6, c));
       [_,_,R,R,B,B,B,R,R,_].forEach((c, i) => dp(i, 7, c));
       [_,_,_,B,B,_,B,B,_,_].forEach((c, i) => dp(i, 8, c));
       [_,_,H,H,H,_,H,H,H,_].forEach((c, i) => dp(i, 9, c));
    } else if (p.isClimbing) {
       const frame = Math.floor(time / 150) % 2;
       [_,_,R,R,R,R,R,_,_,_].forEach((c, i) => dp(i, 0, c));
       [_,R,R,R,R,R,R,R,_,_].forEach((c, i) => dp(i, 1, c));
       [_,R,H,H,H,H,H,R,_,_].forEach((c, i) => dp(i, 2, c));
       [_,_,H,H,H,H,H,_,_,_].forEach((c, i) => dp(i, 3, c));
       if (frame === 0) {
          [R,R,R,R,B,R,R,R,R,_].forEach((c, i) => dp(i, 4, c));
          [R,R,R,B,B,B,R,R,R,_].forEach((c, i) => dp(i, 5, c));
          [_,_,B,B,_,B,B,_,_,_].forEach((c, i) => dp(i, 7, c));
          [_,_,H,H,_,H,H,_,_,_].forEach((c, i) => dp(i, 9, c));
       } else {
          [_,_,R,R,B,R,R,_,_,_].forEach((c, i) => dp(i, 4, c));
          [_,R,R,R,B,B,B,R,R,_].forEach((c, i) => dp(i, 5, c));
          [_,_,B,_,_,_,B,_,_,_].forEach((c, i) => dp(i, 7, c));
          [_,_,H,_,_,_,H,_,_,_].forEach((c, i) => dp(i, 9, c));
       }
    } else if (!p.isGrounded) {
       [_,_,R,R,R,R,R,_,_,_].forEach((c, i) => dp(i, 0, c));
       [_,_,R,R,R,R,R,R,_,_].forEach((c, i) => dp(i, 1, c));
       [_,_,H,H,S,S,S,_,_,_].forEach((c, i) => dp(i, 2, c));
       [_,_,H,S,S,H,H,H,S,_].forEach((c, i) => dp(i, 3, c));
       [_,_,_,S,S,S,S,S,S,_].forEach((c, i) => dp(i, 4, c));
       [_,_,R,R,B,R,R,_,_,_].forEach((c, i) => dp(i, 5, c));
       [_,R,R,R,B,B,B,R,R,_].forEach((c, i) => dp(i, 6, c));
       [_,_,B,B,_,_,B,B,_,_].forEach((c, i) => dp(i, 7, c));
       [_,H,H,_,_,_,_,H,H,_].forEach((c, i) => dp(i, 8, c));
    } else if (Math.abs(p.vx) > 0.1) {
       const frame = Math.floor(time / 100) % 3;
       [_,_,R,R,R,R,R,_,_,_].forEach((c, i) => dp(i, 0, c));
       [_,_,R,R,R,R,R,R,_,_].forEach((c, i) => dp(i, 1, c));
       [_,_,H,H,S,S,S,_,_,_].forEach((c, i) => dp(i, 2, c));
       [_,_,H,S,S,H,H,H,S,_].forEach((c, i) => dp(i, 3, c));
       [_,_,_,S,S,S,S,S,S,_].forEach((c, i) => dp(i, 4, c));
       [_,_,R,R,B,R,R,_,_,_].forEach((c, i) => dp(i, 5, c));
       [_,R,R,R,B,B,B,R,R,_].forEach((c, i) => dp(i, 6, c));
       if (frame === 0) {
         [_,_,_,B,B,B,_,_,_,_].forEach((c, i) => dp(i, 7, c));
         [_,_,B,B,_,B,B,_,_,_].forEach((c, i) => dp(i, 8, c));
         [_,H,H,H,_,H,H,H,_].forEach((c, i) => dp(i, 9, c));
       } else if (frame === 1) {
         [_,_,_,B,B,B,_,_,_,_].forEach((c, i) => dp(i, 7, c));
         [_,_,_,B,B,B,_,_,_,_].forEach((c, i) => dp(i, 8, c));
         [_,_,_,H,H,H,_,_,_,_].forEach((c, i) => dp(i, 9, c));
       } else {
         [_,_,_,B,B,B,_,_,_,_].forEach((c, i) => dp(i, 7, c));
         [_,_,_,B,B,B,_,_,_,_].forEach((c, i) => dp(i, 8, c));
         [_,_,H,H,H,_,_,_,_,_].forEach((c, i) => dp(i, 9, c));
       }
    } else {
       [_,_,R,R,R,R,R,_,_,_].forEach((c, i) => dp(i, 0, c));
       [_,_,R,R,R,R,R,R,_,_].forEach((c, i) => dp(i, 1, c));
       [_,_,H,H,S,S,S,_,_,_].forEach((c, i) => dp(i, 2, c));
       [_,_,H,S,S,H,H,H,S,_].forEach((c, i) => dp(i, 3, c));
       [_,_,_,S,S,S,S,S,S,_].forEach((c, i) => dp(i, 4, c));
       [_,_,R,R,B,R,R,_,_,_].forEach((c, i) => dp(i, 5, c));
       [_,R,R,R,B,B,B,R,R,_].forEach((c, i) => dp(i, 6, c));
       [_,_,_,B,B,B,_,_,_,_].forEach((c, i) => dp(i, 7, c));
       [_,_,B,B,_,B,B,_,_,_].forEach((c, i) => dp(i, 8, c));
       [_,_,H,H,_,H,H,_,_,_].forEach((c, i) => dp(i, 9, c));
    }
  };

  const drawMonkey = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const pileX = x - 90; 
    const pileY = y; 
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;

    const drawStandingBarrel = (bx: number, by: number) => {
      const w = 16;
      const h = 20;
      ctx.fillStyle = '#fff';
      ctx.fillRect(bx - w/2, by - h, w, h);
      ctx.beginPath();
      ctx.ellipse(bx, by - h, w/2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#000';
      ctx.beginPath(); ctx.moveTo(bx - w/2, by - h/2 - 2); ctx.lineTo(bx + w/2, by - h/2 - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - w/2, by - h/2 + 2); ctx.lineTo(bx + w/2, by - h/2 + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - w/2, by - h); ctx.lineTo(bx - w/2, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + w/2, by - h); ctx.lineTo(bx + w/2, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - w/2, by); ctx.lineTo(bx + w/2, by); ctx.stroke();
    };

    const bw = 18;
    const bh = 20;
    
    drawStandingBarrel(pileX - bw, pileY);
    drawStandingBarrel(pileX, pileY);
    drawStandingBarrel(pileX + bw, pileY);
    drawStandingBarrel(pileX - bw/2, pileY - bh);
    drawStandingBarrel(pileX + bw/2, pileY - bh);
    drawStandingBarrel(pileX, pileY - bh * 2);

    const state = monkeyStateRef.current;

    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 22, y - 52, 6, 8);
    ctx.fillRect(x + 16, y - 52, 6, 8);
    ctx.fillRect(x - 16, y - 58, 32, 22);
    ctx.fillRect(x - 18, y - 46, 36, 12);
    ctx.fillRect(x - 28, y - 38, 56, 32);
    ctx.fillRect(x - 24, y - 8, 14, 8);
    ctx.fillRect(x + 10, y - 8, 14, 8);
    
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 10, y - 52, 4, 4); 
    ctx.fillRect(x + 6, y - 52, 4, 4);  
    ctx.fillRect(x - 4, y - 42, 3, 2);  
    ctx.fillRect(x + 1, y - 42, 3, 2);  
    
    if (!mouthStateRef.current) {
      ctx.fillRect(x - 8, y - 38, 16, 2);
    } else {
      ctx.fillStyle = '#000';
      switch (mouthStateRef.current) {
        case DrumType.KICK: ctx.fillRect(x - 6, y - 42, 12, 10); break;
        case DrumType.SNARE: ctx.fillRect(x - 12, y - 40, 24, 6); break;
        case DrumType.HIHAT: ctx.fillRect(x - 3, y - 39, 6, 4); break;
        case DrumType.CLAP:
          ctx.beginPath();
          ctx.moveTo(x - 10, y - 40);
          ctx.lineTo(x, y - 32);
          ctx.lineTo(x + 10, y - 40);
          ctx.fill();
          break;
        case DrumType.CRASH:
          ctx.fillRect(x - 16, y - 44, 32, 16);
          ctx.fillStyle = '#fff';
          ctx.fillRect(x - 10, y - 40, 20, 2);
          break;
      }
    }

    ctx.fillStyle = '#9CA3AF';
    ctx.fillRect(x - 20, y - 60, 40, 4);
    ctx.fillRect(x - 24, y - 58, 4, 12);
    ctx.fillRect(x + 20, y - 58, 4, 12);
    ctx.fillStyle = '#D1D5DB';
    ctx.fillRect(x - 26, y - 54, 8, 12);
    ctx.fillRect(x + 18, y - 54, 8, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - 24, y - 52, 2, 8);
    ctx.fillRect(x + 20, y - 52, 2, 8);

    ctx.fillStyle = '#fff';

    if (state === 'IDLE') {
       ctx.fillRect(x - 38, y - 35, 12, 30);
       ctx.fillRect(x + 26, y - 35, 12, 30);
       ctx.fillRect(x - 42, y - 10, 16, 12);
       ctx.fillRect(x + 26, y - 10, 16, 12);
    } 
    else if (state === 'GRAB_LEFT') {
       ctx.fillRect(x - 50, y - 35, 24, 12);
       ctx.fillRect(x - 55, y - 40, 12, 18);
       ctx.fillRect(x + 26, y - 35, 12, 30);
       ctx.fillRect(x + 26, y - 10, 16, 12);
    }
    else if (state === 'HOLD') {
       ctx.fillRect(x - 38, y - 55, 12, 30);
       ctx.fillRect(x + 26, y - 55, 12, 30);
       const holdY = y - 75;
       ctx.beginPath();
       ctx.arc(x, holdY, 12, 0, Math.PI * 2);
       ctx.fill();
       ctx.strokeStyle = '#000';
       ctx.beginPath();
       ctx.moveTo(x + 8, holdY + 8); ctx.lineTo(x - 8, holdY - 8);
       ctx.stroke();
    }
    else if (state === 'THROW_RIGHT') {
       ctx.fillRect(x - 38, y - 35, 12, 30);
       ctx.fillRect(x - 42, y - 10, 16, 12);
       ctx.fillRect(x + 26, y - 35, 24, 12); 
       ctx.fillRect(x + 45, y - 40, 12, 18);
    }
  };

  return (
    <div className="relative border border-white shadow-[0_0_20px_rgba(255,255,255,0.3)] bg-black overflow-hidden h-full">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-w-full h-auto"
      />
    </div>
  );
};

export default GameCanvas;
