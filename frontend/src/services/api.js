import axios from 'axios';

// Use environment variable for API base URL
// In production (Netlify): set VITE_API_URL in Netlify dashboard
// In development: falls back to empty string (uses Vite proxy)

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api',
  timeout: 30000, // 30s timeout (Render free tier cold starts can be slow)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
API.interceptors.request.use((config) => {
  try {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      const parsed = JSON.parse(userInfo);
      if (parsed?.token) {
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    }
  } catch (e) {
    // Corrupted localStorage data — clear it
    console.warn('Corrupted auth data in localStorage, clearing...');
    localStorage.removeItem('userInfo');
  }
  return config;
});

// Response interceptor: auto-logout on 401 (expired/invalid token)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear ALL auth-related storage
      localStorage.removeItem('userInfo');
      sessionStorage.clear();

      // Only redirect if not already on a login page
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/cashier-login' && path !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = (data) => API.post('/auth/login', data);
export const registerUser = (data) => API.post('/auth/register', data);
export const requestRegistrationOtp = (data) => API.post('/auth/register/request-otp', data);
export const verifyRegistrationOtp = (data) => API.post('/auth/register/verify-otp', data);
export const getMe = () => API.get('/auth/me');
export const updateProfile = (data) => API.put('/auth/profile', data);

// Products
export const getProducts = (params) => API.get('/products', { params });
export const getProductById = (id) => API.get(`/products/${id}`);
export const searchProducts = (q) => API.get('/products/search', { params: { q } });
export const getFeaturedProducts = () => API.get('/products/featured');
export const getDeals = () => API.get('/products/deals');
export const getMyStoreProducts = () => API.get('/products/my-store');
export const createProduct = (data) => API.post('/products', data);
export const updateProduct = (id, data) => API.put(`/products/${id}`, data);
export const deleteProduct = (id) => API.delete(`/products/${id}`);
export const getPriceHistory = (id) => API.get(`/products/${id}/price-history`);

// Categories
export const getCategories = () => API.get('/categories');
export const createCategory = (data) => API.post('/categories', data);
export const updateCategory = (id, data) => API.put(`/categories/${id}`, data);
export const deleteCategory = (id) => API.delete(`/categories/${id}`);

// Stores
export const getStores = () => API.get('/stores');
export const getStoreById = (id) => API.get(`/stores/${id}`);
export const getMyStore = () => API.get('/stores/my');
export const createStore = (data) => API.post('/stores', data);
export const updateStore = (id, data) => API.put(`/stores/${id}`, data);

// Cart
export const getCart = () => API.get('/cart');
export const addToCart = (data) => API.post('/cart/add', data);
export const updateCartItem = (data) => API.put('/cart/update', data);
export const removeFromCart = (productId) => API.delete(`/cart/remove/${productId}`);
export const clearCart = () => API.delete('/cart/clear');

// Wishlist
export const getWishlist = () => API.get('/wishlist');
export const addToWishlist = (productId) => API.post(`/wishlist/${productId}`);
export const removeFromWishlist = (productId) => API.delete(`/wishlist/${productId}`);

// Reviews
export const getProductReviews = (productId) => API.get(`/reviews/product/${productId}`);
export const createReview = (productId, data) => API.post(`/reviews/product/${productId}`, data);
export const updateReview = (id, data) => API.put(`/reviews/${id}`, data);
export const deleteReview = (id) => API.delete(`/reviews/${id}`);

// Orders
export const createOrder = (data) => API.post('/orders', data);
export const getMyOrders = () => API.get('/orders/my');
export const getOrderById = (id) => API.get(`/orders/${id}`);
export const getStoreOrders = () => API.get('/orders/store');
export const updateOrderStatus = (id, data) => API.put(`/orders/${id}/status`, data);
export const getPayHereHash = (orderId) => API.post(`/orders/${orderId}/payhere-hash`);
export const getPosPayHereHash = (data) => API.post('/orders/pos/payhere-hash', data);
export const requestOrderPaymentOtp = (orderId) => API.post(`/orders/${orderId}/payment-otp/request`);
export const verifyOrderPaymentOtp = (orderId, data) => API.post(`/orders/${orderId}/payment-otp/verify`, data);
export const cancelMyOrder = (orderId, data) => API.put(`/orders/${orderId}/cancel`, data);

// Admin
export const getAdminStats = () => API.get('/admin/stats');
export const getAdminUsers = () => API.get('/admin/users');
export const updateUserRole = (id, data) => API.put(`/admin/users/${id}/role`, data);
export const toggleUserStatus = (id) => API.put(`/admin/users/${id}/toggle-status`);
export const deleteUser = (id) => API.delete(`/admin/users/${id}`);
export const getAdminStores = () => API.get('/admin/stores');
export const toggleStoreStatus = (id) => API.put(`/admin/stores/${id}/toggle`);
export const getAdminOrders = () => API.get('/admin/orders');
export const getAdminProducts = () => API.get('/admin/products');
export const approveOrder = (id) => API.put(`/admin/orders/${id}/approve`);
export const cancelOrder = (id, data) => API.put(`/admin/orders/${id}/cancel`, data);

