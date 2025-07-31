// Main navigation bar component for the entire application
// Features search functionality, user menu, cart, and scroll-based animations
"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchesPage } from '@/contexts/WatchesPageContext';
import { usePathname } from 'next/navigation';

// Custom SVG icon components for consistent styling and easy maintenance

// Search icon - magnifying glass design for the search functionality
const SearchIcon = () => ( 
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M17.5 3.33333C15.241 3.33352 13.0148 3.87394 11.0071 4.90948C8.99941 5.94503 7.26848 7.44569 5.95872 9.28625C4.64896 11.1268 3.79834 13.2539 3.47784 15.4901C3.15734 17.7262 3.37624 20.0066 4.11629 22.141C4.85634 24.2753 6.09607 26.2018 7.73206 27.7595C9.36804 29.3173 11.3528 30.4613 13.5209 31.096C15.6889 31.7307 17.9772 31.8377 20.195 31.4082C22.4128 30.9786 24.4957 30.0249 26.27 28.6267L32.3567 34.7133C32.671 35.0169 33.092 35.1849 33.529 35.1811C33.966 35.1773 34.384 35.002 34.693 34.693C35.002 34.384 35.1773 33.966 35.1811 33.529C35.1849 33.092 35.0169 32.671 34.7133 32.3567L28.6267 26.27C30.2733 24.181 31.2986 21.6707 31.5852 19.0262C31.8717 16.3817 31.408 13.71 30.247 11.3168C29.0861 8.92361 27.2748 6.90559 25.0205 5.49371C22.7662 4.08184 20.1599 3.33315 17.5 3.33333ZM6.66666 17.5C6.66666 14.6268 7.80803 11.8713 9.83967 9.83967C11.8713 7.80803 14.6268 6.66666 17.5 6.66666C20.3732 6.66666 23.1287 7.80803 25.1603 9.83967C27.192 11.8713 28.3333 14.6268 28.3333 17.5C28.3333 20.3732 27.192 23.1287 25.1603 25.1603C23.1287 27.192 20.3732 28.3333 17.5 28.3333C14.6268 28.3333 11.8713 27.192 9.83967 25.1603C7.80803 23.1287 6.66666 20.3732 6.66666 17.5Z" fill="black"/>
</svg>
)

// User icon - person silhouette for user account functionality
const UserIcon = () => (
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 6.66666C18.4529 6.66666 16.9692 7.28124 15.8752 8.37521C14.7812 9.46917 14.1667 10.9529 14.1667 12.5C14.1667 14.0471 14.7812 15.5308 15.8752 16.6248C16.9692 17.7187 18.4529 18.3333 20 18.3333C21.5471 18.3333 23.0308 17.7187 24.1248 16.6248C25.2188 15.5308 25.8333 14.0471 25.8333 12.5C25.8333 10.9529 25.2188 9.46917 24.1248 8.37521C23.0308 7.28124 21.5471 6.66666 20 6.66666ZM10.8333 12.5C10.8333 10.0688 11.7991 7.73727 13.5182 6.01818C15.2373 4.2991 17.5688 3.33333 20 3.33333C22.4312 3.33333 24.7627 4.2991 26.4818 6.01818C28.2009 7.73727 29.1667 10.0688 29.1667 12.5C29.1667 14.9311 28.2009 17.2627 26.4818 18.9818C24.7627 20.7009 22.4312 21.6667 20 21.6667C17.5688 21.6667 15.2373 20.7009 13.5182 18.9818C11.7991 17.2627 10.8333 14.9311 10.8333 12.5ZM5 31.6667C5 29.4565 5.87797 27.3369 7.44078 25.7741C9.00358 24.2113 11.1232 23.3333 13.3333 23.3333H26.6667C28.8768 23.3333 30.9964 24.2113 32.5592 25.7741C34.122 27.3369 35 29.4565 35 31.6667V36.6667H5V31.6667ZM13.3333 26.6667C12.0073 26.6667 10.7355 27.1934 9.7978 28.1311C8.86012 29.0688 8.33333 30.3406 8.33333 31.6667V33.3333H31.6667V31.6667C31.6667 30.3406 31.1399 29.0688 30.2022 28.1311C29.2645 27.1934 27.9927 26.6667 26.6667 26.6667H13.3333Z" fill="black"/>
</svg>
)

