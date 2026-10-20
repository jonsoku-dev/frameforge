import {AbsoluteFill, useCurrentFrame, interpolate} from 'frameforge';

/**
 * 【中文提示词】
 * 创建一个星空粒子效果，要求：
 * - 生成多个随机位置和大小的小圆点
 * - 粒子闪烁效果（透明度变化）
 * - 粒子缓慢移动
 * - 不同层次的粒子（不同速度）
 * - 深色背景营造太空感
 *
 * 【效果说明】
 * 演示如何创建粒子系统效果。
 * 使用数组生成多个粒子，每个粒子有独立的动画参数。
 */

export const StarrySky = () => {
  const frame = useCurrentFrame();

  // 生成星星粒子数据
  const stars = Array.from({length: 150}, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 800;
    return {
      x: 960 + Math.cos(angle) * distance,
      y: 540 + Math.sin(angle) * distance,
      size: Math.random() * 3 + 1,
      twinkleSpeed: Math.random() * 0.5 + 0.5,
      twinkleOffset: Math.random() * 100,
      moveSpeed: Math.random() * 0.3 + 0.1,
      moveAngle: angle,
    };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a1a',
        overflow: 'hidden',
      }}
    >
      {/* 背景渐变 */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at center, #1a1a3a 0%, #0a0a1a 100%)',
        }}
      />

      {/* 星星粒子 */}
      {stars.map((star, index) => {
        // 闪烁效果
        const twinkle = interpolate(
          (frame * star.twinkleSpeed + star.twinkleOffset) % 60,
          [0, 30, 60],
          [0.3, 1, 0.3],
          {extrapolateRight: 'clamp'}
        );

        // 缓慢移动
        const moveX = Math.cos(star.moveAngle) * frame * star.moveSpeed;
        const moveY = Math.sin(star.moveAngle) * frame * star.moveSpeed;

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: star.x + moveX,
              top: star.y + moveY,
              width: star.size,
              height: star.size,
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              opacity: twinkle,
              boxShadow: `0 0 ${star.size * 2}px rgba(255, 255, 255, ${twinkle * 0.5})`,
            }}
          />
        );
      })}

      {/* 标题 */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 100,
          fontSize: 64,
          fontWeight: 'bold',
          color: '#ffffff',
          textShadow: '0 0 20px rgba(255, 255, 255, 0.8)',
        }}
      >
        星空粒子效果
      </div>

      {/* 说明 */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 100,
          fontSize: 28,
          color: '#8888aa',
        }}
      >
        使用数组生成 150 个独立动画的粒子
      </div>

      {/* 流星效果 */}
      <ShootingStar frame={frame} delay={60} />
      <ShootingStar frame={frame} delay={180} />
    </AbsoluteFill>
  );
};

// 流星组件
const ShootingStar = ({frame, delay}) => {
  const relativeFrame = frame - delay;

  if (relativeFrame < 0 || relativeFrame > 60) {
    return null;
  }

  const progress = relativeFrame / 60;
  const x = interpolate(progress, [0, 1], [-100, 2000]);
  const y = interpolate(progress, [0, 1], [200, 800]);
  const opacity = interpolate(relativeFrame, [0, 10, 50, 60], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 100,
        height: 2,
        background: 'linear-gradient(90deg, transparent, #ffffff)',
        opacity: opacity,
        transform: 'rotate(-30deg)',
      }}
    />
  );
};
