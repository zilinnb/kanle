/**
 * 动态照片（Motion Photo）提取服务
 *
 * Android 手机（OPPO/三星/小米/Google Pixel 等）拍摄的"动态照片"/"实况图"
 * 本质上是一个 JPEG 文件，在 JPEG 数据之后追加了 MP4 视频数据。
 * 本服务从单个文件中拆分出图片和视频两部分。
 *
 * 文件结构：
 * [JPEG SOI (FFD8) ... JPEG EOI (FFD9)] [可选 XMP/SEF 元数据] [MP4 ftyp box ...]
 *
 * 提取策略：
 * 1. 搜索 JPEG EOI 标记 (FFD9)
 * 2. 在 EOI 之后搜索 MP4 ftyp box 标记 ("ftyp" = 0x66 0x74 0x79 0x70)
 * 3. ftyp 前 4 字节是 box size，MP4 数据从 box size 开始
 * 4. 以 ftyp 位置为界拆分缓冲区
 */

export interface ExtractedMotionPhoto {
  image: Buffer;
  video: Buffer;
  imageMime: string;
  videoMime: string;
}

/**
 * 从缓冲区中查找子序列的起始位置
 * 从指定偏移量开始搜索
 */
function indexOfSequence(
  buf: Buffer,
  sequence: Buffer,
  startOffset = 0
): number {
  for (let i = startOffset; i <= buf.length - sequence.length; i++) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      if (buf[i + j] !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}

/**
 * 从动态照片缓冲区中提取图片和视频
 *
 * @param buf 上传的文件缓冲区
 * @returns 提取结果，如果文件不包含嵌入视频则返回 null
 */
export function extractMotionPhoto(
  buf: Buffer
): ExtractedMotionPhoto | null {
  if (!buf || buf.length < 100) return null;

  // 必须以 JPEG SOI 标记开头
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  // 搜索 JPEG EOI 标记 (FFD9)
  const eoiMarker = Buffer.from([0xff, 0xd9]);
  const eoiPos = indexOfSequence(buf, eoiMarker, 2);
  if (eoiPos < 0) return null;

  // EOI 标记占 2 字节，之后的数据可能包含嵌入的视频
  const afterEoi = eoiPos + 2;
  if (afterEoi >= buf.length) return null;

  // 搜索 MP4 ftyp box 标记
  // ftyp box 结构: [4字节size][ftyp][4字节brand]...
  const ftypMarker = Buffer.from("ftyp", "ascii"); // 0x66 0x74 0x79 0x70
  const ftypPos = indexOfSequence(buf, ftypMarker, afterEoi);
  if (ftypPos < 0) return null;

  // ftyp 标记前 4 字节是 box size（大端 uint32）
  // MP4 数据从 box size 字段开始
  const boxStart = ftypPos - 4;
  if (boxStart < afterEoi) return null;

  // 验证 box size 是否合理（不超过剩余缓冲区大小）
  const boxSize = buf.readUInt32BE(boxStart);
  if (boxSize < 8 || boxSize > buf.length - boxStart + 100) {
    // box size 可能不准确（某些厂商格式），但仍尝试提取
  }

  // 拆分缓冲区
  const imageBuf = buf.subarray(0, afterEoi); // 包含完整的 JPEG 数据
  const videoBuf = buf.subarray(boxStart); // 从 MP4 box 开始

  // 验证视频数据不为空且足够大（至少有 ftyp box）
  if (videoBuf.length < 16) return null;

  return {
    image: imageBuf,
    video: videoBuf,
    imageMime: "image/jpeg",
    videoMime: "video/mp4",
  };
}

/**
 * 检测文件是否为动态照片（包含嵌入视频）
 */
export function isMotionPhoto(buf: Buffer): boolean {
  return extractMotionPhoto(buf) !== null;
}
