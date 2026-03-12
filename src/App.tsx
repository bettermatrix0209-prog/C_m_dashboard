import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Settings2, 
  Info, 
  ArrowRight,
  Package,
  Activity,
  BarChart3,
  ChevronRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';
import { calculateInventoryLogic, pnorm, BASE_FORECASTS } from './utils';
import { MODEL_SNAPSHOT } from './data/modelSnapshot';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HS_LABEL_TO_CODE = {
  "870830 (Brakes)": "870830",
  "870840 (Gear boxes)": "870840",
} as const;

type HsLabel = keyof typeof HS_LABEL_TO_CODE;

export default function App() {
  // State
  const [hsCode, setHsCode] = useState<HsLabel>("870830 (Brakes)");
  const [serviceLevel, setServiceLevel] = useState(98.0);
  const [muL, setMuL] = useState(15.0);
  const [sigmaL, setSigmaL] = useState(3.5);

  // Derived Data
  const selectedHsCode = HS_LABEL_TO_CODE[hsCode];
  const connectedModel = MODEL_SNAPSHOT.by_hs[selectedHsCode as keyof typeof MODEL_SNAPSHOT.by_hs];
  const baseData = connectedModel
    ? { mu_D: connectedModel.mu_D, sigma_D: connectedModel.sigma_D }
    : BASE_FORECASTS[hsCode];
  const isConnected = Object.keys(MODEL_SNAPSHOT.by_hs).length > 0;
  const zScore = useMemo(() => pnorm(serviceLevel / 100), [serviceLevel]);

  useEffect(() => {
    if (!connectedModel) {
      return;
    }
    setMuL(connectedModel.mu_L);
    setSigmaL(connectedModel.sigma_L);
  }, [hsCode]);
  
  const policy = useMemo(() => 
    calculateInventoryLogic(baseData.mu_D, baseData.sigma_D, muL, sigmaL, zScore),
    [baseData, muL, sigmaL, zScore]
  );

  // Simulation Data for Chart
  const chartData = useMemo(() => {
    const data = [];
    for (let sl = 85; sl <= 99.9; sl += 0.5) {
      const z = pnorm(sl / 100);
      const p = calculateInventoryLogic(baseData.mu_D, baseData.sigma_D, muL, sigmaL, z);
      data.push({
        sl: sl.toFixed(1),
        ss: Math.round(p.SS),
      });
    }
    return data;
  }, [baseData, muL, sigmaL]);

  // Scenario Data
  const scenarios = useMemo(() => {
    return [0.90, 0.95, 0.98, 0.99].map(lv => {
      const z = pnorm(lv);
      const p = calculateInventoryLogic(baseData.mu_D, baseData.sigma_D, muL, sigmaL, z);
      return {
        level: `${Math.round(lv * 100)}%`,
        ss: p.SS,
        rop: p.ROP,
        coverDays: p.ROP / baseData.mu_D
      };
    });
  }, [baseData, muL, sigmaL]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto z-10 hidden lg:block">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-slate-800">Inventory Opt</h1>
        </div>

        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-500">
              <Settings2 className="w-4 h-4" />
              <h2 className="text-xs font-semibold uppercase tracking-wider">Parameters</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">HS Code (Item)</label>
                <select 
                  value={hsCode}
                  onChange={(e) => setHsCode(e.target.value as HsLabel)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                >
                  {Object.keys(HS_LABEL_TO_CODE).map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Service Level</label>
                  <span className="text-sm font-bold text-indigo-600">{serviceLevel}%</span>
                </div>
                <input 
                  type="range" 
                  min="80" 
                  max="99.9" 
                  step="0.1" 
                  value={serviceLevel}
                  onChange={(e) => setServiceLevel(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>80%</span>
                  <span>99.9%</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-700">사용자 데이터 연결</h2>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                  isConnected
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                )}>
                  {isConnected ? "Connected" : "Not Connected"}
                </span>
              </div>
              <p className="text-xs text-slate-700">
                {MODEL_SNAPSHOT.source_file}
              </p>
              {connectedModel && (
                <p className="text-[11px] text-slate-500 mt-1">
                  {selectedHsCode} 최신 기준월: {connectedModel.latest_date}
                </p>
              )}
              <p className="text-[11px] text-indigo-900 mt-3 leading-relaxed font-medium">
                안내: 사용자 데이터는 서버에서만 구동되며 저장되지 않습니다.
              </p>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-500">
              <Truck className="w-4 h-4" />
              <h2 className="text-xs font-semibold uppercase tracking-wider">Logistics Setup</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Avg Lead Time (Days)</label>
                <input 
                  type="number" 
                  value={muL}
                  onChange={(e) => setMuL(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Lead Time Variability (σ)</label>
                <input 
                  type="number" 
                  value={sigmaL}
                  onChange={(e) => setSigmaL(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="mt-auto pt-10">
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2 mb-2 text-indigo-700">
              <Info className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Pro Tip</span>
            </div>
            <p className="text-xs text-indigo-900 leading-relaxed">
              Increasing service level exponentially increases safety stock requirements. Balance cost vs. availability.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-80 p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <span>Dashboard</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-900 font-medium">Inventory Analysis</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">
            {hsCode} Analysis Report
          </h2>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Optimal metrics for {serviceLevel}% service level
          </div>
        </header>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <MetricCard 
            title="Safety Stock (SS)" 
            value={policy.SS} 
            unit="kg" 
            icon={<Package className="w-5 h-5" />}
            color="indigo"
          />
          <MetricCard 
            title="Reorder Point (ROP)" 
            value={policy.ROP} 
            unit="kg" 
            icon={<Activity className="w-5 h-5" />}
            color="emerald"
          />
          <MetricCard 
            title="Lead Time Demand" 
            value={policy.mu_DL} 
            unit="kg" 
            icon={<Truck className="w-5 h-5" />}
            color="amber"
          />
        </div>

        {/* Chart Section */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Safety Stock Simulation</h3>
              <p className="text-sm text-slate-500">Required stock vs. service level targets</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-600" />
                <span className="text-xs text-slate-600">Safety Stock</span>
              </div>
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="sl" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  label={{ value: 'Service Level (%)', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#94A3B8' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  label={{ value: 'Safety Stock (kg)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#94A3B8' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Safety Stock']}
                  labelFormatter={(label) => `Service Level: ${label}%`}
                />
                <ReferenceLine 
                  x={serviceLevel.toFixed(1)} 
                  stroke="#F43F5E" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Current', position: 'top', fill: '#F43F5E', fontSize: 10, fontWeight: 'bold' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="ss" 
                  stroke="#4F46E5" 
                  strokeWidth={3} 
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Table Section */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-bottom border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Scenario Guide</h3>
            <p className="text-sm text-slate-500">Comparative inventory strategy by service level</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Service Level</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Safety Stock (SS)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Reorder Point (ROP)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Coverage Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scenarios.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                        {s.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{Math.round(s.ss).toLocaleString()} kg</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{Math.round(s.rop).toLocaleString()} kg</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{s.coverDays.toFixed(1)} days</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500" 
                            style={{ width: `${Math.min(100, (s.coverDays / 30) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'amber';
}

function MetricCard({ title, value, unit, icon, color }: MetricCardProps) {
  const colorClasses = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100"
  };

  const iconBgClasses = {
    indigo: "bg-indigo-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-600"
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-lg text-white", iconBgClasses[color])}>
          {icon}
        </div>
        <div className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border", colorClasses[color])}>
          Live Metric
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-2xl font-bold text-slate-900">{Math.round(value).toLocaleString()}</h4>
          <span className="text-sm font-medium text-slate-400">{unit}</span>
        </div>
      </div>
    </motion.div>
  );
}
