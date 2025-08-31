'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Home, Bookmark, User, Settings, Search, 
  Bell, TrendingUp, Globe, Filter, ChevronDown,
  Sun, Moon, Smartphone, Tablet, Monitor
} from 'lucide-react';

interface MobileOptimizedLayoutProps {
  children: React.ReactNode;
  user?: {
    id: string;
    name: string;
    avatar?: string;
    preferences: {
      theme: 'light' | 'dark' | 'auto';
      density: 'compact' | 'comfortable' | 'spacious';
    };
  };
}

export default function MobileOptimizedLayout({ children, user }: MobileOptimizedLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState(3);

  // Detect device type and screen size
  useEffect(() => {
    const detectDeviceType = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    detectDeviceType();
    window.addEventListener('resize', detectDeviceType);
    return () => window.removeEventListener('resize', detectDeviceType);
  }, []);

  // Handle theme changes
  useEffect(() => {
    const userTheme = user?.preferences.theme || 'auto';
    if (userTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    } else {
      setTheme(userTheme);
    }
  }, [user?.preferences.theme]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const navigationItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'trending', label: 'Trending', icon: TrendingUp, path: '/trending' },
    { id: 'categories', label: 'Categories', icon: Globe, path: '/categories' },
    { id: 'bookmarks', label: 'Saved', icon: Bookmark, path: '/bookmarks' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' }
  ];

  const getDensityClasses = () => {
    const density = user?.preferences.density || 'comfortable';
    switch (density) {
      case 'compact':
        return 'space-y-1 text-sm';
      case 'spacious':
        return 'space-y-6 text-lg';
      default:
        return 'space-y-4 text-base';
    }
  };

  const MobileNavigation = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-50 md:hidden">
      <div className="flex items-center justify-around py-2">
        {navigationItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
              {item.id === 'profile' && notifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const TabletSidebar = () => (
    <div className="hidden md:flex lg:hidden fixed left-0 top-0 h-full w-20 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col items-center py-4 z-40">
      <div className="mb-8">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">S</span>
        </div>
      </div>
      
      <nav className="flex-1 flex flex-col space-y-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-3 rounded-lg transition-colors relative ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              title={item.label}
            >
              <Icon className="w-6 h-6" />
              {item.id === 'profile' && notifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );

  const DesktopSidebar = () => (
    <div className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col z-40">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">SmartKhabar</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Live News Feed</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <div className={getDensityClasses()}>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.id === 'profile' && notifications > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
      
      {user && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
              ) : (
                <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {user.preferences.density} • {user.preferences.theme}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const TopBar = () => (
    <div className={`sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-30 ${
      deviceType === 'mobile' ? '' : deviceType === 'tablet' ? 'ml-20' : 'ml-64'
    }`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-4">
          {deviceType === 'mobile' && (
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}
          
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {navigationItems.find(item => item.id === activeTab)?.label || 'Home'}
            </h2>
            {deviceType !== 'mobile' && (
              <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                {deviceType === 'tablet' ? <Tablet className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                <span className="capitalize">{deviceType}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <Search className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          
          <button className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <Bell className="w-5 h-5" />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {notifications}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Search Bar */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search news, topics, sources..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const MobileMenu = () => (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 z-50 md:hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">SmartKhabar</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Live News Feed</p>
                </div>
              </div>
              
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <nav className="p-4">
              <div className={getDensityClasses()}>
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive 
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                          : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                      {item.id === 'profile' && notifications > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {notifications}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
            
            {user && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
                    ) : (
                      <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {user.preferences.density} • {user.preferences.theme}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Navigation Components */}
      <MobileNavigation />
      <TabletSidebar />
      <DesktopSidebar />
      <MobileMenu />
      
      {/* Main Content Area */}
      <div className={`${
        deviceType === 'mobile' ? 'pb-16' : deviceType === 'tablet' ? 'ml-20' : 'ml-64'
      }`}>
        <TopBar />
        
        <main className={`${getDensityClasses()} p-4`}>
          {children}
        </main>
      </div>
    </div>
  );
}