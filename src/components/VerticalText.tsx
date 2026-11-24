import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { Scene, VideoTimeline } from '../types';
import { cleanTemplateText, resolvePalette, valueAtFrame } from './timeline-utils';

export const VerticalText: React.FC<{ scene: Scene; timeline: VideoTimeline }> = ({ scene, timeline }) => {
  const frame = useCurrentFrame();
  const item = scene.verticalText;
  if (!item?.visible) return null;
  const text = cleanTemplateText(item.text, '');
  const defaults = timeline.layoutDefaults?.verticalText;
  const opacity = valueAtFrame(item.opacity, frame, scene.startFrame, 1);
  return (
    <div
      className="arabic-text"
      dir="rtl"
      lang="ar"
      style={{
        position: 'absolute',
        left: item.position.x,
        top: item.position.y,
        width: defaults?.width ?? 560,
        minHeight: defaults?.height ?? 84,
        transform: `translate(-50%, -50%) rotate(${item.rotationDegrees ?? defaults?.rotationDegrees ?? -90}deg)`,
        transformOrigin: 'center center',
        color: resolvePalette(item.color ?? defaults?.color, timeline.project.palette, '#FFFFFF'),
        fontFamily: `'${item.fontFamily ?? defaults?.fontFamily ?? timeline.fonts.primary?.family ?? 'Noto Sans Arabic'}', sans-serif`,
        fontSize: item.fontSize ?? defaults?.fontSize ?? 48,
        fontWeight: item.fontWeight ?? defaults?.fontWeight ?? timeline.fonts.primary?.weight ?? 800,
        direction: timeline.fonts.arabicText?.direction ?? defaults?.direction ?? 'rtl',
        textAlign: timeline.fonts.arabicText?.textAlign ?? defaults?.textAlign ?? 'center',
        opacity,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};
