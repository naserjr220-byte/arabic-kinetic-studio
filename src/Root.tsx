import React from 'react';
import { Composition } from 'remotion';
import timelineJson from './data/timeline.json';
import { KineticTypography } from './components/KineticTypography';
import type { VideoTimeline } from './types';
import './styles/global.css';

const timeline = timelineJson as unknown as VideoTimeline;

export const Root: React.FC = () => {
  return (
    <Composition
      id="ArabicKineticTypography"
      component={KineticTypography}
      width={timeline.project.width}
      height={timeline.project.height}
      fps={timeline.project.fps}
      durationInFrames={timeline.project.durationFrames}
      defaultProps={{ timeline }}
    />
  );
};
