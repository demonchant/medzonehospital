import { useEffect, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  Menu,
  Phone,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useLocation } from "react-router-dom";

const navigation = [
  { name: "Home", path: "/" },
  { name: "About Us", path: "/about" },
  { name: "Services", path: "/services" },
  { name: "Contact", path: "/contact" },
];

function EmergencyBar() {
  return (
    <div className="bg-[#0054A6] text-white py-2 text-center text-[10px] md:text-xs font-black uppercase tracking-[0.3em] relative z-[60]">
      <div className="container mx-auto px-4 flex justify-center items-center gap-4">
        <span className="flex items-center gap-2">
          <Phone size={12} className="text-[#00AEEF]" />
          Emergency: 0807 808 9416, 0706 291 2469
        </span>
        <span className="hidden md:block w-1 h-1 bg-white/30 rounded-full" />
        <span className="hidden md:flex items-center gap-2">
          <Clock size={12} className="text-[#00AEEF]" />
          Open 24/7
        </span>
      </div>
    </div>
  );
}

export function Logo({ className = "", light = false }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex items-center gap-2">
        <div className="text-[#00AEEF] font-black text-4xl leading-none">+</div>
        <div className="bg-[#00AEEF] px-3 py-1 rounded-sm flex items-center">
          <span className="text-white text-4xl font-black tracking-tighter lowercase leading-none">med</span>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[#0054A6] text-4xl font-black tracking-tighter lowercase leading-none">zone</span>
          <span className="text-[#00AEEF] text-xl font-black tracking-tight lowercase leading-none">hospital</span>
        </div>
      </div>
      <span className={`text-xs font-black tracking-widest mt-2 ${light ? "text-white" : "text-slate-900"}`}>
        BN-3420004
      </span>
    </div>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <EmergencyBar />
      <header className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? "top-0 bg-white shadow-lg py-2" : "top-8 md:top-10 bg-transparent py-6"}`}>
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <Logo className="scale-75 md:scale-90 origin-left" light={!scrolled} />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`font-bold text-sm uppercase tracking-widest transition-all hover:text-[#00AEEF] ${pathname === item.path ? "text-[#00AEEF]" : scrolled ? "text-slate-800" : "text-white"}`}
              >
                {item.name}
              </Link>
            ))}
            <Link to="/appointment" className="bg-[#00AEEF] text-white px-8 py-3 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-[#0054A6] transition-all shadow-lg hover:shadow-[#00AEEF]/20">
              Book Now
            </Link>
          </nav>
          <button className="md:hidden p-2" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X className={scrolled ? "text-slate-900" : "text-white"} /> : <Menu className={scrolled ? "text-slate-900" : "text-white"} />}
          </button>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="absolute top-full left-0 w-full bg-white shadow-2xl md:hidden overflow-hidden border-t border-slate-100"
            >
              <div className="flex flex-col p-6 gap-4">
                {navigation.map((item) => (
                  <Link key={item.name} to={item.path} onClick={() => setMenuOpen(false)} className={`text-lg font-bold uppercase tracking-widest p-3 rounded-xl transition-all ${pathname === item.path ? "bg-slate-50 text-[#00AEEF]" : "text-slate-700"}`}>
                    {item.name}
                  </Link>
                ))}
                <Link to="/appointment" onClick={() => setMenuOpen(false)} className="bg-[#00AEEF] text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest text-center shadow-lg">
                  Book Appointment
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 pt-20 pb-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-16">
          <div className="space-y-8">
            <Link to="/" className="inline-block"><Logo className="scale-90 origin-left" light /></Link>
            <p className="text-slate-500 leading-relaxed text-sm">Medzone Hospital is committed to providing world-class healthcare services with compassion, excellence, and state-of-the-art medical technology.</p>
          </div>
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Quick Links</h4>
            <ul className="space-y-4">
              {[...navigation, { name: "Appointment", path: "/appointment" }].map((item) => (
                <li key={item.name}><Link to={item.path} className="hover:text-blue-400 transition-colors flex items-center gap-2"><ChevronRight size={14} /> {item.name === "Services" ? "Our Services" : item.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Our Services</h4>
            <ul className="space-y-4">
              {["General Hospital", "Obstetrics & Gynecology", "Pediatrics", "General Surgery", "Laboratory & Diagnostic"].map((service) => (
                <li key={service}><Link to="/services" className="hover:text-blue-400 transition-colors flex items-center gap-2"><ChevronRight size={14} /> {service}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex gap-3"><MapPin className="text-blue-500 shrink-0" size={20} /><span>Plot 2, 9th Avenue, Badore Rd, off First Unity Estate, Ajah, Lagos</span></li>
              <li className="flex gap-3"><Phone className="text-blue-500 shrink-0" size={20} /><div className="flex flex-col"><span>0807 808 9416</span><span>0706 291 2469</span></div></li>
              <li className="flex gap-3"><Mail className="text-blue-500 shrink-0" size={20} /><div className="flex flex-col"><span>medzonehospital@gmail.com</span><span>bellomoyosere21@gmail.com</span></div></li>
              <li className="flex gap-3"><Clock className="text-blue-500 shrink-0" size={20} /><span>Open 24 Hours</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <p>© {new Date().getFullYear()} Medzone Hospital. All rights reserved. Reg No: BN-3420004</p>
          <div className="flex gap-6"><a href="#!" className="hover:text-white transition-colors">Privacy Policy</a><a href="#!" className="hover:text-white transition-colors">Terms of Service</a></div>
        </div>
      </div>
    </footer>
  );
}

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <motion.button initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0 }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-8 right-8 z-50 bg-[#00AEEF] text-white p-4 rounded-2xl shadow-2xl hover:bg-[#0054A6] transition-all">
      <ArrowUp size={24} />
    </motion.button>
  );
}
