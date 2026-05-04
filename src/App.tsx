import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, Plus, Minus, Clock, Phone, Lock, 
  ClipboardList, LogOut, X, UtensilsCrossed, CheckCircle2, 
  Package, Search, ChevronRight, MapPin, AlertCircle, Upload, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [view, setView] = useState<'menu' | 'admin'>('menu');
  const [adminTab, setAdminTab] = useState<'orders' | 'menu_config'>('orders');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('re_orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenu>(() => {
    const saved = localStorage.getItem('re_weekly_menu');
    return saved ? JSON.parse(saved) : DEFAULT_WEEKLY_MENU;
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    localStorage.setItem('re_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('re_weekly_menu', JSON.stringify(weeklyMenu));
  }, [weeklyMenu]);

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

  const finalizeOrder = (name: string, address: string) => {
    if (!name) return alert('Informe seu nome!');
    if (!address) return alert('Informe seu endereço!');
    
    const newOrder: Order = {
      id: `RE-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      customerName: name,
      address,
      items: [...cart],
      total: cart.reduce((acc, i) => acc + i.price * i.quantity, 0),
      status: 'Pendente',
      createdAt: Date.now()
    };
    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    setIsCartOpen(false);
    alert('Pedido enviado com sucesso!');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 overflow-x-hidden">
      {/* Top Navbar */}
      <nav className="bg-white sticky top-0 z-50 border-b border-gray-100 h-16 flex items-center px-4 justify-between shadow-sm">
        <h1 className="font-black text-xl text-gray-800 tracking-tight">RE-MARMITARIA</h1>
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
          isLoggedIn={isLoggedIn} 
          onLogin={() => setIsLoggedIn(true)} 
          orders={orders} 
          updateStatus={(id, s) => setOrders(prev => prev.map(o => o.id === id ? { ...o, status: s } : o))}
          weeklyMenu={weeklyMenu}
          setWeeklyMenu={setWeeklyMenu}
          activeTab={adminTab}
          setActiveTab={setAdminTab}
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
  isLoggedIn, 
  onLogin, 
  orders, 
  updateStatus,
  weeklyMenu,
  setWeeklyMenu,
  activeTab,
  setActiveTab
}: { 
  isLoggedIn: boolean, 
  onLogin: () => void, 
  orders: Order[], 
  updateStatus: (id: string, s: OrderStatus) => void,
  weeklyMenu: WeeklyMenu,
  setWeeklyMenu: React.Dispatch<React.SetStateAction<WeeklyMenu>>,
  activeTab: 'orders' | 'menu_config',
  setActiveTab: (t: 'orders' | 'menu_config') => void
}) {
  const [pass, setPass] = useState('');
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-6">LOGIN ADMIN</h2>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Senha (admin123)" className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl text-center mb-4 focus:outline-none" />
          <button onClick={() => pass === 'admin123' ? onLogin() : alert('Senha errada!')} className="w-full h-14 bg-gray-800 text-white rounded-2xl font-black">ENTRAR NO PAINEL</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      {/* Admin Tabs */}
      <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100 mb-8">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'orders' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <ClipboardList className="w-4 h-4" /> Pedidos
        </button>
        <button 
          onClick={() => setActiveTab('menu_config')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'menu_config' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}
        >
           <UtensilsCrossed className="w-4 h-4" /> Cardápio Semanal
        </button>
      </div>

      {activeTab === 'orders' ? (
        <>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black flex items-center gap-3"><ClipboardList className="w-8 h-8 text-red-500" /> PAINEL DE PEDIDOS</h2>
            <div className="bg-white px-4 py-2 rounded-xl text-xs font-bold text-gray-500 border border-gray-100">{orders.length} pedidos hoje</div>
          </div>
          <div className="grid gap-6">
            {orders.length === 0 ? (
              <div className="bg-white p-20 rounded-3xl text-center text-gray-300 border border-dashed border-gray-200">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-bold">Nenhum pedido hoje</p>
              </div>
            ) : orders.map(o => (
              <div key={o.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">#{o.id} • {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <h4 className="text-xl font-black text-gray-900">{o.customerName}</h4>
                  </div>
                  <span className={`h-fit px-4 py-1.5 rounded-full text-xs font-black uppercase ${o.status === 'Pendente' ? 'bg-yellow-100 text-yellow-700' : o.status === 'Em preparo' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {o.status}
                  </span>
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
      ) : (
        <MenuConfig weeklyMenu={weeklyMenu} setWeeklyMenu={setWeeklyMenu} />
      )}
    </div>
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
    setWeeklyMenu(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        dishes: prev[selectedDay].dishes.filter((_, i) => i !== idx)
      }
    }));
  };

  const handleImageUpload = (index: number, file: File) => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      handleUpdateDish(index, 'image', base64String);
    };
    reader.readAsDataURL(file);
  };

  const [saving, setSaving] = useState(false);
  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert('Configurações salvas com sucesso!');
    }, 800);
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black flex items-center gap-2"><UtensilsCrossed className="w-6 h-6 text-red-500" /> CONFIGURAR CARDÁPIO</h2>
        <button 
          onClick={handleSave}
          className={`h-9 px-4 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${saving ? 'bg-gray-100 text-gray-400' : 'bg-green-600 text-white shadow-md shadow-green-100 hover:scale-105 active:scale-95'}`}
        >
          {saving ? <Clock className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        {DAYS_OF_WEEK.map(day => (
          <button 
            key={day} 
            onClick={() => setSelectedDay(day)}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all border ${selectedDay === day ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white text-gray-500 border-gray-100'}`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="space-y-6 mt-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
           <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Guarnições de {selectedDay}</h3>
           <input 
              type="text"
              value={weeklyMenu[selectedDay]?.guarnicoes.join(', ')}
              onChange={(e) => handleUpdateGuarnicoes(e.target.value)}
              placeholder="Arroz, Feijão, Salada... (separe por vírgula)"
              className="w-full h-14 px-4 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium"
           />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Pratos Principais</h3>
            <button onClick={addDish} className="text-xs font-black text-red-500 flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg active:scale-95"><Plus className="w-3 h-3" /> Adicionar Prato</button>
          </div>

          {weeklyMenu[selectedDay]?.dishes.map((dish, idx) => (
            <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 relative group">
              <button 
                onClick={() => removeDish(idx)}
                className="absolute top-4 right-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Imagem do Prato</label>
                    <div className="flex gap-2">
                       <div className="relative group/img w-20 h-20 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                          {dish.image ? (
                            <img src={dish.image} className="w-full h-full object-cover" alt="Preview" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                               <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                       </div>
                       <div className="flex-1 space-y-2">
                          <label className="flex items-center justify-center gap-2 w-full h-10 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-50 transition-all">
                             <Upload className="w-3 h-3" />
                             <span>Upload do Computador</span>
                             <input 
                               type="file" 
                               accept="image/*" 
                               className="hidden" 
                               onChange={(e) => e.target.files?.[0] && handleImageUpload(idx, e.target.files[0])}
                             />
                          </label>
                          <input 
                            value={dish.image}
                            onChange={(e) => handleUpdateDish(idx, 'image', e.target.value)}
                            placeholder="Ou cole o link da imagem aqui"
                            className="w-full h-8 px-3 rounded-lg border border-gray-100 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-red-500 text-[10px] font-medium"
                          />
                       </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Nome do Prato</label>
                    <input 
                      value={dish.name}
                      onChange={(e) => handleUpdateDish(idx, 'name', e.target.value)}
                      placeholder="Ex: Feijoada Completa"
                      className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Preço Base (R$)</label>
                    <input 
                      type="number"
                      value={dish.price}
                      onChange={(e) => handleUpdateDish(idx, 'price', e.target.value)}
                      placeholder="20"
                      className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium"
                    />
                  </div>
                </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Descrição</label>
                <textarea 
                  value={dish.description}
                  onChange={(e) => handleUpdateDish(idx, 'description', e.target.value)}
                  placeholder="Conte os segredos deste prato..."
                  className="w-full h-24 p-4 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium resize-none"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
           <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
           <p className="text-xs text-blue-700 font-medium">As alterações são aplicadas e salvas em tempo real.</p>
        </div>
      </div>
    </div>
  );
}

