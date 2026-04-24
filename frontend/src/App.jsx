import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import StoreList from './pages/StoreList';
import StoreDetail from './pages/StoreDetail';
import Deals from './pages/Deals';
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishlistPage';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import OrdersPage from './pages/OrdersPage';
import Profile from './pages/customer/Profile';
import CustomerLoyalty from './pages/customer/CustomerLoyalty';
import StoreOverview from './pages/storeOwner/StoreOverview';
import StoreProducts from './pages/storeOwner/StoreProducts';
import StoreOrders from './pages/storeOwner/StoreOrders';
import ManagerEmployees from './pages/storeOwner/ManagerEmployees';
import ManagerAttendance from './pages/storeOwner/ManagerAttendance';
import ManagerLeaves from './pages/storeOwner/ManagerLeaves';
import ManagerReturns from './pages/storeOwner/ManagerReturns';
import ManagerTargets from './pages/storeOwner/ManagerTargets';
import ManagerPerformance from './pages/storeOwner/ManagerPerformance';
import ManagerInventory from './pages/storeOwner/ManagerInventory';
import ManagerSupplierPayments from './pages/storeOwner/ManagerSupplierPayments';
import AdminOverview from './pages/admin/AdminOverview';
import AdminUsers from './pages/admin/AdminUsers';
import AdminStores from './pages/admin/AdminStores';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/AdminOrders';
import AdminVouchers from './pages/admin/AdminVouchers';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import AdminExpenses from './pages/admin/AdminExpenses';
import AdminFinancials from './pages/admin/AdminFinancials';
import AdminInventory from './pages/admin/AdminInventory';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminProducts from './pages/admin/AdminProducts';
import AdminPayroll from './pages/admin/AdminPayroll';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminReturns from './pages/admin/AdminReturns';
import AdminBarcodes from './pages/admin/AdminBarcodes';
import AdminSupplierPayments from './pages/admin/AdminSupplierPayments';
import AdminSalesTracking from './pages/admin/AdminSalesTracking';
import AdminPredictions from './pages/admin/AdminPredictions';
import AdminOvertime from './pages/admin/AdminOvertime';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminLeaves from './pages/admin/AdminLeaves';
import AdminTargets from './pages/admin/AdminTargets';
import BarcodeGenerator from './pages/barcode/BarcodeGenerator';
import CashierLogin from './pages/cashier/CashierLogin';
import POSScreen from './pages/cashier/POSScreen';
import DeliveryDashboard from './pages/delivery/DeliveryDashboard';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeProfile from './pages/employee/EmployeeProfile';
import EmployeeAttendance from './pages/employee/EmployeeAttendance';
import EmployeeLeaves from './pages/employee/EmployeeLeaves';
import EmployeeReturns from './pages/employee/EmployeeReturns';
import EmployeeSalary from './pages/employee/EmployeeSalary';
import EmployeeOvertime from './pages/employee/EmployeeOvertime';
import CashierStock from './pages/employee/CashierStock';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useSettingsStore from './store/settingsStore';

