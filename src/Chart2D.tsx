import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { DiveData } from "./parseData";
import {
  getSeriesColor,
  getSeriesColorRgba,
  getSeriesOpacity,
  shortDateLabel,
} from "./colors";

interface Chart2DProps {
  data: DiveData;
}

export default function Chart2D({ data }: Chart2DProps) {
  const { seriesNames, seriesData } = data;
  const [activeIndex, setActiveIndex] = useState(seriesNames.length - 1);

  const option = useMemo<EChartsOption>(() => {
    const total = seriesNames.length;

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(13, 17, 23, 0.9)",
        borderColor: getSeriesColor(activeIndex, total),
        borderWidth: 1,
        textStyle: { color: "#e6edf3", fontSize: 12 },
      },
      legend: {
        data: seriesNames.map((name) => shortDateLabel(name)),
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
      series: seriesNames.map((name, i) => {
        const opacity = getSeriesOpacity(i, activeIndex, total);
        const color = getSeriesColor(i, total);
        const isActive = i === activeIndex;

        return {
          name: shortDateLabel(name),
          type: "line" as const,
          data: seriesData[i],
          smooth: true,
          showSymbol: false,
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
                { offset: 0, color: getSeriesColorRgba(i, total, isActive ? 0.25 : 0.08 * opacity) },
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
  }, [activeIndex, seriesNames, seriesData]);

  return (
    <div className="chart-container">
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        theme="dark"
      />
      <div className="slider-container">
        <label className="slider-label">
          Active: <strong>{shortDateLabel(seriesNames[activeIndex])}</strong>
          <span className="slider-sublabel">
            {seriesNames[activeIndex]}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={seriesNames.length - 1}
          value={activeIndex}
          onChange={(e) => setActiveIndex(Number(e.target.value))}
          className="series-slider"
        />
        <div className="slider-endpoints">
          <span>{shortDateLabel(seriesNames[0])}</span>
          <span>{shortDateLabel(seriesNames[seriesNames.length - 1])}</span>
        </div>
      </div>
    </div>
  );
}