// Cart icon - shopping bag for cart functionality
const CartIcon = () => (
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M33.75 10H27.5C27.5 8.01088 26.7098 6.10322 25.3033 4.6967C23.8968 3.29018 21.9891 2.5 20 2.5C18.0109 2.5 16.1032 3.29018 14.6967 4.6967C13.2902 6.10322 12.5 8.01088 12.5 10H6.25C5.58696 10 4.95107 10.2634 4.48223 10.7322C4.01339 11.2011 3.75 11.837 3.75 12.5V31.25C3.75 31.913 4.01339 32.5489 4.48223 33.0178C4.95107 33.4866 5.58696 33.75 6.25 33.75H33.75C34.413 33.75 35.0489 33.4866 35.5178 33.0178C35.9866 32.5489 36.25 31.913 36.25 31.25V12.5C36.25 11.837 35.9866 11.2011 35.5178 10.7322C35.0489 10.2634 34.413 10 33.75 10ZM20 5C21.3261 5 22.5979 5.52678 23.5355 6.46447C24.4732 7.40215 25 8.67392 25 10H15C15 8.67392 15.5268 7.40215 16.4645 6.46447C17.4021 5.52678 18.6739 5 20 5ZM33.75 31.25H6.25V12.5H12.5V15C12.5 15.3315 12.6317 15.6495 12.8661 15.8839C13.1005 16.1183 13.4185 16.25 13.75 16.25C14.0815 16.25 14.3995 16.1183 14.6339 15.8839C14.8683 15.6495 15 15.3315 15 15V12.5H25V15C25 15.3315 25.1317 15.6495 25.3661 15.8839C25.6005 16.1183 25.9185 16.25 26.25 16.25C26.5815 16.25 26.8995 16.1183 27.1339 15.8839C27.3683 15.6495 27.5 15.3315 27.5 15V12.5H33.75V31.25Z" fill="black"/>
</svg>
)

