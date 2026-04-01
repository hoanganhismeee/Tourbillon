// Near-3D tilt effect using Framer Motion MotionValues + spring physics.
// Maps mouse position within the element to rotateX/rotateY (-8° to 8°).
// Spring (stiffness 200, damping 30) springs back to 0 on mouseleave.
import { useMotionValue, useSpring } from 'framer-motion';

export function useTilt() {
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);

  const rotateX = useSpring(rawRotateX, { stiffness: 200, damping: 30 });
  const rotateY = useSpring(rawRotateY, { stiffness: 200, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width  / 2;
    const centerY = rect.top  + rect.height / 2;
    // Map cursor offset to ±8 degrees
    rawRotateY.set(((e.clientX - centerX) / (rect.width  / 2)) *  8);
    rawRotateX.set(((e.clientY - centerY) / (rect.height / 2)) * -8);
  };

  const handleMouseLeave = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
  };

  return { rotateX, rotateY, handleMouseMove, handleMouseLeave };
}