// POS (Cashier)
export const getPosProducts = (params) => API.get('/pos/products', { params });
export const getProductByBarcode = (code) => API.get(`/pos/products/barcode/${code}`);
export const posCheckout = (data) => API.post('/pos/checkout', data);
export const getPosOrders = () => API.get('/pos/orders');
export const getPosOrderById = (id) => API.get(`/pos/orders/${id}`);
export const getActivePosSession = () => API.get('/pos/session/active');
export const startPosSession = (data) => API.post('/pos/session/start', data);
export const endPosSession = (data) => API.post('/pos/session/end', data);

// Notifications
export const getNotifications = (params) => API.get('/notifications', { params });
export const getUnreadCount = () => API.get('/notifications/unread-count');
export const markNotificationRead = (id) => API.put(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => API.put('/notifications/read-all');

// Currency
export const getExchangeRate = () => API.get('/currency/rate');

// Loyalty (Phase 3)
export const getMyLoyaltyPoints = () => API.get('/loyalty/points');
export const getLoyaltyHistory = () => API.get('/loyalty/history');
export const redeemPoints = (data) => API.post('/loyalty/redeem', data);
export const issueBonusPoints = (data) => API.post('/loyalty/bonus', data);
export const applyVoucher = (data) => API.post('/loyalty/voucher/apply', data);
export const applyPromoCode = (data) => API.post('/loyalty/promo/apply', data);
export const getAvailableVouchers = () => API.get('/loyalty/vouchers');
export const claimVoucher = (code) => API.post(`/loyalty/vouchers/${code}/claim`);

// Delivery (Phase 4)
export const getDeliveryOrders = () => API.get('/delivery/orders');
export const updateDeliveryStatus = (id, data) => API.put(`/delivery/orders/${id}/status`, data);
export const getDeliveryHistory = () => API.get('/delivery/history');
export const getDeliveryEarnings = () => API.get('/delivery/earnings');
export const assignDeliveryGuy = (orderId, data) => API.post(`/delivery/assign/${orderId}`, data);
export const getAvailableDeliveryGuys = (params) => API.get('/delivery/available', { params });
export const markDeliveryPaymentSuccess = (id) => API.put(`/delivery/orders/${id}/payment-success`);

// HR (Phase 5)
export const checkIn = () => API.post('/hr/attendance/check-in');
export const checkOut = () => API.post('/hr/attendance/check-out');
export const getMyAttendance = (params) => API.get('/hr/attendance', { params });
export const getAttendanceReport = (params) => API.get('/hr/attendance/report', { params });
export const requestLeave = (data) => API.post('/hr/leaves', data);
export const getMyLeaves = () => API.get('/hr/leaves');
export const approveLeave = (id) => API.put(`/hr/leaves/${id}/approve`);
export const rejectLeave = (id, data) => API.put(`/hr/leaves/${id}/reject`, data);
export const getEmployees = (params) => API.get('/hr/employees', { params });
export const addEmployee = (data) => API.post('/hr/employees', data);
export const updateEmployee = (id, data) => API.put(`/hr/employees/${id}`, data);
export const getStoreLeaves = (params) => API.get('/hr/leaves/store', { params });
export const adminMarkAttendance = (data) => API.post('/hr/attendance/mark', data);
export const adminCreateLeave = (data) => API.post('/hr/leaves/create-for-employee', data);

// Breaks
export const startBreak = (data) => API.post('/hr/breaks/start', data);
export const endBreak = () => API.post('/hr/breaks/end');
export const getActiveBreak = () => API.get('/hr/breaks/active');
export const getBreakHistory = (params) => API.get('/hr/breaks', { params });

// Targets & Performance
export const createTarget = (data) => API.post('/hr/targets', data);
export const getTargets = (params) => API.get('/hr/targets', { params });
export const getMyTargets = () => API.get('/hr/targets/me');
export const updateTargetProgress = (id, data) => API.put(`/hr/targets/${id}/progress`, data);
export const payTargetBonus = (id) => API.put(`/hr/targets/${id}/pay-bonus`);
export const deleteTarget = (id) => API.delete(`/hr/targets/${id}`);
export const getEmployeePerformance = (employeeId) => API.get(`/hr/performance/${employeeId}`);

// Payroll (Phase 5)
export const calculateSalary = (data) => API.post('/payroll/calculate', data);
export const processSalaryPayment = (data) => API.post('/payroll/pay', data);
export const getSalaryHistory = (employeeId) => API.get(`/payroll/history/${employeeId}`);
export const getPayrollReport = (params) => API.get('/payroll/report', { params });
export const exportSalaryHistory = (employeeId, params) =>
  API.get(`/payroll/history/${employeeId}/export`, { params, responseType: 'blob' });

// Settings
export const getSettings = () => API.get('/settings');
export const updateSettings = (data) => API.put('/settings', data);
export const uploadLogo = (formData) => API.post('/settings/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Expenses
export const getExpenses = (params) => API.get('/expenses', { params });
export const getExpenseSummary = (params) => API.get('/expenses/summary', { params });
export const createExpense = (data) => API.post('/expenses', data);
export const updateExpense = (id, data) => API.put(`/expenses/${id}`, data);
export const deleteExpense = (id) => API.delete(`/expenses/${id}`);

// Finance
export const getFinancialDashboard = (params) => API.get('/finance/dashboard', { params });
export const getAdditionalIncomes = (params) => API.get('/finance/income', { params });
export const addAdditionalIncome = (data) => API.post('/finance/income', data);
export const updateAdditionalIncome = (id, data) => API.put(`/finance/income/${id}`, data);
export const deleteAdditionalIncome = (id) => API.delete(`/finance/income/${id}`);

// Suppliers + Stock
export const getSuppliers = (params) => API.get('/suppliers', { params });
export const createSupplier = (data) => API.post('/suppliers', data);
export const updateSupplier = (id, data) => API.put(`/suppliers/${id}`, data);
export const deleteSupplier = (id) => API.delete(`/suppliers/${id}`);

export const getStockReceipts = (params) => API.get('/stock/receipts', { params });
export const createStockReceipt = (data) => API.post('/stock/receipts', data);
export const getSupplierReturns = (params) => API.get('/stock/supplier-returns', { params });
export const createSupplierReturn = (data) => API.post('/stock/supplier-returns', data);

// Customer Returns
export const createCustomerReturn = (data) => API.post('/returns/customer', data);
export const getCustomerReturns = (params) => API.get('/returns/customer', { params });
export const approveCustomerReturn = (id, data) => API.put(`/returns/customer/${id}/approve`, data);
export const rejectCustomerReturn = (id, data) => API.put(`/returns/customer/${id}/reject`, data);
export const getReturnOrder = (id) => API.get(`/returns/orders/${id}`);
export const managerApproveCustomerReturn = (id, data) => API.put(`/returns/customer/${id}/manager-approve`, data);
export const managerRejectCustomerReturn = (id, data) => API.put(`/returns/customer/${id}/manager-reject`, data);
export const exportCustomerReturnsReport = (params) =>
  API.get('/returns/customer/export', { params, responseType: 'blob' });

// Barcode Generator
export const logBarcodeGeneration = (data) => API.post('/barcodes/generate', data);
export const getBarcodeLogs = (params) => API.get('/barcodes/logs', { params });

// Supplier Payments
export const getSupplierPaymentSummary = (params) => API.get('/supplier-payments/summary', { params });
export const getSupplierPayments = (params) => API.get('/supplier-payments/payments', { params });
export const getSupplierLedger = (supplierId, params) => API.get(`/supplier-payments/${supplierId}/ledger`, { params });
export const recordSupplierPayment = (supplierId, data) => API.post(`/supplier-payments/${supplierId}/pay`, data);
export const recordSupplierPurchase = (supplierId, data) => API.post(`/supplier-payments/${supplierId}/purchase`, data);

// Sales Tracking
export const getCashierSalesReport = (params) => API.get('/pos/cashier-report', { params });

// Predictions
export const getSalesPredictions = (params) => API.get('/predictions/sales', { params });

// Promotions
export const getPromotions = (params) => API.get('/promotions', { params });
export const getActivePromotions = () => API.get('/promotions/active');
export const createPromotion = (data) => API.post('/promotions', data);
export const updatePromotion = (id, data) => API.put(`/promotions/${id}`, data);
export const togglePromotion = (id) => API.put(`/promotions/${id}/toggle`);
export const deletePromotion = (id) => API.delete(`/promotions/${id}`);
// Overtime Pay
export const getOvertimeRecords = (params) => API.get('/overtime', { params });
export const getOvertimeSummary = (params) => API.get('/overtime/summary', { params });
export const createOvertimeRecord = (data) => API.post('/overtime', data);
export const markOvertimePaid = (id) => API.put(`/overtime/${id}/pay`);
export const rejectOvertimeRecord = (id) => API.put(`/overtime/${id}/reject`);
export const deleteOvertimeRecord = (id) => API.delete(`/overtime/${id}`);
export const getEmployeeOTReport = (employeeId, params) => API.get(`/overtime/employee/${employeeId}`, { params });
export const getMyOvertime = (params) => API.get('/overtime/my', { params });

export default API;
