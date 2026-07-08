import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  FileSpreadsheet, LogIn, RefreshCw, Search, ChevronLeft, ChevronRight, 
  ArrowUpDown, Filter, AlertCircle, Clock
} from "lucide-react";
import { initAuth, googleSignIn, logout } from "../../lib/googleAuth";
import { googleWorkspace, DriveFile, SheetProperties } from "../../lib/googleWorkspace";
import { 
  useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, 
  getFilteredRowModel, flexRender, ColumnDef, SortingState, ColumnFiltersState
} from "@tanstack/react-table";

export default function GoogleSheetReader({ addToast }: { addToast: any }) {
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [spreadsheets, setSpreadsheets] = useState<DriveFile[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState("");
  const [selectedSpreadsheetName, setSelectedSpreadsheetName] = useState("");
  const [worksheets, setWorksheets] = useState<SheetProperties[]>([]);
  const [selectedWorksheetTitle, setSelectedWorksheetTitle] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheetData, setSheetData] = useState<{ headers: string[], rows: any[][] } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        loadSpreadsheets();
      },
      () => {
        setGoogleUser(null);
        setSpreadsheets([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadSpreadsheets = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const files = await googleWorkspace.listSpreadsheets();
      setSpreadsheets(files);
    } catch (err: any) {
      setError(err.message);
      addToast("error", "Failed to load Google Drive", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSpreadsheet = async (spreadsheetId: string) => {
    if (!spreadsheetId) {
      setSelectedSpreadsheetId("");
      setSelectedSpreadsheetName("");
      setWorksheets([]);
      setSelectedWorksheetTitle("");
      setSheetData(null);
      return;
    }
    
    setSelectedSpreadsheetId(spreadsheetId);
    const selected = spreadsheets.find(s => s.id === spreadsheetId);
    if (selected) setSelectedSpreadsheetName(selected.name);
    
    setSelectedWorksheetTitle("");
    setSheetData(null);
    setWorksheets([]);
    
    try {
      setIsLoading(true);
      setError(null);
      const details = await googleWorkspace.getSpreadsheetDetails(spreadsheetId);
      setWorksheets(details.sheets);
    } catch (err: any) {
      setError(err.message);
      addToast("error", "Failed to load worksheets", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectWorksheet = async (title: string) => {
    setSelectedWorksheetTitle(title);
    if (!title) {
      setSheetData(null);
      return;
    }
    await loadSheetData(selectedSpreadsheetId, title);
  };

  const loadSheetData = async (spreadsheetId: string, sheetTitle: string) => {
    try {
      setIsLoadingData(true);
      setError(null);
      const data = await googleWorkspace.getSheetData(spreadsheetId, sheetTitle);
      
      // Handle empty sheet
      if (!data || data.headers.length === 0) {
        throw new Error("Sheet is empty or has no headers.");
      }

      setSheetData(data);
      setLastSyncTime(new Date());
    } catch (err: any) {
      setError(err.message);
      addToast("error", "Failed to read sheet data", err.message);
      setSheetData(null);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Convert row arrays to objects for TanStack table
  const tableData = useMemo(() => {
    if (!sheetData) return [];
    return sheetData.rows.map((row, rowIndex) => {
      const rowObj: Record<string, any> = { _rowIndex: rowIndex + 2 }; // +2 for 1-based index and header offset
      sheetData.headers.forEach((header, colIndex) => {
        rowObj[header] = row[colIndex] || "";
      });
      return rowObj;
    });
  }, [sheetData]);

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!sheetData) return [];
    return [
      {
        header: "#",
        accessorKey: "_rowIndex",
        size: 60,
      },
      ...sheetData.headers.map((header) => ({
        header,
        accessorKey: header,
        cell: (info: any) => (
          <div className="truncate max-w-[200px]" title={info.getValue()}>
            {info.getValue()}
          </div>
        )
      }))
    ];
  }, [sheetData]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 100, // Show first 100 rows
      }
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Sheet Reader</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Read and preview data from connected Google Sheets securely.</p>
        </div>
        {!googleUser ? (
          <button
            onClick={() => googleSignIn().catch(console.error)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <LogIn size={16} /> Connect Google Account
          </button>
        ) : (
          <div className="flex items-center gap-3 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-lg shadow-sm">
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-xs">
              {googleUser.displayName?.charAt(0) || "U"}
            </div>
            <span className="text-sm font-medium pr-2">{googleUser.email}</span>
            <button
              onClick={() => { logout(); setSheetData(null); }}
              className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors pl-3 border-l border-slate-200 dark:border-white/10"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1: Select Spreadsheet */}
        <div className="bg-white dark:bg-[#111111] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
              <FileSpreadsheet size={16} />
            </div>
            <h3 className="font-semibold">Select Spreadsheet</h3>
          </div>
          
          <div className="space-y-3">
            {isLoading && spreadsheets.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <RefreshCw size={14} className="animate-spin" /> Loading spreadsheets...
              </div>
            ) : !googleUser ? (
              <div className="text-sm text-slate-500 italic">Connect account to list spreadsheets</div>
            ) : (
              <select
                value={selectedSpreadsheetId}
                onChange={(e) => handleSelectSpreadsheet(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">-- Choose a Spreadsheet --</option>
                {spreadsheets.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Step 2: Select Worksheet */}
        <div className="bg-white dark:bg-[#111111] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileSpreadsheet size={16} />
            </div>
            <h3 className="font-semibold">Select Worksheet</h3>
          </div>
          
          <div className="space-y-3">
            {isLoading && selectedSpreadsheetId && worksheets.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <RefreshCw size={14} className="animate-spin" /> Loading worksheets...
              </div>
            ) : !selectedSpreadsheetId ? (
              <div className="text-sm text-slate-500 italic">Select a spreadsheet first</div>
            ) : (
              <select
                value={selectedWorksheetTitle}
                onChange={(e) => handleSelectWorksheet(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">-- Choose a Worksheet --</option>
                {worksheets.map(s => (
                  <option key={s.sheetId} value={s.title}>{s.title}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold block mb-1">Error Reading Sheet</span>
            {error}
          </div>
        </div>
      )}

      {/* Metadata & Preview Section */}
      {(sheetData || isLoadingData) && (
        <div className="bg-white dark:bg-[#111111] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
          
          {/* Top Bar / Metadata */}
          <div className="p-5 border-b border-slate-200 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Spreadsheet</span>
                <span className="font-medium truncate max-w-[200px]" title={selectedSpreadsheetName}>{selectedSpreadsheetName || "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Worksheet</span>
                <span className="font-medium">{selectedWorksheetTitle || "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Last Updated</span>
                <span className="font-medium text-slate-900 dark:text-white truncate max-w-[150px]">{selectedSpreadsheetId && spreadsheets.find(s => s.id === selectedSpreadsheetId)?.modifiedTime ? (new Date(spreadsheets.find(s => s.id === selectedSpreadsheetId)!.modifiedTime!).toLocaleString()) : "-" }</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total Rows</span>
                <span className="font-medium font-mono">{sheetData ? sheetData.rows.length.toLocaleString() : "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total Columns</span>
                <span className="font-medium font-mono">{sheetData ? sheetData.headers.length.toLocaleString() : "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Last Sync Time</span>
                <span className="font-medium flex items-center gap-1.5">
                  <Clock size={12} className="text-slate-400" />
                  {lastSyncTime ? lastSyncTime.toLocaleTimeString() : "-"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search in all columns..." 
                  value={globalFilter ?? ''}
                  onChange={e => setGlobalFilter(e.target.value)}
                  className="pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg bg-slate-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full sm:w-64 transition-all"
                  disabled={isLoadingData || !sheetData}
                />
              </div>
              <button 
                onClick={() => loadSheetData(selectedSpreadsheetId, selectedWorksheetTitle)}
                disabled={isLoadingData || !selectedWorksheetTitle}
                className="p-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw size={16} className={isLoadingData ? "animate-spin text-indigo-500" : "text-slate-500 dark:text-slate-400"} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="w-full overflow-x-auto min-h-[400px]">
            {isLoadingData ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-slate-500 dark:text-slate-400 gap-3">
                <RefreshCw size={24} className="animate-spin text-indigo-500" />
                <p className="text-sm font-medium">Fetching worksheet data...</p>
              </div>
            ) : !sheetData ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-slate-500 dark:text-slate-400">
                <p className="text-sm">No data available.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-white/10 sticky top-0 z-10">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap group">
                          {header.isPlaceholder ? null : (
                            <div 
                              className={`flex items-center gap-2 ${header.column.getCanSort() ? 'cursor-pointer select-none' : ''}`}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {header.column.getCanSort() && (
                                <ArrowUpDown size={12} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                              {{
                                asc: <span className="text-indigo-600 text-xs font-bold">↑</span>,
                                desc: <span className="text-indigo-600 text-xs font-bold">↓</span>,
                              }[header.column.getIsSorted() as string] ?? null}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                        No results found for your search.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-4 py-2.5 max-w-xs truncate" title={cell.getValue() as string}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          {sheetData && (
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 text-sm">
              <div className="text-slate-500 dark:text-slate-400">
                Showing <span className="font-medium text-slate-900 dark:text-white">
                  {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                </span> to <span className="font-medium text-slate-900 dark:text-white">
                  {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}
                </span> of <span className="font-medium text-slate-900 dark:text-white">{table.getFilteredRowModel().rows.length.toLocaleString()}</span> entries
                {globalFilter && ` (filtered from ${sheetData.rows.length.toLocaleString()} total)`}
              </div>
              
              <div className="flex items-center gap-2">
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={e => table.setPageSize(Number(e.target.value))}
                  className="border border-slate-200 dark:border-white/10 rounded-md bg-white dark:bg-[#111111] px-2 py-1 text-sm focus:outline-none"
                >
                  {[50, 100, 250, 500].map(pageSize => (
                    <option key={pageSize} value={pageSize}>
                      Show {pageSize}
                    </option>
                  ))}
                </select>
                
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="p-1 rounded-md border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-2">
                    Page <span className="font-medium">{table.getState().pagination.pageIndex + 1}</span> of <span className="font-medium">{table.getPageCount() || 1}</span>
                  </span>
                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="p-1 rounded-md border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
