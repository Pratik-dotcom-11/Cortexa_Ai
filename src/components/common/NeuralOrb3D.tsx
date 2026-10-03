import React, { useEffect, useRef } from 'react';

interface NeuralOrb3DProps {
  size?: number;
  className?: string;
  interactive?: boolean;
}

export const NeuralOrb3D: React.FC<NeuralOrb3DProps> = ({
  size = 280,
  className = '',
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Node structure in 3D sphere coordinate space
    const NODE_COUNT = 32;
    const nodes: Array<{
      x: number;
      y: number;
      z: number;
      baseX: number;
      baseY: number;
      baseZ: number;
      radius: number;
      color: string;
      pulsePhase: number;
    }> = [];

    const radius = size * 0.36;

    // Distribute nodes evenly using Fibonacci sphere algorithm
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
    const colors = [
      '#6366f1', // Indigo
      '#8b5cf6', // Violet
      '#06b6d4', // Cyan
      '#3b82f6', // Blue
      '#a855f7', // Purple
    ];

    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y); // radius at y
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      nodes.push({
        x: x * radius,
        y: y * radius,
        z: z * radius,
        baseX: x * radius,
        baseY: y * radius,
        baseZ: z * radius,
        radius: Math.random() * 2.2 + 2,
        color: colors[i % colors.length],
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    let angleX = 0.002;
    let angleY = 0.004;
    let targetAngleX = 0.002;
    let targetAngleY = 0.004;
    let mouseX = 0;
    let mouseY = 0;
    let isHovering = false;
    let animationFrameId: number;
    let isVisible = true;

    // Mouse movement parallax
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas || !interactive) return;
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      mouseY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      targetAngleY = mouseX * 0.015;
      targetAngleX = -mouseY * 0.015;
      isHovering = true;
    };

    const handleMouseLeave = () => {
      targetAngleX = 0.002;
      targetAngleY = 0.004;
      isHovering = false;
    };

    if (interactive) {
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseLeave);
    }

    // Visibility Observer to save battery when scrolled away
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(canvas);

    let time = 0;

    const render = () => {
      if (!canvas || !ctx) return;

      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      time += 0.02;

      // Smooth interpolation for mouse interaction
      angleX += (targetAngleX - angleX) * 0.05;
      angleY += (targetAngleY - angleY) * 0.05;

      const currentAngleX = prefersReducedMotion ? 0 : angleX;
      const currentAngleY = prefersReducedMotion ? 0 : angleY;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Subtle atmospheric core glow
      const coreGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        5,
        centerX,
        centerY,
        radius * 1.1
      );
      coreGradient.addColorStop(0, 'rgba(99, 102, 241, 0.18)');
      coreGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.08)');
      coreGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Rotate nodes in 3D space
      const cosX = Math.cos(currentAngleX);
      const sinX = Math.sin(currentAngleX);
      const cosY = Math.cos(currentAngleY);
      const sinY = Math.sin(currentAngleY);

      nodes.forEach((node) => {
        // Y-axis rotation
        let x1 = node.x * cosY - node.z * sinY;
        let z1 = node.z * cosY + node.x * sinY;

        // X-axis rotation
        let y2 = node.y * cosX - z1 * sinX;
        let z2 = z1 * cosX + node.y * sinX;

        node.x = x1;
        node.y = y2;
        node.z = z2;
      });

      // Sort nodes by Z depth for realistic layering
      const sortedNodes = [...nodes].sort((a, b) => a.z - b.z);

      // Draw connective neural synapse lines
      const maxDistance = radius * 0.95;
      for (let i = 0; i < sortedNodes.length; i++) {
        for (let j = i + 1; j < sortedNodes.length; j++) {
          const n1 = sortedNodes[i];
          const n2 = sortedNodes[j];

          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dz = n1.z - n2.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * 0.32 * ((n1.z + radius) / (radius * 2));
            ctx.beginPath();
            ctx.moveTo(centerX + n1.x, centerY + n1.y);
            ctx.lineTo(centerX + n2.x, centerY + n2.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${Math.max(0, alpha)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw nodes with depth-based scale and lighting
      sortedNodes.forEach((node) => {
        const depthScale = (node.z + radius * 1.5) / (radius * 2.5);
        const currentRadius = Math.max(1, node.radius * depthScale);
        const pulse = Math.sin(time * 2 + node.pulsePhase) * 0.3 + 0.7;
        const opacity = Math.min(1, Math.max(0.2, depthScale * pulse));

        const posX = centerX + node.x;
        const posY = centerY + node.y;

        // Outer glow
        ctx.beginPath();
        ctx.arc(posX, posY, currentRadius * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${opacity * 0.25})`;
        ctx.fill();

        // Core node
        ctx.beginPath();
        ctx.arc(posX, posY, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = opacity;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // Subtle orbital ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time * 0.1);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.15, radius * 0.45, Math.PI / 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      if (interactive) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [size, interactive]);

  return (
    <div
      className={`relative flex items-center justify-center select-none pointer-events-auto ${className}`}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
