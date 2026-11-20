import { useEffect, useState } from 'react';

const OPEN = '/doll/doll-eyes-open.png';
const CLOSED = '/doll/doll-eyes-closed.png';

// Random blink: eyes open for 2.5–5.5s, then closed for ~140ms; sometimes a quick double blink.
function useBlink() {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let timer;
    const wait = (ms, fn) => { timer = setTimeout(fn, ms); };

    const openPhase = () => wait(2500 + Math.random() * 3000, () => {
      setClosed(true);
      wait(140, () => {
        setClosed(false);
        if (Math.random() < 0.25) {
          wait(120, () => { setClosed(true); wait(140, () => { setClosed(false); openPhase(); }); });
        } else {
          openPhase();
        }
      });
    });

    openPhase();
    return () => clearTimeout(timer);
  }, []);

  return closed;
}

export default function App() {
  const closed = useBlink();

  return (
    <main className="room" role="img" aria-label="Love, Me dressing and beauty room">
      <div className="doll" aria-hidden="true">
        <img className="doll-img" src={OPEN} alt="" draggable="false" />
        <img className="doll-img doll-closed" src={CLOSED} alt="" draggable="false" style={{ opacity: closed ? 1 : 0 }} />
      </div>
    </main>
  );
}
