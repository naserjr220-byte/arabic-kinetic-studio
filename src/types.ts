export type XY = { x: number; y: number };
export type Keyframe = { frame: number; value: number };
export type NumberTrack = { from?: number; to?: number; keyframes?: Keyframe[]; interpolation?: string } | number;
export type TextEntry = {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  position: XY;
  maxWidth?: number;
  textAlign?: 'left' | 'center' | 'right';
  opacity?: NumberTrack;
  entry?: { type?: string; fromScale?: number; toScale?: number; offsetY?: number; durationFrames?: number };
  kashida?: { enabled?: boolean; mode?: string; displayText?: string };
};
export type ImageEvent = {
  id: string;
  startFrame: number;
  src: string;
  position?: XY | { from: XY; to: XY };
  size?: { width: number; height: number };
  scale?: NumberTrack;
  opacity?: NumberTrack;
};
export type StickerEvent = {
  id: string;
  type: 'hand-drawn-arrow' | 'text-sticker' | 'emoji' | string;
  text?: string;
  emoji?: string | null;
  startFrame: number;
  endFrame: number;
  position: XY;
  rotationDegrees?: number;
  color?: string;
  opacity?: NumberTrack;
  entry?: { type?: string; fromScale?: number; toScale?: number; durationFrames?: number };
  sfxName?: string;
  sfxVolume?: number;
  pathPoints?: XY[];
  curved?: boolean;
  dashed?: boolean;
  drawOn?: { enabled?: boolean; durationFrames?: number };
};
export type Scene = {
  id: string;
  label?: string;
  startFrame: number;
  endFrame: number;
  background?: string;
  mainElement: {
    src: string;
    position: XY | { from: XY; to: XY };
    size: { width: number; height: number };
    scale?: NumberTrack & { interpolation?: string };
    opacity?: NumberTrack;
    imageEvents?: ImageEvent[];
  };
  verticalText?: {
    text: string;
    visible: boolean;
    position: XY;
    rotationDegrees?: number;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    opacity?: NumberTrack;
  };
  wordEvents?: TextEntry[];
  stickerEvents?: StickerEvent[];
  sfxEvents?: Array<{ id: string; name: string; src?: string; atFrame: number; volume?: number }>;
};
export type VideoTimeline = {
  project: {
    name: string;
    width: number;
    height: number;
    fps: number;
    durationFrames: number;
    durationSeconds: number;
    palette: Record<string, string>;
    background?: { color?: string; type?: string; isStatic?: boolean };
  };
  fonts: {
    primary: { family: string; role?: string; weight?: number; style?: string };
    secondary: { family: string; role?: string; weight?: number; style?: string };
    arabicText: { direction?: 'rtl' | 'ltr'; textAlign?: 'left' | 'center' | 'right'; kashida?: { enabled?: boolean; mode?: string; note?: string } };
  };
  audio: {
    narration: { src: string; volume?: number; startFrame?: number; endFrame?: number };
    renderedMixSrc?: string;
    sfxMix?: { targetGain?: number; allowedRange?: [number, number]; relativeToNarration?: boolean; duckNarration?: boolean };
  };
  assets: { mainElementFrames?: string[]; sfx?: Record<string, string>; fontsDirectory?: string };
  layoutDefaults?: {
    coordinateUnit?: string;
    origin?: string;
    imageFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
    mainElement?: { x?: number; y?: number; width?: number; height?: number; anchor?: string; scale?: number; opacity?: number };
    verticalText?: { width?: number; height?: number; rotationDegrees?: number; fontFamily?: string; fontSize?: number; fontWeight?: number; direction?: 'rtl' | 'ltr'; textAlign?: 'left' | 'center' | 'right'; color?: string; position?: XY };
  };
  narrationText?: string;
  wordTimings?: Array<{ index: number; text: string; startSeconds: number; endSeconds: number; startFrame: number; endFrame: number; sceneId?: string }>;
  scenes: Scene[];
};
