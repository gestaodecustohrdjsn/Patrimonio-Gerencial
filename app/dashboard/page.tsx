'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Mock data for demonstration
const mockData = {
  totalAssets: 1242,
  activeAssets: 1024,
  inactiveAssets: 86,
  maintenanceAssets: 78,
  stockAssets: 54,
  totalValue: 2456789.50,
  monthlyEvolution: [
    { month: 'Jan', total: 1024, active: 856, inactive: 68, maintenance: 52, stock: 48 },
    { month: 'Fev', total: 1089, active: 912, inactive: 72, maintenance: 58, stock: 47 },
    { month: 'Mar', total: 1134, active: 945, inactive: 78, maintenance: 62, stock: 49 },
    { month: 'Abr', total: 1178, active: 978, inactive: 82, maintenance: 68, stock: 50 },
    { month: 'Mai', total: 1205, active: 1002, inactive: 85, maintenance: 72, stock: 46 },
    { month: 'Jun', total: 1242, active: 1024, inactive: 86, maintenance: 78, stock: 54 },
  ],
  costCenterDistribution: [
    { name: 'Bloco A', value: 320 },
    { name: 'Bloco B', value: 280 },
    { name: 'Bloco C', value: 210 },
    { name: 'UTI', value: 156 },
    { name: 'Consultórios', value: 145 },
    { name: 'Administrativo', value: 131 },
  ],
  healthIndex: [
    { name: 'Bloco A', index: 87 },
    { name: 'Bloco B', index: 92 },
    { name: 'Bloco C', index: 78 },
    { name: 'UTI', index: 95 },
    { name: 'Consultórios', index: 82 },
    { name: 'Administrativo', index: 89 },
  ]
};

const COLORS = ['#00e5ff', '#00bfa5', '#ffd740', '#ff9100', '#ff5252', '#26c6da'];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    // In a real app, this would fetch from an API
    setData(mockData);
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="p-6">
          <div className="animate-pulse">
            <h1 className="text-2xl font-bold text-text-pri mb-6">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-bg-card p-6 rounded-lg border border-border">
                  <div className="h-4 bg-border rounded w-3/4 mb-4"></div>
                  <div className="h-8 bg-border rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-pri mb-6">Dashboard</h1>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-bg-card p-6 rounded-lg border border-border">
            <p className="text-text-sec text-sm">Total de Bens</p>
            <p className="text-2xl font-bold text-text-pri">{data.totalAssets}</p>
          </div>
          <div className="bg-bg-card p-6 rounded-lg border border-border">
            <p className="text-text-sec text-sm">Ativos</p>
            <p className="text-2xl font-bold text-green">{data.activeAssets}</p>
          </div>
          <div className="bg-bg-card p-6 rounded-lg border border-border">
            <p className="text-text-sec text-sm">Inativos</p>
            <p className="text-2xl font-bold text-red">{data.inactiveAssets}</p>
          </div>
          <div className="bg-bg-card p-6 rounded-lg border border-border">
            <p className="text-text-sec text-sm">Em Manutenção</p>
            <p className="text-2xl font-bold text-yellow">{data.maintenanceAssets}</p>
          </div>
          <div className="bg-bg-card p-6 rounded-lg border border-border">
            <p className="text-text-sec text-sm">Em Estoque</p>
            <p className="text-2xl font-bold text-orange">{data.stockAssets}</p>
          </div>
        </div>

        {/* Value and Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-bg-card p-6 rounded-lg border border-border">
            <h2 className="text-lg font-semibold text-text-pri mb-4">Evolução Mensal</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.monthlyEvolution}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={data.monthlyEvolution.length > 0 ? "#0e3347" : "#000"} />
                  <XAxis dataKey="month" stroke="#80cbc4" />
                  <YAxis stroke="#80cbc4" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#071520', borderColor: '#0e3347', color: '#e0f7fa' }} 
                    itemStyle={{ color: '#e0f7fa' }}
                    labelStyle={{ color: '#00e5ff', fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Bar dataKey="active" name="Ativos" fill="#00e676" />
                  <Bar dataKey="inactive" name="Inativos" fill="#ff5252" />
                  <Bar dataKey="maintenance" name="Manutenção" fill="#ffd740" />
                  <Bar dataKey="stock" name="Estoque" fill="#ff9100" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-bg-card p-6 rounded-lg border border-border">
            <h2 className="text-lg font-semibold text-text-pri mb-4">Valor Total do Patrimônio</h2>
            <div className="text-3xl font-bold text-cyan mb-6">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.totalValue)}
            </div>
            
            <h2 className="text-lg font-semibold text-text-pri mb-4">Distribuição por Centro de Custo</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.costCenterDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.costCenterDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#071520', borderColor: '#0e3347', color: '#e0f7fa' }}
                    formatter={(value) => [`${value} bens`, 'Quantidade']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Health Index Section */}
        <div className="bg-bg-card p-6 rounded-lg border border-border mb-8">
          <h2 className="text-lg font-semibold text-text-pri mb-4">Índice de Saúde por Centro de Custo</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.healthIndex}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#0e3347" />
                <XAxis dataKey="name" stroke="#80cbc4" />
                <YAxis domain={[0, 100]} stroke="#80cbc4" tickCount={6} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#071520', borderColor: '#0e3347', color: '#e0f7fa' }}
                  formatter={(value) => [`${value}`, 'Índice']}
                />
                <Legend />
                <Bar dataKey="index" name="Índice de Saúde" fill="#00e5ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts Section */}
        <div className="bg-bg-card p-6 rounded-lg border border-border">
          <h2 className="text-lg font-semibold text-text-pri mb-4">Alertas</h2>
          <div className="space-y-3">
            <div className="p-3 bg-yellow/10 border border-yellow/30 rounded-md">
              <p className="text-yellow font-medium">⚠️ 12 bens estão em manutenção há mais de 30 dias</p>
            </div>
            <div className="p-3 bg-red/10 border border-red/30 rounded-md">
              <p className="text-red font-medium">⚠️ 5 bens com depreciação zerada</p>
            </div>
            <div className="p-3 bg-cyan/10 border border-cyan/30 rounded-md">
              <p className="text-cyan font-medium">ℹ️ Nenhuma movimentação registrada nos últimos 7 dias</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}