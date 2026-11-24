import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TextEntry, VideoTimeline } from '../types';
import { cleanTemplateText, resolvePalette, valueAtFrame } from './timeline-utils';

type Props = { event: TextEntry; sceneStartFrame: number; sceneEndFrame: number; timeline: VideoTimeline };

export const WordEvent: React.FC<Props> = ({ event, sceneStartFrame, sceneEndFrame, timeline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = event.startFrame - sceneStartFrame;
  const nominalEnd = event.endFrame - sceneStartFrame;
  const keyframes = typeof event.opacity === 'object' && event.opacity && 'keyframes' in event.opacity
    ? event.opacity.keyframes
    : undefined;
  const lastOpacityFrame = keyframes?.length ? Math.max(...keyframes.map((kf) => kf.frame - sceneStartFrame)) : nominalEnd;
  const end = Math.min(sceneEndFrame - sceneStartFrame, Math.max(nominalEnd, lastOpacityFrame));
  if (frame < start || frame > end) return null;

  const entry = event.entry ?? { type: 'fade-rise', offsetY: 18 };
  const entryDuration = entry.type === 'spring-pop' ? 14 : 12;
  const progress = interpolate(frame - start, [0, entryDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const springScale = entry.type === 'spring-pop'
    ? spring({ frame: frame - start, fps, config: { damping: 12, mass: 0.55, stiffness: 180 } })
    : 1;
  const scale = entry.type === 'spring-pop'
    ? (entry.fromScale ?? 0.82) + ((entry.toScale ?? 1) - (entry.fromScale ?? 0.82)) * springScale
    : 1;
  const yOffset = entry.type === 'fade-rise' ? (entry.offsetY ?? 20) * (1 - progress) : 0;
  const opacityFallback = frame < start + entryDuration ? progress : 1;
  const opacity = keyframes?.length
    ? valueAtFrame(event.opacity, frame, sceneStartFrame, opacityFallback)
    : (typeof event.opacity === 'object' && event.opacity && event.opacity.from !== undefined && event.opacity.to !== undefined
      ? (event.opacity.from + (event.opacity.to - event.opacity.from) * progress)
      : opacityFallback);
  const rawText = cleanTemplateText(event.kashida?.displayText, event.text);
  const text = cleanTemplateText(rawText, '');
  const color = resolvePalette(event.color, timeline.project.palette, '#171717');

  return (
    <div
      className="arabic-text"
      dir="rtl"
      lang="ar"
      style={{
        position: 'absolute',
        left: event.position.x,
        top: event.position.y + yOffset,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        opacity,
        color,
        fontFamily: `'${event.fontFamily ?? timeline.fonts.primary?.family ?? 'Noto Sans Arabic'}', sans-serif`,
        fontSize: event.fontSize ?? 84,
        fontWeight: event.fontWeight ?? timeline.fonts.primary?.weight ?? 800,
        direction: timeline.fonts.arabicText?.direction ?? 'rtl',
        textAlign: event.textAlign ?? timeline.fonts.arabicText?.textAlign ?? 'center',
        maxWidth: event.maxWidth ?? 980,
        width: 'max-content',
        minWidth: 80,
        padding: '0 20px',
        textShadow: '0 2px 0 rgba(255,255,255,0.08)',
        willChange: 'transform, opacity',
      }}
    >
      {text}
    </div>
  );
};
