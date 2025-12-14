import React, { useState } from 'react';
import Button from './Button';
import { TextAlignJustify } from 'lucide-react';
import Logo from './icons/Logo';
import type { AppUser } from '../pages/meet/types';
import Avatar from './Avatar';
import { getAuthService } from '../utils/AuthService';

// Define the types for the component's props
type PageType = 'welcome' | 'landing';
type ActivePage = 'Features' | 'Comparison' | 'Pricing' | 'FAQ'; // Possible active pages

interface HeaderProps {
  pageType?: PageType;
  user?: AppUser;
  activePage?: ActivePage;
}

const navItems = [
  { name: 'Features', href: '/features' },
  { name: 'Comparison', href: '/comparison' },
  { name: 'Pricing', href: '/#pricing' },
  { name: 'FAQ', href: '/faq' },
];

const Header: React.FC<HeaderProps> = ({
  pageType = 'landing',
  user,
  activePage,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleAuthAction = (action: 'login' | 'logout' | 'signup') => {
    const authService = getAuthService();
    if (authService) {
      authService[action]();
    }
  };

  const renderNavLinks = () => {
    if (pageType === 'landing') {
      return (
        <nav className='hidden md:flex gap-8'>
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={
                activePage === item.name
                  ? 'text-primary-500 font-semibold'
                  : 'text-gray-600 hover:text-primary-500'
              }
            >
              {item.name}
            </a>
          ))}
        </nav>
      );
    }
    return null;
  };

  // Desktop right section (auth buttons + CTA)
  const renderDesktopRight = () => {
    if (pageType === 'welcome') {
      return (
        <div className='hidden md:flex gap-4 items-center'>
          {user ? (
            <>
              <Button variant='secondary' onClick={() => handleAuthAction('logout')}>
                Log Out
              </Button>
              {user.avatarUrl && (
                <Avatar
                  src={user.avatarUrl}
                  alt={user.name}
                  className='user-avatar w-14 h-14 rounded-full object-cover mx-auto sm:mx-0'
                />
              )}
            </>
          ) : (
            <>
              <Button variant='secondary' onClick={() => handleAuthAction('login')}>
                Login
              </Button>
              <Button variant='primary' onClick={() => handleAuthAction('signup')}>
                Signup
              </Button>
            </>
          )}
        </div>
      );
    }

    // Landing page
    return (
      <div className='hidden md:flex gap-4 items-center'>
        <a href='/dashboard'>
          <Button
            variant='primary'
            className='hidden md:block'
          >
            Visit Platform
          </Button>
        </a>
      </div>
    );
  };

  const renderMobileMenu = () => {
    if (!mobileMenuOpen) return null;

    return (
      <div className='absolute top-full left-0 right-0 bg-white rounded-xl shadow-md p-4 flex flex-col gap-3 w-full z-50 md:w-64'>
        {pageType === 'landing' ? (
          <>
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={
                  activePage === item.name
                    ? 'text-black font-semibold'
                    : 'text-gray-600 hover:text-black'
                }
              >
                {item.name}
              </a>
            ))}
            <a href='/dashboard'>
              <Button variant='primary'>
                Visit Platform
              </Button>
            </a>
          </>
        ) : user ? (
          <Button
            variant='secondary'
            onClick={() => handleAuthAction('logout')}
          >
            Log Out
          </Button>
        ) : (
          <>
            <Button
              variant='secondary'
              onClick={() => handleAuthAction('login')}
            >
              Login
            </Button>
            <Button
              variant='primary'
              onClick={() => handleAuthAction('signup')}
            >
              Signup
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <header className='ml-[2vw] mr-[2vw] flex flex-1 items-center justify-between rounded-full md:border md:border-gray-200 p-3 mt-4 md:shadow-sm md:backdrop-blur-sm relative'>
      <div className='flex items-center gap-2 pl-4'>
          <Logo />
      </div>
      <div className='absolute left-1/2 transform -translate-x-1/2'>
        {renderNavLinks()}
      </div>
      <div className='flex items-center gap-2 md:gap-4'>
        {renderDesktopRight()}
        <div className='md:hidden flex items-center'>
          <button
            className='p-2'
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <TextAlignJustify strokeWidth={3} size={26} />
          </button>
          {renderMobileMenu()}
        </div>
      </div>
    </header>
  );
};

export default Header;
