import { useCallback, useMemo, useState } from "react";
import { parseDiveData } from "./parseData";
import type { DiveData } from "./parseData";
import {
  defaultGroupingConfig,
  processData,
  type GroupingConfig,
} from "./grouping";
import GroupingControls from "./GroupingControls";
import Sidebar from "./Sidebar";
import Chart2D from "./Chart2D";
import Chart3D from "./Chart3D";

type ViewMode = "2d" | "3d";

export default function App() {
  const data = useMemo(() => parseDiveData(), []);
  const [mode, setMode] = useState<ViewMode>("2d");
  const [hiddenDives, setHiddenDives] = useState<Set<number>>(new Set());
  const [groupingConfig, setGroupingConfig] = useState<GroupingConfig>(() =>
    defaultGroupingConfig(data.seriesNames.length)
  );

  const toggleVisibility = useCallback((index: number) => {
    setHiddenDives((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const filteredData = useMemo<DiveData>(() => {
    const seriesNames: string[] = [];
    const seriesData: [number, number][][] = [];
    for (let i = 0; i < data.seriesNames.length; i++) {
      if (!hiddenDives.has(i)) {
        seriesNames.push(data.seriesNames[i]);
        seriesData.push(data.seriesData[i]);
      }
    }
    return { seriesNames, seriesData };
  }, [data, hiddenDives]);

  const processed = useMemo(
    () => processData(filteredData, groupingConfig),
    [filteredData, groupingConfig]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Freediving Dive Profiles</h1>
        <div className="mode-toggle">
          <button
            className={mode === "2d" ? "active" : ""}
            onClick={() => setMode("2d")}
          >
            2D
          </button>
          <button
            className={mode === "3d" ? "active" : ""}
            onClick={() => setMode("3d")}
          >
            3D
          </button>
        </div>
      </header>
      <GroupingControls
        config={groupingConfig}
        totalSeries={filteredData.seriesNames.length}
        onChange={setGroupingConfig}
      />
      <div className="app-body">
        <Sidebar
          seriesNames={data.seriesNames}
          hiddenDives={hiddenDives}
          onToggleVisibility={toggleVisibility}
        />
        <main className="app-main">
          {mode === "2d" ? (
            <Chart2D processed={processed} />
          ) : (
            <Chart3D processed={processed} />
          )}
        </main>
      </div>
    </div>
  );
}
