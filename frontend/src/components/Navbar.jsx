import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, User, Search, MapPin, Menu, X, ChevronDown, RefreshCw, Home, ShoppingBag, Heart, Package, LayoutDashboard, Tag } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useCartStore from '../store/cartStore';
import useCurrencyStore from '../store/currencyStore';
import { searchProducts } from '../services/api';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const cartCount = useCartStore((s) => s.getCount());
  const fetchCart = useCartStore((s) => s.fetchCart);
  const { currency, toggleCurrency, fetchRate, getProductPrice } = useCurrencyStore();

  useEffect(() => {
    if (user) fetchCart();
    fetchRate();
  }, [user]);

  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  // Handle search with debounce
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    clearTimeout(searchTimeout.current);

    if (value.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await searchProducts(value);
        setSearchResults(res.data.products.slice(0, 6));
        setShowSearchResults(true);
      } catch (err) {
        console.error(err);
      }
    }, 300);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchResults(false);
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  // Close search results on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Navigation links with role visibility
  const navLinks = [
    { path: '/', label: 'Home', icon: Home, show: true },
    { path: '/shop', label: 'Shop', icon: ShoppingBag, show: true },
    { path: '/deals', label: 'Deals', icon: Tag, show: true },
    { path: '/stores', label: 'Stores', icon: MapPin, show: true },
  ];

  const getDashboardLink = () => {
    if (!user) return null;
    switch (user.role) {
      case 'admin': return { path: '/admin', label: 'Admin Panel', emoji: '🛡️' };
      case 'manager': return { path: '/manager', label: 'Dashboard', emoji: '📊' };
      case 'cashier': return { path: '/employee', label: 'My Portal', emoji: '👤' };
      case 'deliveryGuy': return { path: '/employee', label: 'My Portal', emoji: '👤' };
      case 'stockEmployee': return { path: '/employee', label: 'My Portal', emoji: '👤' };
      default: return null;
    }
  };

  const dashLink = getDashboardLink();
  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      {/* Top Utility Bar */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white text-xs">
        <div className="base-container py-1.5 flex items-center justify-between">
          <span className="hidden sm:inline">🚚 Free delivery on orders over Rs. 5,000</span>
          <span className="sm:hidden text-[11px]">🚚 Free delivery over Rs.5,000</span>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline">📞 +94 11 255 5000</span>
            {/* Currency Toggle */}
            <button
              onClick={toggleCurrency}
              className="flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-0.5 transition-colors backdrop-blur-sm text-[11px] font-semibold"
              title="Toggle currency"
            >
              <RefreshCw size={10} className="opacity-70" />
              <span>{currency === 'LKR' ? 'LKR 🇱🇰' : 'USD 🇺🇸'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="base-container py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="text-2xl font-bold text-primary-green flex-shrink-0">
          FreshCart
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.path)
                  ? 'text-primary-green bg-emerald-50'
                  : 'text-muted-text hover:text-dark-navy hover:bg-gray-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {dashLink && (
            <Link
              to={dashLink.path}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(dashLink.path)
                  ? 'text-primary-green bg-emerald-50'
                  : 'text-violet-600 hover:bg-violet-50'
              }`}
            >
              {dashLink.emoji} {dashLink.label}
            </Link>
          )}
        </nav>

        {/* Search Bar (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-md" ref={searchRef}>
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              placeholder="Search for fresh groceries..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full border border-card-border rounded-full py-2.5 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-green focus:border-transparent transition-all text-sm"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary-green text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors"
            >
              <Search size={16} />
            </button>

            {/* Search Dropdown Results */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white border border-card-border rounded-xl shadow-xl z-50 overflow-hidden">
                {searchResults.map((product) => (
                  <Link
                    key={product._id}
                    to={`/product/${product._id}`}
                    onClick={() => { setShowSearchResults(false); setSearchQuery(''); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors border-b border-card-border last:border-b-0"
                  >
                    <img
                      src={product.images?.[0] || 'https://via.placeholder.com/50'}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-navy m-0 truncate">{product.name}</p>
                      <p className="text-xs text-muted-text m-0">{product.storeId?.name}</p>
                    </div>
                    <span className="text-sm font-bold text-primary-green flex-shrink-0">
                      {getProductPrice(product)}
                    </span>
                  </Link>
                ))}
                <button
                  onClick={handleSearchSubmit}
                  className="w-full text-center py-2.5 text-sm text-primary-green hover:bg-emerald-50 transition-colors font-medium"
                >
                  View all results for "{searchQuery}"
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {/* Notification Bell */}
          {user && <NotificationBell />}

          {/* Wishlist */}
          {user && (
            <Link to="/wishlist" className="hidden sm:flex relative text-muted-text hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50" title="Wishlist">
              <Heart size={20} />
            </Link>
          )}

          {/* Cart */}
          <Link to="/cart" className="relative text-dark-navy hover:text-primary-green transition-colors p-1.5 rounded-lg hover:bg-emerald-50" title="Cart">
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent-orange text-white text-[10px] font-bold rounded-full h-4.5 w-4.5 min-w-[18px] h-[18px] flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {/* User Menu */}
          {user ? (
            <div className="relative group cursor-pointer">
              <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block">
                  <p className="text-xs text-muted-text m-0 leading-tight">Hello, {user.name.split(' ')[0]}</p>
                  <p className="text-xs font-bold text-dark-navy m-0 leading-tight flex items-center gap-0.5">Account <ChevronDown size={12} /></p>
                </div>
              </div>

              {/* Dropdown */}
              <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-card-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1 overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-card-border">
                  <p className="text-sm font-semibold text-dark-navy m-0">{user.name}</p>
                  <p className="text-xs text-muted-text m-0">{user.email}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase bg-primary-green/10 text-primary-green px-2 py-0.5 rounded-full">{user.role}</span>
                </div>
                <Link to="/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-navy hover:bg-emerald-50 hover:text-primary-green transition-colors">
                  <User size={14} /> My Profile
                </Link>
                <Link to="/orders" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-navy hover:bg-emerald-50 hover:text-primary-green transition-colors">
                  <Package size={14} /> Orders
                </Link>
                <Link to="/wishlist" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-navy hover:bg-emerald-50 hover:text-primary-green transition-colors">
                  <Heart size={14} /> Wishlist
                </Link>
                <Link to="/loyalty" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-navy hover:bg-amber-50 hover:text-amber-600 transition-colors">
                  🎁 <span>Loyalty & Rewards</span>
                </Link>
                {dashLink && (
                  <>
                    <hr className="my-1 border-card-border" />
                    <Link to={dashLink.path} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-violet-600 hover:bg-violet-50 font-medium transition-colors">
                      <LayoutDashboard size={14} /> {dashLink.emoji} {dashLink.label}
                    </Link>
                  </>
                )}
                <hr className="my-1 border-card-border" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2.5"
                >
                  ↪ Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="flex items-center gap-2 text-sm font-medium text-dark-navy hover:text-primary-green transition-colors px-3 py-2 rounded-lg hover:bg-gray-50">
                <User size={18} />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
              <Link to="/register" className="hidden sm:flex bg-primary-green text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors shadow-sm">
                Register
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden text-dark-navy p-1.5 rounded-lg hover:bg-gray-50"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-card-border animate-slideDown">
          <div className="base-container py-4 space-y-1">
            {/* Mobile Search */}
            <form onSubmit={handleSearchSubmit} className="mb-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search groceries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-card-border rounded-xl py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-green">
                  <Search size={18} />
                </button>
              </div>
            </form>

            {/* Nav Links */}
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'text-primary-green bg-emerald-50'
                    : 'text-dark-navy hover:bg-gray-50'
                }`}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            ))}

            {/* Dashboard Link */}
            {dashLink && (
              <Link
                to={dashLink.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-violet-600 hover:bg-violet-50 transition-colors"
              >
                <LayoutDashboard size={18} />
                {dashLink.emoji} {dashLink.label}
              </Link>
            )}

            {/* User Links */}
            {user && (
              <>
                <hr className="my-2 border-card-border" />
                <Link to="/orders" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-navy hover:bg-gray-50">
                  <Package size={18} /> My Orders
                </Link>
                <Link to="/wishlist" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-navy hover:bg-gray-50">
                  <Heart size={18} /> Wishlist
                </Link>
                <Link to="/loyalty" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-navy hover:bg-gray-50">
                  🎁 Loyalty & Rewards
                </Link>
              </>
            )}

            {/* Currency Toggle */}
            <hr className="my-2 border-card-border" />
            <button
              onClick={toggleCurrency}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-navy hover:bg-gray-50 w-full"
            >
              <RefreshCw size={18} />
              Switch to {currency === 'LKR' ? 'USD 🇺🇸' : 'LKR 🇱🇰'}
            </button>

            {/* Login/Logout */}
            {user ? (
              <>
                <hr className="my-2 border-card-border" />
                <div className="px-3 py-2 mb-1">
                  <p className="text-sm font-semibold text-dark-navy m-0">{user.name}</p>
                  <p className="text-xs text-muted-text m-0">{user.email}</p>
                </div>
                <Link to="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-navy hover:bg-gray-50 transition-colors">
                  <User size={18} /> My Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  ↪ Logout
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/login" className="flex-1 text-center bg-gray-100 text-dark-navy text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 transition-colors">
                  Sign In
                </Link>
                <Link to="/register" className="flex-1 text-center bg-primary-green text-white text-sm font-medium py-2.5 rounded-xl hover:bg-emerald-600 transition-colors">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
