import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { IssueCard } from '@/components/issues/IssueCard';
import type { Issue } from '@/types';

export function BoardCard({ issue }: { issue: Issue }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id, data: { issue } });
  return (
    <motion.div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: isDragging ? 0.45 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, y: 8 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      whileDrag={{ scale: 1.05, rotate: 1.5, boxShadow: '0 26px 60px rgba(15,23,42,0.25)' }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={isDragging ? 'z-50 cursor-grabbing' : 'cursor-grab'}
    >
      <IssueCard issue={issue} />
    </motion.div>
  );
}

export function BoardCardPreview({ issue }: { issue: Issue }) {
  return (
    <motion.div
      initial={{ scale: 0.96, rotate: -1 }}
      animate={{ scale: 1.04, rotate: 1.5 }}
      className="w-80 cursor-grabbing"
      style={{ boxShadow: '0 28px 70px rgba(15,23,42,0.28)' }}
    >
      <IssueCard issue={issue} preview />
    </motion.div>
  );
}

