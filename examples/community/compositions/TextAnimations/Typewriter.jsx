import {AbsoluteFill, useCurrentFrame, interpolate} from 'frameforge';

/**
 * 【中文提示词】
 * 创建一个打字机效果动画，要求：
 * - 文字逐个字符显示
 * - 每个字符之间有短暂延迟
 * - 显示时闪烁光标
 * - 文字显示完成后光标消失
 * - 模拟真实的打字体验
 *
 * 【效果说明】
 * 演示如何创建打字机效果，通过计算当前应该显示的字符数量。
 * 使用 Math.floor 和 frame 计算来实现逐字显示。
 */

export const Typewriter = () => {
  const frame = useCurrentFrame();
  const text = '这是一个打字机效果演示！';
  const speed = 3; // 每隔几帧显示一个字符

  // 计算当前应该显示的字符数
  const currentLength = Math.floor(frame / speed);
  const visibleText = text.slice(0, currentLength);

  // 光标闪烁
  const cursorOpacity = interpolate(
    frame % 30, // 每30帧一个周期
    [0, 15, 30],
    [1, 0, 1],
    {extrapolateRight: 'clamp'}
  );

  // 文字显示完成后隐藏光标
  const showCursor = currentLength <= text.length;
  const finalCursorOpacity = showCursor ? cursorOpacity : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0f0f0f',
        fontFamily: 'Courier New, monospace',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 64,
          color: '#00ff00',
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {visibleText}
        <span
          style={{
            opacity: finalCursorOpacity,
            display: 'inline-block',
            width: 4,
            height: 64,
            backgroundColor: '#00ff00',
            marginLeft: 4,
            verticalAlign: 'middle',
          }}
        >
          |
        </span>
      </div>

      <div
        style={{
          marginTop: 60,
          fontSize: 32,
          color: '#888888',
          textAlign: 'center',
        }}
      >
        使用 frame 和 slice 实现逐字显示
      </div>
    </AbsoluteFill>
  );
};
