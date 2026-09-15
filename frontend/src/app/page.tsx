"use client";
import React, { useState } from 'react';
import axios from 'axios';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import {
  Activity,
  ShieldCheck,
  Server,
  AlertCircle,
  Cpu,
  Database,
  CheckCircle2,
  HeartPulse,
  Info,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

export default function ClinicalDashboard() {
  const [formData, setFormData] = useState({
    Age: 58,
    RestingBP: 142,
    Cholesterol: 245,
    MaxHR: 135,
    ST_Depression: 2.3,
    ChestPain_Type: 2,
    ExerciseAngina: 1
  });

  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nodeUrl, setNodeUrl] = useState("http://localhost:8001"); // Toggles between Hospital A & B

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await axios.post(`${nodeUrl}/predict`, formData);
      if (res.data.error) {
        setErrorMessage(res.data.error);
        setResult(null);
      } else {
        setResult(res.data);
      }
    } catch (err: any) {
      setErrorMessage("Error connecting to Edge Node. Ensure Docker is running and ports 8001/8002 are accessible.");
      setResult(null);
    }
    setLoading(false);
  };

  // Custom data label formatter for SHAP waterfall bars
  const renderShapLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (value === undefined || value === null) return null;
    const num = typeof value === 'number' ? value : parseFloat(value);
    const isPositive = num >= 0;
    const formatted = isPositive ? `+${num.toFixed(3)}` : num.toFixed(3);

    return (
      <text
        x={isPositive ? x + width + 8 : x - 8}
        y={y + height / 2}
        fill={isPositive ? "#dc2626" : "#16a34a"}
        textAnchor={isPositive ? "start" : "end"}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
      >
        {formatted}
      </text>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* 1. Hospital Header */}
        <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <HeartPulse size={28} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                Decentralized Clinical Gateway
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  XFL v1.0
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium">
                Federated Edge Inference • Zero-Knowledge Telemetry • Local SHAP Explainability
              </p>
            </div>
          </div>

          {/* Node Selector */}
          <div className="flex items-center gap-3 bg-slate-100/80 px-4 py-2.5 rounded-xl border border-slate-200">
            <Server size={18} className="text-slate-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Edge Node</span>
              <select
                className="bg-transparent font-bold text-slate-800 text-sm outline-none cursor-pointer"
                value={nodeUrl}
                onChange={(e) => {
                  setNodeUrl(e.target.value);
                  setResult(null);
                  setErrorMessage(null);
                }}
              >
                <option value="http://localhost:8001">Hospital A (Cardiology Center - Port 8001)</option>
                <option value="http://localhost:8002">Hospital B (General Hospital - Port 8002)</option>
              </select>
            </div>
          </div>
        </header>

        {/* 2. Federated Learning Metadata Status Bar */}
        <div className="bg-white px-6 py-3.5 rounded-xl shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Model Architecture */}
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-blue-600" />
              <span className="text-slate-500 font-medium">Federated Model:</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">FedAvg Round #10</span>
            </div>

            {/* Sync Status with pulsing dot */}
            <div className="flex items-center gap-2">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
              <span className="text-slate-500 font-medium">Sync Status:</span>
              <span className="font-bold text-emerald-700">Active (In-Sync)</span>
            </div>

            {/* Reference Cohort */}
            <div className="flex items-center gap-2">
              <Database size={16} className="text-indigo-600" />
              <span className="text-slate-500 font-medium">Local Reference Cohort:</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">N=50 samples</span>
            </div>
          </div>

          {/* Privacy Badge */}
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
            <ShieldCheck size={14} />
            <span>Local Weights Only • Zero EHR Leakage</span>
          </div>
        </div>

        {/* Error / Notification Banner */}
        {errorMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3 shadow-sm">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-sm">Edge Node Notice</p>
              <p className="text-xs text-amber-800 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* 3. Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: 2-Column Telemetry Input Card (5 Cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Patient Telemetry (IoMT)</h2>
                  <p className="text-xs text-slate-500">Continuous vitals acquisition & clinical indicators</p>
                </div>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200/50">
                  Standard Panel
                </span>
              </div>

              <form id="vitals-form" onSubmit={handleSubmit} className="space-y-4">
                
                {/* 2-Column Grid for Numerical Vitals with Units */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Age */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Age
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="120"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 pr-14 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                        value={formData.Age}
                        onChange={(e) => setFormData({ ...formData, Age: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="absolute right-3 text-xs font-semibold text-slate-400 pointer-events-none">
                        years
                      </span>
                    </div>
                  </div>

                  {/* Resting Blood Pressure */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Resting BP
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="1"
                        min="50"
                        max="250"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 pr-16 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                        value={formData.RestingBP}
                        onChange={(e) => setFormData({ ...formData, RestingBP: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="absolute right-3 text-xs font-semibold text-slate-400 pointer-events-none">
                        mmHg
                      </span>
                    </div>
                  </div>

                  {/* Serum Cholesterol */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Cholesterol
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="1"
                        min="80"
                        max="600"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 pr-16 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                        value={formData.Cholesterol}
                        onChange={(e) => setFormData({ ...formData, Cholesterol: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="absolute right-3 text-xs font-semibold text-slate-400 pointer-events-none">
                        mg/dL
                      </span>
                    </div>
                  </div>

                  {/* Maximum Heart Rate */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Max HR
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="1"
                        min="40"
                        max="220"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 pr-14 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                        value={formData.MaxHR}
                        onChange={(e) => setFormData({ ...formData, MaxHR: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="absolute right-3 text-xs font-semibold text-slate-400 pointer-events-none">
                        bpm
                      </span>
                    </div>
                  </div>

                  {/* ST Depression */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      ST Depression (ECG)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 pr-14 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                        value={formData.ST_Depression}
                        onChange={(e) => setFormData({ ...formData, ST_Depression: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="absolute right-3 text-xs font-semibold text-slate-400 pointer-events-none">
                        mm
                      </span>
                    </div>
                  </div>
                </div>

                {/* Categorical 1: Chest Pain Type (Styled Select Dropdown) */}
                <div className="pt-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Chest Pain Type (CPT)
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition cursor-pointer"
                    value={formData.ChestPain_Type}
                    onChange={(e) => setFormData({ ...formData, ChestPain_Type: parseInt(e.target.value, 10) })}
                  >
                    <option value={0}>Type 0: Typical Angina</option>
                    <option value={1}>Type 1: Atypical Angina</option>
                    <option value={2}>Type 2: Non-Anginal Pain</option>
                    <option value={3}>Type 3: Asymptomatic</option>
                  </select>
                </div>

                {/* Categorical 2: Exercise Induced Angina (Interactive Button Group) */}
                <div className="pt-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Exercise Induced Angina
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ExerciseAngina: 0 })}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${
                        formData.ExerciseAngina === 0
                          ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      No (Negative)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ExerciseAngina: 1 })}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${
                        formData.ExerciseAngina === 1
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Yes (Positive)
                    </button>
                  </div>
                </div>

              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="submit"
                form="vitals-form"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating Edge Model...</span>
                  </>
                ) : (
                  <>
                    <Activity size={18} />
                    <span>Generate Risk & Explainability</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Clinical Decision & SHAP Explainability (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">

            {result ? (
              <>
                {/* 1. Clinical Decision Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Clinical Diagnostic Outcome
                      </span>
                      <div className="text-3xl sm:text-4xl font-black mt-1">
                        {result.risk_probability > 0.5 ? (
                          <span className="text-rose-600 flex items-center gap-2">
                            High Cardiac Risk
                          </span>
                        ) : (
                          <span className="text-emerald-600 flex items-center gap-2">
                            Low Cardiac Risk
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-slate-600 font-medium">
                          Calculated Probability:{" "}
                          <strong className="text-slate-900">{(result.risk_probability * 100).toFixed(1)}%</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600 font-medium">
                          Threshold: <strong>50.0%</strong>
                        </span>
                      </div>
                    </div>

                    {/* Edge Firewall Security Badge */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3 self-start sm:self-auto">
                      <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Edge-Verified</div>
                        <div className="text-[11px] text-slate-500">Weights synced via FedAvg</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. SHAP Explainability Card with Legend & Baseline */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                        Local SHAP Feature Attribution
                      </h3>
                      <p className="text-xs text-slate-500">
                        Quantified risk contribution relative to local reference distribution
                      </p>
                    </div>

                    {/* Baseline E[f(x)] Badge */}
                    <div className="bg-blue-50 border border-blue-200/60 px-3 py-1.5 rounded-lg flex items-center gap-2 self-start sm:self-auto">
                      <Info size={14} className="text-blue-600" />
                      <span className="text-xs font-semibold text-blue-900">
                        Baseline E[f(x)]: <strong>{result.baseline_expected_value?.toFixed(3) ?? '0.000'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* SHAP Visual Legend */}
                  <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/70 mb-5 text-xs">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-rose-500 inline-block" />
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          Increases Risk <TrendingUp size={13} className="text-rose-600" />
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-emerald-500 inline-block" />
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          Protective Factor <TrendingDown size={13} className="text-emerald-600" />
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Values show exact risk shift (Δ)
                    </span>
                  </div>

                  {/* Horizontal Bar Chart with exact value labels */}
                  <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={result.shap_contributions}
                        layout="vertical"
                        margin={{ left: 10, right: 65, top: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          domain={['auto', 'auto']}
                        />
                        <YAxis
                          dataKey="feature"
                          type="category"
                          width={110}
                          tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                          formatter={(value: any) => [
                            `${parseFloat(value) >= 0 ? '+' : ''}${parseFloat(value).toFixed(4)}`,
                            'SHAP Attribution'
                          ]}
                          contentStyle={{
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        />
                        <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
                        <Bar
                          dataKey="value"
                          radius={[0, 4, 4, 0]}
                          label={renderShapLabel}
                        >
                          {result.shap_contributions.map((entry: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.value >= 0 ? '#ef4444' : '#22c55e'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              /* Empty / Standby State */
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200/80 text-center flex flex-col items-center justify-center min-h-[420px]">
                <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <Activity size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Awaiting Telemetry Evaluation</h3>
                <p className="text-xs md:text-sm text-slate-500 max-w-md mt-1 mb-6">
                  Input patient vitals in the telemetry panel and click &ldquo;Generate Risk & Explainability&rdquo; to execute localized federated inference.
                </p>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 px-3.5 py-1.5 rounded-lg border border-slate-200">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Edge model weights synchronized across Hospital A & B</span>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
