"use client"

import React from 'react';
import { Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../hooks/useAuth';

interface LoginRequiredProps {
  message?: string;
  description?: string;
  fullPage?: boolean; // If true, adds height to center vertically
}

const LoginRequired: React.FC<LoginRequiredProps> = ({ 
  message = "Login Required", 
  description = "Please log in to access this feature.",
  fullPage = true
}) => {
  const { login } = useAuth();

  return (
    <div className={`flex flex-col items-center justify-center ${fullPage ? 'h-[60vh]' : 'h-full py-12'}`}>
      <div className="bg-gray-100 p-4 rounded-full mb-4">
        <Lock className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{message}</h3>
      <p className="text-gray-500 mb-6 text-center max-w-sm">
        {description}
      </p>
      <Button onClick={login} className="bg-primary-500 hover:bg-primary-600 text-white">
        Log In
      </Button>
    </div>
  );
};

export default LoginRequired;
