import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { ECharts, EChartsOption, LineSeriesOption } from "echarts";
import {
  chartSeriesIndexForGlobalDive,
  GroupingConfig,
  type ProcessedData,
  type ChartViewMode,
} from "./grouping";
import {
  colorWithAlpha,
  getSeriesColor,
  getSeriesColorRgba,
  getSeriesOpacity,
} from "./colors";
import { computeVelocitySeries } from "./diveStats";
import type { ProfilePoint } from "./parseData";
import {
  bumpEndGap,
  bumpStartGap,
  canBumpEndRight,
  canBumpStartRight,
  detectDiveRegions,
  detectConsecutiveSurfaceSections,
  buildEditDepthSeriesData,
  extractRegionProfiles,
  regionToggleControl,
  getTrimSplitIssues,
  prepareEditableProfile,
  toggleRegionEnabled,
  type DiveRegion,
} from "./splitDive";
import type { StoredDive } from "./storage";
import { useMediaQuery } from "./useMediaQuery";

interface Chart2DProps {
  processed: ProcessedData;
  visibleIndices: number[];
  activeDiveIndex?: number | null;
  onActiveDiveChange?: (globalDiveIndex: number) => void;
  groupingConfig?: GroupingConfig;
  onGroupingConfigChange?: (config: GroupingConfig) => void;
  variant?: "default" | "single";
  splitEditDive?: StoredDive | null;
  onSplitDiveComplete?: (regionProfiles: ProfilePoint[][]) => void;
}

type SeriesEventParams = {
  componentType?: string;
  componentSubType?: string;
  seriesIndex?: number;
  dataIndex?: number;
  name?: string;
};

type SplitEditState = {
  workingProfile: ProfilePoint[];
  regions: DiveRegion[];
  leadingPadding: boolean;
  trailingPadding: boolean;
  leadingPaddingIndex: number;
  trailingPaddingIndex: number;
};

function createInitialSplitEditState(profile: ProfilePoint[]): SplitEditState {
  const prepared = prepareEditableProfile(profile);
  return {
    workingProfile: prepared.profile,
    regions: detectDiveRegions(prepared.profile),
    leadingPadding: prepared.leadingPadding,
    trailingPadding: prepared.trailingPadding,
    leadingPaddingIndex: prepared.leadingPaddingIndex,
    trailingPaddingIndex: prepared.trailingPaddingIndex,
  };
}

const ACTIVE_LINE_COLOR = "#ffffff";

function formatTooltipNumber(value: unknown): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return String(value ?? "");
  }
  return value.toFixed(1);
}

function formatDepthTooltip(value: unknown): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return String(value ?? "");
  }
  return `${Math.abs(value).toFixed(1)} m`;
}

function formatVelocityTooltip(value: unknown): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return String(value ?? "");
  }
  return `${value.toFixed(1)} m/s`;
}

function formatDurationTooltip(value: unknown): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return String(value ?? "");
  }
  return `${value.toFixed(1)} s`;
}

function formatDistanceTooltip(value: unknown): string {
  return `${formatTooltipNumber(value)} m`;
}

function buildSingleDiveChartOption(
  depthData: [number, number][],
  metric: "depth" | "velocity",
  color: string,
  shadowColor: string,
  isMobile = false,
  compact = false,
  showAxisNames = true,
): EChartsOption {
  const isVelocity = metric === "velocity";
  const primaryData = isVelocity ? computeVelocitySeries(depthData) : depthData;

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(13, 17, 23, 0.9)",
      borderColor: "rgba(255, 255, 255, 0.12)",
      borderWidth: 1,
      textStyle: { color: "#e6edf3", fontSize: compact ? 11 : 12 },
      valueFormatter: (value) =>
        isVelocity ? formatVelocityTooltip(value) : formatDepthTooltip(value),
    },
    grid: {
      left: compact ? (isVelocity ? 52 : 44) : isVelocity ? 68 : 60,
      right: compact ? 8 : 16,
      top: compact ? 12 : 16,
      bottom: compact ? 32 : 40,
    },
    xAxis: {
      type: "value",
      name: showAxisNames ? "Time (sec)" : "",
      nameLocation: "middle",
      nameGap: compact ? 22 : 28,
      nameTextStyle: { color: "#8b949e", fontSize: compact ? 11 : 13 },
      axisLine: { lineStyle: { color: "#30363d" } },
      axisLabel: { color: "#8b949e" },
      splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.4)" } },
    },
    yAxis: {
      type: "value",
      name: showAxisNames ? (isVelocity ? "Velocity (m/s)" : "Depth (m)") : "",
      nameLocation: "middle",
      nameGap: compact ? (isVelocity ? 40 : 34) : isVelocity ? 50 : 42,
      nameTextStyle: { color: "#8b949e", fontSize: compact ? 11 : 13 },
      axisLine: { lineStyle: { color: "#30363d" } },
      axisLabel: { color: "#8b949e" },
      splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.4)" } },
    },
    series: [
      {
        type: "line" as const,
        data: primaryData,
        smooth: true,
        showSymbol: false,
        itemStyle: { color },
        lineStyle: {
          width: isMobile ? 1.5 : 2.5,
          color,
          shadowBlur: 12,
          shadowColor,
        },
        ...(isVelocity
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
                    { offset: 0, color: colorWithAlpha(color, 0.2) },
                    { offset: 1, color: colorWithAlpha(color, 0) },
                  ],
                },
              },
            }),
      },
    ],
    animation: false,
  };
}

