import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Palette, Sun, Moon, Check } from 'lucide-react';
import { useTheme, THEME_COLORS } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const ThemeSwitcher: React.FC = () => {
  const { color, mode, setColor, setMode } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Theme">
          <Palette className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-2 text-muted-foreground">Color Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_COLORS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setColor(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all hover:scale-105",
                    color === t.value ? "border-foreground" : "border-transparent hover:border-border"
                  )}
                  title={t.label}
                >
                  <span
                    className="relative h-7 w-7 rounded-full shadow-sm"
                    style={{ backgroundColor: t.swatch }}
                  >
                    {color === t.value && (
                      <Check className="absolute inset-0 m-auto h-4 w-4 text-white" strokeWidth={3} />
                    )}
                  </span>
                  <span className="text-[10px] font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-semibold mb-2 text-muted-foreground">Background</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={mode === 'light' ? 'default' : 'outline'}
                onClick={() => setMode('light')}
                className="gap-1.5"
              >
                <Sun className="h-3.5 w-3.5" /> Light
              </Button>
              <Button
                size="sm"
                variant={mode === 'dark' ? 'default' : 'outline'}
                onClick={() => setMode('dark')}
                className="gap-1.5"
              >
                <Moon className="h-3.5 w-3.5" /> Dark
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ThemeSwitcher;
