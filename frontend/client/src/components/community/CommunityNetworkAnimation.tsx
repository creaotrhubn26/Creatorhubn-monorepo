/**
 * CreatorHub Community Network Animation
 * 
 * Canvas-based animated scene showing community members communicating
 * with particles, connection lines, and smooth animations
 * 
 * Simplified from Three.js to avoid dynamic import issues
 */

import React, { useRef, useEffect } from 'react';

interface CommunityNetworkAnimationProps {
  width?: number;
  height?: number;
}

interface Member {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
}

const CommunityNetworkAnimation: React.FC<CommunityNetworkAnimationProps> = ({
  width = 360,
  height = 360,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Initialize members (community nodes)
    const memberCount = 6;
    const centerX = width / 2;
    const centerY = height / 2;
    const memberRadius = Math.min(width, height) * 0.3;
    
    const members: Member[] = [];
    for (let i = 0; i < memberCount; i++) {
      const angle = (i / memberCount) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * memberRadius;
      const y = centerY + Math.sin(angle) * memberRadius;
      
      members.push({
        x,
        y,
        baseX: x,
        baseY: y,
        radius: 15,
        phase: i * 0.5,
      });
    }

    // Initialize particles
    const particles: Particle[] = [];
    for (let i = 0; i < 50; i++) {
      const startMember = Math.floor(Math.random() * memberCount);
      const endMember = (startMember + Math.floor(Math.random() * (memberCount - 1)) + 1) % memberCount;
      
      particles.push({
        x: members[startMember].baseX,
        y: members[startMember].baseY,
        startX: members[startMember].baseX,
        startY: members[startMember].baseY,
        targetX: members[endMember].baseX,
        targetY: members[endMember].baseY,
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.005,
      });
    }

    let time = 0;
    let lastTime = performance.now();
    const hubColor = '#f59e0b';
    const secondaryColor = '#fbbf24';

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      time += deltaTime;

      // Clear canvas with slight fade effect
      ctx.fillStyle = 'rgba(26, 26, 46, 0.1)';
      ctx.fillRect(0, 0, width, height);

      // Draw background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, width, height);

      // Update and draw members
      members.forEach((member, i) => {
        // Floating motion
        const floatX = Math.sin(time + member.phase) * 10;
        const floatY = Math.cos(time * 0.7 + member.phase) * 10;
        member.x = member.baseX + floatX;
        member.y = member.baseY + floatY;

        // Draw connection line to center
        ctx.strokeStyle = `rgba(245, 158, 11, 0.3)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(member.x, member.y);
        ctx.stroke();

        // Draw member glow
        const glowSize = 25 + Math.sin(time * 3 + member.phase) * 5;
        const gradient = ctx.createRadialGradient(member.x, member.y, 0, member.x, member.y, glowSize);
        gradient.addColorStop(0, `rgba(245, 158, 11, 0.4)`);
        gradient.addColorStop(1, `rgba(245, 158, 11, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(member.x - glowSize, member.y - glowSize, glowSize * 2, glowSize * 2);

        // Draw member circle
        ctx.fillStyle = hubColor;
        ctx.beginPath();
        ctx.arc(member.x, member.y, member.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw member ring
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(member.x, member.y, member.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Draw center hub
      const hubScale = 1 + Math.sin(time * 2) * 0.1;
      const hubRadius = 20 * hubScale;

      // Hub glow
      const hubGlowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 40);
      hubGlowGradient.addColorStop(0, `rgba(245, 158, 11, 0.3)`);
      hubGlowGradient.addColorStop(1, `rgba(245, 158, 11, 0)`);
      ctx.fillStyle = hubGlowGradient;
      ctx.fillRect(centerX - 40, centerY - 40, 80, 80);

      // Hub main circle
      ctx.fillStyle = hubColor;
      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius, 0, Math.PI * 2);
      ctx.fill();

      // Hub ring
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius + 12, 0, Math.PI * 2);
      ctx.stroke();

      // Draw rotating outer ring
      const ringRotation = time * 0.3;
      ctx.strokeStyle = `rgba(245, 158, 11, 0.2)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const outerRadius = memberRadius + 30;
      ctx.arc(centerX, centerY, outerRadius, ringRotation, ringRotation + Math.PI * 1.5);
      ctx.stroke();

      // Update and draw particles
      particles.forEach((particle) => {
        particle.progress += particle.speed;

        if (particle.progress >= 1) {
          // Reset particle
          const startMember = Math.floor(Math.random() * memberCount);
          const endMember = (startMember + Math.floor(Math.random() * (memberCount - 1)) + 1) % memberCount;
          
          particle.startX = members[startMember].baseX;
          particle.startY = members[startMember].baseY;
          particle.targetX = members[endMember].baseX;
          particle.targetY = members[endMember].baseY;
          particle.progress = 0;
        }

        // Interpolate position with curve
        const t = particle.progress;
        const curve = Math.sin(t * Math.PI) * 0.3;
        
        particle.x = particle.startX + (particle.targetX - particle.startX) * t;
        particle.y = particle.startY + (particle.targetY - particle.startY) * t + curve;

        // Draw particle
        const opacity = Math.sin(particle.progress * Math.PI);
        ctx.fillStyle = `rgba(245, 158, 11, ${opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'block',
        backgroundColor: '#1a1a2e',
      }}
    />
  );
};

export default CommunityNetworkAnimation;
