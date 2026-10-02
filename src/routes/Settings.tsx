import { Link, useNavigate } from 'react-router-dom';
import {
  REALM_LABEL, setLight, setPaper, setRealm, useLight, usePaper, useRealm,
  type Light, type Paper,
} from '@/lib/modes';
import { supabase } from '@/lib/supabase';
import { DEMO } from '@/lib/demo';
import type { RealmScope } from '@/lib/types';

/**
 * How the register looks and which life it shows. All of it is kept on
 * this device; none of it is written to the register.
 */
export function Settings({ email }: { email: string }) {
  const navigate = useNavigate();
  const paper = usePaper();
  const light = useLight();
  const realm = useRealm();

  return (
    <section className="settings" aria-labelledby="settings-head">
      <header className="pagehead">
        <h1 id="settings-head">Settings</h1>
      </header>

      <div className="settings__grid">
        <Choice<Paper>
          legend="Paper"
          name="paper"
          value={paper}
          onChange={setPaper}
          options={[
            ['ledger', 'Ledger', 'White page, black ink. The quickest to scan.'],
            ['notebook', 'Notebook', 'Ruled paper, blue-black ink, a red margin.'],
          ]}
        />
        <Choice<Light>
          legend="Light"
          name="light"
          value={light}
          onChange={setLight}
          options={[
            ['system', 'Follow this device', 'Dark when your laptop or phone is.'],
            ['light', 'Always light', ''],
            ['dark', 'Always dark', ''],
          ]}
        />
        <Choice<RealmScope>
          legend="Which life"
          name="realm"
          value={realm}
          onChange={setRealm}
          options={[
            ['all', REALM_LABEL.all, 'Work and personal together.'],
            ['work', REALM_LABEL.work, 'The personal projects are not there at all.'],
            ['personal', REALM_LABEL.personal, 'The work projects are not there at all.'],
          ]}
        />
        <fieldset className="choice">
          <legend className="label">Projects</legend>
          <p className="choice__hint">Add, rename, reorder, merge and delete projects and their sub-focuses.</p>
          <Link to="/projects/organise" className="btn btn--ghost">Organise projects</Link>
        </fieldset>
        <fieldset className="choice">
          <legend className="label">Account</legend>
          <p className="settings__email">{email}</p>
          {!DEMO && (
            <button
              className="btn btn--ghost settings__out"
              onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
            >
              Sign out
            </button>
          )}
        </fieldset>
      </div>
    </section>
  );
}

function Choice<T extends string>({
  legend, name, value, onChange, options,
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string, string][];
}) {
  return (
    <fieldset className="choice">
      <legend className="label">{legend}</legend>
      {options.map(([v, label, sub]) => (
        <label key={v} className="choice__opt">
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
          <span>
            <b>{label}</b>
            {sub && <span className="choice__sub">{sub}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
