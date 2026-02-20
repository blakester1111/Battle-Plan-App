"use client";

import { AppProvider } from "@/context/AppContext";
import AppShell from "@/components/AppShell";
import { useState, useEffect } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-screen bg-stone-50 dark:bg-stone-950" />;
  }

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
