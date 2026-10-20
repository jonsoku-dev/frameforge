import {AbsoluteFill, useCurrentFrame, interpolate, Sequence} from 'frameforge';

/**
 * 【中文提示词】
 * 创建一个文字淡入淡出动画，要求：
 * - 文字从完全透明渐变到完全不透明
 * - 保持显示一段时间
 * - 然后渐变到透明
 * - 多行文字依次出现和消失
 * - 使用 interpolate 控制 opacity 属性
 *
 * 【效果说明】
 * 演示如何使用 interpolate 函数创建平滑的淡入淡出效果。
 * 适用于标题、说明文字等场景。
 */

export const FadeInFadeOut = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a1a',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Sequence from={0} durationInFrames={40}>
        <FadeText text="淡入淡出效果演示" delay={0} />
      </Sequence>

      <Sequence from={30} durationInFrames={40}>
        <FadeText text="使用 interpolate 函数" delay={30} />
      </Sequence>

      <Sequence from={60} durationInFrames={40}>
        <FadeText text="控制 opacity 属性" delay={60} />
      </Sequence>
    </AbsoluteFill>
  );
};

const FadeText = ({text, delay}) => {
  const frame = useCurrentFrame();
  const relativeFrame = frame - delay;

  // 淡入：0-20帧，保持：20-30帧，淡出：30-50帧
  const opacity = interpolate(relativeFrame, [0, 20, 30, 50], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const scale = interpolate(relativeFrame, [0, 20], [0.8, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity: opacity,
        transform: `scale(${scale})`,
        fontSize: 72,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 40,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
};