const SURFACE_SECTION_GRAY = "rgba(139, 148, 158, 0.25)";
const EDIT_GRAY_DEPTH_LINE = "rgba(139, 148, 158, 0.55)";

type RegionToggleButton = {
  id: string;
  left: number;
  label: "keep" | "discard";
  clickable: boolean;
};

function buildGrayEditDepthLineSeries(
  data: ([number, number] | null)[],
  isMobile: boolean,
): LineSeriesOption[] {
  if (data.length === 0) return [];

  return [
    {
      type: "line",
      data,
      smooth: true,
      showSymbol: false,
      connectNulls: false,
      lineStyle: {
        width: isMobile ? 1.5 : 2.5,
        color: EDIT_GRAY_DEPTH_LINE,
      },
      itemStyle: { color: EDIT_GRAY_DEPTH_LINE },
      z: 3,
    },
  ];
}

function buildSingleDiveDepthEditOption(
  profile: ProfilePoint[],
  regions: DiveRegion[],
  color: string,
  shadowColor: string,
  isMobile = false,
  showAxisNames = true,
): EChartsOption {
  const depthData = profile.map(([time, depth]) => [time, depth] as [number, number]);
  const option = buildSingleDiveChartOption(
    depthData,
    "depth",
    color,
    shadowColor,
    isMobile,
    false,
    showAxisNames,
  );
  const splitData = buildEditDepthSeriesData(profile, regions);
  const surfaceSections = detectConsecutiveSurfaceSections(profile);
  const surfaceMarkAreaData = surfaceSections.map((section) => [
    {
      xAxis: profile[section.startIdx][0],
      itemStyle: { color: SURFACE_SECTION_GRAY },
      silent: true,
    },
    { xAxis: profile[section.endIdx][0] },
  ]);
  const regionMarkAreaData = regions.map((region) => {
    const control = regionToggleControl(region, regions);

    return [
      {
        name: region.id,
        silent: !control.clickable,
        xAxis: profile[region.startIdx][0],
        itemStyle: {
          color: region.enabled
            ? colorWithAlpha(color, 0.22)
            : SURFACE_SECTION_GRAY,
        },
      },
      { xAxis: profile[region.endIdx][0] },
    ];
  });
  const markArea: LineSeriesOption["markArea"] = {
    silent: false,
    label: { show: false },
    data: [...surfaceMarkAreaData, ...regionMarkAreaData] as NonNullable<
      LineSeriesOption["markArea"]
    >["data"],
  };
  const lineWidth = isMobile ? 1.5 : 2.5;
  const seriesList: LineSeriesOption[] = [
    ...buildGrayEditDepthLineSeries(splitData.surface, isMobile),
    ...buildGrayEditDepthLineSeries(splitData.disabled, isMobile),
  ];

  if (splitData.enabled.length > 0) {
    seriesList.push({
      type: "line",
      data: splitData.enabled,
      smooth: true,
      showSymbol: false,
      connectNulls: false,
      lineStyle: {
        width: lineWidth,
        color,
        shadowBlur: 12,
        shadowColor,
      },
      itemStyle: { color },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: colorWithAlpha(color, 0.2) },
            { offset: 1, color: colorWithAlpha(color, 0) },
          ],
        },
      },
      markArea,
      z: 1,
    });
  } else if (seriesList[0]) {
    seriesList[0] = { ...seriesList[0], markArea };
  }

  return {
    ...option,
    series: seriesList,
  };
}

