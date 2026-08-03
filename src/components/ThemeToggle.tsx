import { useTheme } from "@/hooks/useTheme";
import { useBlur } from "@/hooks/useBlur";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Eye, EyeOff } from "lucide-react";

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const { blurred, toggleBlur } = useBlur();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        title={isDark ? "Цайвар горим руу шилжих" : "Харанхуй горим руу шилжих"}
        className="text-muted-foreground hover:text-foreground"
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleBlur}
        title={blurred ? "Тоон утгуудын буларыг унтраах" : "Тоон утгуудыг буларлах"}
        className="text-muted-foreground hover:text-foreground"
      >
        {blurred ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </Button>
    </div>
  );
}
