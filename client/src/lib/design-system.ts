/**
 * CareerAI Design System
 * A comprehensive guide for consistent UI/UX across the application
 */

export const designSystem = {
  colors: {
    // Primary Colors
    primary: {
      main: '#10B981', // Emerald-500 from Tailwind
      light: '#34D399', // Emerald-400 for hover states
      dark: '#059669', // Emerald-600 for active states
    },
    // Background Colors
    background: {
      main: 'hsl(240, 10%, 3.9%)',
      card: 'hsl(240, 10%, 5.9%)',
      hover: 'hsl(240, 10%, 7.9%)',
    },
    // Text Colors
    text: {
      primary: 'hsl(0, 0%, 98%)',
      secondary: 'hsl(240, 5%, 64.9%)',
      disabled: 'hsl(240, 5%, 44.9%)',
    },
    // Border Colors
    border: {
      default: 'hsl(240, 3.7%, 15.9%)',
      hover: 'hsla(160, 84%, 39%, 0.2)',
    }
  },

  typography: {
    fontFamily: {
      primary: "'Inter', system-ui, sans-serif",
    },
    scale: {
      h1: {
        size: ['2.5rem', '3rem', '3.75rem'], // mobile, tablet, desktop
        weight: '700',
        lineHeight: '1.2',
      },
      h2: {
        size: ['2rem', '2.5rem', '3rem'],
        weight: '600',
        lineHeight: '1.3',
      },
      h3: {
        size: ['1.5rem', '1.75rem', '2rem'],
        weight: '600',
        lineHeight: '1.4',
      },
      body: {
        size: '1rem',
        weight: '400',
        lineHeight: '1.6',
      },
      small: {
        size: '0.875rem',
        weight: '400',
        lineHeight: '1.5',
      },
    },
  },

  spacing: {
    scale: {
      1: '0.25rem', // 4px
      2: '0.5rem',  // 8px
      3: '0.75rem', // 12px
      4: '1rem',    // 16px
      5: '1.25rem', // 20px
      6: '1.5rem',  // 24px
      8: '2rem',    // 32px
      10: '2.5rem', // 40px
      12: '3rem',   // 48px
      16: '4rem',   // 64px
    },
    container: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
  },

  components: {
    buttons: {
      base: {
        padding: '0.5rem 1rem',
        borderRadius: '0.75rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        transition: 'all 0.2s ease-in-out',
      },
      variants: {
        primary: {
          background: 'var(--primary)',
          color: 'white',
          hover: {
            transform: 'scale(1.02)',
            background: 'var(--primary-light)',
          },
        },
        secondary: {
          background: 'transparent',
          border: '2px solid var(--primary)',
          color: 'var(--primary)',
          hover: {
            background: 'rgba(var(--primary), 0.1)',
          },
        },
      },
    },
    cards: {
      base: {
        background: 'var(--background-card)',
        borderRadius: '0.75rem',
        border: '1px solid var(--border)',
        transition: 'all 0.2s ease-in-out',
      },
      hover: {
        border: '1px solid var(--border-hover)',
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
      },
    },
    inputs: {
      base: {
        background: 'var(--background-card)',
        border: '1px solid var(--border)',
        borderRadius: '0.75rem',
        padding: '0.5rem 0.75rem',
        fontSize: '0.875rem',
        transition: 'all 0.2s ease-in-out',
      },
      focus: {
        borderColor: 'var(--primary)',
        boxShadow: '0 0 0 2px rgba(var(--primary), 0.2)',
      },
    },
  },

  animation: {
    transition: {
      default: '0.2s ease-in-out',
      slow: '0.3s ease-in-out',
      fast: '0.1s ease-in-out',
    },
    scale: {
      hover: 'scale(1.02)',
      active: 'scale(0.98)',
    },
  },

  icons: {
    // Using Lucide React icons for consistency
    size: {
      small: '1rem',
      medium: '1.5rem',
      large: '2rem',
    },
    stroke: {
      width: 2,
    },
  },
} as const;

/**
 * Usage Examples:
 * 
 * // Button
 * <Button className="bg-primary hover:bg-primary-light">
 *   Click Me
 * </Button>
 * 
 * // Card
 * <Card className="bg-background-card hover:border-primary/20">
 *   Content
 * </Card>
 * 
 * // Typography
 * <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold">
 *   Heading
 * </h1>
 */