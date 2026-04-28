import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Star, ArrowRight, Truck, ShieldCheck, Clock3, Gem } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCategories, getFeaturedProducts, getDeals } from '../services/api';
import ProductCard from '../components/ProductCard';
import useSettingsStore from '../store/settingsStore';

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const settings = useSettingsStore((s) => s.settings);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const heroProducts = settings?.heroProducts || [
    { name: 'Luxe Tote Bag', price: 9500, emoji: '👜' },
    { name: 'Radiance Serum', price: 6800, emoji: '✨' },
  ];

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, featRes, dealsRes] = await Promise.all([
          getCategories(),
          getFeaturedProducts(),
          getDeals(),
        ]);
        setCategories(catRes.data);
        setFeatured(featRes.data);
        setDeals(dealsRes.data);
      } catch (error) {
        console.error('Error fetching homepage data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div>
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-[#fff9f5] to-stone-100">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-72 h-72 bg-rose-300 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-neutral-300 rounded-full blur-3xl"></div>
        </div>
        <div className="base-container py-16 md:py-24 flex flex-col md:flex-row items-center justify-between relative z-10">
          <motion.div
            className="md:w-1/2 mb-10 md:mb-0"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="inline-flex items-center gap-2 bg-rose-100 text-rose-700 text-xs font-bold px-4 py-2 rounded-full mb-4 uppercase tracking-wider">
              <Sparkles size={14} /> New Season Beauty Edit
            </span>
            {/* Brand Name - editable from admin settings */}
            <div className="mb-3">
              <p className="text-sm font-bold text-muted-text uppercase tracking-widest mb-1">Welcome to</p>
              <h2 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-rose-500 to-fuchsia-700 bg-clip-text text-transparent leading-tight">
                {settings?.shopName || 'Zage Fashion Corner'}
              </h2>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-dark-navy leading-tight mb-6 mt-0">
              Signature style
              <br />
              <span className="bg-gradient-to-r from-rose-500 to-fuchsia-700 bg-clip-text text-transparent">
                and beauty essentials.
              </span>
            </h1>
            <p className="text-muted-text text-lg mb-8 max-w-lg leading-relaxed">
              Discover premium clothing, skincare, cosmetics, and accessories curated for modern lifestyles. Shop trend-led collections with smooth and secure checkout.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/shop"
                className="bg-primary-green hover:bg-fuchsia-700 text-white font-semibold py-3.5 px-8 rounded-full transition-all shadow-lg shadow-rose-200 hover:shadow-rose-300 inline-flex items-center gap-2"
              >
                Shop Now <ArrowRight size={18} />
              </Link>
              <Link
                to="/deals"
                className="border-2 border-accent-orange text-accent-orange hover:bg-accent-orange hover:text-white font-semibold py-3.5 px-8 rounded-full transition-all inline-flex items-center gap-2"
              >
                Beauty Deals
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="md:w-1/2 flex justify-center"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="relative">
              <div className="w-80 h-80 md:w-96 md:h-96 rounded-full bg-gradient-to-br from-rose-100 to-stone-200 flex items-center justify-center shadow-2xl overflow-hidden border-4 border-white">
                <span className="text-8xl">💄</span>
              </div>
              {/* Floating badges */}
              {heroProducts[0] && (
                <motion.div
                  className="absolute -top-4 right-0 bg-white rounded-2xl shadow-lg p-3 flex items-center gap-2"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <span className="text-2xl">{heroProducts[0].emoji || '👜'}</span>
                  <div>
                    <p className="text-xs font-bold text-dark-navy m-0">{heroProducts[0].name}</p>
                    <p className="text-xs text-primary-green m-0 font-semibold">LKR {Number(heroProducts[0].price).toLocaleString()}</p>
                  </div>
                </motion.div>
              )}
              {heroProducts[1] && (
                <motion.div
                  className="absolute bottom-4 -left-4 bg-white rounded-2xl shadow-lg p-3 flex items-center gap-2"
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity }}
                >
                  <span className="text-2xl">{heroProducts[1].emoji || '✨'}</span>
                  <div>
                    <p className="text-xs font-bold text-dark-navy m-0">{heroProducts[1].name}</p>
                    <p className="text-xs text-primary-green m-0 font-semibold">LKR {Number(heroProducts[1].price).toLocaleString()}</p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== VALUE PROPS ===== */}
      <section className="bg-white border-y border-card-border">
        <div className="base-container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: <Truck size={24} />, title: 'Free Shipping', desc: 'On premium orders' },
              { icon: <Clock3 size={24} />, title: 'Fast Dispatch', desc: 'Packed in 24 hours' },
              { icon: <ShieldCheck size={24} />, title: 'Secure Checkout', desc: 'Encrypted payments' },
              { icon: <Gem size={24} />, title: 'Premium Selection', desc: 'Designer-inspired picks' },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-primary-green flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-dark-navy m-0">{item.title}</h4>
                  <p className="text-xs text-muted-text m-0">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CATEGORIES ===== */}
      <section className="base-container py-12">
        <motion.div
          className="flex items-center justify-between mb-8"
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={fadeUp} transition={{ duration: 0.5 }}
        >
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-dark-navy mt-0 mb-1">Explore Categories</h2>
            <p className="text-muted-text m-0">Discover curated fashion and beauty collections</p>
          </div>
          <Link to="/categories" className="text-primary-green hover:underline font-medium flex items-center gap-1">
            View All <ArrowRight size={16} />
          </Link>
        </motion.div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {categories.map((cat, i) => (
            <motion.div
              key={cat._id}
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} transition={{ delay: i * 0.05, duration: 0.4 }}
            >
              <Link
                to={`/shop?category=${cat._id}`}
                className="bg-white border border-card-border rounded-2xl p-4 text-center cursor-pointer hover:shadow-lg hover:border-primary-green transition-all group block"
              >
                <div className="w-14 h-14 bg-rose-50 group-hover:bg-rose-100 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl transition-colors">
                  {cat.icon}
                </div>
                <h3 className="font-semibold text-xs text-dark-navy mt-0 mb-0 group-hover:text-primary-green transition-colors">
                  {cat.name}
                </h3>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== DEALS OF THE DAY ===== */}
      {deals.length > 0 && (
        <section className="bg-gradient-to-r from-rose-50 to-stone-100 py-12">
          <div className="base-container">
            <motion.div
              className="flex items-center justify-between mb-8"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} transition={{ duration: 0.5 }}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🔥</span>
                  <h2 className="text-2xl md:text-3xl font-bold text-dark-navy mt-0 mb-0">Deals of the Day</h2>
                </div>
                <p className="text-muted-text m-0">Grab these trend picks before they are gone.</p>
              </div>
              <Link to="/deals" className="text-accent-orange hover:underline font-medium flex items-center gap-1">
                View All <ArrowRight size={16} />
              </Link>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {deals.slice(0, 8).map((product, i) => (
                <motion.div
                  key={product._id}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== FEATURED PRODUCTS ===== */}
      {featured.length > 0 && (
        <section className="base-container py-12">
          <motion.div
            className="flex items-center justify-between mb-8"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} transition={{ duration: 0.5 }}
          >
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-dark-navy mt-0 mb-1">Featured Products</h2>
              <p className="text-muted-text m-0">Handpicked favorites by our team</p>
            </div>
            <Link to="/shop?featured=true" className="text-primary-green hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight size={16} />
            </Link>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {featured.slice(0, 15).map((product, i) => (
              <motion.div
                key={product._id}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ===== PROMOTIONAL BANNER ===== */}
      <section className="base-container py-6">
          <motion.div
          className="bg-gradient-to-r from-black to-zinc-800 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between text-white overflow-hidden relative"
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={fadeUp} transition={{ duration: 0.6 }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="z-10 mb-6 md:mb-0">
            <h3 className="text-2xl md:text-3xl font-bold mt-0 mb-2">Download Zage Fashion Corner App</h3>
            <p className="text-rose-100 m-0 max-w-md">
              Unlock exclusive drops, beauty tutorials, personalized wishlists, and faster checkout from your phone.
            </p>
          </div>
          <div className="z-10 flex gap-4">
            <button className="bg-white text-zinc-900 font-semibold py-3 px-6 rounded-full hover:bg-rose-50 transition-colors">
              App Store
            </button>
            <button className="bg-white/20 text-white border border-white/30 font-semibold py-3 px-6 rounded-full hover:bg-white/30 transition-colors">
              Play Store
            </button>
          </div>
        </motion.div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="base-container py-12">
        <motion.div
          className="text-center mb-8"
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={fadeUp} transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-dark-navy mt-0 mb-1">What Our Clients Say</h2>
          <p className="text-muted-text m-0">Loved by fashion and skincare enthusiasts</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'Emily R.', text: "The quality is stunning. My skincare routine and wardrobe both got a serious upgrade from one place.", avatar: '👩', rating: 5 },
            { name: 'Marcus T.', text: "I shop menswear and grooming products here every month. Fast delivery and premium packaging every time.", avatar: '👨', rating: 5 },
            { name: 'Sarah K.', text: "The cosmetic collection feels luxury but still affordable. Product photos match exactly what arrives.", avatar: '👩‍🦰', rating: 4 },
          ].map((testimonial, i) => (
            <motion.div
              key={i}
              className="bg-white border border-card-border rounded-2xl p-6 hover:shadow-lg transition-shadow"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, j) => (
                  <Star key={j} size={16} className="fill-accent-orange text-accent-orange" />
                ))}
              </div>
              <p className="text-dark-navy mb-4 italic">"{testimonial.text}"</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{testimonial.avatar}</span>
                <span className="font-semibold text-dark-navy">{testimonial.name}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
