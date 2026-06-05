import { useMemo, useState } from "react";
import { parseDiveData } from "./parseData";
import {
  defaultGroupingConfig,
  processData,
  type GroupingConfig,
} from "./grouping";
import GroupingControls from "./GroupingControls";
import Chart2D from "./Chart2D";
import Chart3D from "./Chart3D";

type ViewMode = "2d" | "3d";

export default function App() {
  const data = useMemo(() => parseDiveData(), []);
  const [mode, setMode] = useState<ViewMode>("2d");
  const [groupingConfig, setGroupingConfig] = useState<GroupingConfig>(() =>
    defaultGroupingConfig(data.seriesNames.length)
  );

  const processed = useMemo(
    () => processData(data, groupingConfig),
    [data, groupingConfig]
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
        totalSeries={data.seriesNames.length}
        onChange={setGroupingConfig}
      />
      <main className="app-main">
        {mode === "2d" ? (
          <Chart2D processed={processed} />
        ) : (
          <Chart3D processed={processed} />
        )}
      </main>
    </div>
  );
}
