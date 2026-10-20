import {AbsoluteFill, useCurrentFrame, interpolate, Sequence} from 'frameforge';

/**
 * 【中文提示词】
 * 创建一个滑动切换动画，要求：
 * - 场景从右侧滑入
 * - 旧场景向左滑出
 * - 支持水平滑动
 * - 平滑的过渡效果
 * - 使用 translate 实现位移
 *
 * 【效果说明】
 * 演示如何在场景之间创建滑动过渡效果。
 * 使用 interpolate 控制 transform 的 translate 属性。
 */

export const SlideTransition = () => {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={90}>
        <Scene1 />
      </Sequence>

      <Sequence from={90} durationInFrames={90}>
        <SlideInScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// 第一个场景
const Scene1 = () => {
  const frame = useCurrentFrame();

  // 在 60-90 帧时向左滑出
  const slideOut = interpolate(frame, [60, 90], [0, -1920], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#3498db',
        transform: `translateX(${slideOut}px)`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 120,
          fontWeight: 'bold',
          color: '#ffffff',
          textAlign: 'center',
        }}
      >
        场景 1
        <div style={{fontSize: 48, marginTop: 40}}>向左滑出</div>
      </div>
    </AbsoluteFill>
  );
};

// 第二个场景（从右滑入）
const SlideInScene = () => {
  const frame = useCurrentFrame();
  const relativeFrame = frame - 90;

  // 在 0-30 帧时从右侧滑入
  const slideIn = interpolate(relativeFrame, [0, 30], [1920, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#e74c3c',
        transform: `translateX(${slideIn}px)`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 120,
          fontWeight: 'bold',
          color: '#ffffff',
          textAlign: 'center',
        }}
      >
        场景 2
        <div style={{fontSize: 48, marginTop: 40}}>从右滑入</div>
      </div>
    </AbsoluteFill>
  );
};
