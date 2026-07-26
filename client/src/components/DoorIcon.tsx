import {
  Bot,
  BookOpen,
  CheckCheck,
  DoorOpen,
  Drama,
  Eye,
  Glasses,
  GraduationCap,
  HeartHandshake,
  Laptop,
  LineChart,
  ListOrdered,
  type LucideIcon,
  Presentation,
  School,
  Shuffle,
  Users,
  Wrench,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Presentation,
  Laptop,
  BookOpen,
  GraduationCap,
  Wrench,
  Eye,
  HeartHandshake,
  Users,
  School,
  Drama,
  Glasses,
  ListOrdered,
  Bot,
  LineChart,
  CheckCheck,
  Shuffle,
};

export function DoorIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] ?? DoorOpen;
  return <Icon className={className} />;
}
