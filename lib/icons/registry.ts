/**
 * Mapa de ícones AgendaPix — só lucide-react.
 * Decisão: docs/DESIGN_DECISION.md § Ícones + docs/design-refs/icons/.
 * Preferir <Icon icon={…} /> de @/components/ui/icon para stroke/tamanho.
 */
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  Check,
  ChevronLeft,
  CircleCheck,
  CircleCheckBig,
  CircleX,
  Clock,
  Copy,
  ExternalLink,
  Hourglass,
  IdCard,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  Palette,
  Phone,
  QrCode,
  RefreshCw,
  RotateCcw,
  Scissors,
  Settings,
  ShieldCheck,
  Sun,
  Sunrise,
  Timer,
  TimerOff,
  User,
  Users,
  Wallet,
} from "lucide-react";

export { ICON_SIZE, ICON_STROKE, Icon, createIcon } from "@/components/ui/icon";

/** Passos do fluxo público (+ confirmação). */
export const BOOKING_STEP_ICONS = {
  1: Scissors,
  2: CalendarDays,
  3: User,
  4: QrCode,
  confirmed: CircleCheckBig,
} as const satisfies Record<string, LucideIcon>;

/** Períodos do seletor de horário. */
export const PERIOD_ICONS = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
} as const satisfies Record<"morning" | "afternoon" | "evening", LucideIcon>;

/** Campos do cliente. */
export const CUSTOMER_FIELD_ICONS = {
  name: User,
  whatsapp: MessageCircle,
  phone: Phone,
  cpf: IdCard,
} as const;

/** Cabeçalho do negócio (só se o dado existir). */
/** Avatar do negócio sem logo (não usar iniciais). */
export const BUSINESS_AVATAR_ICON = CalendarCheck;

export const BUSINESS_HEADER_ICONS = {
  location: MapPin,
  phone: Phone,
  whatsapp: MessageCircle,
  secure: ShieldCheck,
} as const;

/** Resumo / meta de serviço. */
export const SUMMARY_ICONS = {
  service: Scissors,
  date: CalendarDays,
  time: Clock,
  price: Banknote,
  duration: Clock,
} as const;

/** Tela Pix. */
export const PIX_ICONS = {
  qr: QrCode,
  copy: Copy,
  copied: Check,
  timer: Timer,
  refresh: RefreshCw,
  loading: Loader2,
  secure: ShieldCheck,
  lock: Lock,
} as const;

export type PixUiStatus = "pending" | "paid" | "expired" | "cancelled";

/** Status de cobrança Pix (ícone + cor; nunca só cor). */
export const PIX_STATUS_ICONS: Record<PixUiStatus, LucideIcon> = {
  pending: Hourglass,
  paid: CircleCheck,
  expired: TimerOff,
  cancelled: CircleX,
};

/** Status de reserva no painel. */
export type BookingStatusValue = "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";

export const BOOKING_STATUS_ICONS: Record<BookingStatusValue, LucideIcon> = {
  confirmed: CircleCheck,
  pending_payment: Hourglass,
  completed: CircleCheckBig,
  cancelled: CircleX,
  expired: TimerOff,
};

/**
 * Nav do painel — só rotas existentes.
 * (layout-dashboard / wallet financeiro não têm seção própria ainda.)
 */
export const DASHBOARD_NAV_ICONS = {
  agenda: CalendarDays,
  services: Scissors,
  customers: Users,
  settings: Settings,
  publicPage: ExternalLink,
  logout: LogOut,
} as const;

/**
 * KPIs existentes na agenda:
 * - agendamentos do período
 * - aguardando sinal (Pix pendente)
 * ValueSlab de sinais usa Wallet no badge quando aplicável.
 */
export const KPI_ICONS = {
  bookings: CalendarCheck,
  pending: Hourglass,
  revenue: Wallet,
} as const;

/** Ações e empty states. */
export const ACTION_ICONS = {
  whatsapp: MessageCircle,
  phone: Phone,
  addToCalendar: CalendarPlus,
  newBooking: RotateCcw,
  emptyBusiness: Building2,
  emptyCustomers: Users,
  emptyServices: Scissors,
  emptyAgenda: CalendarPlus,
  cancelled: CalendarX,
  link: Link2,
  hours: Clock,
  appearance: Palette,
  back: ChevronLeft,
} as const;

/** Confirmação pós-pagamento. */
export const CONFIRMATION_ICONS = {
  success: CircleCheckBig,
  date: CalendarDays,
  time: Clock,
  customer: User,
  whatsapp: MessageCircle,
  addToCalendar: CalendarPlus,
  restart: RotateCcw,
} as const;
