import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1400px' } },
    extend: {
      // Single source of truth for stacking order. Every fixed/absolute overlay in
      // Ameya OS uses one of these tokens instead of an ad-hoc z-50, so layers are
      // strictly ordered and can never collide (the "zero overlap" mandate).
      //
      // Key rule: the always-mounted floating chrome (dock, FABs, launcher, banners)
      // lives BELOW the popover layer, so it can never cover an open dialog or menu.
      // Dialogs and dropdowns share the `popover` layer on purpose — they portal to
      // <body> and Radix orders nested ones by DOM order (a Select opened inside a
      // Dialog still renders above it). Coach marks sit above everything interactive.
      //   content < top-bar < dock < drawer < popover(dialogs+menus) < modal < coach < toast < max
      zIndex: {
        sticky: '30',            // desktop top-bar
        dock: '40',              // mobile dock, pull-to-refresh, FABs, launcher, banners
        'drawer-backdrop': '44', // mobile sidebar scrim (over the dock)
        drawer: '45',            // mobile sidebar panel
        popover: '50',           // dialogs, dropdowns, project switcher, quick-create, menus
        modal: '60',             // reserved for feature-level full modals migrating off z-[60]
        coach: '70',             // guided tour, what's-new (above modals)
        toast: '80',             // notifications
        max: '100',              // nav progress bar — always on top
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        // Brand tokens (Ameya Heights)
        brass: {
          DEFAULT: 'hsl(var(--brass))',
          deep: 'hsl(var(--brass-deep))',
          light: 'hsl(var(--brass-light))',
        },
        sand: 'hsl(var(--sand))',
        charcoal: 'hsl(var(--charcoal))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        info: 'hsl(var(--info))',
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      fontFamily: {
        display: ['var(--font-display)', 'Cormorant Garamond', 'serif'],
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        accent: ['var(--font-accent)', 'Unbounded', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
