import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import "echarts-gl";
import type { DiveData } from "./parseData";
import { getSeriesColor, shortDateLabel } from "./colors";

interface Chart3DProps {
  data: DiveData;
}

export default function Chart3D({ data }: Chart3DProps) {
  const { seriesNames, seriesData } = data;

  const option = useMemo(() => {
    const total = seriesNames.length;

    return {
      backgroundColor: "transparent",
      tooltip: {},
      grid3D: {
        viewControl: {
          autoRotate: false,
          distance: 220,
          alpha: 25,
          beta: 40,
        },
        boxWidth: 120,
        boxHeight: 80,
        boxDepth: 100,
        environment: "transparent" as const,
        light: {
          main: { intensity: 0.8, shadow: false },
          ambient: { intensity: 0.5 },
        },
      },
      xAxis3D: {
        type: "value",
        name: "Time (sec)",
        nameTextStyle: { color: "#8b949e", fontSize: 12 },
        axisLine: { lineStyle: { color: "#30363d" } },
        axisLabel: { color: "#8b949e" },
        splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.3)" } },
      },
      yAxis3D: {
        type: "value",
        name: "",
        min: -0.5,
        max: total - 0.5,
        axisLine: { lineStyle: { color: "#30363d" } },
        axisLabel: {
          color: "#8b949e",
          formatter: (value: number) => {
            const idx = Math.round(value);
            if (idx >= 0 && idx < total) return shortDateLabel(seriesNames[idx]);
            return "";
          },
        },
        splitLine: { show: false },
      },
      zAxis3D: {
        type: "value",
        name: "Depth (m)",
        nameTextStyle: { color: "#8b949e", fontSize: 12 },
        axisLine: { lineStyle: { color: "#30363d" } },
        axisLabel: { color: "#8b949e" },
        splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.3)" } },
      },
      series: seriesNames.map((name, i) => {
        const color = getSeriesColor(i, total);
        const points: [number, number, number][] = seriesData[i].map(
          ([time, depth]) => [time, i, depth]
        );

        return {
          name: shortDateLabel(name),
          type: "line3D",
          data: points,
          lineStyle: {
            width: 3,
            color,
            opacity: 1.0,
          },
          animation: true,
          animationDurationUpdate: 500,
        };
      }),
    };
  }, [seriesNames, seriesData]);

  return (
    <div className="chart-container">
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        theme="dark"
      />
      <p className="chart-hint">Drag to rotate, scroll to zoom, right-click to pan</p>
    </div>
  );
}
