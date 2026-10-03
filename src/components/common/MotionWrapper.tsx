import React, { useRef, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// ============================================================================
// 1. PAGE TRANSITION WRAPPER
// ============================================================================
interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  tabKey: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = '',
  tabKey,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key={tabKey}
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.995 }}
      transition={{
        duration: 0.22,
        ease: [0.22, 1, 0.36, 1], // Custom fast cubic bezier
      }}
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  );
};

// ============================================================================
// 2. STAGGER CONTAINER & ITEM
// ============================================================================
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  className = '',
  delay = 0.06,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : 'hidden'}
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: delay,
            delayChildren: 0.02,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
  useViewport?: boolean;
}> = ({ children, className = '', useViewport = false }) => {
  const shouldReduceMotion = useReducedMotion();

  if (useViewport) {
    return (
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{
          duration: 0.35,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={{
        hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 },
        show: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.3,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ============================================================================
// 2B. VIEWPORT-TRIGGERED SECTION REVEAL (whileInView with 15px translateY & opacity)
// ============================================================================
interface ViewportSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const ViewportSection: React.FC<ViewportSectionProps> = ({
  children,
  className = '',
  delay = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration: 0.36,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

// ============================================================================
// 3. 3D INTERACTIVE TILT CARD (Spatial Depth)
// ============================================================================
interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  depth?: number; // max tilt degrees (default 3)
}

export const Card3D: React.FC<Card3DProps> = ({
  children,
  className = '',
  onClick,
  depth = 3,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -depth;
    const rotY = ((x - centerX) / centerX) * depth;

    setRotateX(rotX);
    setRotateY(rotY);
  };

  const handleMouseEnter = () => {
    if (!shouldReduceMotion) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      animate={{
        rotateX: isHovered ? rotateX : 0,
        rotateY: isHovered ? rotateY : 0,
        y: isHovered ? -2 : 0,
        scale: isHovered ? 1.008 : 1,
      }}
      whileTap={{ scale: 0.985 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
      className={`relative transition-shadow duration-200 ${
        isHovered ? 'shadow-xl' : 'shadow-xs'
      } ${className}`}
    >
      {children}
    </motion.div>
  );
};

// ============================================================================
// 4. ANIMATED COUNT UP NUMBER
// ============================================================================
interface CountUpNumberProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  duration = 0.8,
  suffix = '',
  prefix = '',
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    let start = 0;
    const end = value;
    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const startTime = performance.now();
    const durationMs = duration * 1000;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration, shouldReduceMotion]);

  return (
    <span className={className}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
};

// ============================================================================
// 5. INTERACTIVE BUTTON WRAPPER (Micro-Interactions)
// ============================================================================
interface InteractiveButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const InteractiveButton: React.FC<InteractiveButtonProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={`cursor-pointer ${className}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
};