export default function Chart2D({
  processed,
  visibleIndices,
  activeDiveIndex,
  onActiveDiveChange,
  groupingConfig,
  onGroupingConfigChange,
  variant = "default",
  splitEditDive = null,
  onSplitDiveComplete,
}: Chart2DProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const mobileLineWidthActive = isMobile ? 2 : 3;
  const mobileLineWidthInactive = isMobile ? 1 : 1.5;
  const {
    series,
    chartMode,
    aggregationMetric,
    timelineMetric,
    timelineCategories,
  } = processed;
  const isSingleDive = variant === "single";
  const isBarChart = chartMode === "bar";
  const isTimeline = chartMode === "timeline";
  const viewMode = groupingConfig?.viewMode ?? "diveProfile";
  const [activeIndex, setActiveIndex] = useState(series.length - 1);
  const [hoveringLine, setHoveringLine] = useState(false);
  const [splitEditing, setSplitEditing] = useState(false);
  const [splitEditState, setSplitEditState] = useState<SplitEditState | null>(
    null,
  );
  const depthChartRef = useRef<ReactECharts>(null);
  const [regionToggleButtons, setRegionToggleButtons] = useState<
    RegionToggleButton[]
  >([]);

  useEffect(() => {
    setSplitEditing(false);
    setSplitEditState(null);
    setRegionToggleButtons([]);
  }, [splitEditDive?.datetime]);

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

  const handleViewModeChange = useCallback(
    (nextViewMode: ChartViewMode) => {
      if (!groupingConfig || !onGroupingConfigChange) return;
      onGroupingConfigChange({
        ...groupingConfig,
        viewMode: nextViewMode,
        aggregationMode: "none",
        ...(nextViewMode === "timeline" &&
        groupingConfig.groupMode === "dateInterval"
          ? { groupMode: "none" }
          : {}),
      });
    },
    [groupingConfig, onGroupingConfigChange],
  );

  const trimSplitIssues = useMemo(
    () =>
      splitEditDive != null ? getTrimSplitIssues(splitEditDive.profile) : [],
    [splitEditDive],
  );

  const showTrimSplitToolbar =
    splitEditing || trimSplitIssues.length > 0;

  const handleStartTrimSplit = useCallback(() => {
    if (!splitEditDive) return;
    setSplitEditState(createInitialSplitEditState(splitEditDive.profile));
    setSplitEditing(true);
  }, [splitEditDive]);

  const handleCancelTrimSplit = useCallback(() => {
    setSplitEditState(null);
    setSplitEditing(false);
  }, []);

  const handleDoneTrimSplit = useCallback(() => {
    if (!splitEditState || !onSplitDiveComplete) return;
    onSplitDiveComplete(
      extractRegionProfiles(
        splitEditState.workingProfile,
        splitEditState.regions,
      ),
    );
    setSplitEditState(null);
    setSplitEditing(false);
  }, [onSplitDiveComplete, splitEditState]);

  const handleBumpStartLeft = useCallback(() => {
    setSplitEditState((prev) => {
      if (!prev?.leadingPadding) return prev;
      return {
        ...prev,
        workingProfile: bumpStartGap(
          prev.workingProfile,
          1,
          prev.leadingPaddingIndex,
        ),
      };
    });
  }, []);

  const handleBumpStartRight = useCallback(() => {
    setSplitEditState((prev) => {
      if (!prev?.leadingPadding) return prev;
      if (!canBumpStartRight(prev.workingProfile, prev.leadingPaddingIndex)) {
        return prev;
      }
      return {
        ...prev,
        workingProfile: bumpStartGap(
          prev.workingProfile,
          -1,
          prev.leadingPaddingIndex,
        ),
      };
    });
  }, []);

  const handleBumpEndLeft = useCallback(() => {
    setSplitEditState((prev) => {
      if (!prev?.trailingPadding) return prev;
      return {
        ...prev,
        workingProfile: bumpEndGap(
          prev.workingProfile,
          -1,
          prev.trailingPaddingIndex,
        ),
      };
    });
  }, []);

  const handleBumpEndRight = useCallback(() => {
    setSplitEditState((prev) => {
      if (!prev?.trailingPadding) return prev;
      if (!canBumpEndRight(prev.workingProfile, prev.trailingPaddingIndex)) {
        return prev;
      }
      return {
        ...prev,
        workingProfile: bumpEndGap(
          prev.workingProfile,
          1,
          prev.trailingPaddingIndex,
        ),
      };
    });
  }, []);

  const updateRegionToggleButtons = useCallback(() => {
    if (
      !splitEditing ||
      !splitEditState ||
      splitEditState.regions.length <= 1
    ) {
      setRegionToggleButtons([]);
      return;
    }

    const chart = depthChartRef.current?.getEchartsInstance();
    if (!chart) return;

    const profile = splitEditState.workingProfile;
    const buttons = splitEditState.regions.map((region) => {
      const centerTime =
        (profile[region.startIdx][0] + profile[region.endIdx][0]) / 2;
      const pixel = chart.convertToPixel(
        { xAxisIndex: 0, yAxisIndex: 0 },
        [centerTime, 0],
      );
      const control = regionToggleControl(region, splitEditState.regions);

      return {
        id: region.id,
        left: Array.isArray(pixel) ? pixel[0] : 0,
        label: control.label,
        clickable: control.clickable,
      };
    });

    setRegionToggleButtons(buttons);
  }, [splitEditing, splitEditState]);

  useEffect(() => {
    if (!splitEditing) {
      setRegionToggleButtons([]);
      return;
    }

    updateRegionToggleButtons();
    const handleResize = () => updateRegionToggleButtons();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [splitEditing, updateRegionToggleButtons]);

  const handleDepthChartReady = useCallback(
    (chart: ECharts) => {
      chart.on("finished", updateRegionToggleButtons);
      updateRegionToggleButtons();
    },
    [updateRegionToggleButtons],
  );

  const handleRegionToggleClick = useCallback((regionId: string) => {
    setSplitEditState((prev) => {
      if (!prev) return prev;
      const toggled = toggleRegionEnabled(prev.regions, regionId);
      if (!toggled) return prev;
      return { ...prev, regions: toggled };
    });
  }, []);

  const singleDiveCharts = useMemo(() => {
    if (!isSingleDive) return null;

    const color = series[0]?.color ?? getSeriesColor(0, 1);
    const shadowColor = series[0]?.color
      ? colorWithAlpha(series[0].color, 0.25)
      : getSeriesColorRgba(0, 1, 0.25);
    const depthData =
      splitEditing && splitEditState
        ? splitEditState.workingProfile.map(
            ([time, depth]) => [time, depth] as [number, number],
          )
        : (series[0]?.data ?? []);

    return {
      depth:
        splitEditing && splitEditState
          ? buildSingleDiveDepthEditOption(
              splitEditState.workingProfile,
              splitEditState.regions,
              color,
              shadowColor,
              isMobile,
              !isMobile,
            )
          : buildSingleDiveChartOption(
              depthData,
              "depth",
              color,
              shadowColor,
              isMobile,
              false,
              !isMobile,
            ),
      velocity: buildSingleDiveChartOption(
        depthData,
        "velocity",
        color,
        shadowColor,
        isMobile,
        false,
        !isMobile,
      ),
    };
  }, [isMobile, isSingleDive, series, splitEditState, splitEditing]);

  const startGapCanShrink =
    splitEditState != null &&
    canBumpStartRight(
      splitEditState.workingProfile,
      splitEditState.leadingPaddingIndex,
    );
  const endGapCanShrink =
    splitEditState != null &&
    canBumpEndRight(
      splitEditState.workingProfile,
      splitEditState.trailingPaddingIndex,
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
      return {};
    }

    if (isTimeline && timelineCategories) {
      const yAxisName =
        timelineMetric === "duration" ? "Duration (sec)" : "Depth (m)";
      const showLegend =
        groupingConfig?.groupMode !== "none" && series.length > 1;

      return {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(13, 17, 23, 0.9)",
          borderColor: ACTIVE_LINE_COLOR,
          borderWidth: 1,
          textStyle: { color: "#e6edf3", fontSize: 12 },
          valueFormatter: (value) =>
            timelineMetric === "duration"
              ? formatDurationTooltip(value)
              : formatDepthTooltip(value),
        },
        legend: showLegend
          ? {
              data: series.map((s) => s.label),
              textStyle: { color: "#8b949e", fontSize: 11 },
              top: 4,
              type: "scroll",
              pageTextStyle: { color: "#8b949e" },
            }
          : undefined,
        grid: {
          left: isMobile ? 44 : 60,
          right: isMobile ? 8 : 24,
          top: showLegend ? (isMobile ? 44 : 50) : isMobile ? 16 : 24,
          bottom:
            timelineCategories.length > 8
              ? isMobile
                ? 52
                : 60
              : isMobile
                ? 32
                : 40,
        },
        xAxis: {
          type: "category",
          data: timelineCategories,
          name: isMobile ? "" : "Time interval",
          nameLocation: "middle",
          nameGap:
            timelineCategories.length > 8
              ? isMobile
                ? 36
                : 42
              : isMobile
                ? 22
                : 28,
          nameTextStyle: { color: "#8b949e", fontSize: isMobile ? 11 : 13 },
          axisLine: { lineStyle: { color: "#30363d" } },
          axisLabel: {
            color: "#8b949e",
            rotate: timelineCategories.length > 8 ? 35 : 0,
            interval: 0,
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: "value",
          name: isMobile ? "" : yAxisName,
          nameLocation: "middle",
          nameGap: isMobile ? 38 : 48,
          nameTextStyle: { color: "#8b949e", fontSize: isMobile ? 11 : 13 },
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
            data: timelineCategories.map((_, catIdx) => {
              const point = s.data.find(([idx]) => idx === catIdx);
              return point?.[1] ?? null;
            }),
            connectNulls: true,
            smooth: false,
            showSymbol: true,
            symbolSize: isActive ? 8 : 5,
            triggerLineEvent: true,
            itemStyle: { color, opacity: isActive ? 1 : opacity },
            lineStyle: {
              width: isActive ? mobileLineWidthActive : mobileLineWidthInactive,
              color,
              opacity: isActive ? 1 : opacity,
              shadowBlur: isActive ? 16 : 8,
              shadowColor,
            },
            z: isActive ? 10 : 1,
          };
        }),
        animation: false,
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
          valueFormatter: (value) =>
            aggregationMetric === "duration"
              ? formatDurationTooltip(value)
              : formatDistanceTooltip(value),
        },
        grid: {
          left: isMobile ? 44 : 60,
          right: isMobile ? 8 : 24,
          top: isMobile ? 16 : 24,
          bottom: isMobile ? 52 : 60,
        },
        xAxis: {
          type: "category",
          data: series.map((s) => s.label),
          name: isMobile ? "" : "Group",
          nameLocation: "middle",
          nameGap: isMobile ? 36 : 42,
          nameTextStyle: { color: "#8b949e", fontSize: isMobile ? 11 : 13 },
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
          name: isMobile ? "" : yAxisName,
          nameLocation: "middle",
          nameGap: isMobile ? 38 : 48,
          nameTextStyle: { color: "#8b949e", fontSize: isMobile ? 11 : 13 },
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
        animation: false,
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
        valueFormatter: (value) => formatDepthTooltip(value),
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
        left: isMobile ? 44 : 60,
        right: isMobile ? 8 : 24,
        top: isMobile ? 44 : 50,
        bottom: isMobile ? 32 : 40,
      },
      xAxis: {
        type: "value",
        name: isMobile ? "" : "Time (sec)",
        nameLocation: "middle",
        nameGap: isMobile ? 22 : 28,
        nameTextStyle: { color: "#8b949e", fontSize: isMobile ? 11 : 13 },
        axisLine: { lineStyle: { color: "#30363d" } },
        axisLabel: { color: "#8b949e" },
        splitLine: { lineStyle: { color: "rgba(48, 54, 61, 0.4)" } },
      },
      yAxis: {
        type: "value",
        name: isMobile ? "" : "Depth (m)",
        nameLocation: "middle",
        nameGap: isMobile ? 34 : 42,
        nameTextStyle: { color: "#8b949e", fontSize: isMobile ? 11 : 13 },
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
            width: isActive ? mobileLineWidthActive : mobileLineWidthInactive,
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
      animation: false,
    };
  }, [
    aggregationMetric,
    clampedActive,
    groupingConfig?.groupMode,
    isBarChart,
    isMobile,
    isTimeline,
    series,
    timelineCategories,
    timelineMetric,
  ]);

  if (isSingleDive && singleDiveCharts) {
    return (
      <div className="chart-single-stack">
        <div className="chart-container chart-container--single">
          <div className="chart-single-title-row">
            <h3 className="chart-single-header">Depth</h3>
            {showTrimSplitToolbar && (
              <div className="chart-single-toolbar filter-chips">
                {splitEditing ? (
                  <>
                    <button
                      type="button"
                      className="tag-action-btn cancel"
                      onClick={handleCancelTrimSplit}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="tag-action-btn done"
                      onClick={handleDoneTrimSplit}
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="chart-trim-split-btn"
                    onClick={handleStartTrimSplit}
                  >
                    <span className="chart-trim-split-content">
                      Trim/Split
                      <span
                        className="info-icon"
                        aria-label="Detected trim/split issues"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM7 4.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM6.75 7.25a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-4.5Z" />
                        </svg>
                        <span className="info-tooltip" role="tooltip">
                          <span>Detected issues:</span>
                          <ul>
                            {trimSplitIssues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        </span>
                      </span>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
          {splitEditing && splitEditState?.leadingPadding && (
            <div className="chart-padding-controls chart-padding-controls--start">
              <button type="button" onClick={handleBumpStartLeft}>
                ←
              </button>
              <button
                type="button"
                onClick={handleBumpStartRight}
                disabled={!startGapCanShrink}
              >
                →
              </button>
            </div>
          )}
          {splitEditing && splitEditState?.trailingPadding && (
            <div className="chart-padding-controls chart-padding-controls--end">
              <button type="button" onClick={handleBumpEndLeft}>
                ←
              </button>
              <button
                type="button"
                onClick={handleBumpEndRight}
                disabled={!endGapCanShrink}
              >
                →
              </button>
            </div>
          )}
          <div className="chart-depth-edit-frame">
            <div className="chart-plot chart-plot--single chart-plot--depth-edit">
              {splitEditing && regionToggleButtons.length > 0 && (
                <div className="chart-region-toggle-row">
                  {regionToggleButtons.map((button) => (
                    <button
                      key={button.id}
                      type="button"
                      className="chart-region-toggle-btn"
                      style={{ left: `${button.left}px` }}
                      disabled={!button.clickable}
                      onClick={() => handleRegionToggleClick(button.id)}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              )}
              <ReactECharts
                ref={depthChartRef}
                option={singleDiveCharts.depth}
                notMerge={true}
                onChartReady={splitEditing ? handleDepthChartReady : undefined}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "canvas" }}
                theme="dark"
              />
            </div>
          </div>
          {isMobile && (
            <div
              style={{
                textAlign: "center",
                marginTop: "8px",
                fontSize: "12px",
                color: "#8b949e",
              }}
            >
              Depth (m) vs Time (sec)
            </div>
          )}
        </div>
        <div className="chart-container chart-container--single">
          <h3 className="chart-single-header">Velocity</h3>
          <div className="chart-plot chart-plot--single">
            <ReactECharts
              option={singleDiveCharts.velocity}
              notMerge={true}
              style={{ height: "100%", width: "100%" }}
              opts={{ renderer: "canvas" }}
              theme="dark"
            />
          </div>
          {isMobile && (
            <div
              style={{
                textAlign: "center",
                marginTop: "8px",
                fontSize: "12px",
                color: "#8b949e",
              }}
            >
              Velocity (m/s) vs Time (sec)
            </div>
          )}
        </div>
      </div>
    );
  }

  // Build axis label text for mobile display
  const getAxisLabelText = () => {
    if (!isMobile) return "";

    if (isSingleDive) {
      // For single dive, determine which chart type is active based on the variant
      // Since we're in single dive mode, show depth chart axis labels
      return "Depth (m) vs Time (sec)";
    }

    if (isTimeline && timelineMetric) {
      const yAxisName =
        timelineMetric === "duration" ? "Duration (sec)" : "Depth (m)";
      return `${yAxisName} vs Time interval`;
    }

    if (isBarChart && aggregationMetric) {
      const yAxisName =
        aggregationMetric === "duration"
          ? "Total duration (sec)"
          : "Total distance swum vertically (m)";
      return `${yAxisName} vs Group`;
    }

    return "Depth (m) vs Time (sec)";
  };

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
      {groupingConfig && onGroupingConfigChange && (
        <div className="chart-view-toolbar">
          <div className="segment-buttons chart-view-toggle">
            <button
              type="button"
              className={viewMode === "diveProfile" ? "active" : ""}
              onClick={() => handleViewModeChange("diveProfile")}
            >
              Dive profile
            </button>
            <button
              type="button"
              className={viewMode === "timeline" ? "active" : ""}
              onClick={() => handleViewModeChange("timeline")}
            >
              Timeline
            </button>
          </div>
        </div>
      )}
      {!isTimeline && (
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
      )}
      <div
        className={`chart-plot${!isBarChart && !isTimeline && hoveringLine ? " chart-plot--hover-line" : ""}`}
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
      {isMobile && getAxisLabelText() && (
        <div
          style={{
            textAlign: "center",
            marginTop: "8px",
            fontSize: "12px",
            color: "#8b949e",
          }}
        >
          {getAxisLabelText()}
        </div>
      )}
    </div>
  );
}
