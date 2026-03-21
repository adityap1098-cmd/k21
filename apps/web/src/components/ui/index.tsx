import { clsx } from 'clsx'

/* ─── Button ─── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-brand text-white hover:bg-brand-hover shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.1)]',
  secondary: 'bg-surface-raised text-ink-secondary border border-border hover:bg-surface-subtle',
  ghost:     'text-ink-secondary hover:bg-surface-subtle',
  danger:    'bg-danger text-white hover:bg-red-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-[13px] gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
}

export function Button({ variant = 'primary', size = 'md', icon, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-semibold rounded-lg press-scale',
        'transition-colors duration-150',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

/* ─── Badge ─── */

type BadgeColor = 'brand' | 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'neutral'

interface BadgeProps {
  color?: BadgeColor
  children: React.ReactNode
  className?: string
}

const badgeColors: Record<BadgeColor, string> = {
  brand:   'bg-brand-muted text-brand',
  green:   'bg-success-muted text-success',
  red:     'bg-danger-muted text-danger',
  amber:   'bg-warning-muted text-warning',
  blue:    'bg-info-muted text-info',
  purple:  'bg-purple-muted text-purple',
  neutral: 'bg-[rgba(122,132,144,0.1)] text-ink-muted',
}

export function Badge({ color = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-medium',
      badgeColors[color],
      className,
    )}>
      {children}
    </span>
  )
}

/* ─── Card ─── */

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={clsx(
      'bg-surface-raised border border-border rounded-xl',
      'shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
      padding && 'p-5',
      className,
    )}>
      {children}
    </div>
  )
}

/* ─── MetricCard ─── */

interface MetricCardProps {
  label: string
  value: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  labelColor?: string
  valueColor?: string
  className?: string
}

export function MetricCard({
  label, value, subtitle, trend, labelColor, valueColor, className,
}: MetricCardProps) {
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-ink-muted'
  return (
    <Card className={clsx('flex flex-col gap-2', className)}>
      <span className={clsx(
        'text-xs font-medium uppercase tracking-wider',
        labelColor || 'text-ink-muted',
      )}>
        {label}
      </span>
      <span className={clsx(
        'text-[28px] font-bold leading-[34px] tabular-nums',
        valueColor || 'text-ink',
      )}>
        {value}
      </span>
      {subtitle && (
        <span className={clsx('text-xs', trendColor)}>
          {subtitle}
        </span>
      )}
    </Card>
  )
}

/* ─── Input ─── */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: React.ReactNode
}

export function Input({ label, icon, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-ink">{label}</label>
      )}
      <div className={clsx(
        'flex items-center gap-2.5 px-3.5 py-2.5',
        'bg-surface-raised border border-border rounded-lg',
        'transition-colors duration-150',
        'focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-subtle',
        className,
      )}>
        {icon && <span className="text-ink-faint flex-shrink-0">{icon}</span>}
        <input
          className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint outline-none"
          {...props}
        />
      </div>
    </div>
  )
}

/* ─── Select ─── */

interface SelectOption { label: string; value: string }
interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  label?: string
  className?: string
}

export function Select({ options, value, onChange, label, className }: SelectProps) {
  return (
    <div className={clsx('flex items-center gap-1.5', className)}>
      {label && <span className="text-[13px] font-medium text-ink-secondary">{label}</span>}
      <select
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className={clsx(
          'px-3.5 py-2.5 rounded-lg border border-border bg-surface-raised',
          'text-[13px] font-medium text-ink-secondary',
          'appearance-none cursor-pointer outline-none',
          'focus:border-brand focus:ring-2 focus:ring-brand-subtle',
          'bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMyA1TDYgOEw5IDUiIHN0cm9rZT0iIzVBNjI3MCIgc3Ryb2tlLXdpZHRoPSIxLjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==")] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8',
        )}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

/* ─── PageHeader ─── */

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl sm:text-[22px] font-bold text-ink leading-7">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-ink-muted leading-[18px]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  )
}

/* ─── EmptyState ─── */

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="text-xs text-ink-muted max-w-xs text-center">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
