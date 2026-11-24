import React, { useEffect, useState } from 'react';
import {
  Audio,
  Sequence,
  staticFile,
  useVideoConfig,
  delayRender,
  continueRender,
  cancelRender,
} from 'remotion';
import type { VideoTimeline } from '../types';
import { Scene } from './Scene';

export const KineticTypography: React.FC<{ timeline: VideoTimeline }> = ({ timeline }) => {
  const { durationInFrames } = useVideoConfig();
  const [fontHandle] = useState(() => delayRender('Loading Noto Arabic fonts'));

  useEffect(() => {
    let cancelled = false;

    const loadArabicFonts = async () => {
      try {
        // Load the exact local font families and weights used by timeline.json.
        await Promise.all([
          document.fonts.load('400 32px "Noto Sans Arabic"', 'العربية'),
          document.fonts.load('800 32px "Noto Sans Arabic"', 'العربية'),
          document.fonts.load('400 32px "Noto Naskh Arabic"', 'العربية'),
          document.fonts.load('700 32px "Noto Naskh Arabic"', 'العربية'),
        ]);
        await document.fonts.ready;
        if (!cancelled) continueRender(fontHandle);
      } catch (error) {
        cancelRender(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void loadArabicFonts();
    return () => {
      cancelled = true;
    };
  }, [fontHandle]);

  const mixSrc = timeline.audio.renderedMixSrc ?? 'audio/mixed_narration.wav';
  return (
    <div style={{ position: 'absolute', inset: 0, background: timeline.project.palette.background, overflow: 'hidden' }}>
      <Audio src={staticFile(mixSrc)} volume={timeline.audio.narration.volume ?? 1} />
      {timeline.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={Math.min(scene.endFrame - scene.startFrame, durationInFrames - scene.startFrame)}
          name={scene.label ?? scene.id}
        >
          <Scene scene={scene} timeline={timeline} />
        </Sequence>
      ))}
    </div>
  );
};
