import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '../lib/theme-context';

const MODES = {
  system: { Icon: Monitor, label: 'Theme: follows your system' },
  light: { Icon: Sun, label: 'Theme: light' },
  dark: { Icon: Moon, label: 'Theme: dark' },
};

/** Cycles system -> light -> dark. */
export default function ThemeToggle() {
  const { preference, cycle } = useTheme();
  const { Icon, label } = MODES[preference] ?? MODES.system;

  return (
    <button
      type="button"
      className="icon-button"
      onClick={cycle}
      title={label}
      aria-label={`${label}. Activate to change.`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
