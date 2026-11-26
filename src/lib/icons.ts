import {
  BookOpen, Brain, Briefcase, Camera, Clapperboard, Code, Dumbbell, Folder, Globe, GraduationCap, Heart,
  Home, Lightbulb, Music, PenLine, Plane, Rocket, Sparkles, Star, Target, Users, Wallet, type LucideIcon,
} from 'lucide-react';

export const BOARD_ICONS: Record<string, LucideIcon> = {
  'graduation-cap': GraduationCap, clapperboard: Clapperboard, brain: Brain, 'pen-line': PenLine, users: Users,
  folder: Folder, briefcase: Briefcase, rocket: Rocket, target: Target, lightbulb: Lightbulb, heart: Heart,
  star: Star, book: BookOpen, dumbbell: Dumbbell, wallet: Wallet, home: Home, music: Music, camera: Camera,
  code: Code, globe: Globe, plane: Plane, sparkles: Sparkles,
};
export const boardIcon = (name: string) => BOARD_ICONS[name] ?? Folder;

export const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#f43f5e', '#ec4899', '#8b5cf6', '#6366f1', '#64748b'];
