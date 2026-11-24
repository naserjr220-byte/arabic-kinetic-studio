import { Easing, interpolate } from 'remotion';
import type { NumberTrack, XY } from '../types';

export const resolvePalette = (value: string | undefined, palette: Record<string, string>, fallback = '#000000'): string => {
  if (!value) return fallback;
  if (!value.startsWith('$palette.')) return value;
  const key = value.slice('$palette.'.length);
  return palette[key] ?? fallback;
};

export const clampInterpolate = (frame: number, input: [number, number], output: [number, number]) =>
  interpolate(frame, input, output, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const valueAtFrame = (track: NumberTrack | undefined, localFrame: number, sceneStartFrame: number, fallback: number, durationFrames = 12): number => {
  if (typeof track === 'number') return track;
  if (!track) return fallback;
  if (Array.isArray(track.keyframes) && track.keyframes.length > 0) {
    const points = [...track.keyframes].sort((a, b) => a.frame - b.frame);
    const first = points[0];
    const last = points[points.length - 1];
    if (localFrame + sceneStartFrame <= first.frame) return first.value;
    if (localFrame + sceneStartFrame >= last.frame) return last.value;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (localFrame + sceneStartFrame >= a.frame && localFrame + sceneStartFrame <= b.frame) {
        return clampInterpolate(localFrame + sceneStartFrame, [a.frame, b.frame], [a.value, b.value]);
      }
    }
  }
  if (track.from !== undefined && track.to !== undefined) {
    const easing = track.interpolation === 'smooth-ease' ? Easing.inOut(Easing.ease) : Easing.linear;
    return interpolate(localFrame, [0, Math.max(1, durationFrames - 1)], [track.from, track.to], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing,
    });
  }
  return fallback;
};

export const positionAtFrame = (position: XY | { from: XY; to: XY }, localFrame: number, duration: number): XY => {
  if ('from' in position && 'to' in position) {
    const end = Math.max(1, duration - 1);
    return {
      x: interpolate(localFrame, [0, end], [position.from.x, position.to.x], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease) }),
      y: interpolate(localFrame, [0, end], [position.from.y, position.to.y], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease) }),
    };
  }
  return position;
};

export const easedProgress = (frame: number, duration: number): number => {
  if (duration <= 0) return 1;
  return interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
};

export const cleanTemplateText = (candidate: string | undefined, fallback: string): string => {
  if (!candidate || candidate.includes('{{')) return fallback;
  return candidate;
};
