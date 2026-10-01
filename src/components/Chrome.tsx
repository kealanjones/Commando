import { NavLink } from 'react-router-dom';
import { Plus } from './icons';
import { SyncBadge } from './SyncBadge';
import { REALM_LABEL, setRealm, useRealm } from '@/lib/modes';
import type { RealmScope } from '@/lib/types';

/**
 * The top of every screen: the date, which life is showing, and the two
 * things you can do from anywhere — find something, or add something.
 */
export function Header({ onAdd, onSearch }: { onAdd: () => void; onSearch: () => void }) {
  const realm = useRealm();
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <header className="hello">
      <div className="hello__grow">
        <h1 className="hello__date">{today}</h1>
      </div>
      <SyncBadge />
      <div className="seg modes__realm" role="group" aria-label="Which life to show">
        {(['work', 'personal', 'all'] as RealmScope[]).map((r) => (
          <button
            key={r}
            type="button"
            data-realm={r}
            aria-pressed={realm === r}
            onClick={() => setRealm(r)}
          >
            {REALM_LABEL[r]}
          </button>
        ))}
      </div>
      <button className="iconbtn iconbtn--ghost" onClick={onSearch} aria-label="Search the register">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
      </button>
      <button className="iconbtn" onClick={onAdd} aria-label="Add an item">
        <Plus />
      </button>
    </header>
  );
}

/** Four places, and nothing else competes with them. */
export function Nav() {
  return (
    <nav className="nav" aria-label="Sections">
      <NavLink to="/" end>Today</NavLink>
      <NavLink to="/streams">Streams</NavLink>
      <NavLink to="/people">People</NavLink>
      <NavLink to="/review">Review</NavLink>
    </nav>
  );
}
