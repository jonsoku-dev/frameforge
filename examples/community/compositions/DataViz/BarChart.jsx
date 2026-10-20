import {AbsoluteFill, useCurrentFrame, interpolate, spring} from 'frameforge';

/**
 * 【中文提示词】
 * 创建一个柱状图生长动画，要求：
 * - 显示多个数据柱
 * - 每个柱子从底部向上生长
 * - 使用不同的延迟时间
 * - 显示数据标签和数值
 * - 支持自定义颜色
 *
 * 【效果说明】
 * 演示如何创建动态柱状图，使用 spring 动画让柱子生长更有弹性。
 */

export const BarChart = () => {
  const frame = useCurrentFrame();

  const data = [
    {label: '一月', value: 65, color: '#3498db'},
    {label: '二月', value: 85, color: '#e74c3c'},
    {label: '三月', value: 45, color: '#2ecc71'},
    {label: '四月', value: 95, color: '#9b59b6'},
    {label: '五月', value: 75, color: '#f39c12'},
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1e1e1e',
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
          marginBottom: 80,
        }}
      >
        柱状图动画
      </h1>

      {/* 图表容器 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 40,
          height: 500,
          width: '100%',
          maxWidth: 1400,
          padding: 40,
          backgroundColor: '#2a2a2a',
          borderRadius: 20,
          position: 'relative',
        }}
      >
        {/* Y轴刻度线 */}
        {[0, 25, 50, 75, 100].map((value) => (
          <div
            key={value}
            style={{
              position: 'absolute',
              left: 0,
              top: `${((100 - value) / 100) * 100}%`,
              width: '100%',
              borderTop: '1px solid #444',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: -50,
                fontSize: 20,
                color: '#888',
              }}
            >
              {value}
            </span>
          </div>
        ))}

        {data.map((item, index) => (
          <Bar
            key={index}
            {...item}
            delay={index * 15}
            frame={frame}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: 80,
          fontSize: 32,
          color: '#888',
        }}
      >
        使用 spring 实现弹性生长
      </div>
    </AbsoluteFill>
  );
};

const Bar = ({label, value, color, delay, frame}) => {
  // Spring 动画
  const growth = spring({
    frame: frame - delay,
    fps: 30,
    config: {
      damping: 10,
      stiffness: 100,
      mass: 0.8,
    },
  });

  // 限制在 0-1 之间
  const clampedGrowth = Math.min(Math.max(growth, 0), 1);

  // 柱子高度（最大值是 100）
  const barHeight = (value / 100) * 400 * clampedGrowth;

  // 数值淡入
  const opacity = interpolate(frame - delay, [20, 40], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        height: '100%',
        justifyContent: 'flex-end',
      }}
    >
      {/* 数值标签 */}
      <div
        style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: color,
          marginBottom: 10,
          opacity: opacity,
        }}
      >
        {Math.round(value * clampedGrowth)}
      </div>

      {/* 柱子 */}
      <div
        style={{
          width: '80%',
          height: barHeight,
          backgroundColor: color,
          borderRadius: 8,
          boxShadow: `0 0 20px ${color}40`,
        }}
      />

      {/* X轴标签 */}
      <div
        style={{
          fontSize: 24,
          color: '#ffffff',
          marginTop: 15,
          fontWeight: 'bold',
        }}
      >
        {label}
      </div>
    </div>
  );
};
