import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from './KanbanBoard';
import { ScrumBoard } from './ScrumBoard';
export function BoardPage() { const [view, setView] = useState('kanban'); return <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="kanban">Kanban</TabsTrigger><TabsTrigger value="scrum">Scrum</TabsTrigger></TabsList><TabsContent value="kanban"><KanbanBoard /></TabsContent><TabsContent value="scrum"><ScrumBoard /></TabsContent></Tabs>; }
