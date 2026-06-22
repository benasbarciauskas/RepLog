import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

export interface AreaChartCardProps<T extends Record<string, unknown>> {
  /** Card heading. */
  title: string;
  /** Optional supporting line under the title. */
  description?: string;
  /** Row data — each object is one point. */
  data: T[];
  /** Key on each row used for the X axis (e.g. "date"). */
  xKey: keyof T & string;
  /** Key on each row plotted as the area (e.g. "kg"). */
  dataKey: keyof T & string;
  /** Series label shown in the tooltip. */
  seriesLabel?: string;
  /** Stroke / fill color. Defaults to the brand accent (highlight). */
  color?: string;
  /** Format an X tick (e.g. shorten an ISO date). */
  xTickFormatter?: (value: T[keyof T & string]) => string;
  /** Optional trailing slot in the header. */
  headerAction?: React.ReactNode;
  /** Chart height in px. Default 220. */
  height?: number;
  className?: string;
}

/**
 * Themed gradient-fill area chart in a card. Good for trends where the filled
 * volume reads as "accumulation" (bodyweight over time). Built on the shadcn
 * chart primitives so all colors derive from the design tokens.
 */
export function AreaChartCard<T extends Record<string, unknown>>({
  title,
  description,
  data,
  xKey,
  dataKey,
  seriesLabel,
  color = 'var(--color-highlight)',
  xTickFormatter,
  headerAction,
  height = 220,
  className,
}: AreaChartCardProps<T>) {
  const config: ChartConfig = {
    [dataKey]: { label: seriesLabel ?? title, color },
  };
  const gradientId = `area-fill-${dataKey}`;

  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {headerAction}
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={config}
          className="w-full"
          style={{ height }}
        >
          <AreaChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={`var(--color-${dataKey})`}
                  stopOpacity={0.32}
                />
                <stop
                  offset="100%"
                  stopColor={`var(--color-${dataKey})`}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey={xKey as string}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={24}
              tickFormatter={
                xTickFormatter
                  ? (v) => xTickFormatter(v as T[keyof T & string])
                  : undefined
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tickMargin={6}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={<ChartTooltipContent />}
            />
            <Area
              type="monotone"
              dataKey={dataKey as string}
              stroke={`var(--color-${dataKey})`}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
