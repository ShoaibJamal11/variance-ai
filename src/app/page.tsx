"use client";

import React, { useState, useRef, useMemo } from "react";
import Papa from "papaparse";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileSpreadsheet,
  UploadCloud,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Download,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Building2,
  Key,
  Trash2,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

interface GLRecord {
  [key: string]: string | number | boolean | null | undefined;
}

interface UploadedFileState {
  file: File | null;
  fileName: string;
  fileSize: string;
  data: GLRecord[];
  rowCount: number;
  columns: string[];
}

export default function Home() {
  // Upload states
  const [lastMonth, setLastMonth] = useState<UploadedFileState>({
    file: null,
    fileName: "",
    fileSize: "",
    data: [],
    rowCount: 0,
    columns: [],
  });

  const [currentMonth, setCurrentMonth] = useState<UploadedFileState>({
    file: null,
    fileName: "",
    fileSize: "",
    data: [],
    rowCount: 0,
    columns: [],
  });

  // UI States
  const [apiKey, setApiKey] = useState<string>("");
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [showLastPreview, setShowLastPreview] = useState<boolean>(false);
  const [showCurrentPreview, setShowCurrentPreview] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // File Input References
  const lastMonthInputRef = useRef<HTMLInputElement>(null);
  const currentMonthInputRef = useRef<HTMLInputElement>(null);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Parse CSV File with PapaParse
  const handleParseFile = (
    file: File,
    target: "last" | "current"
  ) => {
    setError("");
    Papa.parse<GLRecord>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cleanedData = results.data.filter(
          (row) => Object.keys(row).length > 0 && Object.values(row).some((v) => v !== null && v !== "")
        );
        const columns = results.meta.fields || (cleanedData[0] ? Object.keys(cleanedData[0]) : []);

        const statePayload: UploadedFileState = {
          file,
          fileName: file.name,
          fileSize: formatFileSize(file.size),
          data: cleanedData,
          rowCount: cleanedData.length,
          columns,
        };

        if (target === "last") {
          setLastMonth(statePayload);
        } else {
          setCurrentMonth(statePayload);
        }
      },
      error: (err) => {
        setError(`Failed to parse ${target === "last" ? "Last Month" : "Current Month"} CSV: ${err.message}`);
      },
    });
  };

  // Handle file input changes
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "last" | "current"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleParseFile(file, target);
    }
  };

  // Remove file
  const handleRemoveFile = (target: "last" | "current") => {
    if (target === "last") {
      setLastMonth({
        file: null,
        fileName: "",
        fileSize: "",
        data: [],
        rowCount: 0,
        columns: [],
      });
      if (lastMonthInputRef.current) lastMonthInputRef.current.value = "";
    } else {
      setCurrentMonth({
        file: null,
        fileName: "",
        fileSize: "",
        data: [],
        rowCount: 0,
        columns: [],
      });
      if (currentMonthInputRef.current) currentMonthInputRef.current.value = "";
    }
  };

  // Load sample data for quick demonstration
  const handleLoadSampleData = async () => {
    setError("");
    try {
      const [resLast, resCurrent] = await Promise.all([
        fetch("/sample_last_month.csv"),
        fetch("/sample_current_month.csv"),
      ]);

      if (!resLast.ok || !resCurrent.ok) {
        throw new Error("Sample CSV files could not be loaded.");
      }

      const textLast = await resLast.text();
      const textCurrent = await resCurrent.text();

      const parsedLast = Papa.parse<GLRecord>(textLast, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });

      const parsedCurrent = Papa.parse<GLRecord>(textCurrent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });

      setLastMonth({
        file: null,
        fileName: "sample_last_month.csv",
        fileSize: formatFileSize(new Blob([textLast]).size),
        data: parsedLast.data,
        rowCount: parsedLast.data.length,
        columns: parsedLast.meta.fields || [],
      });

      setCurrentMonth({
        file: null,
        fileName: "sample_current_month.csv",
        fileSize: formatFileSize(new Blob([textCurrent]).size),
        data: parsedCurrent.data,
        rowCount: parsedCurrent.data.length,
        columns: parsedCurrent.meta.fields || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading sample files.");
    }
  };

  // Reset entire dashboard
  const handleReset = () => {
    handleRemoveFile("last");
    handleRemoveFile("current");
    setReport("");
    setError("");
  };

  // Calculate quick summary metrics if Amount column exists
  const summaryMetrics = useMemo(() => {
    if (lastMonth.data.length === 0 || currentMonth.data.length === 0) return null;

    const findAmountKey = (data: GLRecord[]) => {
      if (!data[0]) return null;
      return Object.keys(data[0]).find((k) =>
        k.toLowerCase().includes("amount") ||
        k.toLowerCase().includes("balance") ||
        k.toLowerCase().includes("expense") ||
        k.toLowerCase().includes("total")
      );
    };

    const keyLast = findAmountKey(lastMonth.data);
    const keyCurrent = findAmountKey(currentMonth.data);

    if (!keyLast || !keyCurrent) return null;

    const sumLast = lastMonth.data.reduce((acc, row) => {
      const val = Number(row[keyLast]);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const sumCurrent = currentMonth.data.reduce((acc, row) => {
      const val = Number(row[keyCurrent]);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const delta = sumCurrent - sumLast;
    const pctChange = sumLast !== 0 ? (delta / Math.abs(sumLast)) * 100 : 0;

    return {
      sumLast,
      sumCurrent,
      delta,
      pctChange,
    };
  }, [lastMonth.data, currentMonth.data]);

  // Execute Analysis via Backend API
  const handleGenerateReport = async () => {
    if (lastMonth.data.length === 0 || currentMonth.data.length === 0) {
      setError("Please upload and parse both Last Month and Current Month general ledgers.");
      return;
    }

    setLoading(true);
    setError("");
    setReport("");
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < 2 ? prev + 1 : prev));
    }, 1800);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lastMonthData: lastMonth.data,
          currentMonthData: currentMonth.data,
          apiKey: apiKey.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate variance commentary.");
      }

      setReport(result.report);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while generating the variance report."
      );
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  // Copy report to clipboard
  const handleCopyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download report as markdown file
  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `variance-ai-cfo-report-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadingMessages = [
    "Normalizing general ledger account structures & balances...",
    "Computing period-over-period variances and identifying anomalies...",
    "Groq Llama 3.1 70B synthesizing executive CFO commentary...",
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">VarianceAI</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                  CFO Suite
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Month-End General Ledger Variance Analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>{apiKey ? "Custom Key Active" : "Groq API Key"}</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <span>Load Sample Ledgers</span>
            </button>

            {(lastMonth.data.length > 0 || currentMonth.data.length > 0 || report) && (
              <button
                type="button"
                onClick={handleReset}
                title="Reset All"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Optional Custom API Key Drawer */}
        {showKeyInput && (
          <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-600">
                <span className="font-semibold text-slate-800">Custom Groq API Key:</span> By default,
                VarianceAI reads <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">GROQ_API_KEY</code> from your server environment. You can override it here.
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                {apiKey && (
                  <button
                    onClick={() => setApiKey("")}
                    className="text-xs text-rose-600 hover:text-rose-700 px-2 py-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Month-End Financial Variance Analysis
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Upload two consecutive general ledger periods. VarianceAI client-parses your statements and leverages Groq&apos;s Llama 3.1 70B model to deliver executive-grade CFO variance commentary, cost driver attribution, and anomaly audits.
          </p>
        </div>

        {/* Error notification banner if any */}
        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/80 p-4 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <h4 className="font-semibold text-rose-900">Analysis Error</h4>
              <p className="text-rose-700 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError("")}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Two-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ================= LEFT COLUMN: INPUTS ================= */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            {/* Dual CSV Upload Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-900">General Ledger Ingestion</h2>
                </div>
                <span className="text-xs font-medium text-slate-500">Dual-Period Comparison</span>
              </div>

              {/* Upload Input 1: Last Month CSV */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                    1. Last Month CSV (Prior Period)
                  </label>
                  {lastMonth.data.length > 0 && (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {lastMonth.rowCount} Rows Parsed
                    </span>
                  )}
                </div>

                {lastMonth.data.length === 0 ? (
                  <div
                    onClick={() => lastMonthInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-xl p-5 text-center transition-all group"
                  >
                    <input
                      type="file"
                      accept=".csv"
                      ref={lastMonthInputRef}
                      onChange={(e) => handleFileChange(e, "last")}
                      className="hidden"
                    />
                    <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 group-hover:bg-indigo-100/70 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors mb-2">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      Upload Last Month&apos;s GL
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Click or drag .csv file here (e.g., September GL)
                    </p>
                    <div className="mt-3">
                      <span className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-700 underline underline-offset-2">
                        Browse file
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-9 w-9 shrink-0 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          CSV
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {lastMonth.fileName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {lastMonth.fileSize} &bull; {lastMonth.rowCount} line items &bull; {lastMonth.columns.length} columns
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowLastPreview(!showLastPreview)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
                          title="Toggle preview table"
                        >
                          {showLastPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile("last")}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible preview table */}
                    {showLastPreview && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                          <TableIcon className="w-3.5 h-3.5" /> Sample Rows (First 3)
                        </div>
                        <div className="overflow-x-auto max-h-40 rounded border border-slate-200 bg-white text-[11px]">
                          <table className="w-full text-left">
                            <thead className="bg-slate-100 text-slate-700">
                              <tr>
                                {lastMonth.columns.slice(0, 4).map((col) => (
                                  <th key={col} className="p-1.5 font-medium border-b border-slate-200">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {lastMonth.data.slice(0, 3).map((row, idx) => (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                  {lastMonth.columns.slice(0, 4).map((col) => (
                                    <td key={col} className="p-1.5 text-slate-600 truncate max-w-[120px]">
                                      {String(row[col] ?? "")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Upload Input 2: Current Month CSV */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                    2. Current Month CSV (Target Period)
                  </label>
                  {currentMonth.data.length > 0 && (
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {currentMonth.rowCount} Rows Parsed
                    </span>
                  )}
                </div>

                {currentMonth.data.length === 0 ? (
                  <div
                    onClick={() => currentMonthInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-xl p-5 text-center transition-all group"
                  >
                    <input
                      type="file"
                      accept=".csv"
                      ref={currentMonthInputRef}
                      onChange={(e) => handleFileChange(e, "current")}
                      className="hidden"
                    />
                    <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 group-hover:bg-indigo-100/70 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors mb-2">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      Upload Current Month&apos;s GL
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Click or drag .csv file here (e.g., October GL)
                    </p>
                    <div className="mt-3">
                      <span className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-700 underline underline-offset-2">
                        Browse file
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-9 w-9 shrink-0 rounded-lg bg-indigo-100/80 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          CSV
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {currentMonth.fileName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {currentMonth.fileSize} &bull; {currentMonth.rowCount} line items &bull; {currentMonth.columns.length} columns
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowCurrentPreview(!showCurrentPreview)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
                          title="Toggle preview table"
                        >
                          {showCurrentPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile("current")}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible preview table */}
                    {showCurrentPreview && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                          <TableIcon className="w-3.5 h-3.5" /> Sample Rows (First 3)
                        </div>
                        <div className="overflow-x-auto max-h-40 rounded border border-slate-200 bg-white text-[11px]">
                          <table className="w-full text-left">
                            <thead className="bg-slate-100 text-slate-700">
                              <tr>
                                {currentMonth.columns.slice(0, 4).map((col) => (
                                  <th key={col} className="p-1.5 font-medium border-b border-slate-200">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {currentMonth.data.slice(0, 3).map((row, idx) => (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                  {currentMonth.columns.slice(0, 4).map((col) => (
                                    <td key={col} className="p-1.5 text-slate-600 truncate max-w-[120px]">
                                      {String(row[col] ?? "")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button: Generate Variance Report */}
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={loading || lastMonth.data.length === 0 || currentMonth.data.length === 0}
                className="w-full py-3.5 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 hover:from-indigo-500 hover:via-indigo-600 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Analyzing General Ledgers...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Variance Report</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Metrics Strip if amounts detected */}
            {summaryMetrics && (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Preliminary Balance Aggregation
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-xs text-slate-500 block">Prior Total</span>
                    <span className="text-base font-bold text-slate-800">
                      ${summaryMetrics.sumLast.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-xs text-slate-500 block">Current Total</span>
                    <span className="text-base font-bold text-slate-800">
                      ${summaryMetrics.sumCurrent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="col-span-2 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-indigo-700 block">Net Expense Variance</span>
                      <span className="text-sm font-bold text-indigo-950">
                        {summaryMetrics.delta >= 0 ? "+" : ""}${summaryMetrics.delta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md bg-white border border-indigo-200 text-indigo-800">
                      {summaryMetrics.delta >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>
                        {summaryMetrics.pctChange >= 0 ? "+" : ""}{summaryMetrics.pctChange.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CFO Guidelines Callout */}
            <div className="bg-slate-100/70 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">Model Engine:</span> Powered by Groq&apos;s <span className="font-semibold text-indigo-700">Llama 3.1 70B Versatile</span> for low-latency reasoning and strict financial compliance logic.
              </div>
            </div>
          </section>

          {/* ================= RIGHT COLUMN: OUTPUT ================= */}
          <section className="lg:col-span-7 flex flex-col">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col min-h-[560px]">
              {/* Output Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      CFO Month-End Variance Commentary
                    </h2>
                    <p className="text-xs text-slate-500">
                      AI Executive Assessment &bull; Llama 3.1 70B
                    </p>
                  </div>
                </div>

                {report && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy Markdown</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs"
                      title="Download as markdown file"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Download .md</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Output Body Container */}
              <div className="p-6 flex-1 flex flex-col">
                {/* STATE 1: LOADING */}
                {loading && (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 px-4">
                    <div className="relative mb-6">
                      <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Loader2 className="w-8 h-8 animate-spin" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-600"></span>
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-1 text-center">
                      Virtual CFO analyzing general ledgers...
                    </h3>
                    <p className="text-xs text-indigo-600 font-medium tracking-wide animate-pulse text-center mb-8">
                      {loadingMessages[loadingStep]}
                    </p>

                    {/* Progress skeleton layout */}
                    <div className="w-full max-w-md space-y-3">
                      <div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-slate-100 rounded-full w-full animate-pulse"></div>
                      <div className="h-4 bg-slate-100 rounded-full w-5/6 animate-pulse"></div>
                      <div className="h-20 bg-slate-50 border border-slate-100 rounded-xl animate-pulse mt-4"></div>
                    </div>
                  </div>
                )}

                {/* STATE 2: EMPTY STATE (AWAITING UPLOAD) */}
                {!loading && !report && (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-4">
                      <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">
                      Awaiting Ledger Datasets
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                      Upload your prior and current month CSV ledgers on the left, then click &ldquo;Generate Variance Report&rdquo; to formulate your executive CFO commentary.
                    </p>

                    <div className="mt-8 border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 max-w-md w-full text-left">
                      <span className="text-xs font-semibold text-slate-700 block mb-2">
                        What the CFO Analysis Provides:
                      </span>
                      <ul className="text-xs text-slate-600 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5"></span>
                          <span><strong>Top 3 Expense Drivers:</strong> Accounts with the most significant dollar and percentage expansion.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5"></span>
                          <span><strong>Anomaly Audits:</strong> Sudden surges (&gt;50%), zeroed accounts, or unexpected newly opened GL codes.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5"></span>
                          <span><strong>CFO Summary &amp; Directives:</strong> Actionable guidance for department heads prior to month-end close.</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadSampleData}
                      className="mt-6 text-xs font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-4"
                    >
                      Or click here to load sample demo data instantly
                    </button>
                  </div>
                )}

                {/* STATE 3: REPORT COMPLETED */}
                {!loading && report && (
                  <div className="prose prose-slate max-w-none text-slate-800 animate-in fade-in duration-300">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-2xl font-bold text-slate-900 border-b border-slate-200 pb-2.5 mb-4 mt-2">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-1.5 mb-3 mt-6 flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block"></span>
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-base font-semibold text-slate-800 mb-2 mt-4">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-sm leading-relaxed text-slate-700 mb-3.5">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-outside pl-5 mb-4 space-y-1.5 text-sm text-slate-700">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-outside pl-5 mb-4 space-y-1.5 text-sm text-slate-700">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="leading-relaxed text-slate-700">
                            {children}
                          </li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-slate-900">
                            {children}
                          </strong>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-indigo-600 bg-indigo-50/50 pl-4 py-2.5 my-4 rounded-r-lg text-slate-800 text-sm font-medium">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-5 rounded-xl border border-slate-200">
                            <table className="min-w-full divide-y divide-slate-200 text-xs">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider">
                            {children}
                          </thead>
                        ),
                        th: ({ children }) => (
                          <th className="px-3.5 py-2.5 text-left font-semibold text-slate-800">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-3.5 py-2 text-slate-700 border-t border-slate-100">
                            {children}
                          </td>
                        ),
                        code: ({ children }) => (
                          <code className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-mono font-medium">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {report}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">VarianceAI</span>
            <span>&bull;</span>
            <span>Autonomous CFO Financial Intelligence</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span>Powered by Groq Cloud</span>
            <span>&bull;</span>
            <span>Llama 3.1 70B Versatile</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
