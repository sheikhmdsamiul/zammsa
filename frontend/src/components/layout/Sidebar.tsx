import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/outline';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
}

interface SidebarProps {
  navItems: NavItem[];
  isOpen: boolean;
  onClose: () => void;
  brandName?: string;
  brandLogo?: React.ReactNode;
  accentColor?: string; // Tailwind color class name
  footer?: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({
  navItems,
  isOpen,
  onClose,
  brandName = 'ZAMMSA',
  brandLogo,
  accentColor = 'zammsa-green',
  footer
}) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeClass = `bg-${accentColor} text-white shadow-lg shadow-${accentColor}/20`;
  const inactiveClass = 'text-gray-400 hover:bg-gray-800 hover:text-white';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-zammsa-black border-r border-gray-800 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-20' : 'w-72'}`}
      >
        {/* Brand */}
        <div className="flex items-center h-20 px-6 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {brandLogo || (
              <div className={`w-10 h-10 bg-${accentColor} rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-${accentColor}/30`}>
                <span className="text-white text-lg font-bold">{brandName[0]}</span>
              </div>
            )}
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight text-white leading-tight">{brandName}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold">Procurement System</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-4 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && item.path !== '/admin' && item.path !== '/vendor/dashboard' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                  isActive ? activeClass : inactiveClass
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <div className={`shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </div>
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {isActive && !isCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />
                )}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-4 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-gray-700">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer / User Profile Area */}
        {footer && !isCollapsed && (
          <div className="p-4 border-t border-gray-800">
            {footer}
          </div>
        )}

        {/* Collapse Toggle (Desktop only) */}
        <div className="hidden lg:block p-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center w-full py-2.5 rounded-xl bg-gray-900/50 text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200 border border-gray-800"
          >
            {isCollapsed ? (
              <ChevronRightIcon className="h-5 w-5" />
            ) : (
              <div className="flex items-center gap-2">
                <ChevronLeftIcon className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Collapse Sidebar</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

/*
  Safelist for Tailwind (ensure these are not purged):
  bg-zammsa-green shadow-zammsa-green/20 shadow-zammsa-green/30
  bg-zammsa-orange shadow-zammsa-orange/20 shadow-zammsa-orange/30
*/
export default Sidebar;
