import { useCallback, useEffect, useRef, useState } from 'react';
import { readLiveParams } from '../live/params';
import { useLiveSim } from '../live/useLiveSim';
import { Instrument } from '../ui/Instrument';
import { DemoPill } from './DemoPill';
import { Panel } from './Panel';
import './demo.css';

/**
 * The product route: the live instrument in its device frame, wrapped in
 * the demo harness (docs/BUILD_BRIEF.md: src/demo wraps the product and is
 * never imported by src/ui). The two checkboxes are harness state, read by
 * the live loop only at the moment an incident starts.
 *
 * `embed` (?embed=1, wide enough): the same live app, minus page chrome —
 * see EmbedPage.
 */
export function DemoPage({ embed = false }: { embed?: boolean }) {
  const [params] = useState(() => readLiveParams(window.location.search));
  const [fromLock, setFromLock] = useState(true);
  const [autoSecond, setAutoSecond] = useState(true);
  const optsRef = useRef({ fromLock, autoSecond });
  useEffect(() => {
    optsRef.current = { fromLock, autoSecond };
  }, [fromLock, autoSecond]);
  const getRunOptions = useCallback(() => optsRef.current, []);

  const { instrumentProps, demo } = useLiveSim({ seed: params.seed, readMs: params.readMs, getRunOptions });

  return (
    <main className={embed ? 'stage embed-stage' : 'stage'}>
      <div className="device" id="app">
        <Instrument {...instrumentProps} />
      </div>
      {!embed && <DemoPill targetId="app" />}
      <Panel
        {...demo}
        fromLock={fromLock}
        autoSecond={autoSecond}
        onToggleFromLock={setFromLock}
        onToggleAutoSecond={setAutoSecond}
        variant={embed ? 'controls' : 'full'}
      />
    </main>
  );
}