const AppLayout = ({ children }) => {
  const location = useLocation();
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);
  const isPOS = location.pathname === '/pos' || location.pathname === '/cashier-login';
  if (isPOS) return <>{children}</>;
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/stores" element={<StoreList />} />
          <Route path="/store/:id" element={<StoreDetail />} />
          <Route path="/deals" element={<Deals />} />

          {/* Customer */}
          <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
          <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/order-confirmation/:id" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/loyalty" element={<ProtectedRoute><CustomerLoyalty /></ProtectedRoute>} />

          {/* Manager */}
          <Route path="/manager" element={<ProtectedRoute roles={['manager']}><StoreOverview /></ProtectedRoute>} />
          <Route path="/manager/products" element={<ProtectedRoute roles={['manager']}><StoreProducts /></ProtectedRoute>} />
          <Route path="/manager/orders" element={<ProtectedRoute roles={['manager']}><StoreOrders /></ProtectedRoute>} />
          <Route path="/manager/returns" element={<ProtectedRoute roles={['manager']}><ManagerReturns /></ProtectedRoute>} />
          <Route path="/manager/employees" element={<ProtectedRoute roles={['manager']}><ManagerEmployees /></ProtectedRoute>} />
          <Route path="/manager/attendance" element={<ProtectedRoute roles={['manager']}><ManagerAttendance /></ProtectedRoute>} />
          <Route path="/manager/leaves" element={<ProtectedRoute roles={['manager']}><ManagerLeaves /></ProtectedRoute>} />
          <Route path="/manager/targets" element={<ProtectedRoute roles={['manager']}><ManagerTargets /></ProtectedRoute>} />
          <Route path="/manager/performance" element={<ProtectedRoute roles={['manager']}><ManagerPerformance /></ProtectedRoute>} />
          <Route path="/manager/inventory" element={<ProtectedRoute roles={['manager']}><Navigate to="/manager/products" replace /></ProtectedRoute>} />
          <Route path="/manager/supplier-payments" element={<ProtectedRoute roles={['manager']}><ManagerSupplierPayments /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminOverview /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/employees" element={<ProtectedRoute roles={['admin']}><AdminEmployees /></ProtectedRoute>} />
          <Route path="/admin/attendance" element={<ProtectedRoute roles={['admin']}><AdminAttendance /></ProtectedRoute>} />
          <Route path="/admin/leaves" element={<ProtectedRoute roles={['admin']}><AdminLeaves /></ProtectedRoute>} />
          <Route path="/admin/stores" element={<ProtectedRoute roles={['admin']}><AdminStores /></ProtectedRoute>} />
          <Route path="/admin/categories" element={<ProtectedRoute roles={['admin']}><AdminCategories /></ProtectedRoute>} />
          <Route path="/admin/products" element={<ProtectedRoute roles={['admin']}><AdminProducts /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute roles={['admin']}><AdminOrders /></ProtectedRoute>} />
          <Route path="/admin/returns" element={<ProtectedRoute roles={['admin']}><AdminReturns /></ProtectedRoute>} />
          <Route path="/admin/vouchers" element={<ProtectedRoute roles={['admin']}><AdminVouchers /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={['admin']}><AdminReports /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} />
          <Route path="/admin/expenses" element={<ProtectedRoute roles={['admin']}><AdminExpenses /></ProtectedRoute>} />
          <Route path="/admin/financials" element={<ProtectedRoute roles={['admin']}><AdminFinancials /></ProtectedRoute>} />
          <Route path="/admin/payroll" element={<ProtectedRoute roles={['admin']}><AdminPayroll /></ProtectedRoute>} />
          <Route path="/admin/inventory" element={<ProtectedRoute roles={['admin']}><Navigate to="/admin/products" replace /></ProtectedRoute>} />
          <Route path="/admin/promotions" element={<ProtectedRoute roles={['admin']}><AdminPromotions /></ProtectedRoute>} />
          <Route path="/admin/barcodes" element={<ProtectedRoute roles={['admin']}><AdminBarcodes /></ProtectedRoute>} />
          <Route path="/admin/supplier-payments" element={<ProtectedRoute roles={['admin']}><AdminSupplierPayments /></ProtectedRoute>} />
          <Route path="/admin/sales-tracking" element={<ProtectedRoute roles={['admin']}><AdminSalesTracking /></ProtectedRoute>} />
          <Route path="/admin/predictions" element={<ProtectedRoute roles={['admin']}><AdminPredictions /></ProtectedRoute>} />
          <Route path="/admin/overtime" element={<ProtectedRoute roles={['admin']}><AdminOvertime /></ProtectedRoute>} />
          <Route path="/admin/targets" element={<ProtectedRoute roles={['admin']}><AdminTargets /></ProtectedRoute>} />

          {/* Barcode Generator (Admin + Manager + Cashier) */}
          <Route path="/barcode-generator" element={<ProtectedRoute roles={['admin', 'manager', 'cashier']}><BarcodeGenerator /></ProtectedRoute>} />

          {/* Cashier */}
          <Route path="/cashier-login" element={<CashierLogin />} />
          <Route path="/pos" element={<ProtectedRoute roles={['cashier', 'manager', 'admin']}><POSScreen /></ProtectedRoute>} />

          {/* Delivery */}
          <Route path="/delivery" element={<ProtectedRoute roles={['deliveryGuy']}><DeliveryDashboard /></ProtectedRoute>} />

          {/* Employee Self-Service */}
          <Route path="/employee" element={<ProtectedRoute roles={['cashier', 'deliveryGuy', 'stockEmployee']}><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/employee/profile" element={<ProtectedRoute roles={['cashier', 'deliveryGuy', 'stockEmployee']}><EmployeeProfile /></ProtectedRoute>} />
          <Route path="/employee/attendance" element={<ProtectedRoute roles={['cashier', 'deliveryGuy', 'stockEmployee']}><EmployeeAttendance /></ProtectedRoute>} />
          <Route path="/employee/leaves" element={<ProtectedRoute roles={['cashier', 'deliveryGuy', 'stockEmployee']}><EmployeeLeaves /></ProtectedRoute>} />
          {/* Returns removed from cashier — only manager/admin have return access */}
          <Route path="/employee/salary" element={<ProtectedRoute roles={['cashier', 'deliveryGuy', 'stockEmployee']}><EmployeeSalary /></ProtectedRoute>} />
          <Route path="/employee/overtime" element={<ProtectedRoute roles={['cashier', 'deliveryGuy', 'stockEmployee', 'manager']}><EmployeeOvertime /></ProtectedRoute>} />
          <Route path="/employee/stock" element={<ProtectedRoute roles={['cashier', 'stockEmployee']}><CashierStock /></ProtectedRoute>} />
        </Routes>
      </AppLayout>
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
    </Router>
  );
}

export default App;
