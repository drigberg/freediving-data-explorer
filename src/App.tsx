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
  archiveDivesByDatetime,
  diveDataFromStore,
  loadStore,
  mergeUddfIntoStore,
  saveStore,
  downloadStoreAsJson,
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
import { getDisciplineColor } from "./disciplines";
import { useMediaQuery } from "./useMediaQuery";

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
  const [diveListExpanded, setDiveListExpanded] = useState(false);
  const [showArchivedDives, setShowArchivedDives] = useState(false);
  const [showGroupingAndFiltering, setShowGroupingAndFiltering] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

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

  const listData = useMemo<DiveData | null>(() => {
    if (!store) return null;
    return diveDataFromStore(store, { includeArchived: showArchivedDives });
  }, [showArchivedDives, store]);

  const sidebarData = diveListExpanded ? listData : data;

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

  const handleArchiveDive = useCallback(
    (index: number) => {
      const source = diveListExpanded ? listData : data;
      const datetime = source?.datetimes[index];
      if (!datetime) return;

      setStore((prev) => {
        if (!prev) return prev;
        const updated = archiveDivesByDatetime(prev, [datetime]);
        saveStore(updated);
        setTags(tagsFromStored(updated.tags, activeDives(updated)));
        return updated;
      });
      setActiveSidebarDive(null);
      setHiddenDives(new Set());
    },
    [data, diveListExpanded, listData],
  );

  const handleShowArchivedDivesChange = useCallback(
    (checked: boolean) => {
      const datetime =
        activeSidebarDive != null && sidebarData
          ? sidebarData.datetimes[activeSidebarDive]
          : null;
      setShowArchivedDives(checked);
      if (!store) return;

      const nextData = diveDataFromStore(store, { includeArchived: checked });
      if (datetime) {
        const nextIndex = nextData.datetimes.indexOf(datetime);
        setActiveSidebarDive(nextIndex >= 0 ? nextIndex : null);
      }
      setHiddenDives(new Set());
    },
    [activeSidebarDive, sidebarData, store],
  );

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExportClick = useCallback(() => {
    if (!store) return;
    downloadStoreAsJson(store);
  }, [store]);

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

  const singleDiveChart = useMemo(() => {
    if (!diveListExpanded || activeSidebarDive == null || !listData)
      return null;
    const points = listData.seriesData[activeSidebarDive];
    if (!points?.length) return null;

    const temperatureData = points.flatMap(([time, , temp]) =>
      temp !== undefined ? [[time, temp] as [number, number]] : [],
    );

    return {
      chartMode: "line" as const,
      series: [
        {
          label: listData.seriesNames[activeSidebarDive],
          data: points.map(([t, d]) => [t, d] as [number, number]),
          primaryDiveIndex: 0,
          diveIndices: [0],
          color: getDisciplineColor(listData.disciplines[activeSidebarDive]),
          temperatureData:
            temperatureData.length > 0 ? temperatureData : undefined,
        },
      ],
    };
  }, [activeSidebarDive, diveListExpanded, listData]);

  const handleViewModeChange = useCallback(
    (mode: "overview" | "diveDetails") => {
      if (mode === "overview") {
        setDiveListExpanded(false);
        setShowArchivedDives(false);
        setActiveSidebarDive(null);
        return;
      }

      setDiveListExpanded(true);
      if (activeSidebarDive == null && visibleIndices.length > 0) {
        setActiveSidebarDive(visibleIndices[visibleIndices.length - 1]);
      }
    },
    [activeSidebarDive, visibleIndices],
  );

  const handleSwitchToDiveDetails = useCallback(() => {
    handleViewModeChange("diveDetails");
  }, [handleViewModeChange]);

  if (!store || !data || !listData || !sidebarData || !groupingConfig) {
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
          <button className="import-btn" onClick={handleExportClick}>
            Export data
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
      <div className="view-mode-toggle">
        <div className="segment-buttons">
          <button
            type="button"
            className={!diveListExpanded ? "active" : ""}
            onClick={() => handleViewModeChange("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={diveListExpanded ? "active" : ""}
            onClick={() => handleViewModeChange("diveDetails")}
          >
            Dive Details
          </button>
        </div>
      </div>
      {isMobile && (
        <button
          className="grouping-filter-toggle-btn"
          onClick={() => setShowGroupingAndFiltering((prev) => !prev)}
        >
          {showGroupingAndFiltering
            ? "Hide Grouping and Filtering Options"
            : "Show Grouping and Filtering Options"}
        </button>
      )}
      {!diveListExpanded && (
        <div
          className="grouping-filter-wrapper"
          data-show-options={isMobile && showGroupingAndFiltering}
        >
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
        </div>
      )}
      <div
        className={`app-body${diveListExpanded ? " app-body--dive-list-expanded" : ""}${isMobile && showGroupingAndFiltering ? " app-body--options-shown" : ""}`}
      >
        <Sidebar
          groupingConfig={groupingConfig}
          seriesNames={sidebarData.seriesNames}
          diveNumbers={sidebarData.diveNumbers}
          seriesData={sidebarData.seriesData}
          disciplines={sidebarData.disciplines}
          weights={sidebarData.weights}
          exposureSuits={sidebarData.exposureSuits}
          archived={sidebarData.archived}
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
          diveListExpanded={diveListExpanded}
          onSwitchToDiveDetails={handleSwitchToDiveDetails}
          showArchivedDives={showArchivedDives}
          onShowArchivedDivesChange={handleShowArchivedDivesChange}
        />
        <main className="app-main">
          {diveListExpanded ? (
            singleDiveChart ? (
              <Chart2D
                processed={singleDiveChart}
                visibleIndices={visibleIndices}
                activeDiveIndex={activeSidebarDive}
                variant="single"
              />
            ) : (
              <div className="chart-empty">
                Select a dive to view its profile.
              </div>
            )
          ) : processed.series.length > 0 ? (
            <Chart2D
              groupingConfig={groupingConfig}
              onGroupingConfigChange={setGroupingConfig}
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
