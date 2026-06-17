import { useCallback, useMemo, useState, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  chartSeriesIndexForGlobalDive,
  GroupingConfig,
  type ProcessedData,
} from "./grouping";
import { colorWithAlpha, getSeriesColor, getSeriesColorRgba, getSeriesOpacity } from "./colors";
import { computeVelocitySeries } from "./diveStats";

interface Chart2DProps {
  processed: ProcessedData;
  visibleIndices: number[];
  activeDiveIndex?: number | null;
  onActiveDiveChange?: (globalDiveIndex: number) => void;
  groupingConfig?: GroupingConfig;
  variant?: "default" | "single";
}

type SeriesEventParams = {
  componentType?: string;
  seriesIndex?: number;
  dataIndex?: number;
};

const ACTIVE_LINE_COLOR = "#ffffff";

type SingleDiveMetric = "depth" | "speed";

export default function Chart2D({
  processed,
  visibleIndices,
  activeDiveIndex,
  onActiveDiveChange,
  groupingConfig,
  variant = "default",
}: Chart2DProps) {
  const { series, chartMode, aggregationMetric } = processed;
  const isSingleDive = variant === "single";
  const isBarChart = chartMode === "bar";
  const [activeIndex, setActiveIndex] = useState(series.length - 1);
  const [hoveringLine, setHoveringLine] = useState(false);
  const [singleDiveMetric, setSingleDiveMetric] =
    useState<SingleDiveMetric>("depth");

  useEffect(() => {
    setActiveIndex(series.length - 1);
  }, [series.length]);

  useEffect(() => {
    if (activeDiveIndex == null) return;
    const seriesIndex = chartSeriesIndexForGlobalDive(
      series,
      visibleIndices,
      activeDiveIndex,
    );
    if (seriesIndex != null) setActiveIndex(seriesIndex);
  }, [activeDiveIndex, series, visibleIndices]);

  const clampedActive = Math.min(activeIndex, series.length - 1);

  const notifyActiveDive = useCallback(
    (seriesIndex: number) => {
      const primary = series[seriesIndex]?.primaryDiveIndex;
      if (primary == null || !onActiveDiveChange) return;
      const globalIndex = visibleIndices[primary];
      if (globalIndex != null) onActiveDiveChange(globalIndex);
    },
    [series, visibleIndices, onActiveDiveChange],
  );

  const resolveSeriesIndex = useCallback(
    (params: SeriesEventParams) => {
      if (params.componentType !== "series") return null;
      if (isBarChart && params.dataIndex != null) return params.dataIndex;
      if (!isBarChart && params.seriesIndex != null) return params.seriesIndex;
      return null;
    },
    [isBarChart],
  );

  const handleSeriesClick = useCallback(
    (params: SeriesEventParams) => {
      const seriesIndex = resolveSeriesIndex(params);
      if (seriesIndex == null) return;
      setActiveIndex(seriesIndex);
      notifyActiveDive(seriesIndex);
    },
    [notifyActiveDive, resolveSeriesIndex],
  );

  const handleSeriesMouseOver = useCallback(
    (params: SeriesEventParams) => {
      if (resolveSeriesIndex(params) != null) setHoveringLine(true);
    },
    [resolveSeriesIndex],
  );

  const handleSeriesMouseOut = useCallback(() => {
    setHoveringLine(false);
  }, []);

  const chartEvents = useMemo(
    () => ({
      click: handleSeriesClick,
      mouseover: handleSeriesMouseOver,
      mouseout: handleSeriesMouseOut,
      globalout: handleSeriesMouseOut,
    }),
    [handleSeriesClick, handleSeriesMouseOver, handleSeriesMouseOut],
  );

  const option = useMemo<EChartsOption>(() => {
    const total = series.length;

    const resolveColor = (i: number) =>
      series[i].color ?? getSeriesColor(i, total);

    const resolveShadowColor = (i: number, alpha = 0.25) => {
      const color = series[i].color;
      return color
        ? colorWithAlpha(color, alpha)
        : getSeriesColorRgba(i, total, alpha);
    };

    if (isSingleDive) {
      const color = resolveColor(0);
      const shadowColor = resolveShadowColor(0);
      const depthData = series[0]?.data ?? [];
      const showSpeed = singleDiveMetric === "speed";
      const primaryData = showSpeed
        ? computeVelocitySeries(depthData)
        : depthData;

      return {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(13, 17, 23, 0.9)",
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderWidth: 1,
          textStyle: { color: "#e6edf3", fontSize: 12 },
          valueFormatter: (value) => {
            if (typeof value !== "number") return String(value ?? "");
            return showSpeed
              ? `${value.toFixed(2)} m/s`
              : `${Math.abs(value).toFixed(1)} m`;
          },
        },
        grid: {
          left: 52,
          right: 16,
          top: 44,
          bottom: 36,
        },
        xAxis: {
          type: "value",
          axisLine: { lineStyle: { color: "#30363d" } },
          axisLabel: { color: "#8b949e" },
          splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.4)" } },
        },
        yAxis: {
          type: "value",
          axisLine: { lineStyle: { color: "#30363d" } },
          axisLabel: {
            color: "#8b949e",
            formatter: showSpeed
              ? (value: number) => `${value.toFixed(1)}`
              : undefined,
          },
          splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.4)" } },
        },
        series: [
          {
            type: "line" as const,
            data: primaryData,
            smooth: !showSpeed,
            showSymbol: false,
            itemStyle: { color },
            lineStyle: {
              width: 2.5,
              color,
              shadowBlur: 12,
              shadowColor,
            },
            ...(showSpeed
              ? {
                  markLine: {
                    silent: true,
                    symbol: "none",
                    lineStyle: {
                      color: "rgba(139, 148, 158, 0.45)",
                      type: "dashed" as const,
                    },
                    data: [{ yAxis: 0 }],
                  },
                }
              : {
                  areaStyle: {
                    color: {
                      type: "linear" as const,
                      x: 0,
                      y: 0,
                      x2: 0,
                      y2: 1,
                      colorStops: [
                        { offset: 0, color: resolveShadowColor(0, 0.2) },
                        { offset: 1, color: resolveShadowColor(0, 0) },
                      ],
                    },
                  },
                }),
          },
        ],
        animation: true,
        animationDuration: 400,
      };
    }

    if (isBarChart) {
      const yAxisName =
        aggregationMetric === "duration"
          ? "Total duration (sec)"
          : "Total distance swum vertically (m)";

      return {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(13, 17, 23, 0.9)",
          borderColor: ACTIVE_LINE_COLOR,
          borderWidth: 1,
          textStyle: { color: "#e6edf3", fontSize: 12 },
          axisPointer: { type: "shadow" },
        },
        grid: {
          left: 60,
          right: 24,
          top: 24,
          bottom: 60,
        },
        xAxis: {
          type: "category",
          data: series.map((s) => s.label),
          name: "Group",
          nameLocation: "middle",
          nameGap: 42,
          nameTextStyle: { color: "#8b949e", fontSize: 13 },
          axisLine: { lineStyle: { color: "#30363d" } },
          axisLabel: {
            color: "#8b949e",
            rotate: series.length > 8 ? 35 : 0,
            interval: 0,
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: "value",
          name: yAxisName,
          nameLocation: "middle",
          nameGap: 48,
          nameTextStyle: { color: "#8b949e", fontSize: 13 },
          axisLine: { lineStyle: { color: "#30363d" } },
          axisLabel: { color: "#8b949e" },
          splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.4)" } },
        },
        series: [
          {
            type: "bar" as const,
            data: series.map((s, i) => {
              const isActive = i === clampedActive;
              const color = resolveColor(i);
              return {
                value: s.aggregationValue ?? 0,
                itemStyle: {
                  color,
                  opacity: isActive
                    ? 1
                    : getSeriesOpacity(i, clampedActive, total),
                  shadowBlur: isActive ? 12 : 0,
                  shadowColor: isActive
                    ? resolveShadowColor(i, 0.45)
                    : undefined,
                },
              };
            }),
            triggerEvent: true,
            barMaxWidth: 48,
          },
        ],
        animation: true,
        animationDuration: 400,
      };
    }

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(13, 17, 23, 0.9)",
        borderColor: ACTIVE_LINE_COLOR,
        borderWidth: 1,
        textStyle: { color: "#e6edf3", fontSize: 12 },
      },
      legend:
        groupingConfig?.groupMode === "none"
          ? undefined
          : {
              data: series.map((s) => s.label),
              textStyle: { color: "#8b949e", fontSize: 11 },
              top: 4,
              type: "scroll",
              pageTextStyle: { color: "#8b949e" },
            },
      grid: {
        left: 60,
        right: 24,
        top: 50,
        bottom: 40,
      },
      xAxis: {
        type: "value",
        name: "Time (sec)",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { color: "#8b949e", fontSize: 13 },
        axisLine: { lineStyle: { color: "#30363d" } },
        axisLabel: { color: "#8b949e" },
        splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.4)" } },
      },
      yAxis: {
        type: "value",
        name: "Depth (m)",
        nameLocation: "middle",
        nameGap: 42,
        nameTextStyle: { color: "#8b949e", fontSize: 13 },
        axisLine: { lineStyle: { color: "#30363d" } },
        axisLabel: { color: "#8b949e" },
        splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.4)" } },
      },
      series: series.map((s, i) => {
        const opacity = getSeriesOpacity(i, clampedActive, total);
        const isActive = i === clampedActive;
        const color = resolveColor(i);
        const shadowColor = resolveShadowColor(i);

        return {
          name: s.label,
          type: "line" as const,
          data: s.data,
          smooth: true,
          showSymbol: false,
          triggerLineEvent: true,
          itemStyle: { color },
          lineStyle: {
            width: isActive ? 3 : 1.5,
            color,
            opacity: isActive ? 1 : opacity,
            shadowBlur: isActive ? 16 : 8,
            shadowColor,
          },
          ...(isActive && {
            areaStyle: {
              color: {
                type: "linear" as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: resolveShadowColor(i, 0.2) },
                  { offset: 1, color: resolveShadowColor(i, 0) },
                ],
              },
            },
          }),
          z: isActive ? 10 : 1,
        };
      }),
      animation: true,
      animationDuration: 400,
    };
  }, [aggregationMetric, clampedActive, groupingConfig?.groupMode, isBarChart, isSingleDive, series, singleDiveMetric]);

  if (isSingleDive) {
    return (
      <div className="chart-container chart-container--single">
        <div className="chart-single-toolbar">
          <div className="segment-buttons chart-metric-toggle">
            <button
              type="button"
              className={singleDiveMetric === "depth" ? "active" : ""}
              onClick={() => setSingleDiveMetric("depth")}
            >
              Depth
            </button>
            <button
              type="button"
              className={singleDiveMetric === "speed" ? "active" : ""}
              onClick={() => setSingleDiveMetric("speed")}
            >
              Speed
            </button>
          </div>
        </div>
        <div className="chart-plot">
          <ReactECharts
            option={option}
            notMerge={true}
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "canvas" }}
            theme="dark"
          />
        </div>
      </div>
    );
  }

  const activeSeries = series[clampedActive];
  const activePoints = activeSeries.data;
  const maxDepth =
    activePoints.length > 0 ? Math.min(...activePoints.map(([, d]) => d)) : 0;
  const duration =
    activePoints.length > 0
      ? activePoints[activePoints.length - 1][0] - activePoints[0][0]
      : 0;
  const aggregationValue = activeSeries.aggregationValue ?? 0;

  const statsText = isBarChart ? (
    <>
      {aggregationMetric === "duration" ? (
        <>
          Total duration: {Math.floor(aggregationValue / 60)}m
          {String(Math.round(aggregationValue % 60)).padStart(2, "0")}s
        </>
      ) : (
        <>Total distance swum: {aggregationValue.toFixed(1)}m</>
      )}
      {" | "}
      Dives: {activeSeries.diveIndices.length}
    </>
  ) : (
    <>
      Maximum depth: {Math.abs(maxDepth).toFixed(1)}m | Duration:{" "}
      {Math.floor(duration / 60)}m{String(duration % 60).padStart(2, "0")}s
    </>
  );

  return (
    <div className="chart-container">
      <div className="slider-container">
        <label className="slider-label">
          Active: <strong>{activeSeries.label}</strong>
          <span className="slider-stats">{statsText}</span>
        </label>
        <input
          type="range"
          min={0}
          max={series.length - 1}
          value={clampedActive}
          onChange={(e) => setActiveIndex(Number(e.target.value))}
          onMouseUp={(e) => notifyActiveDive(Number(e.currentTarget.value))}
          onTouchEnd={(e) => notifyActiveDive(Number(e.currentTarget.value))}
          className="series-slider"
        />
        <div className="slider-endpoints">
          <span>{series[0].label}</span>
          <span>{series[series.length - 1].label}</span>
        </div>
      </div>
      <div
        className={`chart-plot${!isBarChart && hoveringLine ? " chart-plot--hover-line" : ""}`}
      >
        <ReactECharts
          option={option}
          notMerge={true}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
          theme="dark"
          onEvents={chartEvents}
        />
      </div>
    </div>
  );
}
