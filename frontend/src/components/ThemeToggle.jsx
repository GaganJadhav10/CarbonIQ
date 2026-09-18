import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '../lib/theme-context';

const MODES = {
  system: { Icon: Monitor, label: 'Theme follows your system' },
  light: { Icon: Sun, label: 'Light theme' },
  dark: { Icon: Moon, label: 'Dark theme' },
};

/**
 * Cycles system, light, dark.
 *
 * DESIGN.md §3.1 asks for light only; dark is a deliberate, documented
 * deviation (see docs/design-plan.md). Light remains the default.
 */
export default function ThemeToggle() {
  const { preference, cycle } = useTheme();
  const { Icon, label } = MODES[preference] ?? MODES.system;

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={cycle}
      title={label}
      aria-label={`${label}. Activate to change.`}
    >
      <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}
