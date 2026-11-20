import { useState } from 'react';

const stations = [
  { id: 'wardrobe', label: 'Wardrobe', sub: 'Clothing & outfits', icon: '♧', focus: 'left', position: 'wardrobe' },
  { id: 'vanity', label: 'Beauty vanity', sub: 'Makeup & skincare', icon: '✿', focus: 'right', position: 'vanity' },
  { id: 'accessories', label: 'Accessories', sub: 'Jewellery & finishing touches', icon: '♡', focus: 'right', position: 'accessories' },
];

export default function App() {
  const [activeStation, setActiveStation] = useState(null);
  const [characterPosition, setCharacterPosition] = useState('center');

  const visit = (station) => {
    setCharacterPosition(station.position);
    setActiveStation(station);
  };

  const focus = activeStation?.focus ?? 'center';

  return (
    <main className="game-shell">
      <div className={`room focus-${focus}`} aria-label="Love, Me dressing and beauty room">
        <div className="room-image" />
        <div className="room-wash" />

        <header className="brand">
          <span className="brand-mark">♡</span>
          <span className="brand-name">Love, Me</span>
          <span className="brand-caption">your little world</span>
        </header>

        <nav className="room-nav" aria-label="Room stations">
          {stations.map((station) => (
            <button
              className={`station-link ${activeStation?.id === station.id ? 'selected' : ''}`}
              key={station.id}
              onClick={() => visit(station)}
            >
              <span className="station-icon">{station.icon}</span>
              <span><strong>{station.label}</strong><small>{station.sub}</small></span>
            </button>
          ))}
        </nav>

        <div className={`character-marker character-${characterPosition}`} aria-hidden="true">
          <span className="character-sparkle">✦</span>
          <span className="character-dot">♡</span>
        </div>

        <div className="room-hint">Choose a place to explore</div>

        {activeStation && (
          <section className="station-panel" role="dialog" aria-modal="true" aria-labelledby="station-title">
            <button className="close-panel" onClick={() => setActiveStation(null)} aria-label="Close">×</button>
            <span className="panel-kicker">LET'S GET READY</span>
            <h1 id="station-title">{activeStation.label}</h1>
            <p>{activeStation.sub}</p>
            <div className="panel-placeholder">
              <span>{activeStation.icon}</span>
              <small>This area will open into its own interactive activity.</small>
            </div>
            <button className="enter-button" onClick={() => setActiveStation(null)}>Back to the room</button>
          </section>
        )}
      </div>
    </main>
  );
}