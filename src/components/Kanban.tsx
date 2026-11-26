import { useState, type ReactNode } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { cx } from '../lib/utils';

export interface Column<K extends string> { key: K; label: string; color: string }

function Draggable({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return <div ref={setNodeRef} {...attributes} {...listeners} className={cx('touch-manipulation', isDragging && 'opacity-30')}>{children}</div>;
}

function Lane<K extends string>({ col, count, children }: { col: Column<K>; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div ref={setNodeRef} className={cx('flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl border border-line bg-panel2/40 p-2 transition sm:w-auto sm:max-w-none sm:flex-1', isOver && 'border-[var(--accent)] bg-panel2')}>
      <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
        <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
        <span className="text-sm font-medium">{col.label}</span>
        <span className="text-xs text-faint">{count}</span>
      </div>
      <div className="flex min-h-24 flex-col gap-2">{children}</div>
    </div>
  );
}

/** Drag cards between columns (mouse or long-press on touch). */
export function Kanban<T extends { id: string }, K extends string>({ columns, items, getCol, onMove, renderCard }: {
  columns: Column<K>[]; items: T[]; getCol: (t: T) => K; onMove: (t: T, to: K) => void; renderCard: (t: T) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );
  const [dragging, setDragging] = useState<T | null>(null);
  const end = (e: DragEndEvent) => {
    setDragging(null);
    const t = items.find((i) => i.id === e.active.id);
    if (t && e.over && e.over.id !== getCol(t)) onMove(t, e.over.id as K);
  };
  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(items.find((i) => i.id === e.active.id) ?? null)} onDragEnd={end} onDragCancel={() => setDragging(null)}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
        {columns.map((c) => {
          const list = items.filter((i) => getCol(i) === c.key);
          return (
            <Lane key={c.key} col={c} count={list.length}>
              {list.map((i) => <Draggable key={i.id} id={i.id}>{renderCard(i)}</Draggable>)}
            </Lane>
          );
        })}
      </div>
      <DragOverlay>{dragging ? <div className="rotate-2 shadow-2xl">{renderCard(dragging)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
