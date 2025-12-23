/**
 * CreatorHub Community Network Animation
 * 
 * Three.js animated scene showing community members communicating
 * with particles, connection lines, and smooth 3D animations
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import * as THREE from 'three';

interface CommunityNetworkAnimationProps {
  width?: number;
  height?: number;
}

const CommunityNetworkAnimation: React.FC<CommunityNetworkAnimationProps> = ({
  width = 360,
  height = 360,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 8;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Colors
    const orangeColor = new THREE.Color(0xf59e0b);
    const amberColor = new THREE.Color(0xfbbf24);
    const darkOrange = new THREE.Color(0xd97706);

    // Central hub (CreatorHub logo representation)
    const hubGeometry = new THREE.SphereGeometry(0.6, 32, 32);
    const hubMaterial = new THREE.MeshBasicMaterial({
      color: orangeColor,
      transparent: true,
      opacity: 0.9,
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    scene.add(hub);

    // Inner hub ring
    const hubRingGeometry = new THREE.RingGeometry(0.7, 0.75, 32);
    const hubRingMaterial = new THREE.MeshBasicMaterial({
      color: amberColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const hubRing = new THREE.Mesh(hubRingGeometry, hubRingMaterial);
    scene.add(hubRing);

    // Community members (spheres positioned in a circle)
    const memberCount = 6;
    const members: THREE.Mesh[] = [];
    const memberRadius = 3;

    for (let i = 0; i < memberCount; i++) {
      const angle = (i / memberCount) * Math.PI * 2;
      const x = Math.cos(angle) * memberRadius;
      const y = Math.sin(angle) * memberRadius;

      // Member sphere
      const memberGeometry = new THREE.SphereGeometry(0.35, 24, 24);
      const memberMaterial = new THREE.MeshBasicMaterial({
        color: orangeColor,
        transparent: true,
        opacity: 0.85,
      });
      const member = new THREE.Mesh(memberGeometry, memberMaterial);
      member.position.set(x, y, 0);
      member.userData = { 
        baseX: x, 
        baseY: y, 
        phase: i * 0.5,
        pulsePhase: i * (Math.PI / 3),
      };
      scene.add(member);
      members.push(member);

      // Member glow ring
      const glowGeometry = new THREE.RingGeometry(0.4, 0.5, 24);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: amberColor,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.set(x, y, 0);
      glow.userData = { member: member };
      scene.add(glow);
    }

    // Connection lines between hub and members
    const lineMaterial = new THREE.LineBasicMaterial({
      color: orangeColor,
      transparent: true,
      opacity: 0.4,
    });

    const connectionLines: THREE.Line[] = [];
    members.forEach((member) => {
      const points = [
        new THREE.Vector3(0, 0, 0),
        member.position.clone(),
      ];
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      scene.add(line);
      connectionLines.push(line);
    });

    // Particle system for "communication" effect
    const particleCount = 100;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleColors = new Float32Array(particleCount * 3);
    const particleVelocities: { x: number; y: number; z: number; targetMember: number; progress: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      // Start at random member
      const startMember = Math.floor(Math.random() * memberCount);
      const endMember = (startMember + Math.floor(Math.random() * (memberCount - 1)) + 1) % memberCount;
      
      const startAngle = (startMember / memberCount) * Math.PI * 2;
      const x = Math.cos(startAngle) * memberRadius;
      const y = Math.sin(startAngle) * memberRadius;
      
      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      
      particleSizes[i] = Math.random() * 3 + 1;
      
      // Orange/amber colors
      const colorChoice = Math.random();
      if (colorChoice < 0.33) {
        particleColors[i * 3] = 0.96; // R
        particleColors[i * 3 + 1] = 0.62; // G
        particleColors[i * 3 + 2] = 0.04; // B
      } else if (colorChoice < 0.66) {
        particleColors[i * 3] = 0.98;
        particleColors[i * 3 + 1] = 0.75;
        particleColors[i * 3 + 2] = 0.14;
      } else {
        particleColors[i * 3] = 0.85;
        particleColors[i * 3 + 1] = 0.47;
        particleColors[i * 3 + 2] = 0.02;
      }

      particleVelocities.push({
        x: 0,
        y: 0,
        z: 0,
        targetMember: endMember,
        progress: Math.random(), // Start at random progress
      });
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.08,
      transparent: true,
      opacity: 0.8,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Outer rotating ring
    const outerRingGeometry = new THREE.RingGeometry(4, 4.05, 64);
    const outerRingMaterial = new THREE.MeshBasicMaterial({
      color: orangeColor,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
    scene.add(outerRing);

    // Dashed outer ring
    const dashedRingPoints: THREE.Vector3[] = [];
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      dashedRingPoints.push(new THREE.Vector3(Math.cos(angle) * 4.3, Math.sin(angle) * 4.3, 0));
    }
    dashedRingPoints.push(dashedRingPoints[0].clone());
    
    const dashedRingGeometry = new THREE.BufferGeometry().setFromPoints(dashedRingPoints);
    const dashedRingMaterial = new THREE.LineDashedMaterial({
      color: amberColor,
      transparent: true,
      opacity: 0.3,
      dashSize: 0.3,
      gapSize: 0.15,
    });
    const dashedRing = new THREE.Line(dashedRingGeometry, dashedRingMaterial);
    dashedRing.computeLineDistances();
    scene.add(dashedRing);

    // ============================================
    // Chat Message Bubbles System
    // ============================================
    
    // Messages that will pop up
    const chatMessages = [
      'Hei! 👋',
      'Bra jobbet! 🎉',
      'Tips? 💡',
      'Takk! ❤️',
      'Kult! 🔥',
      'Enig! 👍',
      'Wow! ✨',
      'Sjekk dette!',
      'Flott arbeid!',
      '🎬',
      '📸',
      '🎵',
      'Samarbeid?',
      'Feedback?',
      '👏👏👏',
      'Inspirerende!',
      'Nytt prosjekt!',
      'Trenger hjelp?',
      'Jeg er med!',
      '🚀',
    ];

    // Function to create a chat bubble texture
    const createChatBubbleTexture = (message: string): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      canvas.width = 512;
      canvas.height = 192;
      
      // Background bubble with gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(26, 26, 46, 0.98)');
      gradient.addColorStop(1, 'rgba(15, 15, 30, 0.98)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(12, 12, canvas.width - 24, canvas.height - 48, 24);
      ctx.fill();
      
      // Glow border
      ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Bubble tail
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(70, canvas.height - 36);
      ctx.lineTo(90, canvas.height - 8);
      ctx.lineTo(110, canvas.height - 36);
      ctx.fill();
      
      // Text with shadow
      ctx.shadowColor = 'rgba(245, 158, 11, 0.3)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 12);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    // Chat bubble sprites pool
    interface ChatBubble {
      sprite: THREE.Sprite;
      life: number;
      maxLife: number;
      memberIndex: number;
      offsetX: number;
      offsetY: number;
      startY: number;
    }
    
    const chatBubbles: ChatBubble[] = [];
    const maxBubbles = 5;
    let lastBubbleTime = 0;
    const bubbleInterval = 1.5; // seconds between bubbles

    // Function to spawn a new chat bubble
    const spawnChatBubble = (currentTime: number) => {
      if (chatBubbles.length >= maxBubbles) return;
      if (currentTime - lastBubbleTime < bubbleInterval) return;
      
      lastBubbleTime = currentTime;
      
      // Pick a random member
      const memberIndex = Math.floor(Math.random() * memberCount);
      const member = members[memberIndex];
      
      // Pick a random message
      const message = chatMessages[Math.floor(Math.random() * chatMessages.length)];
      
      // Create texture and sprite
      const texture = createChatBubbleTexture(message);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      
      // Position near the member
      const offsetX = (Math.random() - 0.5) * 0.5;
      const offsetY = 0.6;
      sprite.position.set(
        member.position.x + offsetX,
        member.position.y + offsetY,
        0.5
      );
      sprite.scale.set(2.4, 0.9, 1);
      
      scene.add(sprite);
      
      chatBubbles.push({
        sprite,
        life: 0,
        maxLife: 3, // 3 seconds
        memberIndex,
        offsetX,
        offsetY,
        startY: member.position.y + offsetY,
      });
    };

    // Function to update chat bubbles
    const updateChatBubbles = (deltaTime: number, currentTime: number) => {
      // Try to spawn new bubbles
      spawnChatBubble(currentTime);
      
      // Update existing bubbles
      for (let i = chatBubbles.length - 1; i >= 0; i--) {
        const bubble = chatBubbles[i];
        bubble.life += deltaTime;
        
        const progress = bubble.life / bubble.maxLife;
        const member = members[bubble.memberIndex];
        
        // Update position (follow member + float up)
        bubble.sprite.position.x = member.position.x + bubble.offsetX;
        bubble.sprite.position.y = member.position.y + bubble.offsetY + progress * 0.5;
        
        // Fade in, stay, fade out
        let opacity = 1;
        if (progress < 0.15) {
          // Fade in
          opacity = progress / 0.15;
        } else if (progress > 0.7) {
          // Fade out
          opacity = 1 - (progress - 0.7) / 0.3;
        }
        
        // Scale animation (pop in)
        let scale = 1;
        if (progress < 0.1) {
          scale = 0.5 + (progress / 0.1) * 0.5;
        }
        
        (bubble.sprite.material as THREE.SpriteMaterial).opacity = opacity;
        bubble.sprite.scale.set(2.4 * scale, 0.9 * scale, 1);
        
        // Remove expired bubbles
        if (bubble.life >= bubble.maxLife) {
          scene.remove(bubble.sprite);
          (bubble.sprite.material as THREE.SpriteMaterial).dispose();
          ((bubble.sprite.material as THREE.SpriteMaterial).map as THREE.Texture)?.dispose();
          chatBubbles.splice(i, 1);
        }
      }
    };

    // ============================================
    // Emoji Reactions System (smaller, faster)
    // ============================================
    
    interface EmojiReaction {
      sprite: THREE.Sprite;
      life: number;
      maxLife: number;
      velocityY: number;
      memberIndex: number;
    }
    
    const emojiReactions: EmojiReaction[] = [];
    const emojis = ['❤️', '👍', '🔥', '✨', '🎉', '💪', '🙌', '💯'];
    let lastEmojiTime = 0;
    const emojiInterval = 0.8;

    const createEmojiTexture = (emoji: string): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      canvas.width = 128;
      canvas.height = 128;
      
      ctx.font = '96px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 64, 64);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const spawnEmojiReaction = (currentTime: number) => {
      if (emojiReactions.length >= 8) return;
      if (currentTime - lastEmojiTime < emojiInterval) return;
      
      lastEmojiTime = currentTime;
      
      const memberIndex = Math.floor(Math.random() * memberCount);
      const member = members[memberIndex];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      const texture = createEmojiTexture(emoji);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      
      sprite.position.set(
        member.position.x + (Math.random() - 0.5) * 0.8,
        member.position.y + 0.5,
        0.3
      );
      sprite.scale.set(0.7, 0.7, 1);
      
      scene.add(sprite);
      
      emojiReactions.push({
        sprite,
        life: 0,
        maxLife: 1.5,
        velocityY: 0.8 + Math.random() * 0.4,
        memberIndex,
      });
    };

    const updateEmojiReactions = (deltaTime: number, currentTime: number) => {
      spawnEmojiReaction(currentTime);
      
      for (let i = emojiReactions.length - 1; i >= 0; i--) {
        const reaction = emojiReactions[i];
        reaction.life += deltaTime;
        
        const progress = reaction.life / reaction.maxLife;
        
        // Float up
        reaction.sprite.position.y += reaction.velocityY * deltaTime;
        
        // Fade in/out
        let opacity = 1;
        if (progress < 0.2) {
          opacity = progress / 0.2;
        } else if (progress > 0.6) {
          opacity = 1 - (progress - 0.6) / 0.4;
        }
        
        // Scale pop
        let scale = 0.7;
        if (progress < 0.15) {
          scale = 0.35 + (progress / 0.15) * 0.35;
        }
        
        (reaction.sprite.material as THREE.SpriteMaterial).opacity = opacity;
        reaction.sprite.scale.set(scale, scale, 1);
        
        if (reaction.life >= reaction.maxLife) {
          scene.remove(reaction.sprite);
          (reaction.sprite.material as THREE.SpriteMaterial).dispose();
          ((reaction.sprite.material as THREE.SpriteMaterial).map as THREE.Texture)?.dispose();
          emojiReactions.splice(i, 1);
        }
      }
    };

    // Animation loop
    let time = 0;
    let lastTime = performance.now();
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      time += deltaTime;

      // Rotate hub ring
      hubRing.rotation.z += 0.005;

      // Pulse hub
      const hubScale = 1 + Math.sin(time * 2) * 0.05;
      hub.scale.set(hubScale, hubScale, hubScale);

      // Animate members (gentle floating + pulse)
      members.forEach((member, i) => {
        const userData = member.userData;
        // Gentle floating motion
        member.position.x = userData.baseX + Math.sin(time + userData.phase) * 0.1;
        member.position.y = userData.baseY + Math.cos(time * 0.7 + userData.phase) * 0.1;
        
        // Pulse effect
        const pulse = 1 + Math.sin(time * 3 + userData.pulsePhase) * 0.1;
        member.scale.set(pulse, pulse, pulse);
      });

      // Update connection lines
      connectionLines.forEach((line, i) => {
        const positions = line.geometry.attributes.position.array as Float32Array;
        positions[3] = members[i].position.x;
        positions[4] = members[i].position.y;
        positions[5] = members[i].position.z;
        line.geometry.attributes.position.needsUpdate = true;
      });

      // Animate particles (communication between members)
      const positions = particles.geometry.attributes.position.array as Float32Array;
      particleVelocities.forEach((vel, i) => {
        vel.progress += 0.008;
        
        if (vel.progress >= 1) {
          // Reset particle to new path
          const startMember = vel.targetMember;
          const toHub = Math.random() > 0.5;
          
          if (toHub) {
            // Travel to hub then to another member
            vel.targetMember = -1; // -1 = hub
          } else {
            vel.targetMember = (startMember + Math.floor(Math.random() * (memberCount - 1)) + 1) % memberCount;
          }
          vel.progress = 0;
          
          // Set start position
          if (startMember === -1) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
          } else {
            positions[i * 3] = members[startMember].position.x;
            positions[i * 3 + 1] = members[startMember].position.y;
          }
        }

        // Interpolate position
        const startX = positions[i * 3];
        const startY = positions[i * 3 + 1];
        let endX, endY;
        
        if (vel.targetMember === -1) {
          endX = 0;
          endY = 0;
        } else {
          endX = members[vel.targetMember].position.x;
          endY = members[vel.targetMember].position.y;
        }

        // Curved path using sine wave
        const t = vel.progress;
        const curveOffset = Math.sin(t * Math.PI) * 0.5;
        const perpX = -(endY - startY);
        const perpY = endX - startX;
        const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
        
        positions[i * 3] = startX + (endX - startX) * t + (perpX / perpLen) * curveOffset;
        positions[i * 3 + 1] = startY + (endY - startY) * t + (perpY / perpLen) * curveOffset;
        positions[i * 3 + 2] = Math.sin(t * Math.PI) * 0.3;
      });
      particles.geometry.attributes.position.needsUpdate = true;

      // Rotate outer rings
      outerRing.rotation.z -= 0.002;
      dashedRing.rotation.z += 0.003;

      // Gentle camera movement
      camera.position.x = Math.sin(time * 0.2) * 0.5;
      camera.position.y = Math.cos(time * 0.15) * 0.3;
      camera.lookAt(0, 0, 0);

      // Update chat bubbles and emoji reactions
      updateChatBubbles(deltaTime, time);
      updateEmojiReactions(deltaTime, time);

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      
      // Clean up chat bubbles
      chatBubbles.forEach((bubble) => {
        scene.remove(bubble.sprite);
        (bubble.sprite.material as THREE.SpriteMaterial).dispose();
        ((bubble.sprite.material as THREE.SpriteMaterial).map as THREE.Texture)?.dispose();
      });
      
      // Clean up emoji reactions
      emojiReactions.forEach((reaction) => {
        scene.remove(reaction.sprite);
        (reaction.sprite.material as THREE.SpriteMaterial).dispose();
        ((reaction.sprite.material as THREE.SpriteMaterial).map as THREE.Texture)?.dispose();
      });
      
      // Dispose geometries and materials
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [width, height]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: width,
        height: height,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        '& canvas': {
          borderRadius: '50%',
        },
      }}
    />
  );
};

export default CommunityNetworkAnimation;
