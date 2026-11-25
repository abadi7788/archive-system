'use client';

import { useRef, type CSSProperties, type PointerEvent } from 'react';
import BrandMark, { AppIcon } from '../BrandMark';

/** Purely illustrative: no account data, API requests, or credentials enter this demo. */
export default function LoginShowcase() {
  const stage = useRef<HTMLDivElement>(null);

  function resetTilt() {
    stage.current?.style.setProperty('--tilt-x', '0deg');
    stage.current?.style.setProperty('--tilt-y', '0deg');
  }

  function moveTilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || !window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    stage.current?.style.setProperty('--tilt-x', `${-((event.clientY - bounds.top) / bounds.height - .5) * 7}deg`);
    stage.current?.style.setProperty('--tilt-y', `${((event.clientX - bounds.left) / bounds.width - .5) * 9}deg`);
  }

  return (
    <div className="login-showcase" aria-hidden="true">
      <div className="showcase-scene" onPointerMove={moveTilt} onPointerLeave={resetTilt}>
        <div className="showcase-stage" ref={stage} aria-hidden="true" style={{ '--tilt-x': '0deg', '--tilt-y': '0deg' } as CSSProperties}>
          <div className="showcase-halo" />
          <div className="showcase-orbit" />
          <div className="showcase-paper showcase-paper-back">
            <AppIcon name="file" size={23} /><span /><span /><span />
          </div>
          <div className="showcase-paper showcase-paper-front">
            <AppIcon name="file" size={23} /><span /><span /><span />
          </div>
          <div className="showcase-emblem"><BrandMark size={190} /></div>
          <div className="showcase-node showcase-node-folder"><AppIcon name="folder" size={24} /></div>
          <div className="showcase-node showcase-node-search"><AppIcon name="search" size={24} /></div>
          <div className="showcase-node showcase-node-shield"><AppIcon name="shield" size={24} /></div>
        </div>
      </div>
    </div>
  );
}
