/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      fontSize: {
        hero: ['var(--font-size-hero)', { lineHeight: '1', fontWeight: '800' }],
        section: ['var(--font-size-section)', { lineHeight: '1.05', fontWeight: '800' }],
        'page-title': ['var(--font-size-page-title)', { lineHeight: '1.15', fontWeight: '700' }],
        'card-title': ['var(--font-size-card-title)', { lineHeight: '1.2', fontWeight: '700' }],
        'body-lg': ['var(--font-size-body-lg)', { lineHeight: '1.55' }],
        body: ['var(--font-size-body)', { lineHeight: '1.55' }],
        'body-sm': ['var(--font-size-body-sm)', { lineHeight: '1.45' }],
        meta: ['var(--font-size-meta)', { lineHeight: '1.35' }],
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
        20: 'var(--space-20)',
        24: 'var(--space-24)',
      },
      colors: {
        bg: {
          default: 'var(--color-bg-default)',
          subtle: 'var(--color-bg-subtle)',
        },
        surface: {
          DEFAULT: 'var(--color-surface-default)',
          muted: 'var(--color-surface-muted)',
        },
        border: {
          DEFAULT: 'oklch(var(--border) / <alpha-value>)',
          subtle: 'var(--color-border-subtle)',
          default: 'var(--color-border-default)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        action: {
          primary: 'var(--color-action-primary)',
          'primary-text': 'var(--color-action-primary-text)',
        },
        link: {
          DEFAULT: 'var(--color-link-default)',
        },
        state: {
          success: 'var(--color-state-success)',
          warning: 'var(--color-state-warning)',
          error: 'var(--color-state-error)',
          info: 'var(--color-state-info)',
        },
        input: 'oklch(var(--input) / <alpha-value>)',
        ring: 'oklch(var(--ring) / <alpha-value>)',
        background: 'oklch(var(--background) / <alpha-value>)',
        foreground: 'oklch(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
          foreground: 'oklch(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
          foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
          foreground: 'oklch(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
          foreground: 'oklch(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
          foreground: 'oklch(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
          foreground: 'oklch(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'oklch(var(--card) / <alpha-value>)',
          foreground: 'oklch(var(--card-foreground) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'oklch(var(--sidebar) / <alpha-value>)',
          foreground: 'oklch(var(--sidebar-foreground) / <alpha-value>)',
          primary: 'oklch(var(--sidebar-primary) / <alpha-value>)',
          'primary-foreground': 'oklch(var(--sidebar-primary-foreground) / <alpha-value>)',
          accent: 'oklch(var(--sidebar-accent) / <alpha-value>)',
          'accent-foreground': 'oklch(var(--sidebar-accent-foreground) / <alpha-value>)',
          border: 'oklch(var(--sidebar-border) / <alpha-value>)',
          ring: 'oklch(var(--sidebar-ring) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'oklch(var(--success) / <alpha-value>)',
          foreground: 'oklch(var(--success-foreground) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'oklch(var(--warning) / <alpha-value>)',
          foreground: 'oklch(var(--warning-foreground) / <alpha-value>)',
        },
        chart: {
          1: 'oklch(var(--chart-1) / <alpha-value>)',
          2: 'oklch(var(--chart-2) / <alpha-value>)',
          3: 'oklch(var(--chart-3) / <alpha-value>)',
          4: 'oklch(var(--chart-4) / <alpha-value>)',
          5: 'oklch(var(--chart-5) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        xs: 'var(--shadow-1)',
        sm: 'var(--shadow-1)',
        md: 'var(--shadow-2)',
        lg: 'var(--shadow-3)',
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
      },
      letterSpacing: {
        tighter: '0',
        tight: '0',
        normal: '0',
      },
      keyframes: {
        wave: {
          '0%': { transform: 'translateX(-20px)' },
          '100%': { transform: 'translateX(20px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(200%)' },
        },
        bubble: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { transform: 'translateY(-14px) scale(1)', opacity: '0' },
        },
      },
      animation: {
        wave: 'wave 1.8s linear infinite',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        bubble: 'bubble 1.6s ease-in infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
