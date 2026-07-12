import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiveData, ExposureSuit, ProfilePoint } from "./parseData";
import {
  defaultGroupingConfig,
  processData,
  type GroupingConfig,
  type Tag,
} from "./grouping";
import {
  activeDives,
  archiveDivesByDatetime,
  restoreDivesByDatetime,
  addManualDiveToStore,
  diveDataFromStore,
  loadStore,
  saveStore,
  downloadStoreAsJson,
  setDiveDisciplines,
  setDiveExposureSuits,
  setDiveWeights,
  tagsFromStored,
  tagsToStored,
  replaceDiveWithSplits,
  parseStoreFromJson,
  type DiveStore,
  type StoredDive,
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
import { importDiveFiles } from "./importDives";
import { importDataFile } from "./importData";
import ManualDiveDialog from "./ManualDiveDialog";
import { createManualDive, type ManualDiveInput } from "./manualDive";
import { buildSplitDives } from "./splitDive";
import {
  PencilIcon,
  RefreshIcon,
  SaveFileIcon,
  UploadIcon,
} from "./ButtonIcons";

const DEMO_DATA_URL = "/public/assets/freediving-log-analyzer-assets/demo-data.json";

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
  const [showManualDiveDialog, setShowManualDiveDialog] = useState(false);
  const diveLogInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
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

  const handleRestoreDive = useCallback(
    (index: number) => {
      if (!store || !listData) return;
      const datetime = listData.datetimes[index];
      if (!datetime) return;

      const updated = restoreDivesByDatetime(store, [datetime]);
      setStore(updated);
      saveStore(updated);
      setTags(tagsFromStored(updated.tags, activeDives(updated)));
      setShowArchivedDives(false);

      const nextData = diveDataFromStore(updated, { includeArchived: false });
      const nextIndex = nextData.datetimes.indexOf(datetime);
      setActiveSidebarDive(nextIndex >= 0 ? nextIndex : null);
      setHiddenDives(new Set());
    },
    [listData, store],
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

  const handleImportDiveLogsClick = () => {
    diveLogInputRef.current?.click();
  };

  const handleImportDataClick = () => {
    dataInputRef.current?.click();
  };

  const handleExportClick = useCallback(() => {
    if (!store) return;
    downloadStoreAsJson(store);
  }, [store]);

  const handleDiveLogFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0 || !store) return;

      try {
        const { store: merged, added } = await importDiveFiles(store, files);
        setStore(merged);
        saveStore(merged);
        setTags(tagsFromStored(merged.tags, activeDives(merged)));
        setImportMessage(
          added > 0
            ? `Imported ${added} new dive${added === 1 ? "" : "s"}`
            : "No new dives found in file(s)",
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown import error";
        setImportMessage(`Import failed: ${message}`);
      }

      setTimeout(() => setImportMessage(null), 4000);
    },
    [store],
  );

  const handleDataFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      try {
        const imported = await importDataFile(file);
        setStore(imported);
        saveStore(imported);
        setTags(tagsFromStored(imported.tags, activeDives(imported)));
        setHiddenDives(new Set());
        setActiveSidebarDive(null);
        setImportMessage(
          `Imported ${imported.dives.length} dive${imported.dives.length === 1 ? "" : "s"}`,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown import error";
        setImportMessage(`Import failed: ${message}`);
      }

      setTimeout(() => setImportMessage(null), 4000);
    },
    [],
  );

  const handleLoadDemoData = useCallback(async () => {
    try {
      const res = await fetch(DEMO_DATA_URL);
      if (!res.ok) {
        throw new Error(`Failed to load demo data (${res.status})`);
      }
      const imported = parseStoreFromJson(await res.text());
      setStore(imported);
      saveStore(imported);
      setTags(tagsFromStored(imported.tags, activeDives(imported)));
      setHiddenDives(new Set());
      setActiveSidebarDive(null);
      setImportMessage(
        `Loaded ${imported.dives.length} demo dive${imported.dives.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown import error";
      setImportMessage(`Import failed: ${message}`);
    }

    setTimeout(() => setImportMessage(null), 4000);
  }, []);

  const handleManualDiveSubmit = useCallback(
    (input: ManualDiveInput) => {
      if (!store) return;

      try {
        const dive = createManualDive(store, input);
        const { store: merged, added } = addManualDiveToStore(store, dive);
        if (added === 0) {
          setImportMessage("A dive already exists at this date and time");
        } else {
          setStore(merged);
          saveStore(merged);
          setTags(tagsFromStored(merged.tags, activeDives(merged)));
          setImportMessage("Added dive");
          setShowManualDiveDialog(false);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        setImportMessage(`Failed to add dive: ${message}`);
      }

      setTimeout(() => setImportMessage(null), 4000);
    },
    [store],
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

  const activeStoredDive = useMemo((): StoredDive | null => {
    if (!store || activeSidebarDive == null || !listData) return null;
    const datetime = listData.datetimes[activeSidebarDive];
    return store.dives.find((dive) => dive.datetime === datetime) ?? null;
  }, [activeSidebarDive, listData, store]);

  const handleSplitDiveComplete = useCallback(
    (regionProfiles: ProfilePoint[][]) => {
      if (!store || !activeStoredDive) return;

      const newDives = buildSplitDives(
        activeStoredDive,
        regionProfiles,
        store,
      );
      const { store: updated, newDatetimes } = replaceDiveWithSplits(
        store,
        activeStoredDive.datetime,
        newDives,
      );

      setStore(updated);
      saveStore(updated);
      setTags(tagsFromStored(updated.tags, activeDives(updated)));

      const refreshedListData = diveDataFromStore(updated, {
        includeArchived: showArchivedDives,
      });
      const firstNewDatetime = newDatetimes[0];
      if (firstNewDatetime) {
        const newIndex = refreshedListData.datetimes.indexOf(firstNewDatetime);
        if (newIndex >= 0) {
          setActiveSidebarDive(newIndex);
        }
      }

      setImportMessage(
        regionProfiles.length > 1
          ? `Split into ${regionProfiles.length} dives`
          : "Dive trimmed",
      );
      setTimeout(() => setImportMessage(null), 4000);
    },
    [activeStoredDive, showArchivedDives, store],
  );

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
        <h1>Freediving Log Analyzer</h1>
        <div className="header-actions">
          <div className="header-actions-primary">
            {importMessage && (
              <span className="import-message">{importMessage}</span>
            )}
            <button
              className="import-btn"
              onClick={() => setShowManualDiveDialog(true)}
            >
              <span className="import-button-with-icon-content">
                <PencilIcon />
                Manual Entry
              </span>
            </button>
            <button
              className="import-btn import-dive-logs-btn"
              onClick={handleImportDiveLogsClick}
            >
              <span className="import-button-with-icon-content">
                <UploadIcon />
                Import Dive Logs
                <span
                  className="info-icon"
                  aria-label="Supported dive log file types"
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
                    <span>Supported file types:</span>
                    <ul>
                      <li>.uddf (Shearwater, Mares, Cressi)</li>
                      <li>.fit (Garmin, Suunto)</li>
                    </ul>
                  </span>
                </span>
              </span>
            </button>
            <div className="import-export-group">
              <button className="import-btn" onClick={handleImportDataClick}>
                <span className="import-button-with-icon-content">
                  <RefreshIcon />
                  Load From Backup File
                </span>
              </button>
              <button className="import-btn" onClick={handleExportClick}>
                <span className="import-button-with-icon-content">
                <SaveFileIcon />
                Export Backup File
                <span
                  className="info-icon"
                  aria-label="Export data"
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
                    <span>Export data to a JSON file to back it up, in case you need to clear your browser's local storage!</span>
                  </span>
                </span>
                </span>
              </button>
            </div>
          </div>
          {store.dives.length === 0 && (
            <div className="load-demo-btn-row">
              <button
                className="import-btn load-demo-btn"
                onClick={handleLoadDemoData}
              >
                Load Demo Data
              </button>
            </div>
          )}
          <input
            ref={diveLogInputRef}
            type="file"
            accept=".uddf,.fit"
            multiple
            hidden
            onChange={handleDiveLogFileSelected}
          />
          <input
            ref={dataInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleDataFileSelected}
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
          onRestoreDive={handleRestoreDive}
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
                splitEditDive={activeStoredDive}
                onSplitDiveComplete={handleSplitDiveComplete}
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
              No dives to display. Import .uddf or .fit files to get started.
            </div>
          )}
        </main>
      </div>
      {showManualDiveDialog && (
        <ManualDiveDialog
          onSubmit={handleManualDiveSubmit}
          onClose={() => setShowManualDiveDialog(false)}
        />
      )}
    </div>
  );
}
