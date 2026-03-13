import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  Settings2,
  Info,
  Package,
  Activity,
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
  '870830 (브레이크 부품)': '870830',
  '870840 (기어박스 부품)': '870840',
} as const;

const BASE_FORECASTS_BY_CODE = {
  '870830': BASE_FORECASTS['870830 (Brakes)'],
  '870840': BASE_FORECASTS['870840 (Gear boxes)'],
} as const;

type HsLabel = keyof typeof HS_LABEL_TO_CODE;

export default function App() {
  useEffect(() => {
    document.documentElement.lang = "ko";
    document.documentElement.classList.add("notranslate");
  }, []);

  // State
  const [hsCode, setHsCode] = useState<HsLabel>('870830 (브레이크 부품)');
  const [serviceLevel, setServiceLevel] = useState(98.0);
  const [muL, setMuL] = useState(15.0);
  const [sigmaL, setSigmaL] = useState(3.5);
  const [baselineSafetyStock, setBaselineSafetyStock] = useState(0);
  const [baselineRop, setBaselineRop] = useState(0);

  // Derived Data
  const selectedHsCode = HS_LABEL_TO_CODE[hsCode];
  const connectedModel = MODEL_SNAPSHOT.by_hs[selectedHsCode as keyof typeof MODEL_SNAPSHOT.by_hs];
  const baseData = connectedModel
    ? { mu_D: connectedModel.mu_D, sigma_D: connectedModel.sigma_D }
    : BASE_FORECASTS_BY_CODE[selectedHsCode as keyof typeof BASE_FORECASTS_BY_CODE];
  const isConnected = Object.keys(MODEL_SNAPSHOT.by_hs).length > 0;
  const zScore = useMemo(() => pnorm(serviceLevel / 100), [serviceLevel]);

  useEffect(() => {
    if (!connectedModel) {
      return;
    }
    setMuL(connectedModel.mu_L);
    setSigmaL(connectedModel.sigma_L);
  }, [hsCode]);

  const policy = useMemo(
    () => calculateInventoryLogic(baseData.mu_D, baseData.sigma_D, muL, sigmaL, zScore),
    [baseData, muL, sigmaL, zScore]
  );

  const userBaselineSS = baselineSafetyStock > 0 ? baselineSafetyStock : policy.SS;
  const userBaselineROP = baselineRop > 0 ? baselineRop : policy.ROP;

  // Global supply-chain crisis adjustment (scenario-based heuristic)
  const crisisIndex = useMemo(() => {
    const leadTimeRisk = muL > 0 ? sigmaL / muL : 0;
    const demandRisk = baseData.mu_D > 0 ? baseData.sigma_D / baseData.mu_D : 0;
    const servicePressure = Math.max(0, (serviceLevel - 95) / 5);
    const raw = (leadTimeRisk * 0.45) + (demandRisk * 0.35) + (servicePressure * 0.2);
    return Math.max(0, Math.min(1.2, raw));
  }, [muL, sigmaL, baseData, serviceLevel]);

  const crisisAdjustedSS = userBaselineSS * (1 + crisisIndex * 0.35);
  const crisisAdjustedROP = userBaselineROP * (1 + crisisIndex * 0.25);

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
    return [0.90, 0.95, 0.98, 0.99].map((lv) => {
      const z = pnorm(lv);
      const p = calculateInventoryLogic(baseData.mu_D, baseData.sigma_D, muL, sigmaL, z);
      return {
        level: `${Math.round(lv * 100)}%`,
        ss: p.SS,
        rop: p.ROP,
        coverDays: p.ROP / baseData.mu_D,
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
          <h1 className="font-bold text-xl tracking-tight text-slate-800">재고 최적화</h1>
        </div>

        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-500">
              <Settings2 className="w-4 h-4" />
              <h2 className="text-xs font-semibold uppercase tracking-wider">기본 설정</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">품목 코드 (HS)</label>
                <select
                  value={hsCode}
                  onChange={(e) => setHsCode(e.target.value as HsLabel)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                >
                  {Object.keys(HS_LABEL_TO_CODE).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">서비스 수준</label>
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
                <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-700">데이터 안내</h2>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                    isConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  )}
                >
                  {isConnected ? '연결됨' : '미연결'}
                </span>
              </div>
              <p className="text-[11px] text-indigo-900 mt-2 leading-relaxed font-medium">
                사용자의 데이터는 저장되지 않습니다.
              </p>
            </div>
          </section>

          <section>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">사용자 입력 기준</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">평시 안전재고량 (kg)</label>
                  <input
                    type="number"
                    value={baselineSafetyStock}
                    onChange={(e) => setBaselineSafetyStock(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">재발주 시점 ROP (kg)</label>
                  <input
                    type="number"
                    value={baselineRop}
                    onChange={(e) => setBaselineRop(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  />
                </div>
              </div>
              <p className="text-[11px] text-emerald-900 mt-3 leading-relaxed font-medium">
                평시 안전재고량은 평소 확보 목표치, 재발주 시점(ROP)은 재고가 이 수치 이하일 때 발주를 시작하는 기준입니다.
              </p>
              <p className="text-[11px] text-emerald-800 mt-2 leading-relaxed">
                현재 입력값 기준 공급망 위기 보정률: {Math.round(crisisIndex * 100)}%
              </p>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-500">
              <Truck className="w-4 h-4" />
              <h2 className="text-xs font-semibold uppercase tracking-wider">물류 설정</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">평균 리드타임 (일)</label>
                <input
                  type="number"
                  value={muL}
                  onChange={(e) => setMuL(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">리드타임 변동성 (σ)</label>
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
              <span className="text-xs font-bold uppercase">운영 팁</span>
            </div>
            <p className="text-xs text-indigo-900 leading-relaxed">
              서비스 수준을 올릴수록 안전재고 필요량이 빠르게 증가합니다. 재고비용과 품절위험의 균형을 맞춰 운영하세요.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-80 p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <span>대시보드</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-900 font-medium">재고 분석</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">{hsCode} 분석 리포트</h2>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            서비스 수준 {serviceLevel}% · 공급망 위기 보정 {Math.round(crisisIndex * 100)}%
          </div>
        </header>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <MetricCard
            title="안전재고량 (SS)"
            value={crisisAdjustedSS}
            unit="kg"
            icon={<Package className="w-5 h-5" />}
            color="indigo"
          />
          <MetricCard
            title="재발주 시점 (ROP)"
            value={crisisAdjustedROP}
            unit="kg"
            icon={<Activity className="w-5 h-5" />}
            color="emerald"
          />
          <MetricCard
            title="리드타임 수요량"
            subtitle="발주 후 입고될 때까지 기다리는 기간 동안 예상되는 총 수요"
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
              <h3 className="text-lg font-bold text-slate-800">안전재고 시뮬레이션</h3>
              <p className="text-sm text-slate-500">서비스 수준 목표에 따른 필요 안전재고</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-600" />
                <span className="text-xs text-slate-600">안전재고량</span>
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
                  label={{ value: '서비스 수준 (%)', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#94A3B8' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  label={{ value: '안전재고량 (kg)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#94A3B8' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} kg`, '안전재고량']}
                  labelFormatter={(label) => `서비스 수준: ${label}%`}
                />
                <ReferenceLine
                  x={serviceLevel.toFixed(1)}
                  stroke="#F43F5E"
                  strokeDasharray="3 3"
                  label={{ value: '현재값', position: 'top', fill: '#F43F5E', fontSize: 10, fontWeight: 'bold' }}
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
            <h3 className="text-lg font-bold text-slate-800">시나리오 비교표</h3>
            <p className="text-sm text-slate-500">서비스 수준별 재고 운영 비교</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">서비스 수준</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">안전재고량 (SS)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">재발주 시점 (ROP)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">커버 일수</th>
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
                        <span className="text-sm font-bold text-slate-900">{s.coverDays.toFixed(1)}일</span>
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
  subtitle?: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'amber';
}

function MetricCard({ title, subtitle, value, unit, icon, color }: MetricCardProps) {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100'
  };

  const iconBgClasses = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2 rounded-lg text-white', iconBgClasses[color])}>
          {icon}
        </div>
        <div className={cn('px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border', colorClasses[color])}>
          실시간 지표
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">{subtitle}</p>}
        <div className="flex items-baseline gap-2">
          <h4 className="text-2xl font-bold text-slate-900">{Math.round(value).toLocaleString()}</h4>
          <span className="text-sm font-medium text-slate-400">{unit}</span>
        </div>
      </div>
    </motion.div>
  );
}
