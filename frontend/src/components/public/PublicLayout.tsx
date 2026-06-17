import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin h-8 w-8 border-4 border-zammsa-green border-t-transparent rounded-full" />
  </div>
);

const navLinks = [
  { label: 'Home', path: '/' },
  { label: 'Tenders', path: '/tenders' },
  { label: 'GPNs', path: '/gpns' },
  { label: 'News', path: '/news' },
  { label: 'Notices', path: '/notices' },
  { label: 'Events', path: '/events' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact', path: '/contact' },
  { label: 'About', path: '/about' },
];

const PublicLayout: React.FC = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-zammsa-green rounded-xl flex items-center justify-center shadow-sm group-hover:bg-zammsa-green-dark transition-colors">
                <span className="text-white text-lg font-bold italic">Z</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-slate-900 tracking-tight leading-none">ZAMMSA</span>
                <span className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Procurement Portal</span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                    location.pathname === link.path
                      ? 'text-zammsa-green bg-emerald-50/50'
                      : 'text-slate-500 hover:text-zammsa-green hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="ml-6 flex items-center gap-3 pl-6 border-l border-slate-200">
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider hover:text-zammsa-green transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/suppliers/register"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-zammsa-green rounded-lg uppercase tracking-widest shadow-sm hover:bg-zammsa-green-dark transition-all"
                >
                  Register
                </Link>
              </div>
            </nav>

            <button
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100">
            <div className="px-4 py-6 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                    location.pathname === link.path
                      ? 'text-zammsa-green bg-emerald-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-center py-3 text-xs font-bold text-slate-600 uppercase tracking-widest border border-slate-200 rounded-xl"
                >
                  Login
                </Link>
                <Link
                  to="/suppliers/register"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-center py-3 text-xs font-bold text-white bg-zammsa-green rounded-xl uppercase tracking-widest"
                >
                  Register
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <React.Suspense fallback={<PageLoader />}>
          <Outlet />
        </React.Suspense>
      </main>

      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="space-y-6">
              <Link to="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zammsa-green rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg font-bold italic">Z</span>
                </div>
                <span className="text-xl font-bold text-white tracking-tight">ZAMMSA</span>
              </Link>
              <p className="text-sm leading-relaxed font-medium">
                Ensuring quality healthcare through efficient, transparent, and professional procurement management.
              </p>
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-white uppercase tracking-widest mb-6">Resources</h3>
              <ul className="space-y-3">
                {['Tenders', 'GPNs', 'News', 'Notices', 'FAQ'].map((item) => (
                  <li key={item}>
                    <Link to={`/${item.toLowerCase()}`} className="text-sm font-medium hover:text-zammsa-green transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-white uppercase tracking-widest mb-6">Contact</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="p-1.5 bg-slate-800 rounded-lg text-zammsa-green shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium leading-tight">Plot 12345, Great East Road, Lusaka</span>
                </li>
                <li className="flex items-center gap-3">
                   <div className="p-1.5 bg-slate-800 rounded-lg text-zammsa-green shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">info@zammsa.gov.zm</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-white uppercase tracking-widest mb-6">Follow Us</h3>
              <div className="flex gap-3">
                {['Twitter', 'LinkedIn', 'YouTube'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-zammsa-green hover:text-white transition-all group"
                  >
                    <span className="text-xs font-bold group-hover:scale-110 transition-transform">{social[0]}</span>
                  </a>
                ))}
              </div>
              <div className="mt-8">
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Email Updates"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-zammsa-green transition-all"
                  />
                  <button className="absolute right-2 top-2 px-3 py-1 bg-zammsa-green text-white text-xs font-bold rounded-lg hover:bg-zammsa-green-dark">
                    Join
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-20 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-widest">
            <p>&copy; {new Date().getFullYear()} ZAMMSA PMS. Government of Zambia.</p>
            <div className="flex gap-6">
              <Link to="/about" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/about" className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
