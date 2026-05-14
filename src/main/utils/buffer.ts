import iconv from 'iconv-lite'

/** 解码子进程输出 Buffer */
export function decodeBuffer(buffer: Buffer): string {
  if (process.platform === 'win32') {
    const utf8Text = buffer.toString('utf8')
    if (!utf8Text.includes('�')) {
      return utf8Text
    }
    try {
      return iconv.decode(buffer, 'gbk')
    } catch {
      return utf8Text
    }
  }
  return buffer.toString('utf8')
}
