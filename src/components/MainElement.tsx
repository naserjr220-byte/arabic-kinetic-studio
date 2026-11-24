import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import type { Scene, VideoTimeline } from '../types';
import { positionAtFrame, resolvePalette, valueAtFrame } from './timeline-utils';

type Props = { scene: Scene; timeline: VideoTimeline };

export const MainElement: React.FC<Props> = ({ scene, timeline }) => {
  const localFrame = useCurrentFrame();
  const absoluteFrame = localFrame + scene.startFrame;
  const base = scene.mainElement;
  const imageEvent = [...(base.imageEvents ?? [])]
    .filter((event) => event.startFrame <= absoluteFrame)
    .sort((a, b) => a.startFrame - b.startFrame)
    .at(-1);

  const src = imageEvent?.src ?? base.src;
  const positionTrack = imageEvent?.position ?? base.position;
  const size = imageEvent?.size ?? base.size;
  const scaleTrack = imageEvent?.scale ?? base.scale;
  const opacityTrack = imageEvent?.opacity ?? base.opacity;
  const duration = scene.endFrame - scene.startFrame;
  const position = positionAtFrame(positionTrack, localFrame, duration);
  const scale = valueAtFrame(scaleTrack, localFrame, scene.startFrame, 1, duration);
  const opacity = valueAtFrame(opacityTrack, localFrame, scene.startFrame, 1, duration);
  const background = resolvePalette(scene.background ?? timeline.project.background?.color, timeline.project.palette, '#FADAD8');
  const imageFit = timeline.layoutDefaults?.imageFit ?? 'contain';

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background }} />
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          objectFit: imageFit,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
          opacity,
          willChange: 'transform, opacity',
        }}
      />
    </>
  );
};
