import { useMemo, useState, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { ProcessedData } from "./grouping";
import {
  getSeriesColor,
  getSeriesColorRgba,
  getSeriesOpacity,
} from "./colors";

interface Chart2DProps {
  processed: ProcessedData;
}

export default function Chart2D({ processed }: Chart2DProps) {
  const { series } = processed;
  const [activeIndex, setActiveIndex] = useState(series.length - 1);

  useEffect(() => {
    setActiveIndex(series.length - 1);
  }, [series.length]);

  const clampedActive = Math.min(activeIndex, series.length - 1);

  const option = useMemo<EChartsOption>(() => {
    const total = series.length;

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(13, 17, 23, 0.9)",
        borderColor: getSeriesColor(clampedActive, total),
        borderWidth: 1,
        textStyle: { color: "#e6edf3", fontSize: 12 },
      },
      legend: {
        data: series.map((s) => s.label),
        textStyle: { color: "#8b949e", fontSize: 11 },
        top: 8,
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
        const color = getSeriesColor(i, total);
        const isActive = i === clampedActive;

        return {
          name: s.label,
          type: "line" as const,
          data: s.data,
          smooth: true,
          showSymbol: false,
          itemStyle: { color },
          lineStyle: {
            width: isActive ? 3 : 1.5,
            color,
            opacity,
            shadowBlur: isActive ? 16 : 8,
            shadowColor: getSeriesColorRgba(i, total, isActive ? 0.6 : 0.25),
          },
          areaStyle: {
            color: {
              type: "linear" as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: getSeriesColorRgba(
                    i,
                    total,
                    isActive ? 0.25 : 0.08 * opacity
                  ),
                },
                { offset: 1, color: getSeriesColorRgba(i, total, 0) },
              ],
            },
          },
          z: isActive ? 10 : 1,
        };
      }),
      animation: true,
      animationDuration: 400,
    };
  }, [clampedActive, series]);

  const activePoints = series[clampedActive].data;
  const maxDepth = activePoints.length > 0
    ? Math.min(...activePoints.map(([, d]) => d))
    : 0;
  const duration = activePoints.length > 0
    ? activePoints[activePoints.length - 1][0] - activePoints[0][0]
    : 0;

  return (
    <div className="chart-container">
      <ReactECharts
        option={option}
        notMerge={true}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        theme="dark"
      />
      <div className="slider-container">
        <label className="slider-label">
          Active: <strong>{series[clampedActive].label}</strong>
          <span className="slider-stats">
            Maximum depth: {maxDepth.toFixed(1)}m | Duration: {Math.floor(duration / 60)}m{String(duration % 60).padStart(2, "0")}s
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={series.length - 1}
          value={clampedActive}
          onChange={(e) => setActiveIndex(Number(e.target.value))}
          className="series-slider"
        />
        <div className="slider-endpoints">
          <span>{series[0].label}</span>
          <span>{series[series.length - 1].label}</span>
        </div>
      </div>
    </div>
  );
}
