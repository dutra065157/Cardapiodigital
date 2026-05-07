import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, Plus, Minus, Clock, Phone, Lock, 
  ClipboardList, LogOut, X, UtensilsCrossed, CheckCircle2, 
  Package, Search, ChevronRight, MapPin, AlertCircle, Upload, Image as ImageIcon,
  LayoutDashboard, BarChart3, Settings2, TrendingUp, History, ChefHat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, 
  getDoc, getDocFromServer, serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User 
} from 'firebase/auth';
import { db, auth } from './lib/firebase';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---
type OrderStatus = 'Pendente' | 'Em preparo' | 'Entregue' | 'Cancelado';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  observation?: string;
  size?: string;
}

interface WeeklyMenuItem {
  name: string;
  description: string;
  image: string;
  price: number;
}

interface WeeklyMenuDay {
  dishes: WeeklyMenuItem[];
  guarnicoes: string[];
}

interface WeeklyMenu {
  [key: string]: WeeklyMenuDay;
}

interface Order {
  id: string;
  customerName: string;
  address: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  sizes: { name: string; price: number }[];
}

// --- Data ---
const MARMITARIA_DATA = {
  name: 'Re-Marmitaria',
  phone: '+55 19 98232-2791',
  openingHours: 'Abre hoje às 18h',
  logo: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&h=200&fit=crop',
  banner: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&h=400&fit=crop',
  guarnicoes: ['Macarrão bolonhesa', 'Farofa de torresmo'],
  prices: [
    { name: 'P', price: 20 },
    { name: 'M', price: 22 },
    { name: 'G', price: 25 },
  ]
};

