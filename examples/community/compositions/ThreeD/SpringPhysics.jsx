import {AbsoluteFill, useCurrentFrame, interpolate, spring} from 'frameforge';

/**
 * 【中文提示词】
 * 创建一个弹性物理动画，要求：
 * - 使用 spring 函数实现弹性效果
 * - 展示不同的弹簧参数（damping, stiffness, mass）
 * - 元素像弹簧一样弹跳
 * - 多个元素依次弹入
 * - 可以调整弹性参数改变效果
 *
 * 【效果说明】
 * 演示 spring 函数，创建逼真的弹性物理效果。
 * 调整 damping（阻尼）、stiffness（刚度）、mass（质量）参数可以改变弹性特性。
 */

export const SpringPhysics = () => {
  const frame = useCurrentFrame();

  const demos = [
    {
      title: '高阻尼',
      config: {damping: 20, stiffness: 100, mass: 1},
      color: '#3498db',
      delay: 0,
      description: 'damping: 20 - 衰减快',
    },
    {
      title: '低阻尼',
      config: {damping: 5, stiffness: 100, mass: 1},
      color: '#e74c3c',
      delay: 20,
      description: 'damping: 5 - 弹跳多',
    },
    {
      title: '高刚度',
      config: {damping: 10, stiffness: 200, mass: 1},
      color: '#2ecc71',
      delay: 40,
      description: 'stiffness: 200 - 快速',
    },
    {
      title: '低刚度',
      config: {damping: 10, stiffness: 50, mass: 1},
      color: '#f39c12',
      delay: 60,
      description: 'stiffness: 50 - 慢速',
    },
    {
      title: '大质量',
      config: {damping: 10, stiffness: 100, mass: 3},
      color: '#9b59b6',
      delay: 80,
      description: 'mass: 3 - 沉重',
    },
    {
      title: '小质量',
      config: {damping: 10, stiffness: 100, mass: 0.3},
      color: '#1abc9c',
      delay: 100,
      description: 'mass: 0.3 - 轻盈',
    },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
      }}
    >
      <h1
        style={{
          fontSize: 64,
          fontWeight: 'bold',
          color: '#ffffff',
          marginBottom: 20,
        }}
      >
        弹性物理动画
      </h1>

      <p
        style={{
          fontSize: 32,
          color: '#888',
          marginBottom: 80,
        }}
      >
        调整 damping、stiffness、mass 参数
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 40,
          justifyContent: 'center',
          maxWidth: 1600,
        }}
      >
        {demos.map((demo, index) => (
          <SpringDemo key={index} {...demo} frame={frame} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const SpringDemo = ({title, config, color, delay, description, frame}) => {
  // Spring 动画
  const springValue = spring({
    frame: frame - delay,
    fps: 30,
    config: config,
  });

  // 限制在 0-1 之间
  const clampedSpring = Math.min(Math.max(springValue, 0), 1.2);

  // 弹跳时的缩放效果
  const scale = clampedSpring;

  // Y 轴位置（从上方掉落）
  const y = interpolate(clampedSpring, [0, 1], [-300, 0]);

  // 旋转（配合弹跳）
  const rotation = interpolate(clampedSpring, [0, 1], [180, 0]);

  // 透明度
  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: opacity,
      }}
    >
      {/* 弹跳的球 */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          backgroundColor: color,
          transform: `translateY(${y}px) scale(${scale}) rotate(${rotation}deg)`,
          boxShadow: `0 10px 40px ${color}80`,
          marginBottom: 40,
        }}
      />

      {/* 标题 */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 'bold',
          color: color,
          marginBottom: 10,
        }}
      >
        {title}
      </div>

      {/* 描述 */}
      <div
        style={{
          fontSize: 20,
          color: '#888',
          textAlign: 'center',
        }}
      >
        {description}
      </div>

      {/* 实时值 */}
      <div
        style={{
          fontSize: 24,
          color: '#ffffff',
          marginTop: 10,
          fontFamily: 'monospace',
        }}
      >
        value: {clampedSpring.toFixed(2)}
      </div>
    </div>
  );
};
