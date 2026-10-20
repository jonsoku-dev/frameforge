import './packages-math/paths.tsx';
import './packages-math/shapes.tsx';
import './packages-math/noise.tsx';
import './packages-math/animation-utils.tsx';
import './packages-math/motion-blur.tsx';
import assert from 'node:assert/strict';
import test from 'node:test';
import {makeCircle, evolvePath, noise2D, makeTransform, Trail, MotionBlur} from 'frameforge';
test('math packages are reachable from the frameforge entry', () => {
  assert.equal(typeof noise2D(1, 0.5, 0.5), 'number');
  assert.equal(evolvePath(1, makeCircle({radius: 10}).path).strokeDashoffset, 0);
  assert.equal(typeof makeTransform, 'function'); assert.equal(typeof Trail, 'function'); assert.equal(typeof MotionBlur, 'function');
});
