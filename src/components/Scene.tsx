import React from 'react';
import type { Scene as SceneType, VideoTimeline } from '../types';
import { MainElement } from './MainElement';
import { StickerEvent } from './StickerEvent';
import { VerticalText } from './VerticalText';
import { WordEvent } from './WordEvent';

export const Scene: React.FC<{ scene: SceneType; timeline: VideoTimeline }> = ({ scene, timeline }) => {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <MainElement scene={scene} timeline={timeline} />
      {scene.wordEvents?.map((event) => (
        <WordEvent key={event.id} event={event} sceneStartFrame={scene.startFrame} sceneEndFrame={scene.endFrame} timeline={timeline} />
      ))}
      <VerticalText scene={scene} timeline={timeline} />
      {scene.stickerEvents?.map((event) => (
        <StickerEvent key={event.id} event={event} sceneStartFrame={scene.startFrame} timeline={timeline} />
      ))}
    </div>
  );
};
