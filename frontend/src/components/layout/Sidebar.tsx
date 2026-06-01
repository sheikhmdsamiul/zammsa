import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronRightIcon as ChevronRightSmall } from '@heroicons/react/outline';

export interface NavSubItem {
  label: string;
  path: string;
  badge?: number;
}

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
  children?: NavSubItem[];
  badge?: number;
}

interface SidebarProps {
  navItems: NavItem[];
  isOpen: boolean;
  onClose: () => void;
  brandName?: string;
  brandLogo?: React.ReactNode;
  accentColor?: string;
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (path: string) => {
    setExpandedSections(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const pathOnly = (p: string) => p.split('?')[0];

  const isActive = (item: NavItem) => {
    if (location.pathname === item.path) return true;
    if (item.children) {
      return item.children.some(child => location.pathname.startsWith(pathOnly(child.path)));
    }
    if (item.path !== '/' && item.path !== '/admin' && item.path !== '/vendor/dashboard') {
      if (!item.children && location.pathname.startsWith(item.path)) {
        return true;
      }
    }
    return false;
  };

  const isChildActive = (childPath: string) => location.pathname.startsWith(pathOnly(childPath));

  const activeClass = `bg-${accentColor} text-white shadow-lg shadow-${accentColor}/20`;
  const activeChildClass = `bg-${accentColor}/10 text-${accentColor} font-bold`;
  const inactiveClass = 'text-gray-400 hover:bg-gray-800 hover:text-white';
  const inactiveChildClass = 'text-gray-500 hover:text-white hover:bg-gray-800/50';

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item);
    const expanded = expandedSections[item.path] || (item.children && item.children.some(c => isChildActive(c.path)));

    return (
      <div key={item.path + '|' + item.label}>
        {item.children ? (
          <div>
            <button
              onClick={() => !isCollapsed && toggleSection(item.path)}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 w-full group relative ${
                active ? activeClass : inactiveClass
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <div className={`shrink-0 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                {item.icon}
              </div>
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`} />
                  </div>
                </>
              )}
              {active && !isCollapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-gray-700">
                  {item.label}
                </div>
              )}
            </button>
            {!isCollapsed && expanded && (
              <div className="ml-8 mt-1 space-y-0.5 border-l border-gray-700/50 pl-3">
                {item.children.map((child) => {
                  const childActive = isChildActive(child.path);
                  return (
                    <Link
                      key={child.path + '|' + child.label}
                      to={child.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                        childActive ? activeChildClass : inactiveChildClass
                      }`}
                    >
                      <span className="truncate flex-1">{child.label}</span>
                      {child.badge !== undefined && child.badge > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                          {child.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <Link
            to={item.path}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
              active ? activeClass : inactiveClass
            }`}
            title={isCollapsed ? item.label : ''}
          >
            <div className={`shrink-0 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
              {item.icon}
            </div>
            {!isCollapsed && (
              <span className="truncate flex-1">{item.label}</span>
            )}
            {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                {item.badge}
              </span>
            )}
            {active && !isCollapsed && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />
            )}
            {isCollapsed && (
              <div className="absolute left-full ml-4 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-gray-700">
                {item.label}
              </div>
            )}
          </Link>
        )}
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-zammsa-black border-r border-gray-800 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-20' : 'w-72'}`}
      >
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

        <nav className="flex-1 mt-4 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map(renderNavItem)}
        </nav>

        {footer && !isCollapsed && (
          <div className="p-4 border-t border-gray-800">
            {footer}
          </div>
        )}

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
  bg-zammsa-green/10 text-zammsa-green
*/
export default Sidebar;