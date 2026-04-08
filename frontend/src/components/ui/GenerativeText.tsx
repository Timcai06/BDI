'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface GenerativeTextProps {
  text: string;
  delay?: number;
  className?: string;
  gradient?: boolean;
}

export const GenerativeText: React.FC<GenerativeTextProps> = ({ 
  text, 
  delay = 0, 
  className = "",
  gradient = false
}) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      setHasStarted(true);
      setIsTyping(true);
      
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(interval);
        }
      }, 40); // Type speed 40ms per char

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(startTimeout);
  }, [text, delay]);

  return (
    <span className={`inline-block relative ${className}`}>
      {/* Ghost text for layout sizing */}
      <span className="opacity-0">{text}</span>
      
      {/* Actual typed text */}
      <span className={`absolute left-0 top-0 whitespace-nowrap ${gradient ? 'bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40' : ''}`}>
        {displayText}
        {isTyping && hasStarted && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="inline-block w-1.5 h-[0.85em] bg-[#63e6ff] ml-1 translate-y-[2px]"
          />
        )}
      </span>
    </span>
  );
};
