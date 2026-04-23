import { useState, useEffect } from "react";
import { PanelLeft, PanelLeftClose, LogOut, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VieLogotype } from "@/components/brand/VieMark";
import {
  VieMenu,
  VieMenuItem,
  VieMenuHeader,
  VieMenuSeparator,
  VieMenuDestructiveDivider,
} from "@/components/vie";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSidebarToggle } from "@/hooks/use-sidebar-toggle";
import { getInitials } from "@/lib/string-utils";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const { toggle: toggleSidebar } = useSidebarToggle();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Ctrl+B / Cmd+B toggles sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar]);

  const openShortcuts = useUIStore((s) => s.openShortcutsModal);

  return (
    <>
      <header
        className={cn(
          "h-(--app-header-height) shrink-0 relative",
          "border-b border-border/40 bg-background/80 backdrop-blur-[12px]",
          "flex items-center px-3 gap-3",
          // Quiet 1px domain underline — see --rule-domain in index.css
          "after:absolute after:inset-x-0 after:-bottom-px after:h-px after:opacity-60",
          "after:[background:var(--rule-domain)]",
        )}
      >
        {/* Left: sidebar toggle + branding */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </Button>
          {!sidebarOpen && <VieLogotype size="md" className="hidden sm:inline-flex" />}
        </div>

        <div className="flex-1" />

        {/* Right: theme + user */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeToggle />

          {isAuthenticated && user && (
            <VieMenu
              align="end"
              className="w-64"
              trigger={
                <Button
                  variant="ghost"
                  size="icon-bare"
                  aria-label={user.name ?? "Profile"}
                  className={cn(
                    "h-10 w-10 rounded-full text-xs font-semibold",
                    "bg-primary/10 text-primary",
                    "hover:bg-primary/15 transition-colors",
                  )}
                >
                  {getInitials(user.name, user.email)}
                </Button>
              }
            >
              <VieMenuHeader>
                <p className="type-eyebrow text-xs text-muted-foreground/80">
                  Signed in as
                </p>
                <p className="text-sm font-semibold truncate mt-0.5">{user.name || "User"}</p>
                {user.email && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </VieMenuHeader>
              <VieMenuSeparator />
              <VieMenuItem
                icon={<Keyboard className="h-4 w-4" />}
                hint="?"
                onSelect={openShortcuts}
              >
                Keyboard shortcuts
              </VieMenuItem>
              <VieMenuDestructiveDivider />
              <VieMenuItem
                icon={<LogOut className="h-4 w-4" />}
                destructive
                onSelect={() => setShowLogoutConfirm(true)}
              >
                Sign out
              </VieMenuItem>
            </VieMenu>
          )}
        </div>
      </header>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be signed out. Your library stays right where you left it — sign back in any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={logout}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
