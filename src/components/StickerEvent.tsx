import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StickerEvent as StickerEventType, VideoTimeline, XY } from '../types';
import { resolvePalette, valueAtFrame } from './timeline-utils';

type PathInfo = { d: string; minX: number; minY: number; width: number; height: number; end: XY; angle: number };

const makePath = (points: XY[], curved = false): PathInfo => {
  if (points.length < 2) {
    return { d: '', minX: 0, minY: 0, width: 120, height: 80, end: { x: 90, y: 40 }, angle: 0 };
  }
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const padding = 18;
  const shifted = points.map((p) => ({ x: p.x - minX + padding, y: p.y - minY + padding }));
  let d = '';
  if (curved && shifted.length >= 3) {
    d = `M ${shifted[0].x} ${shifted[0].y} Q ${shifted[1].x} ${shifted[1].y} ${shifted[2].x} ${shifted[2].y}`;
    for (let i = 3; i < shifted.length; i++) d += ` L ${shifted[i].x} ${shifted[i].y}`;
  } else {
    d = shifted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }
  const a = shifted[shifted.length - 2];
  const b = shifted[shifted.length - 1];
  return {
    d,
    minX,
    minY,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    end: b,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
};

export const StickerEvent: React.FC<{ event: StickerEventType; sceneStartFrame: number; timeline: VideoTimeline }> = ({ event, sceneStartFrame, timeline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = event.startFrame - sceneStartFrame;
  const end = event.endFrame - sceneStartFrame;
  if (frame < start || frame >= end) return null;
  const age = frame - start;
  const duration = event.entry?.durationFrames ?? 8;
  const pop = spring({ frame: age, fps, config: { damping: 10, mass: 0.5, stiffness: 220 } });
  const fromScale = event.entry?.fromScale ?? 0.55;
  const toScale = event.entry?.toScale ?? 1;
  const scale = fromScale + (toScale - fromScale) * pop;
  const opacity = valueAtFrame(event.opacity, age, event.startFrame, 1, duration);
  const eventOpacity = Math.max(0, Math.min(1, opacity));
  const color = resolvePalette(event.color, timeline.project.palette, '#C94F76');
  const position = event.position;

  if (event.type === 'hand-drawn-arrow') {
    const points = event.pathPoints ?? [{ x: 0, y: 20 }, { x: 45, y: 5 }, { x: 90, y: 20 }];
    const path = makePath(points, event.curved ?? false);
    const drawFrames = event.drawOn?.durationFrames ?? 10;
    const drawProgress = event.drawOn?.enabled === false ? 1 : interpolate(age, [0, drawFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const headSize = 15;
    const angle1 = path.angle + Math.PI * 0.82;
    const angle2 = path.angle - Math.PI * 0.82;
    const headPath = `M ${path.end.x + headSize * Math.cos(angle1)} ${path.end.y + headSize * Math.sin(angle1)} L ${path.end.x} ${path.end.y} L ${path.end.x + headSize * Math.cos(angle2)} ${path.end.y + headSize * Math.sin(angle2)}`;
    return (
      <div style={{ position: 'absolute', left: position.x, top: position.y, transform: `translate(-50%, -50%) rotate(${event.rotationDegrees ?? 0}deg) scale(${scale})`, transformOrigin: 'center', opacity: eventOpacity }}>
        <svg width={path.width} height={path.height} viewBox={`0 0 ${path.width} ${path.height}`} style={{ overflow: 'visible' }}>
          <path
            d={path.d} fill="none" stroke={color} strokeWidth={event.dashed ? 5 : 7}
            strokeLinecap="round" strokeLinejoin="round" pathLength={100}
            strokeDasharray={event.dashed ? '3 3' : '100'}
            strokeDashoffset={100 - drawProgress * 100}
          />
          <path d={headPath} fill="none" stroke={color} strokeWidth={event.dashed ? 5 : 7}
            strokeLinecap="round" strokeLinejoin="round" opacity={drawProgress > 0.88 ? 1 : 0} />
        </svg>
      </div>
    );
  }

  const isEmoji = event.type === 'emoji';
  const stickerText = isEmoji ? (event.emoji ?? '✨') : (event.text ?? '!!');
  return (
    <div
      style={{
        position: 'absolute', left: position.x, top: position.y,
        transform: `translate(-50%, -50%) rotate(${event.rotationDegrees ?? 0}deg) scale(${scale})`,
        transformOrigin: 'center', opacity: eventOpacity, color,
        fontFamily: isEmoji ? 'Noto Color Emoji, Apple Color Emoji, sans-serif' : 'Noto Sans Arabic, sans-serif',
        fontSize: isEmoji ? 88 : 92, fontWeight: 900, lineHeight: 1, whiteSpace: 'nowrap',
        textShadow: isEmoji ? 'none' : '2px 3px 0 rgba(255,255,255,0.5)',
      }}
    >
      {stickerText}
    </div>
  );
};
