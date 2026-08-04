import { PageSkeleton } from '@/components/ui/skeleton';
/* Shaped like the page it stands in for, so nothing jumps when the real
   content arrives. A spinner tells you to wait; this tells you what for. */
export default function Loading() { return <PageSkeleton stats={5} rows={6} />; }
