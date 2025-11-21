// 节流
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function throttle(fn: (...args: any[]) => any, wait = 50) {
  let last = 0
  let timer: NodeJS.Timeout
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (this: any, ...args: any[]) {
    const now = Date.now()
    if (now - last >= wait) {
      last = now
      fn.apply(this, args)
    } else {
      clearTimeout(timer)
      timer = setTimeout(
        () => {
          last = Date.now()
          fn.apply(this, args)
        },
        wait - (now - last)
      )
    }
  }
}
