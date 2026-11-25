'use client';

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import BrandMark, { AppIcon } from '../BrandMark';
import type { TranslationKeys } from '../lib/i18n';

type DemoMode = 'organize' | 'find' | 'protect';

/** Purely illustrative: no account data, API requests, or credentials enter this demo. */
export default function LoginShowcase({ t }: { t: TranslationKeys }) {
  const [mode, setMode] = useState<DemoMode>('organize');
  const stage = useRef<HTMLDivElement>(null);
  const modes = [
    { id: 'organize' as const, icon: 'folder', label: t.loginOrganize, description: t.loginOrganizeDescription },
    { id: 'find' as const, icon: 'search', label: t.loginFind, description: t.loginFindDescription },
    { id: 'protect' as const, icon: 'shield', label: t.loginProtect, description: t.loginProtectDescription },
  ];
  const current = modes.find((item) => item.id === mode)!;

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
    <div className="login-showcase" aria-label={t.loginDemoLabel}>
      <div className="showcase-scene" data-mode={mode} onPointerMove={moveTilt} onPointerLeave={resetTilt}>
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
          <div className="showcase-scan" />
          <div className="showcase-node showcase-node-folder"><AppIcon name="folder" size={24} /></div>
          <div className="showcase-node showcase-node-search"><AppIcon name="search" size={24} /></div>
          <div className="showcase-node showcase-node-shield"><AppIcon name="shield" size={24} /></div>
        </div>
      </div>
      <div className="showcase-controls">
        <div className="showcase-mode-group" role="group" aria-label={t.loginDemoLabel}>
          {modes.map((item) => (
            <button key={item.id} type="button" aria-pressed={mode === item.id} aria-controls="login-demo-description"
              className="showcase-mode" onClick={() => setMode(item.id)}>
              <AppIcon name={item.icon} size={17} /><span>{item.label}</span>
            </button>
          ))}
        </div>
        <p id="login-demo-description" className="showcase-description" aria-live="polite" aria-atomic="true">{current.description}</p>
      </div>
    </div>
  );
}
