// Project icon set (100 lucide-react icons)
import {
  FolderKanban,
  FileText,
  BookOpen,
  GraduationCap,
  Beaker,
  FlaskConical,
  Microscope,
  Brain,
  Database,
  Code2,
  LineChart,
  BarChart3,
  PieChart,
  Calculator,
  TestTube,
  Atom,
  Dna,
  Stethoscope,
  Pill,
  Leaf,
  Globe,
  MapPin,
  Lightbulb,
  Target,
  Rocket,
  Zap,
  Shield,
  Lock,
  Key,
  Search,
  BookMarked,
  NotebookPen,
  Library,
  PenTool,
  Palette,
  Music,
  Camera,
  Film,
  Gamepad2,
  Monitor,
  Smartphone,
  Wifi,
  Cpu,
  HardDrive,
  Server,
  Cloud,
  GitBranch,
  Terminal,
  Layers,
  Box,
  Archive,
  FileStack,
  FileSpreadsheet,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileCheck,
  FileQuestion,
  FolderOpen,
  FolderPlus,
  FolderLock,
  Briefcase,
  Building2,
  Home,
  Landmark,
  Banknote,
  TrendingUp,
  PiggyBank,
  ShoppingCart,
  Package,
  Truck,
  Plane,
  Car,
  Bike,
  Ship,
  Train,
  Bus,
  Footprints,
  Compass,
  Map,
  Mountain,
  TreePine,
  Sun,
  Moon,
  Star,
  Heart,
  Flag,
  Trophy,
  Medal,
  Gift,
  Sparkles,
  Flame,
  Droplet,
  Wind,
  ThermometerSun,
  Snowflake,
  CloudRain,
  type LucideIcon,
} from "lucide-react"

/** Tên icon hợp lệ (lưu trong DB) */
export type ProjectIconName =
  | "FolderKanban"
  | "FileText"
  | "BookOpen"
  | "GraduationCap"
  | "Beaker"
  | "FlaskConical"
  | "Microscope"
  | "Brain"
  | "Database"
  | "Code2"
  | "LineChart"
  | "BarChart3"
  | "PieChart"
  | "Calculator"
  | "TestTube"
  | "Atom"
  | "Dna"
  | "Stethoscope"
  | "Pill"
  | "Leaf"
  | "Globe"
  | "MapPin"
  | "Lightbulb"
  | "Target"
  | "Rocket"
  | "Zap"
  | "Shield"
  | "Lock"
  | "Key"
  | "Search"
  | "BookMarked"
  | "NotebookPen"
  | "Library"
  | "PenTool"
  | "Palette"
  | "Music"
  | "Camera"
  | "Film"
  | "Gamepad2"
  | "Monitor"
  | "Smartphone"
  | "Wifi"
  | "Cpu"
  | "HardDrive"
  | "Server"
  | "Cloud"
  | "GitBranch"
  | "Terminal"
  | "Layers"
  | "Box"
  | "Archive"
  | "FileStack"
  | "FileSpreadsheet"
  | "FileCode"
  | "FileImage"
  | "FileVideo"
  | "FileAudio"
  | "FileCheck"
  | "FileQuestion"
  | "FolderOpen"
  | "FolderPlus"
  | "FolderLock"
  | "Briefcase"
  | "Building2"
  | "Home"
  | "Landmark"
  | "Banknote"
  | "TrendingUp"
  | "PiggyBank"
  | "ShoppingCart"
  | "Package"
  | "Truck"
  | "Plane"
  | "Car"
  | "Bike"
  | "Ship"
  | "Train"
  | "Bus"
  | "Footprints"
  | "Compass"
  | "Map"
  | "Mountain"
  | "TreePine"
  | "Sun"
  | "Moon"
  | "Star"
  | "Heart"
  | "Flag"
  | "Trophy"
  | "Medal"
  | "Gift"
  | "Sparkles"
  | "Flame"
  | "Droplet"
  | "Wind"
  | "ThermometerSun"
  | "Snowflake"
  | "CloudRain"

const iconMap: Record<ProjectIconName, LucideIcon> = {
  FolderKanban,
  FileText,
  BookOpen,
  GraduationCap,
  Beaker,
  FlaskConical,
  Microscope,
  Brain,
  Database,
  Code2,
  LineChart,
  BarChart3,
  PieChart,
  Calculator,
  TestTube,
  Atom,
  Dna,
  Stethoscope,
  Pill,
  Leaf,
  Globe,
  MapPin,
  Lightbulb,
  Target,
  Rocket,
  Zap,
  Shield,
  Lock,
  Key,
  Search,
  BookMarked,
  NotebookPen,
  Library,
  PenTool,
  Palette,
  Music,
  Camera,
  Film,
  Gamepad2,
  Monitor,
  Smartphone,
  Wifi,
  Cpu,
  HardDrive,
  Server,
  Cloud,
  GitBranch,
  Terminal,
  Layers,
  Box,
  Archive,
  FileStack,
  FileSpreadsheet,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileCheck,
  FileQuestion,
  FolderOpen,
  FolderPlus,
  FolderLock,
  Briefcase,
  Building2,
  Home,
  Landmark,
  Banknote,
  TrendingUp,
  PiggyBank,
  ShoppingCart,
  Package,
  Truck,
  Plane,
  Car,
  Bike,
  Ship,
  Train,
  Bus,
  Footprints,
  Compass,
  Map,
  Mountain,
  TreePine,
  Sun,
  Moon,
  Star,
  Heart,
  Flag,
  Trophy,
  Medal,
  Gift,
  Sparkles,
  Flame,
  Droplet,
  Wind,
  ThermometerSun,
  Snowflake,
  CloudRain,
}

/** Danh sách 100 icon cho picker */
export const PROJECT_ICON_LIST: ProjectIconName[] = Object.keys(iconMap) as ProjectIconName[]

const DEFAULT_ICON: ProjectIconName = "FolderKanban"

/** Lấy component icon theo tên; fallback FolderKanban nếu không hợp lệ */
export function getProjectIcon(name: string | undefined | null): LucideIcon {
  const k = (name?.trim() || DEFAULT_ICON) as ProjectIconName
  return iconMap[k] ?? iconMap[DEFAULT_ICON]
}
