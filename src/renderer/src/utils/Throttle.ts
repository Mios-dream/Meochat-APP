// 节流
export default function throttle(fn: Function, wait = 50) {
  let last = 0
  let timer: any = null
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
        wait - (now - last),
      )
    }
  }
}
