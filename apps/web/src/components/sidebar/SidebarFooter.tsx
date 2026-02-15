import { useState } from "react";
import { Film, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useAuthStore } from "@/stores/auth-store";
import { useAllVideos } from "@/hooks/use-videos";

export function SidebarFooter() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const { data: videosData } = useAllVideos();
  const totalVideos = videosData?.videos?.length ?? 0;
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/50 text-xs text-muted-foreground shrink-0">
        {/* Video count */}
        <div className="flex items-center gap-1.5">
          <Film className="h-3 w-3 shrink-0" />
          <span>
            {totalVideos} video{totalVideos !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Theme + User profile */}
        <div className="flex items-center gap-0.5">
          <ThemeToggle />

          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-48">
                <div className="px-2 py-1.5 text-sm font-medium border-b border-border/50 mb-1">
                  {user?.name || "User"}
                </div>
                <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be signed out of your account.
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
