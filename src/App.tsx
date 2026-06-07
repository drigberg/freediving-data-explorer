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
import {
  defaultDiveFilters,
  filterOptionsFromData,
  sliceDiveData,
  visibleDiveIndices,
  type DiveFilterConfig,
} from "./filters";
import FilterControls from "./FilterControls";
import GroupingControls from "./GroupingControls";
import Sidebar from "./Sidebar";
import Chart2D from "./Chart2D";

export default function App() {
  const [store, setStore] = useState<DiveStore | null>(null);
  const [hiddenDives, setHiddenDives] = useState<Set<number>>(new Set());
  const [tags, setTags] = useState<Tag[]>([]);
  const [groupingConfig, setGroupingConfig] = useState<GroupingConfig | null>(
    null,
  );
  const [diveFilters, setDiveFilters] =
    useState<DiveFilterConfig>(defaultDiveFilters);
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
    [store],
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
    [],
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
    [],
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
    [],
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
    [],
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
            : "No new dives found in file",
        );
        setTimeout(() => setImportMessage(null), 4000);
        return merged;
      });

      e.target.value = "";
    },
    [],
  );

  const filterOptions = useMemo(
    () => (data ? filterOptionsFromData(data) : null),
    [data],
  );

  const visibleIndices = useMemo(() => {
    if (!data) return [];
    return visibleDiveIndices(data, hiddenDives, diveFilters);
  }, [data, hiddenDives, diveFilters]);

  const filteredData = useMemo<DiveData>(() => {
    if (!data) {
      return {
        seriesNames: [],
        seriesData: [],
        disciplines: [],
        weights: [],
        safeties: [],
        exposureSuits: [],
      };
    }
    return sliceDiveData(data, visibleIndices);
  }, [data, visibleIndices]);

  const processed = useMemo(
    () =>
      groupingConfig
        ? processData(filteredData, groupingConfig)
        : { series: [] },
    [filteredData, groupingConfig],
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
        </div>
      </header>
      <GroupingControls
        config={groupingConfig}
        totalSeries={filteredData.seriesNames.length}
        onChange={setGroupingConfig}
      />
      {filterOptions && (
        <FilterControls
          filters={diveFilters}
          options={filterOptions}
          visibleCount={visibleIndices.length}
          totalCount={data.seriesNames.length}
          onChange={setDiveFilters}
        />
      )}
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
          diveFilters={diveFilters}
        />
        <main className="app-main">
          <Chart2D processed={processed} />
        </main>
      </div>
    </div>
  );
}