// User menu dropdown component with authentication state management
// Handles login/logout functionality and user account options
const UserMenu = () => {
    const { isAuthenticated, user, logout } = useAuth(); // Get auth state from context
    const [isOpen, setIsOpen] = useState(false); // Local state for dropdown visibility
    const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for timeout management
    const isHoveringRef = useRef(false); // Ref to track hover state reliably
  
    // Handle mouse enter with delay to prevent flickering
    const handleMouseEnter = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isHoveringRef.current = true;
      setIsOpen(true);
    };
  
    // Handle mouse leave with delay to allow moving to dropdown
    const handleMouseLeave = () => {
      isHoveringRef.current = false;
      timeoutRef.current = setTimeout(() => {
        if (!isHoveringRef.current) {
          setIsOpen(false);
        }
      }, 150); // 150ms delay to allow cursor movement
    };
  
    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);
  
    return (
      <div 
        className="relative" 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* User icon that triggers dropdown on hover */}
        <Link href={!isAuthenticated ? "/login" : "#"} className="hover:opacity-70 transition-all duration-300 cursor-pointer">
          <UserIcon />
        </Link>
        
                 {/* Dropdown menu - only show when isOpen is true */}
         {isOpen && (
           <div 
             className="absolute right-0 mt-2 w-48 bg-white/5 border border-[#bfa68a] rounded-xl shadow-lg py-2 z-50 backdrop-blur-md"
             onMouseEnter={handleMouseEnter}
             onMouseLeave={handleMouseLeave}
           >
             {isAuthenticated ? (
               // Authenticated user menu options
               <>
                 <div className="px-3 py-2 text-sm text-[#bfa68a] border-b border-[#bfa68a]/30 font-medium text-center">
                   Welcome, {user?.firstName}
                 </div>
                 <Link href="/account/edit-details" className="block px-3 py-2 mt-1 text-sm text-[#F9F6F2] hover:bg-[#bfa68a]/10 hover:text-[#bfa68a] transition-all duration-300 text-center">
                   Edit Details
                 </Link>
                 <button onClick={logout} className="block w-full px-3 py-2 text-sm text-[#F9F6F2] hover:bg-[#bfa68a]/10 hover:text-[#bfa68a] transition-all duration-300 text-center">
                   Logout
                 </button>
               </>
             ) : (
               // Non-authenticated user menu options
               <>
                 <Link href="/login" className="block px-3 py-2 text-sm text-[#F9F6F2] hover:bg-[#bfa68a]/10 hover:text-[#bfa68a] transition-all duration-300 text-center">Sign In</Link>
                 <Link href="/register" className="block px-3 py-2 text-sm text-[#F9F6F2] hover:bg-[#bfa68a]/10 hover:text-[#bfa68a] transition-all duration-300 text-center">Join Us</Link>
               </>
             )}
           </div>
         )}
      </div>
    );
  };
  
  // Main navigation bar component with search, scroll effects, and responsive design
  export default function NavBar() {
    // Refs for DOM manipulation and focus management
    const navRef = useRef<HTMLElement>(null); // Reference to the nav element for height calculations
    const searchInputRef = useRef<HTMLInputElement>(null); // Reference to search input for focus management
    const searchContainerRef = useRef<HTMLDivElement>(null); // Reference to search container for click outside detection
    
    // State for search functionality
    const [isSearchExpanded, setIsSearchExpanded] = useState(false); // Controls search bar expansion
    const [searchQuery, setSearchQuery] = useState(''); // Current search input value
    
    // State for scroll-based animations and navbar behavior
    const lastScrollY = useRef(0); // Previous scroll position for direction detection
    const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up'); // Current scroll direction
    const pathname = usePathname(); // Current pathname for route change detection, Debug function
    const [scrollY, setScrollY] = useState(0); // Current scroll position for background opacity
    const [mounted, setMounted] = useState(false); // Hydration state to prevent SSR/client mismatch
    
    // Get resetToPageOne function from watches page context for navbar navigation
    const { resetToPageOne } = useWatchesPage();

    // Set mounted state to true after component mounts (prevents hydration errors)
    useEffect(() => {
      setMounted(true);
    }, []);
  
    // Handle search icon click - toggle search expansion and focus input
    const handleSearchClick = () => {
      if (isSearchExpanded) {
        // If search is expanded and has content, log the search (placeholder for actual search)
        if (searchQuery.trim()) console.log('Searching for:', searchQuery);
        else handleSearchClose(); // If no content, close search
      } else {
        // Expand search and focus input after animation delay
        setIsSearchExpanded(true);
        setTimeout(() => searchInputRef.current?.focus(), 200);
      }
    };
  
    // Close search bar and clear query
    const handleSearchClose = () => {
      setIsSearchExpanded(false);
      setSearchQuery('');
    };
  
    // Handle search form submission (prevent default and log search)
    const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) console.log('Searching for:', searchQuery);
    };
  
    // Handle keyboard events in search input (Escape to close)
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') handleSearchClose();
    };
  
    // Add click outside listener to close search when clicking elsewhere
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
          handleSearchClose();
        }
      };
  
      // Only add listener when search is expanded
      if (isSearchExpanded) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSearchExpanded]);
  
    // Calculate and set navbar height as CSS custom property for layout calculations
    useEffect(() => {
      const updateNavbarHeight = () => {
        if (navRef.current) {
          const height = navRef.current.offsetHeight;
          document.documentElement.style.setProperty('--navbar-height', `${height}px`);
        }
      };
      
      // Only run on client side to prevent SSR issues
      if (typeof window !== 'undefined') {
        updateNavbarHeight();
        const timer = setTimeout(updateNavbarHeight, 100); // Update after initial render
        window.addEventListener('resize', updateNavbarHeight); // Update on window resize
        return () => {
          clearTimeout(timer);
          window.removeEventListener('resize', updateNavbarHeight);
        };
      }
    }, []);
  
    // Handle scroll events for navbar hide/show animation and background opacity
    useEffect(() => {
      // Only run on client side to prevent SSR issues
      if (typeof window === 'undefined') return;
      
      let ticking = false; // Throttle scroll events for performance
      const handleScroll = () => {
        const currentY = window.scrollY;
        if (!ticking) {
          window.requestAnimationFrame(() => {
            const diff = currentY - lastScrollY.current;
            // Hide navbar when scrolling down more than 5 pixels
            if (diff > 5) setScrollDirection('down');
            // Show navbar when scrolling up more than 3 pixels
            else if (diff < -3) setScrollDirection('up');
            
            setScrollY(currentY); // Update scroll position for background opacity
            lastScrollY.current = currentY;
            ticking = false;
          });
          ticking = true;
        }
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Reset navbar to visible on route change
    useEffect(() => {
      setScrollDirection('up');
    }, [pathname]);
  
    return (
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 w-full z-50 px-16 py-12 grid grid-cols-3 items-center transition-all duration-800 ease-in-out ${mounted ? (scrollDirection === 'down' ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100') : 'translate-y-0 opacity-100'}`}
      >
        {/* Dynamic background with scroll-based opacity - only render when mounted */}
        {mounted && (
          <div 
            className="absolute inset-0 rounded-[20px] mt-12 mb-12"
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.025) 100%)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              zIndex: -1,
              opacity: Math.min(scrollY / 25, 1), // Smooth fade from 0 to 1 over 25px scroll
              transition: 'opacity 0.5s ease',
              marginLeft: '20px', // Custom left padding
              marginRight: '20px', // Custom right padding
            }}
          />
        )}
        
        {/* Left navigation menu - main site navigation links */}
        <div className="flex items-center justify-start gap-[50px] pl-8 font-playfair font-light tracking-[0.08em] text-white uppercase">
          <Link 
            href="/watches" 
            onClick={resetToPageOne} // Reset to page 1 when clicking Timepieces
            className="hover:opacity-10 transition-opacity"
          >
            Timepieces
          </Link>
          <Link href="/trend" className="hover:opacity-10 transition-opacity">Trend</Link>
          <Link href="/stories" className="hover:opacity-10 transition-opacity">Stories</Link>
          <Link href="/contact" className="hover:opacity-10 transition-opacity">Contact</Link>
        </div>
  
        {/* Center logo - brand name with hover effects */}
        <div className="justify-self-center">
          <Link 
            href="/" 
            className="font-playfair text-[48px] logo-text opacity-90 hover:opacity-10 transition-opacity" 
            style={{ fontWeight: 300 }}
          >
            Tourbillon
          </Link>
        </div>
  
        {/* Right side icons - user menu, cart, and search functionality */}
        <div ref={searchContainerRef} className="flex items-center gap-16 relative pr-4 justify-end">
          {/* User menu - hidden when search is expanded */}
          <div className={`transition-opacity duration-500 ${mounted && isSearchExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <UserMenu />
          </div>
          
          {/* Cart icon - hidden when search is expanded */}
          <Link href="/cart" className={`hover:opacity-70 transition-opacity duration-500 cursor-pointer ${mounted && isSearchExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <CartIcon />
          </Link>
          
          {/* Search functionality with expandable input field */}
          <div className="relative">
            {/* Search icon button */}
            <button onClick={handleSearchClick} className="hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-none p-0 relative z-20">
              <SearchIcon />
            </button>
            
            {/* Expandable search input container */}
            <div className={`absolute top-1/2 -translate-y-1/2 flex items-center transition-all duration-1000 ease-out ${isSearchExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ width: isSearchExpanded ? '450px' : '20px', right: '0px', overflow: 'hidden' }}>
              <form onSubmit={handleSearchSubmit} className="flex items-center relative w-full">
                {/* Search input field with styling and animations */}
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search luxury brands and watches..."
                  className={`w-full px-8 py-5 pr-20 bg-transparent border-0 border-b-2 border-white border-opacity-40 text-white placeholder-white placeholder-opacity-50 focus:outline-none focus:border-opacity-90 focus:placeholder-opacity-70 font-inter font-light tracking-wide text-xl transition-all duration-1000 ease-out hover:border-opacity-70 ${isSearchExpanded ? 'opacity-100' : 'opacity-0'}`}
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.025) 100%)',
                    backdropFilter: 'blur(12px)',
                    height: '68px',
                    color: '#f5f5dc',
                    fontSize: '20px',
                    borderRadius: '12px',
                  }}
                />
                
                {/* Animated underline effects for search input */}
                <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 scale-x-0 transition-transform duration-700 focus-within:scale-x-100 blur-sm"></div>
                <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-60 scale-x-0 transition-transform duration-700 focus-within:scale-x-100"></div>
              </form>
            </div>
          </div>
        </div>
      </nav>
    );
  }
  