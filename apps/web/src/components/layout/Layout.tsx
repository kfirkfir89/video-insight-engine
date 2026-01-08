import { useState } from "react";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "@/components/sidebar";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export function Layout({ children, showSidebar = true }: LayoutProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.clientX - startX);
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {showSidebar && sidebarOpen && (
          <>
            <div
              className="shrink-0 h-full"
              style={{ width: sidebarWidth }}
            >
              <Sidebar />
            </div>
            {/* Resize Handle */}
            <div
              className={cn(
                "w-1 bg-border hover:bg-primary/20 cursor-col-resize shrink-0 transition-colors",
                isResizing && "bg-primary/30"
              )}
              onMouseDown={handleMouseDown}
            />
          </>
        )}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
