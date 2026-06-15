import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiveData, ExposureSuit } from "./parseData";
import {
  defaultGroupingConfig,
  processData,
  type GroupingConfig,
  type Tag,
} from "./grouping";
import {
  activeDives,
  archiveDives,
  diveDataFromStore,
  loadStore,
  mergeUddfIntoStore,
  saveStore,
  setDiveDisciplines,
  setDiveExposureSuits,
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
  const [activeSidebarDive, setActiveSidebarDive] = useState<number | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStore().then((loaded) => {
      setStore(loaded);
      setTags(tagsFromStored(loaded.tags, activeDives(loaded)));
      setGroupingConfig(defaultGroupingConfig());
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
        tags: tagsToStored(newTags, activeDives(prev)),
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

  const handleArchiveDive = useCallback((index: number) => {
    setStore((prev) => {
      if (!prev) return prev;
      const updated = archiveDives(prev, [index]);
      saveStore(updated);
      setTags(tagsFromStored(updated.tags, activeDives(updated)));
      return updated;
    });
    setActiveSidebarDive(null);
    setHiddenDives(new Set());
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      const texts = await Promise.all(files.map((f) => f.text()));

      setStore((prev) => {
        if (!prev) return prev;
        let current = prev;
        let totalAdded = 0;
        for (const text of texts) {
          const { store: merged, added } = mergeUddfIntoStore(current, text);
          current = merged;
          totalAdded += added;
        }
        saveStore(current);
        setTags(tagsFromStored(current.tags, activeDives(current)));
        setImportMessage(
          totalAdded > 0
            ? `Imported ${totalAdded} new dive${totalAdded === 1 ? "" : "s"}`
            : "No new dives found in file(s)",
        );
        setTimeout(() => setImportMessage(null), 4000);
        return current;
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
        datetimes: [],
        diveNumbers: [],
        seriesData: [],
        disciplines: [],
        weights: [],
        exposureSuits: [],
      };
    }
    return sliceDiveData(data, visibleIndices);
  }, [data, visibleIndices]);

  const processed = useMemo(
    () =>
      groupingConfig
        ? processData(filteredData, groupingConfig)
        : { chartMode: "line" as const, series: [] },
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
            accept=".uddf"
            multiple
            hidden
            onChange={handleFileSelected}
          />
        </div>
      </header>
      <GroupingControls
        config={groupingConfig}
        filters={diveFilters}
        availableDisciplines={filterOptions?.disciplines ?? []}
        onChange={setGroupingConfig}
        onFiltersChange={setDiveFilters}
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
          groupingConfig={groupingConfig}
          seriesNames={data.seriesNames}
          diveNumbers={data.diveNumbers}
          seriesData={data.seriesData}
          disciplines={data.disciplines}
          weights={data.weights}
          exposureSuits={data.exposureSuits}
          hiddenDives={hiddenDives}
          activeDiveIndex={activeSidebarDive}
          onDiveActivate={setActiveSidebarDive}
          onToggleVisibility={toggleVisibility}
          tags={tags}
          onTagsChange={handleTagsChange}
          onDisciplinesAssign={handleDisciplinesAssign}
          onWeightAssign={handleWeightAssign}
          onExposureSuitAssign={handleExposureSuitAssign}
          onArchiveDive={handleArchiveDive}
          diveFilters={diveFilters}
        />
        <main className="app-main">
          {processed.series.length > 0 ? (
            <Chart2D
              groupingConfig={groupingConfig}
              processed={processed}
              visibleIndices={visibleIndices}
              activeDiveIndex={activeSidebarDive}
              onActiveDiveChange={setActiveSidebarDive}
            />
          ) : (
            <div className="chart-empty">
              No dives to display. Import .uddf files to get started.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
