import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Plus } from './icons';
import { SyncBadge } from './SyncBadge';
import { REALM_LABEL, setFocus, setRealm, useFocus, useRealm } from '@/lib/modes';
import type { RealmScope } from '@/lib/types';

const initials = (email: string) =>
  (email.split('@')[0] ?? '')
    .split(/[.\-_]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'KJ';

export function Header({
  email,
  onAdd,
  onSearch,
  subtitle,
}: {
  email: string;
  onAdd: () => void;
  onSearch: () => void;
  subtitle?: string;
}) {
  const name = (email.split('@')[0] ?? '').split(/[.\-_]/)[0] ?? '';
  const pretty = name ? name[0].toUpperCase() + name.slice(1) : 'there';
  // The date line names the realm, so a screen full of work says "work" on
  // it and never has to be inferred from what is missing. The date gives
  // up its long form to make room on a phone.
  const realm = useRealm();
  const today = new Date().toLocaleDateString('en-GB', realm === 'all'
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'short', day: 'numeric', month: 'short' });
  const line = subtitle ?? (realm === 'all' ? today : `${REALM_LABEL[realm]} · ${today}`);

  return (
    <header className="hello">
      <div className="avatar" aria-hidden="true">{initials(email)}</div>
      <div className="hello__grow">
        <h1>Hi, {pretty}</h1>
        <div className="hello__date">{line}</div>
      </div>
      <SyncBadge />
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

export function Nav() {
  const bar = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // The bar scrolls on a phone, so the destination you are on has to be
  // brought into view or you cannot tell where you are.
  useEffect(() => {
    const here = bar.current?.querySelector<HTMLElement>('[aria-current="page"]');
    here?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [pathname]);

  return (
    <nav className="nav" aria-label="Sections" ref={bar}>
      <NavLink to="/" end>Today</NavLink>
      <NavLink to="/streams">Streams</NavLink>
      <NavLink to="/plan">Plan</NavLink>
      <NavLink to="/web">Web</NavLink>
      <NavLink to="/people">People</NavLink>
      <NavLink to="/periphery">Periphery</NavLink>
      <NavLink to="/intake">Intake</NavLink>
    </nav>
  );
}

/**
 * The two switches. Realm decides what the register is; Focus decides how
 * much of the page is allowed to talk about it.
 */
export function Modes() {
  const realm = useRealm();
  const focus = useFocus();
  return (
    <div className="modes">
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
      <button
        type="button"
        className="modes__focus"
        aria-pressed={focus}
        onClick={() => setFocus(!focus)}
        title={focus ? 'Show everything again' : 'Strip the page back to the work'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
        </svg>
        Focus
      </button>
    </div>
  );
}
