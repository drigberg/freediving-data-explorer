import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiveData, ExposureSuit } from "./parseData";
import {
  defaultGroupingConfig,
  processData,
  type GroupingConfig,
  type Tag,
} from "./grouping";
import {
  diveDataFromStore,
  loadStore,
  mergeCsvIntoStore,
  saveStore,
  setDiveDisciplines,
  setDiveExposureSuits,
  setDiveSafeties,
  setDiveWeights,
  tagsFromStored,
  tagsToStored,
  type DiveStore,
} from "./storage";
import GroupingControls from "./GroupingControls";
import Sidebar from "./Sidebar";
import Chart2D from "./Chart2D";
import Chart3D from "./Chart3D";

type ViewMode = "2d" | "3d";

export default function App() {
  const [store, setStore] = useState<DiveStore | null>(null);
  const [mode, setMode] = useState<ViewMode>("2d");
  const [hiddenDives, setHiddenDives] = useState<Set<number>>(new Set());
  const [tags, setTags] = useState<Tag[]>([]);
  const [groupingConfig, setGroupingConfig] = useState<GroupingConfig | null>(
    null
  );
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStore().then((loaded) => {
      setStore(loaded);
      setTags(tagsFromStored(loaded.tags, loaded.dives));
      setGroupingConfig(defaultGroupingConfig(loaded.dives.length));
    });
  }, []);

  const data = useMemo<DiveData | null>(
    () => (store ? diveDataFromStore(store) : null),
    [store]
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

  const handleTagsChange = useCallback((newTags: Tag[]) => {
    setTags(newTags);
    setStore((prev) => {
      if (!prev) return prev;
      const updated: DiveStore = {
        ...prev,
        tags: tagsToStored(newTags, prev.dives),
      };
      saveStore(updated);
      return updated;
    });
  }, []);

  const handleDisciplinesAssign = useCallback(
    (indices: number[], discipline: string) => {
      setStore((prev) => {
        if (!prev) return prev;
        const updated = setDiveDisciplines(prev, indices, discipline);
        saveStore(updated);
        return updated;
      });
    },
    []
  );

  const handleWeightAssign = useCallback(
    (indices: number[], weightKg: number) => {
      setStore((prev) => {
        if (!prev) return prev;
        const updated = setDiveWeights(prev, indices, weightKg);
        saveStore(updated);
        return updated;
      });
    },
    []
  );

  const handleSafetyAssign = useCallback(
    (indices: number[], safety: boolean) => {
      setStore((prev) => {
        if (!prev) return prev;
        const updated = setDiveSafeties(prev, indices, safety);
        saveStore(updated);
        return updated;
      });
    },
    []
  );

  const handleExposureSuitAssign = useCallback(
    (indices: number[], exposureSuit: ExposureSuit) => {
      setStore((prev) => {
        if (!prev) return prev;
        const updated = setDiveExposureSuits(prev, indices, exposureSuit);
        saveStore(updated);
        return updated;
      });
    },
    []
  );

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const text = await file.text();
      setStore((prev) => {
        if (!prev) return prev;
        const { store: merged, added } = mergeCsvIntoStore(prev, text);
        saveStore(merged);
        setTags(tagsFromStored(merged.tags, merged.dives));
        setImportMessage(
          added > 0
            ? `Imported ${added} new dive${added === 1 ? "" : "s"}`
            : "No new dives found in file"
        );
        setTimeout(() => setImportMessage(null), 4000);
        return merged;
      });

      e.target.value = "";
    },
    []
  );

  const { filteredData } = useMemo(() => {
    if (!data) {
      return {
        filteredData: {
          seriesNames: [],
          seriesData: [],
          disciplines: [],
          weights: [],
          safeties: [],
          exposureSuits: [],
        } as DiveData,
      };
    }

    const seriesNames: string[] = [];
    const seriesData: [number, number][][] = [];
    const disciplines: (string | undefined)[] = [];
    const weights: (number | undefined)[] = [];
    const safeties: (boolean | undefined)[] = [];
    const exposureSuits: (ExposureSuit | undefined)[] = [];
    const originalToFiltered = new Map<number, number>();
    for (let i = 0; i < data.seriesNames.length; i++) {
      if (!hiddenDives.has(i)) {
        originalToFiltered.set(i, seriesNames.length);
        seriesNames.push(data.seriesNames[i]);
        seriesData.push(data.seriesData[i]);
        disciplines.push(data.disciplines[i]);
        weights.push(data.weights[i]);
        safeties.push(data.safeties[i]);
        exposureSuits.push(data.exposureSuits[i]);
      }
    }
    return {
      filteredData: {
        seriesNames,
        seriesData,
        disciplines,
        weights,
        safeties,
        exposureSuits,
      } as DiveData,
    };
  }, [data, hiddenDives]);

  const processed = useMemo(
    () =>
      groupingConfig
        ? processData(filteredData, groupingConfig)
        : { series: [] },
    [filteredData, groupingConfig]
  );

  if (!store || !data || !groupingConfig) {
    return <div className="app-loading">Loading dives…</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Freediving Dive Profiles</h1>
        <div className="header-actions">
          {importMessage && (
            <span className="import-message">{importMessage}</span>
          )}
          <button className="import-btn" onClick={handleImportClick}>
            Import dives
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            hidden
            onChange={handleFileSelected}
          />
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
          seriesData={data.seriesData}
          disciplines={data.disciplines}
          weights={data.weights}
          safeties={data.safeties}
          exposureSuits={data.exposureSuits}
          hiddenDives={hiddenDives}
          onToggleVisibility={toggleVisibility}
          tags={tags}
          onTagsChange={handleTagsChange}
          onDisciplinesAssign={handleDisciplinesAssign}
          onWeightAssign={handleWeightAssign}
          onSafetyAssign={handleSafetyAssign}
          onExposureSuitAssign={handleExposureSuitAssign}
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
