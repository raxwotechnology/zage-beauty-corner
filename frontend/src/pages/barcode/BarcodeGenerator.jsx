import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Printer, Download, Package, Barcode, Plus, Minus, Store } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import DashboardLayout from '../../components/DashboardLayout';
import { getAdminProducts, logBarcodeGeneration, getSettings } from '../../services/api';
import useAuthStore from '../../store/authStore';
import { toast } from 'react-toastify';

// Dynamic nav items based on role
import { adminNavGroups } from '../admin/adminNavItems';
import { managerNavGroups } from '../storeOwner/managerNavItems';
import { getEmployeeNavGroups } from '../employee/employeeNav';

const BarcodeGenerator = () => {
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(12);
  const [shopName, setShopName] = useState('Zage Fashion Corner');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    loadProducts();
    loadSettings();
  }, []);

  const loadProducts = async () => {
    try {
      const { data } = await getAdminProducts();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data } = await getSettings();
      if (data?.shopName) setShopName(data.shopName);
    } catch { /* use default */ }
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(search.toLowerCase())
  );

  const getBarcodeValue = (product) => {
    return product.barcode || product.sku || `ZFC-${product._id?.slice(-8).toUpperCase()}`;
  };

  const handleGenerate = async () => {
    if (!selectedProduct) {
      toast.warning('Please select a product first');
      return;
    }
    setGenerating(true);
    try {
      await logBarcodeGeneration({
        productId: selectedProduct._id,
        quantity,
      });
      setGenerated(true);
      toast.success(`${quantity} barcode labels generated & logged!`);
      setTimeout(() => renderBarcodes(), 100);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate barcodes');
    } finally {
      setGenerating(false);
    }
  };

  const renderBarcodes = useCallback(() => {
    if (!selectedProduct) return;
    const barcodeValue = getBarcodeValue(selectedProduct);
    const svgs = document.querySelectorAll('.barcode-svg');
    svgs.forEach(svg => {
      try {
        JsBarcode(svg, barcodeValue, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 11,
          margin: 2,
          textMargin: 2,
        });
      } catch { /* ignore invalid */ }
    });
  }, [selectedProduct]);

  useEffect(() => {
    if (generated && selectedProduct) {
      setTimeout(() => renderBarcodes(), 50);
    }
  }, [generated, selectedProduct, quantity, renderBarcodes]);

  const handlePrint = () => {
    window.print();
  };

  // Determine nav items based on user role — use GROUPS for DashboardLayout
  const getNavItems = () => {
    if (user?.role === 'admin') return adminNavGroups;
    if (user?.role === 'manager') return managerNavGroups || [];
    return getEmployeeNavGroups(user?.role);
  };

  const dashTitle = user?.role === 'admin' ? 'Zage Admin Panel' :
    user?.role === 'manager' ? 'Store Dashboard' : 'Employee Portal';

  return (
    <DashboardLayout navItems={getNavItems()} title={dashTitle}>
      <div className="no-print">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-dark-navy flex items-center gap-2">
            <Barcode size={24} /> Barcode Generator
          </h1>
          <p className="text-muted-text text-sm mt-1">Generate print-ready barcode labels for products</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left — Product Selection */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
              <h2 className="font-semibold text-dark-navy mb-3 flex items-center gap-2">
                <Package size={18} /> Select Product
              </h2>
              <div className="relative mb-3">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, SKU, or barcode..."
                  className="w-full border border-card-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {loading ? (
                  <div className="text-center py-6 text-muted-text text-sm">Loading products...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-6 text-muted-text text-sm">No products found</div>
                ) : (
                  filteredProducts.slice(0, 30).map(product => (
                    <div
                      key={product._id}
                      onClick={() => { setSelectedProduct(product); setGenerated(false); }}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedProduct?._id === product._id
                          ? 'border-rose-300 bg-rose-50 shadow-sm'
                          : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark-navy truncate">{product.name}</p>
                        <p className="text-xs text-muted-text">
                          SKU: {product.sku || 'N/A'} • Rs. {product.price?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right — Settings & Preview */}
          <div className="space-y-4">
            {/* Label Settings */}
            <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
              <h2 className="font-semibold text-dark-navy mb-3 flex items-center gap-2">
                <Store size={18} /> Label Settings
              </h2>

              {selectedProduct ? (
                <div className="space-y-4">
                  {/* Product Info */}
                  <div className="bg-rose-50 rounded-xl p-4">
                    <p className="font-semibold text-dark-navy">{selectedProduct.name}</p>
                    <p className="text-sm text-muted-text mt-1">
                      SKU: {selectedProduct.sku || 'N/A'} • Price: Rs. {selectedProduct.price?.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-text mt-1">
                      Barcode: {getBarcodeValue(selectedProduct)}
                    </p>
                  </div>

                  {/* Shop Name */}
                  <div>
                    <label className="text-xs font-medium text-muted-text block mb-1">Shop Name on Label</label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      className="w-full border border-card-border rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="text-xs font-medium text-muted-text block mb-1">Number of Labels</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-9 h-9 rounded-lg border border-card-border flex items-center justify-center hover:bg-gray-50"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={e => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                        className="w-20 text-center border border-card-border rounded-xl py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-400"
                      />
                      <button
                        onClick={() => setQuantity(Math.min(500, quantity + 1))}
                        className="w-9 h-9 rounded-lg border border-card-border flex items-center justify-center hover:bg-gray-50"
                      >
                        <Plus size={16} />
                      </button>
                      {/* Quick presets */}
                      {[12, 24, 48].map(n => (
                        <button
                          key={n}
                          onClick={() => setQuantity(n)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            quantity === n ? 'bg-rose-600 text-white' : 'bg-gray-100 text-muted-text hover:bg-gray-200'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-fuchsia-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-md disabled:opacity-50"
                  >
                    <Barcode size={18} />
                    {generating ? 'Generating...' : `Generate ${quantity} Labels`}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-text">
                  <Package size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Select a product from the left to get started</p>
                </div>
              )}
            </div>

            {/* Single Label Preview */}
            {selectedProduct && generated && (
              <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
                <h2 className="font-semibold text-dark-navy mb-3">Label Preview</h2>
                <div className="border border-gray-200 rounded-xl p-4 text-center" style={{ maxWidth: '220px', margin: '0 auto' }}>
                  <p className="text-[10px] font-bold text-gray-700 mb-0.5">{shopName}</p>
                  <p className="text-xs font-semibold text-dark-navy truncate">{selectedProduct.name}</p>
                  <p className="text-sm font-bold text-rose-600 my-1">Rs. {selectedProduct.price?.toFixed(2)}</p>
                  <svg className="barcode-svg mx-auto" style={{ maxWidth: '180px' }}></svg>
                  <p className="text-[9px] text-gray-500 mt-0.5">SKU: {selectedProduct.sku || 'N/A'}</p>
                </div>

                <button
                  onClick={handlePrint}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-dark-navy hover:bg-gray-800 text-white font-medium py-2.5 rounded-xl transition-colors"
                >
                  <Printer size={16} /> Print {quantity} Labels
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ PRINT AREA — only visible when printing ═══════ */}
      {generated && selectedProduct && (
        <div className="print-only" ref={printRef}>
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              .print-only, .print-only * { visibility: visible !important; }
              .print-only {
                position: fixed !important;
                left: 0; top: 0;
                width: 210mm;
                padding: 5mm;
              }
              .no-print { display: none !important; }
              .barcode-grid {
                display: grid !important;
                grid-template-columns: repeat(3, 1fr) !important;
                gap: 2mm !important;
                page-break-inside: auto !important;
              }
              .barcode-label {
                border: 0.5pt solid #ccc !important;
                padding: 3mm !important;
                text-align: center !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `}</style>
          <div className="barcode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            {Array.from({ length: quantity }).map((_, i) => (
              <div key={i} className="barcode-label" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                <p style={{ fontSize: '8px', fontWeight: 700, margin: '0 0 1px', color: '#333' }}>{shopName}</p>
                <p style={{ fontSize: '10px', fontWeight: 600, margin: '0 0 2px', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedProduct.name}
                </p>
                <p style={{ fontSize: '12px', fontWeight: 700, margin: '2px 0', color: '#c026d3' }}>
                  Rs. {selectedProduct.price?.toFixed(2)}
                </p>
                <svg className="barcode-svg" style={{ maxWidth: '160px', display: 'block', margin: '0 auto' }}></svg>
                <p style={{ fontSize: '7px', color: '#888', margin: '1px 0 0' }}>SKU: {selectedProduct.sku || 'N/A'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default BarcodeGenerator;
