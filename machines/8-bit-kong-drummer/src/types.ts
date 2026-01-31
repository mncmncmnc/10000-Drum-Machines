
export enum DrumType {
  KICK = 'KICK',
  SNARE = 'SNARE',
  HIHAT = 'HIHAT',
  CLAP = 'CLAP',
  CRASH = 'CRASH'
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  slope: number; // Vertical offset from left to right
}

export interface Ladder {
  x: number;
  yTop: number;
  yBottom: number;
}

export interface DrumTrigger {
  id: string;
  x: number;
  y: number;
  type: DrumType;
  platformIndex: number;
}

export interface Barrel {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  platformIndex: number;
  hasTriggered: Set<string>; // IDs of triggers it has already hit this pass
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  isGrounded: boolean;
  isClimbing: boolean;
  platformIndex: number;
  facing: 'LEFT' | 'RIGHT';
  isPlacing: boolean;
  placeTimer: number;
}
