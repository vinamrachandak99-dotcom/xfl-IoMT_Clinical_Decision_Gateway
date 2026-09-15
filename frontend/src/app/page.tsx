"use client";
import React, { useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer } from 'recharts';
import { Activity, ShieldCheck, Server, AlertCircle } from 'lucide-react';

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

  const handleSubmit = async (e: any) => {
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
      setErrorMessage("Error connecting to Edge Node. Is Docker running?");
      setResult(null);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="text-blue-600" /> Decentralized Clinical Gateway
            </h1>
            <p className="text-gray-500 text-sm mt-1">Federated AI inference with Local SHAP Explanations</p>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border">
            <Server size={18} className="text-gray-600"/>
            <select 
              className="bg-transparent font-medium outline-none text-sm cursor-pointer"
              value={nodeUrl} 
              onChange={(e) => {
                setNodeUrl(e.target.value);
                setResult(null);
                setErrorMessage(null);
              }}
            >
              <option value="http://localhost:8001">Hospital A (Cardiology)</option>
              <option value="http://localhost:8002">Hospital B (General)</option>
            </select>
          </div>
        </div>

        {/* Error / Status Alert */}
        {errorMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
            <p className="text-sm font-medium">{errorMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Input Form */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
            <h2 className="font-semibold text-lg mb-4 border-b pb-2">Patient Vitals (IoMT)</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {Object.keys(formData).map((key) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 uppercase">{key}</label>
                  <input 
                    type="number" 
                    step="0.1"
                    className="w-full mt-1 p-2 bg-gray-50 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    value={(formData as any)[key]}
                    onChange={(e) => setFormData({...formData, [key]: parseFloat(e.target.value) || 0})}
                  />
                </div>
              ))}
              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Analyzing..." : "Generate Risk Assessment"}
              </button>
            </form>
          </div>

          {/* Results & XAI Dashboard */}
          {result && (
            <div className="lg:col-span-2 space-y-6">
              
              {/* Prediction Badge */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-gray-500 text-sm font-bold uppercase">Clinical Decision</h3>
                  <div className="text-4xl font-extrabold mt-1">
                    {result.risk_probability > 0.5 ? (
                      <span className="text-red-600">High Cardiac Risk</span>
                    ) : (
                      <span className="text-green-600">Low Cardiac Risk</span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-2 font-medium">Model Confidence: {(result.risk_probability * 100).toFixed(1)}%</p>
                </div>
                <div className="text-right bg-green-50 text-green-700 p-4 rounded-lg flex flex-col items-center border border-green-200">
                  <ShieldCheck size={32} />
                  <span className="text-xs font-bold mt-2">Zero Data Leakage</span>
                  <span className="text-[10px] opacity-80">Local Execution Only</span>
                </div>
              </div>

              {/* SHAP Waterfall Plot */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-lg mb-1">Explainability (Local SHAP Attribution)</h3>
                <p className="text-xs text-gray-500 mb-6">How specific patient vitals influenced the risk prediction relative to the hospital baseline.</p>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.shap_contributions} layout="vertical" margin={{ left: 40, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="feature" type="category" width={110} tick={{fontSize: 12, fill: '#4B5563'}} />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.03)'}} />
                      <ReferenceLine x={0} stroke="#94a3b8" />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {
                          result.shap_contributions.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#ef4444' : '#22c55e'} />
                          ))
                        }
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
