import axios from 'axios';

const API = axios.create({
  baseURL: 'https://fresh-cart-n6l6.onrender.com/api',
});

API.interceptors.request.use((config) => {
  const userInfo = localStorage.getItem('userInfo');
  if (userInfo) {
    const { token } = JSON.parse(userInfo);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-logout on 401 (expired/invalid token)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('userInfo');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login' && window.location.pathname !== '/cashier-login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = (data) => API.post('/auth/login', data);
export const registerUser = (data) => API.post('/auth/register', data);
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

// Admin
export const getAdminStats = () => API.get('/admin/stats');
export const getAdminUsers = () => API.get('/admin/users');
export const updateUserRole = (id, data) => API.put(`/admin/users/${id}/role`, data);
export const deleteUser = (id) => API.delete(`/admin/users/${id}`);
export const getAdminStores = () => API.get('/admin/stores');
export const toggleStoreStatus = (id) => API.put(`/admin/stores/${id}/toggle`);
export const getAdminOrders = () => API.get('/admin/orders');

// POS (Cashier)
export const getPosProducts = (params) => API.get('/pos/products', { params });
export const getProductByBarcode = (code) => API.get(`/pos/products/barcode/${code}`);
export const posCheckout = (data) => API.post('/pos/checkout', data);
export const getPosOrders = () => API.get('/pos/orders');
export const getPosOrderById = (id) => API.get(`/pos/orders/${id}`);

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

// Delivery (Phase 4)
export const getDeliveryOrders = () => API.get('/delivery/orders');
export const updateDeliveryStatus = (id, data) => API.put(`/delivery/orders/${id}/status`, data);
export const getDeliveryHistory = () => API.get('/delivery/history');
export const getDeliveryEarnings = () => API.get('/delivery/earnings');
export const assignDeliveryGuy = (orderId, data) => API.post(`/delivery/assign/${orderId}`, data);

// HR (Phase 5)
export const checkIn = () => API.post('/hr/attendance/check-in');
export const checkOut = () => API.post('/hr/attendance/check-out');
export const getMyAttendance = (params) => API.get('/hr/attendance', { params });
export const getAttendanceReport = (params) => API.get('/hr/attendance/report', { params });
export const requestLeave = (data) => API.post('/hr/leaves', data);
export const getMyLeaves = () => API.get('/hr/leaves');
export const approveLeave = (id) => API.put(`/hr/leaves/${id}/approve`);
export const rejectLeave = (id, data) => API.put(`/hr/leaves/${id}/reject`, data);
export const getEmployees = () => API.get('/hr/employees');
export const addEmployee = (data) => API.post('/hr/employees', data);
export const updateEmployee = (id, data) => API.put(`/hr/employees/${id}`, data);

// Payroll (Phase 5)
export const calculateSalary = (data) => API.post('/payroll/calculate', data);
export const processSalaryPayment = (data) => API.post('/payroll/pay', data);
export const getSalaryHistory = (employeeId) => API.get(`/payroll/history/${employeeId}`);
export const getPayrollReport = (params) => API.get('/payroll/report', { params });

// Settings
export const getSettings = () => API.get('/settings');
export const updateSettings = (data) => API.put('/settings', data);
export const uploadLogo = (formData) => API.post('/settings/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export default API;
