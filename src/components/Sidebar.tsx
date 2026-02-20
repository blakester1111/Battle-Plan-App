"use client";

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAppContext } from "@/context/AppContext";
import type { SidebarSectionId } from "@/lib/types";
import { cn } from "@/lib/utils";
import TodoList from "./todo/TodoList";
import NotesArea from "./notes/NotesArea";
import JuniorsList from "./JuniorsList";
import WeeklyBPList from "./WeeklyBPList";
import InfoTerminalsList from "./InfoTerminalsList";

interface SortableSectionProps {
  id: SidebarSectionId;
  children: React.ReactNode;
}

function SortableSection({ id, children }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group/section",
        isDragging && "z-50 opacity-90"
      )}
    >
      {/* Drag handle - left edge, in the margin */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-0.5 top-[17px] p-1 rounded opacity-0 group-hover/section:opacity-100 cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 dark:text-stone-600 dark:hover:text-stone-400 transition-all z-10"
        aria-label="Drag to reorder"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="9" cy="5" r="2.5" />
          <circle cx="9" cy="12" r="2.5" />
          <circle cx="9" cy="19" r="2.5" />
          <circle cx="15" cy="5" r="2.5" />
          <circle cx="15" cy="12" r="2.5" />
          <circle cx="15" cy="19" r="2.5" />
        </svg>
      </button>
      {children}
    </div>
  );
}

// Map section IDs to their components - all wrapped consistently
const SECTION_COMPONENTS: Record<SidebarSectionId, React.ReactNode> = {
  todos: (
    <div className="p-4 border-b border-stone-200 dark:border-stone-800/60">
      <TodoList />
    </div>
  ),
  notes: (
    <div className="p-4 border-b border-stone-200 dark:border-stone-800/60">
      <NotesArea />
    </div>
  ),
  weeklyBPs: (
    <div className="p-4 border-b border-stone-200 dark:border-stone-800/60">
      <WeeklyBPList />
    </div>
  ),
  juniors: (
    <div className="p-4 border-b border-stone-200 dark:border-stone-800/60">
      <JuniorsList />
    </div>
  ),
  infoTerminals: (
    <div className="p-4 border-b border-stone-200 dark:border-stone-800/60">
      <InfoTerminalsList />
    </div>
  ),
};

export default function Sidebar() {
  const { state, dispatch } = useAppContext();

  // Filter out sections that have no content
  const visibleSections = state.sidebarOrder.filter((sectionId) => {
    if (sectionId === "juniors") return state.myJuniors.length > 0;
    if (sectionId === "infoTerminals") return state.viewableAsInfoTerminal.length > 0;
    return true; // todos, notes, weeklyBPs always visible
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = state.sidebarOrder.indexOf(active.id as SidebarSectionId);
        const newIndex = state.sidebarOrder.indexOf(over.id as SidebarSectionId);

        const newOrder = arrayMove(state.sidebarOrder, oldIndex, newIndex);
        dispatch({ type: "SET_SIDEBAR_ORDER", payload: newOrder });
      }
    },
    [state.sidebarOrder, dispatch]
  );

  return (
    <aside
      className={`${
        state.sidebarOpen ? "w-80" : "w-0"
      } transition-all duration-200 overflow-hidden border-r border-stone-200 dark:border-stone-800/60 flex flex-col bg-stone-100/50 dark:bg-stone-900/50 shrink-0`}
    >
      <div className="w-80 h-full overflow-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleSections}
            strategy={verticalListSortingStrategy}
          >
            {visibleSections.map((sectionId) => (
              <SortableSection key={sectionId} id={sectionId}>
                {SECTION_COMPONENTS[sectionId]}
              </SortableSection>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </aside>
  );
}
