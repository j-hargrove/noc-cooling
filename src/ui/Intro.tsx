export interface IntroProps {
  kicker: string;
  title: string;
  body: string;
  onStart: () => void;
  onDismiss: () => void;
  /** True for the brief window the intro is fading away (contract/components.md §8). */
  gone?: boolean;
}

export function Intro({ kicker, title, body, onStart, onDismiss, gone = false }: IntroProps) {
  return (
    <div className={`intro${gone ? ' gone' : ''}`}>
      <span className="i-kicker">{kicker}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      <button type="button" className="i-start" onClick={onStart}>
        Start the incident
      </button>
      <button type="button" className="i-look" onClick={onDismiss}>
        Look around first
      </button>
    </div>
  );
}
