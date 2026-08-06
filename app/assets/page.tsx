'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Eye, Edit, Move, Wrench, Package, Trash2, QrCode } from 'lucide-react';

// Mock data for assets
const mockAssets = [
  {
    id: '108250001',
    description: 'Monitor LCD 24"',
    alternativeDescription: 'Monitor da recepção',
    brand: 'Dell',
    model: 'E2416H',
    acquisitionDate: '2023-08-15',
    value: 890.50,
    sigemValue: 850.00,
    marketValue: 750.00,
    nf: 'NF-12345',
    classification: 3, // IT
    costCenter: 'Administrativo',
    block: 'Bloco A',
    conservationState: 'Bom',
    conservationWeight: 3,
    depreciation: 178.10,
    status: 'Ativo',
    photoUrl: null,
    createdAt: '2023-08-15T10:30:00Z',
    createdBy: 'João Silva'
  },
  {
    id: '209250001',
    description: 'Cadeira Giratória',
    alternativeDescription: 'Cadeira do gerente',
    brand: 'Ergon',
    model: 'Premium X',
    acquisitionDate: '2023-09-20',
    value: 1250.00,
    sigemValue: 1200.00,
    marketValue: 1000.00,
    nf: 'NF-12346',
    classification: 2, // Furniture
    costCenter: 'Administrativo',
    block: 'Bloco A',
    conservationState: 'Ótimo',
    conservationWeight: 4,
    depreciation: 0,
    status: 'Ativo',
    photoUrl: null,
    createdAt: '2023-09-20T14:20:00Z',
    createdBy: 'Maria Oliveira'
  },
  {
    id: '108250002',
    description: 'Osciloscópio Digital',
    alternativeDescription: 'Equipamento laboratório',
    brand: 'Tektronix',
    model: 'TDS2004C',
    acquisitionDate: '2023-08-22',
    value: 4500.00,
    sigemValue: 4300.00,
    marketValue: 4000.00,
    nf: 'NF-12347',
    classification: 1, // Medical
    costCenter: 'Laboratório',
    block: 'Bloco B',
    conservationState: 'Regular',
    conservationWeight: 2,
    depreciation: 450.00,
    status: 'Manutenção',
    photoUrl: null,
    createdAt: '2023-08-22T09:15:00Z',
    createdBy: 'Carlos Souza'
  },
  {
    id: '308250001',
    description: 'Notebook Dell',
    alternativeDescription: 'Notebook financeiro',
    brand: 'Dell',
    model: 'Latitude 5420',
    acquisitionDate: '2023-08-30',
    value: 3200.00,
    sigemValue: 3100.00,
    marketValue: 2800.00,
    nf: 'NF-12348',
    classification: 3, // IT
    costCenter: 'Financeiro',
    block: 'Bloco A',
    conservationState: 'Bom',
    conservationWeight: 3,
    depreciation: 320.00,
    status: 'Estoque',
    photoUrl: null,
    createdAt: '2023-08-30T16:45:00Z',
    createdBy: 'Ana Costa'
  }
];

const classificationLabels = {
  1: 'Médico',
  2: 'Mobiliário',
  3: 'Informática'
};

const statusColors = {
  'Ativo': 'status-active',
  'Inativo': 'status-inactive',
  'Manutenção': 'status-maintenance',
  'Estoque': 'status-stock'
};

