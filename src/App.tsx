import { DemoPage } from './demo/DemoPage';
import { EmbedPage } from './demo/EmbedPage';

/**
 * The product route: the live instrument inside the demo harness
 * (docs/BUILD_BRIEF.md step 6), or with `?embed=1` just the phone and its
 * controls for an iframe (step 7). /states (src/states) stays the static
 * verification page — same Instrument, no loop.
 */
export function App({ embed = false }: { embed?: boolean }) {
  return embed ? <EmbedPage /> : <DemoPage />;
}
