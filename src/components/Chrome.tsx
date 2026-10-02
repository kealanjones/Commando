import { Link, NavLink, useLocation } from 'react-router-dom';
import { Plus } from './icons';
import { SyncBadge } from './SyncBadge';
import { Num } from './Motion';
import { DayTally } from './Progress';
import { useHealth, useToday } from '@/data/store';
import { useReviewStatus } from '@/data/review';
import { REALM_LABEL, setRealm, useRealm } from '@/lib/modes';
import type { RealmScope } from '@/lib/types';

const now = () => new Date();
const weekday = () => now().toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
const dayNum = () => String(now().getDate()).padStart(2, '0');
const monthYear = () => now().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function RealmSwitch() {
  const realm = useRealm();
  return (
    <div className="realm" role="group" aria-label="Which life to show">
      {(['work', 'personal', 'all'] as RealmScope[]).map((r) => (
        <button key={r} type="button" aria-pressed={realm === r} onClick={() => setRealm(r)}>
          {REALM_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);

/**
 * The index: the left pane at a desk. The date, which life, the four
 * places with what is in them, and every stream as a line of the ledger.
 */
export function Index() {
  const health = useHealth();
  const { toDo } = useToday();
  const review = useReviewStatus();
  const open = health.reduce((n, h) => n + h.openTasks, 0);
  const { pathname } = useLocation();

  const places: [string, string, string | number][] = [
    ['/', 'Today', toDo],
    ['/projects', 'Projects', open],
    ['/people', 'People', ''],
    ['/review', 'Review', review.session || ''],
    ['/memory', 'Memory', ''],
  ];

  return (
    <aside className="index" aria-label="Index">
      <div className="index__date">
        <span className="label">{weekday()}</span>
        <span className="index__day">{dayNum()}</span>
        <span className="index__month">{monthYear()}</span>
      </div>

      <DayTally className="daytally--index" />

      <RealmSwitch />

      <nav className="nav index__nav" aria-label="Sections">
        {places.map(([to, label, n]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <span>{label}</span>
            <span className="leader" aria-hidden="true" />
            <span className="index__n">{n === '' ? '' : <Num value={n} />}</span>
          </NavLink>
        ))}
      </nav>

      <div className="index__streams">
        <h2 className="label">Projects</h2>
        {health.map((h) => (
          <Link
            key={h.id}
            to={`/projects/${h.id}`}
            className="index__stream"
            aria-current={pathname === `/projects/${h.id}` ? 'page' : undefined}
          >
            <span className="index__code">{h.code}</span>
            <span className="index__name">{h.short}</span>
            <span className="index__n"><Num value={h.openTasks} /></span>
          </Link>
        ))}
      </div>

      <div className="index__foot">
        <SyncBadge />
        <Link to="/settings" className="label index__settings">Settings</Link>
      </div>
    </aside>
  );
}

/** Across the top of the list at a desk: find something, or add something. */
export function DeskBar({ onAdd, onSearch, onMeeting, onFocus }: {
  onAdd: () => void; onSearch: () => void; onMeeting: () => void; onFocus: () => void;
}) {
  return (
    <div className="deskbar">
      <button className="deskbar__search" onClick={onSearch} aria-label="Search the register">
        <SearchIcon />
        <span>Search the register</span>
        <kbd>/</kbd>
      </button>
      <button className="btn btn--ghost deskbar__new" onClick={onFocus} aria-label="Go through items one by one">
        One by one <kbd>O</kbd>
      </button>
      <button className="btn btn--ghost deskbar__meeting" onClick={onMeeting} aria-label="Bring in a meeting">
        Meeting
      </button>
      <button className="btn btn--primary deskbar__new" onClick={onAdd} aria-label="Add an item">
        New item <kbd>N</kbd>
      </button>
    </div>
  );
}

/** The top of a phone: the date, search, settings, and which life. */
export function PhoneTop({ onSearch, onFocus }: { onSearch: () => void; onFocus: () => void }) {
  return (
    <header className="phonetop">
      <div className="phonetop__row">
        <span className="phonetop__day">{dayNum()}</span>
        <span className="phonetop__when">
          <span className="label">{now().toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()}</span>
          <span className="label">{now().toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</span>
        </span>
        <SyncBadge />
        <button className="iconbtn" onClick={onFocus} aria-label="Go through items one by one">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="6" width="14" height="14" /><path d="M8 3h8" />
          </svg>
        </button>
        <button className="iconbtn" onClick={onSearch} aria-label="Search the register"><SearchIcon /></button>
        <Link to="/settings" className="iconbtn" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
          </svg>
        </Link>
      </div>
      <RealmSwitch />
    </header>
  );
}

/** The bottom of a phone: adding is the main job there, so it comes first. */
export function PhoneBottom({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="phonebottom">
      <button className="btn btn--primary addbar" onClick={onAdd} aria-label="Add an item">
        <Plus /> Add an item
      </button>
      <nav className="nav tabs" aria-label="Sections">
        <NavLink to="/" end>Today</NavLink>
        <NavLink to="/projects">Projects</NavLink>
        <NavLink to="/people">People</NavLink>
        <NavLink to="/review">Review</NavLink>
      </nav>
    </div>
  );
}
