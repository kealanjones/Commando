import { NavLink } from 'react-router-dom';
import { Plus } from './icons';
import { SyncBadge } from './SyncBadge';

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
  subtitle,
}: {
  email: string;
  onAdd: () => void;
  subtitle?: string;
}) {
  const name = (email.split('@')[0] ?? '').split(/[.\-_]/)[0] ?? '';
  const pretty = name ? name[0].toUpperCase() + name.slice(1) : 'there';
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <header className="hello">
      <div className="avatar" aria-hidden="true">{initials(email)}</div>
      <div className="hello__grow">
        <h1>Hi, {pretty}</h1>
        <div className="hello__date">{subtitle ?? today}</div>
      </div>
      <SyncBadge />
      <button className="iconbtn" onClick={onAdd} aria-label="Add an item">
        <Plus />
      </button>
    </header>
  );
}

export function Nav() {
  return (
    <nav className="nav" aria-label="Sections">
      <NavLink to="/" end>Today</NavLink>
      <NavLink to="/streams">Streams</NavLink>
      <NavLink to="/periphery">Periphery</NavLink>
    </nav>
  );
}