const conservationColors = {
  'Ótimo': 'text-green',
  'Bom': 'text-cyan',
  'Regular': 'text-yellow',
  'Ruim': 'text-red'
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedClassification, setSelectedClassification] = useState('all');
  const [selectedCostCenter, setSelectedCostCenter] = useState('all');
  const [selectedConservation, setSelectedConservation] = useState('all');
  const [selectedBlock, setSelectedBlock] = useState('all');
  const [loading, setLoading] = useState(true);
  
  // Get unique values for filters
  const costCenters = Array.from(new Set(mockAssets.map(asset => asset.costCenter)));
  const blocks = Array.from(new Set(mockAssets.map(asset => asset.block)));

  useEffect(() => {
    // In a real app, this would fetch from an API
    setTimeout(() => {
      setAssets(mockAssets);
      setFilteredAssets(mockAssets);
      setLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    let result = assets;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(asset => 
        asset.id.toLowerCase().includes(term) ||
        asset.description.toLowerCase().includes(term) ||
        asset.alternativeDescription?.toLowerCase().includes(term) ||
        asset.brand?.toLowerCase().includes(term) ||
        asset.model?.toLowerCase().includes(term) ||
        asset.costCenter.toLowerCase().includes(term) ||
        asset.block?.toLowerCase().includes(term)
      );
    }
    
    if (selectedStatus !== 'all') {
      result = result.filter(asset => asset.status === selectedStatus);
    }
    
    if (selectedClassification !== 'all') {
      result = result.filter(asset => asset.classification === parseInt(selectedClassification));
    }
    
    if (selectedCostCenter !== 'all') {
      result = result.filter(asset => asset.costCenter === selectedCostCenter);
    }
    
    if (selectedConservation !== 'all') {
      result = result.filter(asset => asset.conservationState === selectedConservation);
    }
    
    if (selectedBlock !== 'all') {
      result = result.filter(asset => asset.block === selectedBlock);
    }
    
    setFilteredAssets(result);
  }, [searchTerm, selectedStatus, selectedClassification, selectedCostCenter, selectedConservation, selectedBlock, assets]);

  const handleViewDetails = (assetId: string) => {
    console.log(`View details for asset: ${assetId}`);
    // In a real app, this would open a modal or navigate to a detail page
  };

  const handleEdit = (assetId: string) => {
    console.log(`Edit asset: ${assetId}`);
    // In a real app, this would open an edit form
  };

  const handleMove = (assetId: string) => {
    console.log(`Move asset: ${assetId}`);
    // In a real app, this would open a movement form
  };

  const handleMaintenance = (assetId: string) => {
    console.log(`Maintenance for asset: ${assetId}`);
    // In a real app, this would open a maintenance form
  };

  const handleGenerateTag = (assetId: string) => {
    console.log(`Generate tag for asset: ${assetId}`);
    // In a real app, this would generate a QR code tag
  };

  const handleHistory = (assetId: string) => {
    console.log(`View history for asset: ${assetId}`);
    // In a real app, this would open a history view
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-text-pri">Patrimônios</h1>
              <button className="bg-primary-500 text-white px-4 py-2 rounded-md flex items-center">
                <Plus className="w-4 h-4 mr-2" />
                Novo Bem
              </button>
            </div>
            <div className="bg-bg-card p-4 rounded-lg border border-border mb-6">
              <div className="h-10 bg-border rounded w-full"></div>
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-bg-card p-4 rounded-lg border border-border">
                  <div className="h-6 bg-border rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-border rounded w-1/2"></div>
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
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
          <h1 className="text-2xl font-bold text-text-pri mb-4 md:mb-0">Patrimônios</h1>
          <button className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-md flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Novo Bem
          </button>
        </div>

        {/* Filters */}
        <div className="bg-bg-card p-4 rounded-lg border border-border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-sec mb-1">Buscar</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ID, descrição, marca..."
                  className="w-full bg-bg-panel border border-border rounded-md py-2 pl-10 pr-4 text-text-pri focus:outline-none focus:ring-1 focus:ring-accent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-mute w-4 h-4" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-sec mb-1">Status</label>
              <select
                className="w-full bg-bg-panel border border-border rounded-md py-2 px-3 text-text-pri focus:outline-none focus:ring-1 focus:ring-accent"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Estoque">Estoque</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-sec mb-1">Classificação</label>
              <select
                className="w-full bg-bg-panel border border-border rounded-md py-2 px-3 text-text-pri focus:outline-none focus:ring-1 focus:ring-accent"
                value={selectedClassification}
                onChange={(e) => setSelectedClassification(e.target.value)}
              >
                <option value="all">Todas</option>
                <option value="1">Médico</option>
                <option value="2">Mobiliário</option>
                <option value="3">Informática</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-sec mb-1">Centro de Custo</label>
              <select
                className="w-full bg-bg-panel border border-border rounded-md py-2 px-3 text-text-pri focus:outline-none focus:ring-1 focus:ring-accent"
                value={selectedCostCenter}
                onChange={(e) => setSelectedCostCenter(e.target.value)}
              >
                <option value="all">Todos</option>
                {costCenters.map(center => (
                  <option key={center} value={center}>{center}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-sec mb-1">Estado de Conservação</label>
              <select
                className="w-full bg-bg-panel border border-border rounded-md py-2 px-3 text-text-pri focus:outline-none focus:ring-1 focus:ring-accent"
                value={selectedConservation}
                onChange={(e) => setSelectedConservation(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="Ótimo">Ótimo</option>
                <option value="Bom">Bom</option>
                <option value="Regular">Regular</option>
                <option value="Ruim">Ruim</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-sec mb-1">Bloco</label>
              <select
                className="w-full bg-bg-panel border border-border rounded-md py-2 px-3 text-text-pri focus:outline-none focus:ring-1 focus:ring-accent"
                value={selectedBlock}
                onChange={(e) => setSelectedBlock(e.target.value)}
              >
                <option value="all">Todos</option>
                {blocks.map(block => (
                  <option key={block} value={block}>{block}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4">
          <p className="text-text-sec">
            Mostrando <span className="text-text-pri font-medium">{filteredAssets.length}</span> de{' '}
            <span className="text-text-pri font-medium">{assets.length}</span> bens
          </p>
        </div>

        {/* Assets table */}
        <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-bg-panel">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-sec uppercase tracking-wider">
                    ID Interno
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-sec uppercase tracking-wider">
                    Descrição
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-sec uppercase tracking-wider">
                    Marca/Modelo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-sec uppercase tracking-wider">
                    Centro/Bloco
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-sec uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-sec uppercase tracking-wider">
                    Conservação
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-sec uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssets.map((asset) => (
                  <tr 
                    key={asset.id} 
                    className={`classification-${classificationLabels[asset.classification].toLowerCase().replace(' ', '-')}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-cyan">{asset.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-text-pri">{asset.description}</div>
                      {asset.alternativeDescription && (
                        <div className="text-sm text-text-sec">{asset.alternativeDescription}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-pri">{asset.brand || '-'}</div>
                      <div className="text-sm text-text-sec">{asset.model || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-pri">{asset.costCenter}</div>
                      <div className="text-sm text-text-sec">{asset.block || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[asset.status]}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={conservationColors[asset.conservationState]}>
                        {asset.conservationState}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-pri">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleViewDetails(asset.id)}
                          className="text-teal hover:text-teal-dim p-1 rounded"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEdit(asset.id)}
                          className="text-primary-400 hover:text-primary-300 p-1 rounded"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleMove(asset.id)}
                          className="text-yellow hover:text-yellow p-1 rounded"
                          title="Movimentar"
                        >
                          <Move className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleMaintenance(asset.id)}
                          className="text-orange hover:text-orange p-1 rounded"
                          title="Manutenção"
                        >
                          <Wrench className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleGenerateTag(asset.id)}
                          className="text-cyan hover:text-cyan-dim p-1 rounded"
                          title="Gerar etiqueta"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleHistory(asset.id)}
                          className="text-secondary-400 hover:text-secondary-300 p-1 rounded"
                          title="Histórico"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}