const PRODUCTS: Product[] = [
  { id: '1', name: 'Feijoada Completa', description: 'Feijoada tradicional com todos os acompanhamentos.', image: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=400', price: 20, sizes: MARMITARIA_DATA.prices },
  { id: '2', name: 'Filé de Coxa Recheado', description: 'Recheado com bacon, presunto e queijo.', image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400', price: 20, sizes: MARMITARIA_DATA.prices },
  { id: '3', name: 'Costela Cozida', description: 'Costela bovina derretendo no molho.', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400', price: 20, sizes: MARMITARIA_DATA.prices },
  { id: '4', name: 'Filé de Frango Grelhado', description: 'Filé suculento grelhado na hora.', image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400', price: 20, sizes: MARMITARIA_DATA.prices },
  { id: '5', name: 'Linguiça Toscana', description: 'Linguiça toscana grelhada.', image: 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=400', price: 20, sizes: MARMITARIA_DATA.prices },
];

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const DEFAULT_WEEKLY_MENU: WeeklyMenu = {
  'Segunda': { dishes: [{ name: 'Virado à Paulista', description: 'O clássico paulista com tutu de feijão, couve e ovo.', image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400', price: 20 }], guarnicoes: ['Arroz', 'Feijão', 'Couve'] },
  'Terça': { dishes: [{ name: 'Dobradinha', description: 'Dobradinha bem tempoada com feijão branco.', image: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=400', price: 20 }], guarnicoes: ['Arroz', 'Feijão', 'Farofa'] },
  'Quarta': { dishes: [{ name: 'Feijoada Completa', description: 'A melhor feijoada da região com carnes selecionadas.', image: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=400', price: 20 }], guarnicoes: ['Arroz', 'Couve', 'Farofa'] },
  'Quinta': { dishes: [{ name: 'Frango Assado', description: 'Frango assado na brasa, suculento e crocante.', image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400', price: 20 }], guarnicoes: ['Maionese', 'Arroz'] },
  'Sexta': { dishes: [{ name: 'Peixe Frito', description: 'Filé de peixe empanado e frito na hora.', image: 'https://images.unsplash.com/photo-1534080564607-198f0170d3a5?w=400', price: 20 }], guarnicoes: ['Pirão', 'Arroz', 'Salada'] },
  'Sábado': { dishes: [{ name: 'Churrasco Misto', description: 'Carnes selecionadas grelhadas na hora.', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400', price: 20 }], guarnicoes: ['Arroz', 'Farofa', 'Vinagrete'] },
  'Domingo': { dishes: [{ name: 'Lasanha à Bolonhesa', description: 'Massa caseira com muito queijo e molho.', image: 'https://images.unsplash.com/photo-1574894709424-2ec43265d933?w=400', price: 20 }], guarnicoes: ['Arroz', 'Maionese'] }
};

export default function App() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [view, setView] = useState<'menu' | 'admin'>('menu');
  const [adminTab, setAdminTab] = useState<'dashboard' | 'orders' | 'menu_config'>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenu>(DEFAULT_WEEKLY_MENU);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Connection test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
  }, []);

  // Menu listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'menu'), (snapshot) => {
      const newMenu: WeeklyMenu = { ...DEFAULT_WEEKLY_MENU };
      snapshot.forEach(doc => {
        newMenu[doc.id] = doc.data() as WeeklyMenuDay;
      });
      setWeeklyMenu(newMenu);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'menu');
    });
    return unsub;
  }, []);

  // Orders listener (admin only)
  useEffect(() => {
    if (!isAdminAuthenticated) {
      setOrders([]);
      return;
    }

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const newOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(newOrders);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });
    return unsub;
  }, [isAdminAuthenticated]);

  const finalizeOrder = async (name: string, address: string) => {
    if (!name) return alert('Informe seu nome!');
    if (!address) return alert('Informe seu endereço!');
    
    const orderId = `RE-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const newOrder = {
      customerName: name,
      address,
      items: [...cart],
      total: cart.reduce((acc, i) => acc + i.price * i.quantity, 0),
      status: 'Pendente',
      createdAt: Date.now() // Using number as standard in the app, but could use serverTimestamp
    };

    try {
      await setDoc(doc(db, 'orders', orderId), newOrder);
      setCart([]);
      setIsCartOpen(false);
      alert('Pedido enviado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}`);
    }
  };

  const updateStatus = async (id: string, s: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status: s });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const handleSetWeeklyMenu = async (newMenu: WeeklyMenu) => {
    // This is called from MenuConfig. Instead of full object, we update the specific day.
    // However, the existing code uses setWeeklyMenu(prev => ...)
    // I will refactor MenuConfig to save to Firestore.
  };

  // Logic to determine current day's menu
  const currentDayInfo = useMemo(() => {
    const now = new Date();
    const dayName = DAYS_OF_WEEK[now.getDay()];
    const hour = now.getHours();
    const isOpen = now.getDay() !== 0 && hour >= 10 && hour < 15; // Segunda a Sábado, 10h as 15h
    
    return {
      dayName,
      isOpen,
      menu: weeklyMenu[dayName] || { dishes: [], guarnicoes: [] }
    };
  }, [weeklyMenu]);

  const activeProducts = useMemo(() => {
    return currentDayInfo.menu.dishes.map((dish, index) => ({
      id: `dish-${index}`,
      name: dish.name,
      description: dish.description || `Prato especial de ${currentDayInfo.dayName}. Acompanha as guarnições do dia.`,
      image: dish.image || `https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&sig=${index}`,
      price: dish.price || 20,
      sizes: MARMITARIA_DATA.prices
    }));
  }, [currentDayInfo]);

  const addToCart = (item: OrderItem) => {
    setCart(prev => [...prev, item]);
    setSelectedProduct(null);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 overflow-x-hidden">
      {/* Top Navbar */}
      <nav className="bg-white sticky top-0 z-50 border-b border-gray-100 h-16 flex items-center px-4 justify-between shadow-sm">
        <h1 onClick={() => setView('menu')} className="font-black text-xl text-gray-800 tracking-tight cursor-pointer">RE-MARMITARIA</h1>
        <div className="flex gap-2">
          <button onClick={() => setIsCartOpen(true)} className="relative p-2 bg-gray-50 rounded-full">
            <ShoppingBag className="w-6 h-6 text-gray-700" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{cart.length}</span>}
          </button>
          <button onClick={() => setView(view === 'menu' ? 'admin' : 'menu')} className="p-2 bg-gray-50 rounded-full">
             <Lock className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </nav>

      {view === 'menu' ? (
        <main className="max-w-xl mx-auto">
          {/* Header Section */}
          <div className="relative mb-6">
            <img src={MARMITARIA_DATA.banner} className="w-full h-44 object-cover" alt="Banner" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute -bottom-6 left-6 flex items-end gap-3">
              <img src={MARMITARIA_DATA.logo} className="w-20 h-20 rounded-2xl border-4 border-white shadow-xl bg-white" alt="Logo" />
              <div className="mb-2">
                <h2 className="text-white font-bold text-lg drop-shadow-md">{MARMITARIA_DATA.name}</h2>
                <p className="text-white/90 text-xs flex items-center gap-1 drop-shadow-md">
                  <Clock className="w-3 h-3" /> {MARMITARIA_DATA.openingHours}
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 mt-12 grid gap-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
               <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contato</span>
                  <span className="text-sm font-medium text-green-600 flex items-center gap-1"><Phone className="w-4 h-4" /> {MARMITARIA_DATA.phone}</span>
               </div>
               <div className="text-right">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pagamento</span>
                  <p className="text-xs font-bold text-gray-700 mt-1">💳 Aceitamos cartões 🥤🥤</p>
               </div>
            </div>

            {/* Menu Sections */}
            <div>
              <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-red-500" />
                CARDÁPIO DE {currentDayInfo.dayName.toUpperCase()}
              </h3>
              
              {!currentDayInfo.isOpen && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl mb-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-orange-800">Horário de Atendimento</p>
                    <p className="text-xs text-orange-600">Funcionamos de Segunda a Sábado, das 10:00 às 15:00. No momento estamos fora do horário de pedidos, mas você pode visualizar o cardápio.</p>
                  </div>
                </div>
              )}

              <div className="grid gap-4">
                {activeProducts.map(p => (
                  <motion.div 
                    key={p.id} 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedProduct(p as Product)}
                    className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-4 cursor-pointer hover:border-red-100 transition-all group"
                  >
                    <img src={p.image} className="w-24 h-24 rounded-xl object-cover" alt={p.name} />
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h4 className="font-bold text-gray-900 group-hover:text-red-600 transition-colors">{p.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-black text-red-600">A partir de R$ 20,00</span>
                        <div className="bg-red-50 p-1.5 rounded-lg text-red-500"><Plus className="w-5 h-5" /></div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Guarnições Info */}
            <div className="bg-gray-800 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
               <div className="relative z-10">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-[0.2em] mb-2 font-mono">Incluso em todos os pratos de {currentDayInfo.dayName}</p>
                  <h4 className="text-xl font-black mb-3">GUARNIÇÕES DO DIA</h4>
                  <ul className="grid grid-cols-2 gap-2">
                    {currentDayInfo.menu.guarnicoes.map(g => (
                      <li key={g} className="flex items-center gap-2 text-xs font-medium bg-white/10 px-3 py-2 rounded-lg">
                        <Package className="w-3 h-3 text-red-500" /> {g}
                      </li>
                    ))}
                  </ul>
               </div>
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <UtensilsCrossed className="w-24 h-24" />
               </div>
            </div>
          </div>
        </main>
      ) : (
        <AdminPanel 
          isAuthenticated={isAdminAuthenticated}
          onLogin={(pass) => {
            if (pass === '2026') {
              setIsAdminAuthenticated(true);
            } else {
              alert('Senha incorreta!');
            }
          }} 
          onLogout={() => setIsAdminAuthenticated(false)}
          orders={orders} 
          updateStatus={updateStatus}
          weeklyMenu={weeklyMenu}
          setWeeklyMenu={setWeeklyMenu}
          activeTab={adminTab}
          setActiveTab={setAdminTab}
          onBackToMenu={() => setView('menu')}
        />
      )}

      {/* Floating Bottom Cart Navigation */}
      {cart.length > 0 && view === 'menu' && (
        <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="fixed bottom-6 left-0 right-0 px-4 flex justify-center z-40">
           <button onClick={() => setIsCartOpen(true)} className="bg-red-600 w-full max-w-lg h-14 rounded-2xl text-white font-bold flex items-center justify-between px-6 shadow-2xl shadow-red-200">
             <div className="flex items-center gap-2"><ShoppingBag className="w-5 h-5" /> <span>{cart.length} itens</span></div>
             <span>Ver Carrinho • R$ {cart.reduce((acc, i) => acc + i.price * i.quantity, 0).toFixed(2)}</span>
           </button>
        </motion.div>
      )}

      {/* Modals & Overlays */}
      <AnimatePresence>
        {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />}
        {isCartOpen && <CartDrawer cart={cart} onClose={() => setIsCartOpen(false)} onRemove={idx => setCart(prev => prev.filter((_, i) => i !== idx))} onFinalize={finalizeOrder} />}
      </AnimatePresence>
    </div>
  );
}

// --- Internal Components ---

function ProductModal({ product, onClose, onAdd }: { product: Product, onClose: () => void, onAdd: (i: OrderItem) => void }) {
  const [size, setSize] = useState(product.sizes[0]);
  const [obs, setObs] = useState('');
  const [qty, setQty] = useState(1);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90dvh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full z-10"><X className="w-5 h-5" /></button>
        <img src={product.image} className="w-full h-56 object-cover" alt="Product" />
        <div className="p-6">
          <h2 className="text-2xl font-black text-gray-900 mb-1">{product.name}</h2>
          <p className="text-gray-500 text-sm mb-6">{product.description}</p>
          
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Escolha o Tamanho</h3>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {product.sizes.map(s => (
              <button key={s.name} onClick={() => setSize(s)} className={`p-4 rounded-2xl border-2 font-bold transition-all ${size.name === s.name ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-100 bg-white text-gray-400'}`}>
                <span className="block text-lg">{s.name}</span>
                <span className="text-xs">R$ {s.price.toFixed(2)}</span>
              </button>
            ))}
          </div>

          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Observações (Opcional)</h3>
          <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Sem cebola, caprichar na farofa..." className="w-full p-4 border border-gray-100 bg-gray-50 rounded-2xl h-24 mb-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all" />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-xl">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm"><Minus className="w-4 h-4" /></button>
              <span className="font-black w-4 text-center">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm"><Plus className="w-4 h-4" /></button>
            </div>
            <button onClick={() => onAdd({ id: product.id, name: product.name, price: size.price, quantity: qty, size: size.name, observation: obs })} className="flex-1 h-14 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-100">
              Adicionar • R$ {(size.price * qty).toFixed(2)}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CartDrawer({ cart, onClose, onRemove, onFinalize }: { cart: OrderItem[], onClose: () => void, onRemove: (i: number) => void, onFinalize: (n: string, a: string) => void }) {
  const [userName, setUserName] = useState('');
  const [address, setAddress] = useState('');
  const total = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col h-[100dvh]">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white z-10 shrink-0">
          <h2 className="text-xl font-black flex items-center gap-2"><ShoppingBag className="w-6 h-6 text-red-500" /> SEU PEDIDO</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
          {cart.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-300">
              <ShoppingBag className="w-12 h-12 mb-2" />
              <p className="font-bold">Carrinho vazio</p>
            </div>
          ) : cart.map((item, idx) => (
            <div key={idx} className="flex gap-4 border-b border-gray-50 pb-4 last:border-0">
              <div className="w-10 h-10 bg-red-50 text-red-600 font-black rounded-lg flex items-center justify-center flex-shrink-0">{item.quantity}x</div>
              <div className="flex-1">
                <div className="flex justify-between font-bold text-gray-800">
                  <span>{item.name} ({item.size})</span>
                  <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
                {item.observation && <p className="text-xs text-gray-400 italic mt-1">"{item.observation}"</p>}
                <button onClick={() => onRemove(idx)} className="text-[10px] uppercase font-black text-red-500 mt-2 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded w-fit transition-colors"><Trash2 className="w-3 h-3" /> Remover</button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Seu Nome</label>
              <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="Como chama você?" className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Endereço de Entrega</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, Número, Bairro e Ponto de Ref." className="w-full h-24 p-4 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium text-sm resize-none" />
            </div>
          </div>
          <div className="flex justify-between text-xl font-black mb-6 pt-2 border-t border-gray-200">
            <span className="text-gray-400">TOTAL</span>
            <span className="text-red-600">R$ {total.toFixed(2)}</span>
          </div>
          <button 
            disabled={cart.length === 0}
            onClick={() => onFinalize(userName, address)} 
            className={`w-full h-16 rounded-2xl font-black shadow-lg flex items-center justify-center gap-3 transition-all ${cart.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-500 text-white shadow-green-100 hover:scale-[1.02] active:scale-95'}`}
          >
             <CheckCircle2 className="w-6 h-6" /> ENVIAR PEDIDO
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AdminPanel({ 
  isAuthenticated, 
  onLogin, 
  onLogout,
  onBackToMenu,
  orders, 
  updateStatus,
  weeklyMenu,
  setWeeklyMenu,
  activeTab,
  setActiveTab
}: { 
  isAuthenticated: boolean, 
  onLogin: (pass: string) => void, 
  onLogout: () => void,
  onBackToMenu: () => void,
  orders: Order[], 
  updateStatus: (id: string, s: OrderStatus) => void,
  weeklyMenu: WeeklyMenu,
  setWeeklyMenu: React.Dispatch<React.SetStateAction<WeeklyMenu>>,
  activeTab: 'dashboard' | 'orders' | 'menu_config',
  setActiveTab: (t: 'dashboard' | 'orders' | 'menu_config') => void
}) {
  const [password, setPassword] = useState('');

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center border border-gray-100">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-black mb-2 text-gray-900">ADMINISTRAÇÃO</h2>
          <p className="text-gray-500 mb-10 font-medium tracking-tight">Digite a senha para acessar o painel do vendedor.</p>
          
          <div className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onLogin(password)}
                placeholder="Digite sua senha..."
                className="w-full h-16 pl-14 pr-6 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-red-500 font-bold transition-all"
              />
            </div>
            <button 
              onClick={() => onLogin(password)} 
              className="w-full h-16 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-gray-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              ENTRAR NO PAINEL
            </button>
          </div>

          <button onClick={onBackToMenu} className="mt-8 text-gray-400 font-bold hover:text-red-500 transition-colors flex items-center justify-center gap-2 mx-auto">
            <UtensilsCrossed className="w-4 h-4" /> VOLTAR AO CARDÁPIO
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().setHours(0,0,0,0);
  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.createdAt).setHours(0,0,0,0);
    return orderDate === today;
  });

  const totalRevenue = todayOrders.reduce((acc, current) => acc + current.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'Pendente').length;
  const preparingOrders = orders.filter(o => o.status === 'Em preparo').length;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-20">
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 mt-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-red-500" />
            PAINEL DE GESTÃO
          </h1>
          <p className="text-gray-500 font-medium">Controle de pedidos e produtos</p>
        </div>
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<BarChart3 className="w-4 h-4" />} label="Resumo" />
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingBag className="w-4 h-4" />} label="Pedidos" />
          <TabButton active={activeTab === 'menu_config'} onClick={() => setActiveTab('menu_config')} icon={<Settings2 className="w-4 h-4" />} label="Gerenciar Cardápio" />
          <button onClick={onBackToMenu} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all">
            <UtensilsCrossed className="w-4 h-4" /> Ver Menu (Cliente)
          </button>
          <button onClick={onLogout} className="p-2.5 text-gray-400 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} key="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <StatCard label="Vendas Hoje" value={`R$ ${totalRevenue.toFixed(2)}`} icon={<TrendingUp className="text-green-600" />} color="bg-green-50" />
              <StatCard label="Pendentes" value={pendingOrders} icon={<Clock className="text-red-600" />} color="bg-red-50" />
              <StatCard label="Em Preparo" value={preparingOrders} icon={<ChefHat className="text-orange-600" />} color="bg-orange-50" />
              <StatCard label="Total Pedidos (Hoje)" value={todayOrders.length} icon={<ShoppingBag className="text-blue-600" />} color="bg-blue-50" />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <History className="w-5 h-5 text-red-500" /> ÚLTIMOS PEDIDOS DO DIA
                  </h3>
                  {todayOrders.length > 0 ? (
                    <div className="space-y-4">
                      {todayOrders.slice(0, 5).map(order => (
                        <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-sm font-black text-red-500 border border-gray-100">
                              #{order.id.slice(-4)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{order.customerName}</p>
                              <p className="text-xs text-gray-500">{order.items.length} itens • R$ {order.total.toFixed(2)}</p>
                            </div>
                          </div>
                          <StatusBadge status={order.status} />
                        </div>
                      ))}
                      <button onClick={() => setActiveTab('orders')} className="w-full py-4 text-sm font-bold text-gray-500 hover:text-red-500 transition-colors">VER TODOS OS PEDIDOS</button>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-gray-400 font-medium">Nenhum pedido recebido hoje ainda.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <NotesSection />
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} key="orders">
            <OrdersManager orders={orders} updateStatus={updateStatus} />
          </motion.div>
        )}

        {activeTab === 'menu_config' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} key="menu">
            <MenuConfig weeklyMenu={weeklyMenu} setWeeklyMenu={setWeeklyMenu} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-lg shadow-gray-200/50 border border-gray-50 flex items-center gap-4">
      <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-2xl`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
        active 
          ? 'bg-gray-800 text-white shadow-lg' 
          : 'text-gray-500 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function NotesSection() {
  const [notes, setNotes] = useState(() => localStorage.getItem('re_admin_notes') || '');
  
  useEffect(() => {
    localStorage.setItem('re_admin_notes', notes);
  }, [notes]);

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100 h-full">
      <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-gray-900">
        <AlertCircle className="w-5 h-5 text-red-500" /> LEMBRETES DO DIA
      </h3>
      <textarea 
        className="w-full h-[300px] p-6 bg-yellow-50/50 rounded-3xl border-none focus:ring-2 focus:ring-yellow-200 text-gray-700 font-medium resize-none leading-relaxed" 
        placeholder="Escreva aqui recados para a cozinha, lista de compras ou observações importantes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles = {
    Pendente: 'bg-red-50 text-red-600 border-red-100',
    'Em preparo': 'bg-orange-50 text-orange-600 border-orange-100',
    Entregue: 'bg-green-50 text-green-600 border-green-100',
    Cancelado: 'bg-gray-100 text-gray-500 border-gray-200'
  };
  return (
    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
}

function OrdersManager({ orders, updateStatus }: { 
  orders: Order[], 
  updateStatus: (id: string, s: OrderStatus) => void 
}) {
  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black flex items-center gap-3"><ClipboardList className="w-8 h-8 text-red-500" /> PAINEL DE PEDIDOS</h2>
        <div className="bg-white px-4 py-2 rounded-xl text-xs font-bold text-gray-500 border border-gray-100">{orders.length} pedidos no total</div>
      </div>
      <div className="grid gap-6">
        {orders.length === 0 ? (
          <div className="bg-white p-20 rounded-3xl text-center text-gray-300 border border-dashed border-gray-200">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="font-bold">Nenhum pedido encontrado</p>
          </div>
        ) : orders.map(o => (
          <div key={o.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between mb-4">
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">#{o.id} • {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <h4 className="text-xl font-black text-gray-900">{o.customerName}</h4>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div className="space-y-2 mb-4 border-l-2 border-red-50 p-1 pl-4">
                {o.items.map((i, idx) => (
                  <div key={idx} className="text-sm font-medium text-gray-700">
                    <span className="font-black text-red-500 mr-2">{i.quantity}x</span> {i.name} ({i.size})
                    {i.observation && <p className="text-[10px] text-gray-400 italic mt-0.5 ml-6">"{i.observation}"</p>}
                  </div>
                ))}
            </div>
            
            <div className="bg-gray-50 p-3 rounded-xl mb-6">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Endereço de Entrega</span>
                  <p className="text-sm text-gray-600 font-medium">{o.address}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-xl font-black text-gray-900">R$ {o.total.toFixed(2)}</span>
                <div className="flex gap-2">
                  {o.status === 'Pendente' && <button onClick={() => updateStatus(o.id, 'Em preparo')} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black">PREPARAR</button>}
                  {o.status === 'Em preparo' && <button onClick={() => updateStatus(o.id, 'Entregue')} className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-xs font-black">ENTREGAR</button>}
                  <button onClick={() => updateStatus(o.id, 'Cancelado')} className="bg-gray-100 text-gray-400 p-2.5 rounded-xl transition-colors hover:bg-red-50 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
                </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MenuConfig({ weeklyMenu, setWeeklyMenu }: { weeklyMenu: WeeklyMenu, setWeeklyMenu: React.Dispatch<React.SetStateAction<WeeklyMenu>> }) {
  const [selectedDay, setSelectedDay] = useState(DAYS_OF_WEEK[new Date().getDay()]);

  const handleUpdateGuarnicoes = (value: string) => {
    const items = value.split(',').map(s => s.trim()).filter(Boolean);
    setWeeklyMenu(prev => ({
      ...prev,
      [selectedDay]: { ...prev[selectedDay], guarnicoes: items }
    }));
  };

  const handleUpdateDish = (index: number, key: keyof WeeklyMenuItem, value: string | number) => {
    setWeeklyMenu(prev => {
      const newDishes = [...prev[selectedDay].dishes];
      newDishes[index] = { ...newDishes[index], [key]: key === 'price' ? Number(value) : value };
      return { ...prev, [selectedDay]: { ...prev[selectedDay], dishes: newDishes } };
    });
  };

  const addDish = () => {
    setWeeklyMenu(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        dishes: [...prev[selectedDay].dishes, { name: '', description: '', image: '', price: 20 }]
      }
    }));
  };

  const removeDish = (idx: number) => {
    if (confirm('Deseja remover este prato?')) {
      setWeeklyMenu(prev => ({
        ...prev,
        [selectedDay]: {
          ...prev[selectedDay],
          dishes: prev[selectedDay].dishes.filter((_, i) => i !== idx)
        }
      }));
    }
  };

  const handleImageUpload = (index: number, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      handleUpdateDish(index, 'image', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'menu', selectedDay), weeklyMenu[selectedDay]);
      setSaving(false);
      alert('Cardápio salvo!');
    } catch (error) {
      setSaving(false);
      handleFirestoreError(error, OperationType.WRITE, `menu/${selectedDay}`);
    }
  };

  const clearDay = () => {
    if (confirm(`Limpar todo o cardápio de ${selectedDay}?`)) {
      setWeeklyMenu(prev => ({
        ...prev,
        [selectedDay]: { dishes: [], guarnicoes: [] }
      }));
    }
  };

  const currentDay = weeklyMenu[selectedDay] || { dishes: [], guarnicoes: [] };

  return (
    <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-gray-100 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-gray-100 pb-8">
        <div>
          <h2 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <ChefHat className="text-red-500 w-8 h-8" /> GESTÃO RÁPIDA
          </h2>
          <p className="text-gray-500 font-medium">Cadastre o que será servido hoje em {selectedDay}.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={clearDay}
            className="flex-1 sm:flex-none h-14 px-6 rounded-2xl font-black text-xs text-gray-400 border-2 border-gray-100 hover:border-red-100 hover:text-red-500 transition-all"
          >
            LIMPAR DIA
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] sm:flex-none bg-green-600 text-white px-10 h-14 rounded-2xl font-black shadow-lg shadow-green-100 transition-all hover:scale-105 active:scale-95 disabled:bg-gray-200"
          >
            {saving ? 'SALVANDO...' : 'SALVAR CARDÁPIO'}
          </button>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-6 mb-8 no-scrollbar">
        {DAYS_OF_WEEK.map(day => (
          <button 
            key={day} 
            onClick={() => setSelectedDay(day)}
            className={`px-6 py-3 rounded-2xl font-black text-xs transition-all border-2 ${selectedDay === day ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200'}`}
          >
            {day.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="space-y-10">
        {/* Guarnições */}
        <section>
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">Guarnições (separadas por vírgula)</label>
          <input 
            type="text" 
            value={currentDay.guarnicoes.join(', ')}
            onChange={(e) => handleUpdateGuarnicoes(e.target.value)}
            placeholder="Ex: Arroz Branco, Feijão Carioca, Farofa, Salada..."
            className="w-full h-16 px-6 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-red-500 font-bold text-gray-700 transition-all"
          />
        </section>

        {/* Pratos */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Pratos Principais</label>
            <button onClick={addDish} className="text-red-500 font-black text-xs flex items-center gap-1 hover:underline">
              <Plus className="w-4 h-4" /> ADICIONAR PRATO
            </button>
          </div>

          <div className="grid gap-4">
            {currentDay.dishes.map((dish, idx) => (
              <div key={idx} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col md:flex-row gap-6 relative">
                <button onClick={() => removeDish(idx)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>

                <div className="w-full md:w-32 h-32 bg-white rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden relative flex items-center justify-center shrink-0">
                  {dish.image ? (
                    <img src={dish.image} className="w-full h-full object-cover" alt="Prato" />
                  ) : (
                    <div className="text-center text-gray-400">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-30" />
                      <span className="text-[10px] font-black leading-tight uppercase block">Foto</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(idx, e.target.files[0])}
                  />
                </div>

                <div className="flex-1 grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Nome do Prato</label>
                    <input 
                      value={dish.name}
                      onChange={(e) => handleUpdateDish(idx, 'name', e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 font-bold focus:outline-none focus:border-red-500"
                      placeholder="Ex: Marmitex de Frango"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Preço (R$)</label>
                    <input 
                      type="number"
                      value={dish.price}
                      onChange={(e) => handleUpdateDish(idx, 'price', e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 font-black focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Descrição (Opcional)</label>
                    <input 
                      value={dish.description}
                      onChange={(e) => handleUpdateDish(idx, 'description', e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 font-medium text-sm focus:outline-none focus:border-red-500"
                      placeholder="Breve descrição dos acompanhamentos..."
                    />
                  </div>
                </div>
              </div>
            ))}

            {currentDay.dishes.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <ChefHat className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 font-bold">Nenhum prato cadastrado.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

