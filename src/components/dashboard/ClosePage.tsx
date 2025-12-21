import React from 'react';
import { 
  LayoutDashboard, 
  RotateCcw, 
  X, 
  LogOut 
} from 'lucide-react';
import SonacoveLogo from '../../assets/sonacove-orange.svg';

const ClosePage = () => {
  const handleCloseApp = () => {
    try {
      window.close();
    } catch (e) {
      console.warn("Could not close window directly", e);
    }
  };

  const handleGoDashboard = () => {
    // @ts-ignore
    if (typeof window.jitsiNodeAPI !== 'undefined') {
        // @ts-ignore
        window.jitsiNodeAPI.ipc.send('nav-to-home');
    } else {
        window.location.href = '/dashboard';
    }
  };

  const handleRejoin = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen w-full bg-gray-50/50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      
      <div className="mb-8 flex items-center gap-3">
        <img 
          src={SonacoveLogo.src} 
          alt="Sonacove" 
          className="h-12 w-12 shrink-0" 
        />
        <span className="text-4xl font-bold text-primary font-crimson tracking-tight">
          Sonacove
        </span>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-lg bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Card Header */}
        <div className="p-8 text-center border-b border-gray-100">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <LogOut className="h-8 w-8 text-gray-500 ml-1" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Meeting Ended
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed">
            You have left the conference. <br />
            Would you like to return to the dashboard or close the app?
          </p>
        </div>

        {/* Card Actions */}
        <div className="p-6 bg-gray-50/30 flex flex-col gap-3">
          
          {/* Primary Action: Go to Dashboard */}
          <button
            onClick={handleGoDashboard}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all duration-200"
          >
            <LayoutDashboard className="h-5 w-5" />
            Back to Dashboard
          </button>

          <div className="grid grid-cols-2 gap-3 mt-1">
            {/* Secondary: Rejoin */}
            <button
              onClick={handleRejoin}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-200 transition-all duration-200"
            >
              <RotateCcw className="h-5 w-5" />
              Rejoin
            </button>

            {/* Secondary: Close App */}
            <button
              onClick={handleCloseApp}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 hover:text-red-700 hover:border-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-100 transition-all duration-200"
            >
              <X className="h-5 w-5" />
              Close App
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 text-sm text-gray-400">
        &copy; {new Date().getFullYear()} Sonacove. All rights reserved.
      </div>
    </div>
  );
};

export default ClosePage;
