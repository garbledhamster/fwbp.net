// One local timeline for rules, animation and scheduled work. Dialogs only hold
// references; no particular surface owns the right to resume another surface.
export function createSuspensionClock() {
  let holders = 0;
  let offset = 0;
  let pausedAt;
  const pending = new Set();
  const now = () => (holders ? pausedAt : performance.now()) - offset;
  const epoch = Date.now() - performance.now();
  function arm(task) {
    if (holders) return;
    if (task.frame) {
      task.native = requestAnimationFrame(() => {
        pending.delete(task);
        task.callback(now());
      });
    } else {
      task.native = setTimeout(() => {
        pending.delete(task);
        task.callback();
      }, Math.max(0, task.at - now()));
    }
  }
  function cancel(task) {
    if (!task) return;
    pending.delete(task);
    if (task.frame) cancelAnimationFrame(task.native);
    else clearTimeout(task.native);
  }
  function timeout(callback, delay = 0) {
    const task = { callback, at: now() + delay };
    pending.add(task);
    arm(task);
    return task;
  }
  function frame(callback) {
    const task = { callback, frame: true };
    pending.add(task);
    arm(task);
    return task;
  }
  function interval(callback, delay) {
    const interval = {};
    const tick = () => {
      callback();
      if (!interval.cancelled) interval.task = timeout(tick, delay);
    };
    interval.task = timeout(tick, delay);
    return interval;
  }
  function clearInterval(interval) {
    if (!interval) return;
    interval.cancelled = true;
    cancel(interval.task);
  }
  function acquire() {
    if (!holders++) {
      pausedAt = performance.now();
      for (const task of pending) {
        if (task.frame) cancelAnimationFrame(task.native);
        else clearTimeout(task.native);
      }
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--holders) return;
      offset += performance.now() - pausedAt;
      for (const task of pending) arm(task);
    };
  }
  return { now, dateNow: () => epoch + now(), timeout, frame, cancel, interval, clearInterval, acquire, get suspended() { return holders > 0; } };
}
