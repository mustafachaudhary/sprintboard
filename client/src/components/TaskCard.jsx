import { CalendarDays, MessageSquare } from 'lucide-react';
import { describeDeadline } from '../utils/format';
import { PriorityBadge } from './Badges';

/**
 * One draggable task card on the Kanban board.
 *
 * Drag & drop: the card is a native HTML5 draggable element. On dragstart we
 * stash the task id in the drag event (dataTransfer) — the column the card is
 * dropped on reads it and tells the board to move the task. It is also a
 * <button> so keyboard users can open the task detail with Enter/Space, and
 * the detail drawer contains a status dropdown as a non-drag alternative.
 */
export default function TaskCard({ task, isDragging, onDragStart, onDragEnd, onOpen }) {
  const due = describeDeadline(task.deadline, task.status);

  return (
    <button
      type="button"
      className={`task-card${isDragging ? ' task-card--dragging' : ''}`}
      draggable
      onDragStart={(event) => {
        // Store the task id; "text/plain" is the most compatible type.
        event.dataTransfer.setData('text/plain', String(task.id));
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      aria-label={`Task: ${task.title}. ${due ? `Deadline: ${due.text}.` : ''} Open for details.`}
      data-task-id={task.id}
    >
      <div className="task-card__title">{task.title}</div>
      <div className="task-card__badges">
        <PriorityBadge priority={task.priority} />
        {due && (
          <span className={`due-chip${due.overdue ? ' due-chip--overdue' : ''}`}>
            <CalendarDays size={12} />
            {due.text}
          </span>
        )}
      </div>
      <div className="task-card__footer">
        <span className="spacer" />
        {task.commentCount > 0 && (
          <span className="task-card__comments">
            <MessageSquare size={13} />
            {task.commentCount}
          </span>
        )}
      </div>
    </button>
  );
}
