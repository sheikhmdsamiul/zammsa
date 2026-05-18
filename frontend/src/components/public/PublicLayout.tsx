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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zammsa-green rounded-full flex items-center justify-center">
                <span className="text-white text-lg font-bold">Z</span>
              </div>
              <div>
                <span className="text-xl font-bold text-zammsa-green">ZAMMSA</span>
                <span className="hidden sm:block text-xs text-gray-400 -mt-1">Procurement Portal</span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    location.pathname === link.path
                      ? 'text-zammsa-green bg-green-50'
                      : 'text-gray-600 hover:text-zammsa-green hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="ml-4 flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-zammsa-green border border-zammsa-green rounded-lg hover:bg-green-50 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/suppliers/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-zammsa-green-dark transition-colors"
                >
                  Register
                </Link>
              </div>
            </nav>

            <button
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
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

        {menuOpen && (
          <div className="lg:hidden border-t border-gray-200">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2 text-sm rounded-lg ${
                    location.pathname === link.path
                      ? 'text-zammsa-green bg-green-50 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-gray-100 flex gap-2">
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 text-center px-4 py-2 text-sm font-medium text-zammsa-green border border-zammsa-green rounded-lg"
                >
                  Login
                </Link>
                <Link
                  to="/suppliers/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 text-center px-4 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg"
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

      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-zammsa-green rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">Z</span>
                </div>
                <span className="text-lg font-bold text-white">ZAMMSA</span>
              </div>
              <p className="text-sm leading-relaxed">
                Zambia Medicines & Medical Supplies Agency - Ensuring quality healthcare through efficient procurement.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                {['Tenders', 'News', 'Notices', 'Events', 'FAQ'].map((item) => (
                  <li key={item}>
                    <Link to={`/${item.toLowerCase()}`} className="hover:text-zammsa-green transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Contact Info</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 mt-0.5 text-zammsa-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Plot 12345, Great East Road, Lusaka, Zambia</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-zammsa-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>+260 211 123 456</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-zammsa-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>info@zammsa.gov.zm</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-zammsa-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Mon-Fri: 08:00 - 17:00</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Follow Us</h3>
              <div className="flex gap-3">
                {[
                  { label: 'Facebook', path: '#' },
                  { label: 'Twitter', path: '#' },
                  { label: 'LinkedIn', path: '#' },
                  { label: 'YouTube', path: '#' },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.path}
                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-zammsa-green transition-colors"
                    title={social.label}
                  >
                    <span className="text-xs font-bold">{social.label[0]}</span>
                  </a>
                ))}
              </div>
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-white mb-2">Subscribe to Updates</h4>
                <div className="flex">
                  <input
                    type="email"
                    placeholder="Your email"
                    className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-l-lg focus:outline-none focus:border-zammsa-green text-white"
                  />
                  <button className="px-4 py-2 bg-zammsa-green text-white text-sm rounded-r-lg hover:bg-zammsa-green-dark">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} ZAMMSA. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/about" className="hover:text-gray-300">Privacy Policy</Link>
              <Link to="/about" className="hover:text-gray-300">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
