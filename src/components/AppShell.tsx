"use client";

import { useAppContext } from "@/context/AppContext";
import Header from "./Header";
import Sidebar from "./Sidebar";
import KanbanBoard from "./kanban/KanbanBoard";
import JuniorBoardView from "./JuniorBoardView";
import InfoTerminalBoardView from "./InfoTerminalBoardView";
import LoginForm from "./LoginForm";
import TaskNotifier from "./TaskNotifier";

export default function AppShell() {
  const { state } = useAppContext();

  // Show loading spinner while checking auth
  if (state.isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-950">
        <div className="text-stone-400">Loading...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!state.user) {
    return <LoginForm />;
  }

  // Determine which board to show
  const isViewingJunior = state.viewingJunior !== null;
  const isViewingInfoTerminal = state.viewingInfoTerminal !== null;

  // Determine which component to render
  function renderBoard() {
    if (isViewingJunior) return <JuniorBoardView />;
    if (isViewingInfoTerminal) return <InfoTerminalBoardView />;
    return <KanbanBoard />;
  }

  // Show main app
  return (
    <div className="h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          {renderBoard()}
        </main>
      </div>
      <TaskNotifier />
    </div>
  );
}
