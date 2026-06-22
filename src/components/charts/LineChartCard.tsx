import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
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

export interface LineChartCardProps<T extends Record<string, unknown>> {
  /** Card heading. */
  title: string;
  /** Optional supporting line under the title. */
  description?: string;
  /** Row data — each object is one point. */
  data: T[];
  /** Key on each row used for the X axis (e.g. "date"). */
  xKey: keyof T & string;
  /** Key on each row plotted as the line (e.g. "e1rm"). */
  dataKey: keyof T & string;
  /** Series label shown in the tooltip. */
  seriesLabel?: string;
  /** Stroke color. Defaults to the brand accent (highlight). */
  color?: string;
  /** Format an X tick (e.g. shorten an ISO date). */
  xTickFormatter?: (value: T[keyof T & string]) => string;
  /** Optional trailing slot in the header (filters, a select). */
  headerAction?: React.ReactNode;
  /** Chart height in px. Default 240. */
  height?: number;
  className?: string;
}

/**
 * Themed line chart in a card. Built on the shadcn chart primitives so colors,
 * grid, and tooltip all read from the design tokens. The default line color is
 * the brand accent — use it for the hero progression (e1rm over time).
 */
export function LineChartCard<T extends Record<string, unknown>>({
  title,
  description,
  data,
  xKey,
  dataKey,
  seriesLabel,
  color = 'var(--color-highlight)',
  xTickFormatter,
  headerAction,
  height = 240,
  className,
}: LineChartCardProps<T>) {
  const config: ChartConfig = {
    [dataKey]: { label: seriesLabel ?? title, color },
  };

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
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
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
            <Line
              type="monotone"
              dataKey={dataKey as string}
              stroke={`var(--color-${dataKey})`}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
