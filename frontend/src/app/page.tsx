"use client";
import React, { useState } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, 
  ReferenceLine, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  Activity, ShieldCheck, Server, AlertTriangle, 
  CheckCircle2, RefreshCw, Cpu, Database, Columns, 
  Layers, Clock, Users, ArrowRightLeft, Info
} from 'lucide-react';

const FEATURE_LABELS: Record<string, string> = {
  Age: "Age",
  RestingBP: "Resting BP",
  Cholesterol: "Cholesterol",
  MaxHR: "Max Heart Rate",
  ST_Depression: "ST Depression",
  ChestPain_Type: "Chest Pain",
  ExerciseAngina: "Exercise Angina",
};

interface ShapContribution {
  feature: string;
  value: number;
}

interface NodeResult {
  node: string;
  model_type: string;
  framework: string;
  risk_probability: number;
  baseline_expected_value: number;
  shap_contributions: ShapContribution[];
  sync_round: number;
  inference_time_ms: number;
  shap_time_ms: number;
  local_cohort_size: number;
  error?: string;
}

export default function ClinicalDashboard() {
  const [formData, setFormData] = useState({
    Age: 58,
    RestingBP: 142,
    Cholesterol: 245,
    MaxHR: 145,
    ST_Depression: 2.3,
    ChestPain_Type: 3,
    ExerciseAngina: 1
  });

  const [selectedModel, setSelectedModel] = useState<"linear" | "mlp">("linear");
  const [viewMode, setViewMode] = useState<"single" | "compare">("single");

  // Single Node State
  const [singleNodeUrl, setSingleNodeUrl] = useState("http://localhost:8001");
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<NodeResult>({
    node: "Hospital A (Cardiology)",
    model_type: "linear",
    framework: "scikit-learn",
    risk_probability: 0.8703,
    baseline_expected_value: 0.2991,
    shap_contributions: [
      { feature: "Age", value: 0.6012 },
      { feature: "RestingBP", value: -0.0821 },
      { feature: "Cholesterol", value: -1.1045 },
      { feature: "MaxHR", value: -0.5524 },
      { feature: "ST_Depression", value: -0.0811 },
      { feature: "ChestPain_Type", value: 3.4215 },
      { feature: "ExerciseAngina", value: -0.7231 }
    ],
    sync_round: 10,
    inference_time_ms: 4.82,
    shap_time_ms: 1.74,
    local_cohort_size: 50
  });

  // Comparison State
  const [compareLoadingA, setCompareLoadingA] = useState(false);
  const [compareLoadingB, setCompareLoadingB] = useState(false);
  const [compareErrorA, setCompareErrorA] = useState<string | null>(null);
  const [compareErrorB, setCompareErrorB] = useState<string | null>(null);
  const [compareResultA, setCompareResultA] = useState<NodeResult | null>(null);
  const [compareResultB, setCompareResultB] = useState<NodeResult | null>(null);

  const getBaseUrls = () => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const urlA = process.env.NEXT_PUBLIC_NODE_A_URL || `http://${host}:8001`;
    const urlB = process.env.NEXT_PUBLIC_NODE_B_URL || `http://${host}:8002`;
    return { urlA, urlB };
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleLoading(true);
    setSingleError(null);
    try {
      const res = await axios.post(`${singleNodeUrl}/predict?model=${selectedModel}`, formData, {
        timeout: 10000
      });
      if (res.data) {
        setSingleResult(res.data);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to reach edge node.";
      setSingleError(errorMsg);
    } finally {
      setSingleLoading(false);
    }
  };

  const handleCompareSubmit = async () => {
    setViewMode("compare");
    setCompareLoadingA(true);
    setCompareLoadingB(true);
    setCompareErrorA(null);
    setCompareErrorB(null);

    const { urlA, urlB } = getBaseUrls();

    // Concurrent independent execution with individual error handling
    const fetchA = axios.post(`${urlA}/predict?model=${selectedModel}`, formData, { timeout: 10000 })
      .then(res => {
        setCompareResultA(res.data);
      })
      .catch(err => {
        setCompareErrorA(err.response?.data?.detail || err.message || "Hospital A connection error.");
      })
      .finally(() => setCompareLoadingA(false));

    const fetchB = axios.post(`${urlB}/predict?model=${selectedModel}`, formData, { timeout: 10000 })
      .then(res => {
        setCompareResultB(res.data);
      })
      .catch(err => {
        setCompareErrorB(err.response?.data?.detail || err.message || "Hospital B connection error.");
      })
      .finally(() => setCompareLoadingB(false));

    await Promise.allSettled([fetchA, fetchB]);
  };

  const handleReset = () => {
    setFormData({
      Age: 58,
      RestingBP: 142,
      Cholesterol: 245,
      MaxHR: 145,
      ST_Depression: 2.3,
      ChestPain_Type: 3,
      ExerciseAngina: 1
    });
  };

  const renderWaterfallChart = (contributions: ShapContribution[], height: number = 380) => (
    <div style={{ height }} className="w-full pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={contributions} 
          layout="vertical" 
          margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis 
            type="number" 
            stroke="#94a3b8" 
            tick={{ fontSize: 11, fill: '#64748b' }} 
            domain={['auto', 'auto']}
            tickFormatter={(val: any) => Number(val).toFixed(2)}
          />
          <YAxis 
            dataKey="feature" 
            type="category" 
            stroke="#94a3b8" 
            tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} 
            width={110}
            tickFormatter={(rawKey: string) => FEATURE_LABELS[rawKey] || rawKey}
          />
          <Tooltip 
            cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }}
            contentStyle={{ 
              backgroundColor: '#ffffff', 
              borderColor: '#e2e8f0', 
              borderRadius: '10px',
              boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.08)',
              fontSize: '12px',
              color: '#0f172a',
              padding: '8px 12px'
            }}
            itemStyle={{ color: '#0f172a', fontWeight: 600 }}
            formatter={(val: any) => [
              `${Number(val) > 0 ? '+' : ''}${Number(val).toFixed(3)} attribution`, 
              'SHAP Impact'
            ]}
            labelFormatter={(label: string) => FEATURE_LABELS[label] || label}
          />
          <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
          <Bar 
            dataKey="value" 
            barSize={20}
            radius={[0, 4, 4, 0]}
          >
            {contributions.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.value > 0 ? '#ef4444' : '#10b981'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100/75 text-slate-800 p-4 sm:p-8 lg:p-10 font-sans antialiased flex flex-col justify-start">
      <div className="w-full max-w-[1720px] mx-auto space-y-6">
        
        {/* Top Clinical Navigation Bar */}
        <header className="flex flex-wrap items-center justify-between bg-white border border-slate-200/90 px-8 py-5 rounded-2xl shadow-xs gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 text-cyan-400 rounded-xl flex items-center justify-center shadow-xs">
              <Activity size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  IoMT Clinical Decision Gateway
                </h1>
                <span className="text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  XFL Architecture v1.5
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Decentralized Inference &amp; Client-Local SHAP Attribution Engine
              </p>
            </div>
          </div>

          {/* Controls: Model Toggle & Mode Selection */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Model Architecture Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedModel("linear")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  selectedModel === "linear" 
                    ? "bg-white text-blue-600 shadow-xs font-bold" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers size={14} /> Logistic Regression
              </button>
              <button
                type="button"
                onClick={() => setSelectedModel("mlp")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  selectedModel === "mlp" 
                    ? "bg-white text-indigo-600 shadow-xs font-bold" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Cpu size={14} /> PyTorch MLP
              </button>
            </div>

            {/* Target Node Selection (For Single Mode) */}
            {viewMode === "single" && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs text-slate-600 shadow-2xs">
                <Server size={14} className="text-slate-500" />
                <span className="text-slate-500 font-medium">Target Node:</span>
                <select 
                  className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer text-xs"
                  value={singleNodeUrl} 
                  onChange={(e) => setSingleNodeUrl(e.target.value)}
                >
                  <option value="http://localhost:8001">Hospital A (Cardiology :8001)</option>
                  <option value="http://localhost:8002">Hospital B (General Medicine :8002)</option>
                </select>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("single")}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "single"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Server size={14} /> Single Node
              </button>
              <button
                type="button"
                onClick={handleCompareSubmit}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "compare"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                }`}
              >
                <ArrowRightLeft size={14} /> Compare Nodes (Cardiology vs. General Medicine)
              </button>
            </div>
          </div>
        </header>

        {/* Informational Banner for Non-IID Local Explainability */}
        <div className="bg-gradient-to-r from-blue-50/90 via-slate-50 to-indigo-50/90 border border-blue-200/80 rounded-2xl p-4 px-6 flex items-start sm:items-center gap-3.5 shadow-2xs">
          <Info size={20} className="text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            <strong className="text-slate-900 font-semibold">Decentralized Privacy Architecture:</strong> Raw patient records and reference background cohorts are isolated within each hospital firewall. The central Flower server coordinates weights via FedAvg, while each node evaluates local risk shifts against its private patient distribution (<code className="text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-mono">N=50</code>).
          </p>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Column: IoMT Telemetry Form (4 Cols) */}
          <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-7 shadow-xs space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-base text-slate-800 flex items-center gap-2.5">
                    <Database size={18} className="text-slate-600" /> Patient Telemetry Stream
                  </h2>
                  <span className="text-xs text-slate-400 mt-0.5 block">ID: PT-84920 • Real-time Physiological Ingestion</span>
                </div>
                <button 
                  type="button" 
                  onClick={handleReset}
                  className="text-xs font-medium text-slate-400 hover:text-slate-700 flex items-center gap-1.5 transition cursor-pointer px-2 py-1 rounded hover:bg-slate-50"
                >
                  <RefreshCw size={13} /> Reset
                </button>
              </div>

              <form id="telemetry-form" onSubmit={handleSingleSubmit} className="space-y-4">
                
                {/* Age & Resting BP */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Age (Years)
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      max="120"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm sm:text-base text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      value={formData.Age}
                      onChange={(e) => setFormData({...formData, Age: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Resting BP (mmHg)
                    </label>
                    <input 
                      type="number"
                      min="50"
                      max="250"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm sm:text-base text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      value={formData.RestingBP}
                      onChange={(e) => setFormData({...formData, RestingBP: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* Cholesterol & Max HR */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Cholesterol (mg/dL)
                    </label>
                    <input 
                      type="number"
                      min="80"
                      max="600"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm sm:text-base text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      value={formData.Cholesterol}
                      onChange={(e) => setFormData({...formData, Cholesterol: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Max Heart Rate (bpm)
                    </label>
                    <input 
                      type="number"
                      min="40"
                      max="220"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm sm:text-base text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      value={formData.MaxHR}
                      onChange={(e) => setFormData({...formData, MaxHR: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* ST Depression */}
                <div>
                  <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    ST Depression (mm)
                  </label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="10"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm sm:text-base text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={formData.ST_Depression}
                    onChange={(e) => setFormData({...formData, ST_Depression: parseFloat(e.target.value) || 0})}
                  />
                </div>

                {/* Chest Pain Presentation */}
                <div>
                  <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Chest Pain Presentation
                  </label>
                  <select 
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.ChestPain_Type}
                    onChange={(e) => setFormData({...formData, ChestPain_Type: parseInt(e.target.value, 10)})}
                  >
                    <option value={0}>Type 0: Typical Angina</option>
                    <option value={1}>Type 1: Atypical Angina</option>
                    <option value={2}>Type 2: Non-Anginal Pain</option>
                    <option value={3}>Type 3: Asymptomatic Ischemia</option>
                  </select>
                </div>

                {/* Exercise Induced Angina */}
                <div>
                  <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Exercise Induced Angina
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, ExerciseAngina: 0})}
                      className={`py-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition cursor-pointer ${
                        formData.ExerciseAngina === 0 
                          ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold shadow-2xs' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Absent (0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, ExerciseAngina: 1})}
                      className={`py-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition cursor-pointer ${
                        formData.ExerciseAngina === 1 
                          ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold shadow-2xs' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Present (1)
                    </button>
                  </div>
                </div>

              </form>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-6">
              <button 
                type="submit" 
                form="telemetry-form"
                disabled={singleLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold py-3.5 rounded-xl text-xs sm:text-sm tracking-wide transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {singleLoading ? "Evaluating Local Tensors..." : `Execute Single Node Assessment (${selectedModel === "linear" ? "Linear" : "MLP"})`}
              </button>

              <button 
                type="button" 
                onClick={handleCompareSubmit}
                disabled={compareLoadingA || compareLoadingB}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 rounded-xl text-xs sm:text-sm tracking-wide transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowRightLeft size={16} /> Compare Nodes (Cardiology vs. General Medicine)
              </button>
            </div>
          </div>

          {/* Right Column: Diagnostic Output (8 Cols) */}
          <div className="lg:col-span-8 space-y-6 flex flex-col justify-between">
            
            {/* VIEW 1: SINGLE NODE DIAGNOSTIC ASSESSMENT */}
            {viewMode === "single" && (
              <div className="space-y-6">
                {singleError && (
                  <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-2xl text-sm flex items-center gap-3">
                    <AlertTriangle size={20} className="text-rose-600 shrink-0" />
                    <span><strong>Assessment Error:</strong> {singleError}</span>
                  </div>
                )}

                {/* Primary Clinical Decision Card */}
                <div className={`border rounded-2xl p-7 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${
                  singleResult.risk_probability > 0.5 
                    ? 'bg-rose-50/90 border-rose-200/90' 
                    : 'bg-emerald-50/90 border-emerald-200/90'
                }`}>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold tracking-wider text-slate-600 uppercase">
                        Diagnostic Classification
                      </span>
                      <span className="text-xs text-slate-600 bg-white border border-slate-200/80 px-2.5 py-0.5 rounded-md shadow-2xs font-semibold">
                        Node: {singleResult.node}
                      </span>
                      <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md font-semibold">
                        Model: {singleResult.model_type?.toUpperCase()} ({singleResult.framework})
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <div className={`p-3 rounded-xl border ${
                        singleResult.risk_probability > 0.5 
                          ? 'bg-rose-100 border-rose-300 text-rose-600' 
                          : 'bg-emerald-100 border-emerald-300 text-emerald-600'
                      }`}>
                        {singleResult.risk_probability > 0.5 ? <AlertTriangle size={36} /> : <CheckCircle2 size={36} />}
                      </div>
                      <div>
                        <div className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
                          {singleResult.risk_probability > 0.5 ? (
                            <span className="text-rose-600">HIGH CARDIAC RISK</span>
                          ) : (
                            <span className="text-emerald-600">NORMAL RISK PROFILE</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 mt-1.5 flex flex-wrap items-center gap-3 font-medium">
                          <span>
                            Posterior Probability: <strong className="text-slate-900 font-bold text-base">{(singleResult.risk_probability * 100).toFixed(1)}%</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Local Baseline E[f(x)]: <strong className="text-slate-900 font-bold text-base">{(singleResult.baseline_expected_value * 100).toFixed(1)}%</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Edge Trust & Privacy Badge */}
                  <div className="bg-emerald-50/80 border border-emerald-300/80 rounded-2xl p-4 flex items-center gap-3.5 min-w-[240px] self-stretch md:self-auto shadow-2xs">
                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-emerald-800">Zero Data Leakage</div>
                      <div className="text-xs text-slate-500 mt-0.5">Local reference cohort (N={singleResult.local_cohort_size})</div>
                    </div>
                  </div>
                </div>

                {/* Recharts SHAP Waterfall Section */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-7 shadow-xs space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-3.5">
                    <div>
                      <h3 className="font-bold text-base text-slate-800 flex items-center gap-2.5">
                        <Cpu size={18} className="text-slate-700" /> Client-Local XAI Attribution (SHAP)
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Feature deviations pushing posterior diagnosis away from this hospital&apos;s baseline cohort.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs sm:text-sm">
                      <span className="flex items-center gap-1.5 font-semibold text-rose-600">
                        <span className="w-3 h-3 bg-rose-500 rounded-2xs"></span> Risk Driver (+)
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                        <span className="w-3 h-3 bg-emerald-500 rounded-2xs"></span> Protective Factor (-)
                      </span>
                    </div>
                  </div>

                  {renderWaterfallChart(singleResult.shap_contributions, 400)}

                  {/* Real Monotonic Latency & Telemetry Footer */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3 mt-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-500" />
                        Inference: <strong className="text-slate-800 font-semibold">{singleResult.inference_time_ms} ms</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <Cpu size={14} className="text-slate-500" />
                        SHAP Time: <strong className="text-slate-800 font-semibold">{singleResult.shap_time_ms} ms</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <Users size={14} className="text-slate-500" />
                        Cohort Size: <strong className="text-slate-800 font-semibold">N={singleResult.local_cohort_size}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-semibold">
                        FL Round #{singleResult.sync_round} Synced
                      </span>
                      <code className="text-slate-500 font-mono text-[11px]">gRPC :8080</code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: DUAL-NODE COMPARISON VIEW (CARDIOLOGY VS GENERAL MEDICINE) */}
            {viewMode === "compare" && (
              <div className="space-y-6">
                
                {/* Comparison Header */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2.5">
                      <ArrowRightLeft size={20} className="text-blue-600" />
                      Cross-Silo Comparison: Cardiology vs. General Medicine
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      Both nodes evaluate identical patient vitals using FedAvg global weights, but explain predictions against private local background cohorts.
                    </p>
                  </div>
                  <button 
                    onClick={handleCompareSubmit}
                    disabled={compareLoadingA || compareLoadingB}
                    className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2"
                  >
                    <RefreshCw size={13} className={compareLoadingA || compareLoadingB ? "animate-spin" : ""} />
                    Re-run Comparison
                  </button>
                </div>

                {/* Side-by-Side Dual Node Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                  
                  {/* NODE A: HOSPITAL A (CARDIOLOGY) */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      {/* Node Header */}
                      <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            <h4 className="font-bold text-base text-slate-900">Hospital A (Cardiology)</h4>
                          </div>
                          <span className="text-xs text-slate-400 mt-0.5 block font-mono">Port :8001 • Urban Specialist Silo</span>
                        </div>
                        <span className="text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md uppercase">
                          {selectedModel}
                        </span>
                      </div>

                      {/* Loading / Error / Content */}
                      {compareLoadingA && (
                        <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span>Querying Hospital A Edge Gateway...</span>
                        </div>
                      )}

                      {compareErrorA && (
                        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-800 my-4">
                          <strong>Node A Failure:</strong> {compareErrorA}
                        </div>
                      )}

                      {compareResultA && !compareLoadingA && (
                        <div className="space-y-4 mt-4">
                          {/* Probability Badge */}
                          <div className={`p-4 rounded-xl border flex justify-between items-center ${
                            compareResultA.risk_probability > 0.5 
                              ? 'bg-rose-50 border-rose-200 text-rose-800' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}>
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider block">Risk Assessment</span>
                              <span className="text-2xl font-black">
                                {(compareResultA.risk_probability * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-right text-xs">
                              <span className="text-slate-500 block">Local Baseline E[f(x)]</span>
                              <strong className="text-slate-800 font-bold">{(compareResultA.baseline_expected_value * 100).toFixed(1)}%</strong>
                            </div>
                          </div>

                          {/* SHAP Chart */}
                          {renderWaterfallChart(compareResultA.shap_contributions, 280)}
                        </div>
                      )}
                    </div>

                    {/* Node A Telemetry Footer */}
                    {compareResultA && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex justify-between items-center">
                        <span>Infer: <strong>{compareResultA.inference_time_ms} ms</strong> | SHAP: <strong>{compareResultA.shap_time_ms} ms</strong></span>
                        <span className="font-semibold text-slate-700">Cohort N={compareResultA.local_cohort_size}</span>
                      </div>
                    )}
                  </div>

                  {/* NODE B: HOSPITAL B (GENERAL MEDICINE) */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      {/* Node Header */}
                      <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                            <h4 className="font-bold text-base text-slate-900">Hospital B (General Med)</h4>
                          </div>
                          <span className="text-xs text-slate-400 mt-0.5 block font-mono">Port :8002 • Suburban Community Silo</span>
                        </div>
                        <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md uppercase">
                          {selectedModel}
                        </span>
                      </div>

                      {/* Loading / Error / Content */}
                      {compareLoadingB && (
                        <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <span>Querying Hospital B Edge Gateway...</span>
                        </div>
                      )}

                      {compareErrorB && (
                        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-800 my-4">
                          <strong>Node B Failure:</strong> {compareErrorB}
                        </div>
                      )}

                      {compareResultB && !compareLoadingB && (
                        <div className="space-y-4 mt-4">
                          {/* Probability Badge */}
                          <div className={`p-4 rounded-xl border flex justify-between items-center ${
                            compareResultB.risk_probability > 0.5 
                              ? 'bg-rose-50 border-rose-200 text-rose-800' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}>
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider block">Risk Assessment</span>
                              <span className="text-2xl font-black">
                                {(compareResultB.risk_probability * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-right text-xs">
                              <span className="text-slate-500 block">Local Baseline E[f(x)]</span>
                              <strong className="text-slate-800 font-bold">{(compareResultB.baseline_expected_value * 100).toFixed(1)}%</strong>
                            </div>
                          </div>

                          {/* SHAP Chart */}
                          {renderWaterfallChart(compareResultB.shap_contributions, 280)}
                        </div>
                      )}
                    </div>

                    {/* Node B Telemetry Footer */}
                    {compareResultB && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex justify-between items-center">
                        <span>Infer: <strong>{compareResultB.inference_time_ms} ms</strong> | SHAP: <strong>{compareResultB.shap_time_ms} ms</strong></span>
                        <span className="font-semibold text-slate-700">Cohort N={compareResultB.local_cohort_size}</span>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
