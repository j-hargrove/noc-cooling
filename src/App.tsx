import { DemoPage } from './demo/DemoPage';

/**
 * The product route: the live instrument inside the demo harness
 * (docs/BUILD_BRIEF.md step 6). /states (src/states) stays the static
 * verification page — same Instrument, no loop.
 */
export function App() {
  return <DemoPage />;
}
